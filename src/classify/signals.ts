import { phraseFound } from "../text/normalize.js";
import { toTextRegions } from "../text/extract.js";
import { THRESHOLDS, proseVolume, slugLabelOverlap } from "./thresholds.js";
import { matchesChallengePath, matchesChallengeSignature, type Rule } from "../rules/challenge.js";
import type { RuleSet } from "../rules/load.js";
import type { Signals } from "./verdict.js";

export interface SignalInput {
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly finalUrl: string;
  /** N4's input. The classifier stays pure; the fetcher reports the number. */
  readonly status: number;
  readonly claims: readonly string[];
  /** The author's footnote text. Widens C1's content-word pool so a PDF at a
   *  hashed URL with no title is not left with nothing to correlate. */
  readonly sourceLabel?: string;
  /** Bundled-plus-local rules (Task 15's `loadRules()`). Defaults to the
   *  bundled snapshot when omitted, so every existing caller is unaffected. */
  readonly rules?: RuleSet;
}

export interface SignalResult {
  readonly signals: Signals;
  readonly text: string;
  readonly regions: readonly string[];
  /** The URL this read was actually classified under, after redirects - what
   *  the fetcher reported, or the URL asked for when it reported none.
   *
   *  REPORTED, NEVER GATING. `verdict()` does not see it and `check()` does
   *  not compare it with the citation, which is a gate left unbuilt and is
   *  disclosed as such in the README. `harvest` reports when a readable
   *  read's path differs from the cited path (spec 8.2 step 2), because a
   *  redirect to a homepage is the exposure an author has to look at before
   *  confirming a proposal. */
  readonly finalUrl: string;
  readonly matchedClaims: readonly string[];
  readonly missedClaims: readonly string[];
  /** Which rule fired, for --explain-fetch. */
  readonly firedRule: Rule | null;
}

const HEAD_MARKER = /<meta[^>]+property=["']og:type["'][^>]+content=["']article["']|"@type"\s*:\s*"(NewsArticle|Article|Report)"|"datePublished"/i;

/**
 * Header field names, lowercased, with every value that lowercased to the same
 * name kept.
 *
 * HTTP field names are case-insensitive (RFC 9110 5.1); a
 * `Record<string, string>` is not. Both bundled fetchers happen to lowercase
 * their keys, but NOTHING in `RawResponse` ever required it, so a
 * caller-supplied `CheckOptions.fetcher` - the documented
 * bring-your-own-reader escape hatch - that passed a server's own casing
 * through lost N1 and N5 silently, and a wall carrying `CF-Mitigated:
 * challenge` on a padded body came back `unsupported` with the claim named in
 * `missed`. A false accusation, produced by a detail of which reader was
 * installed. Normalising HERE makes both vetoes a property of the classifier
 * instead.
 *
 * Values are kept as a LIST rather than last-one-wins because a response
 * carrying two casings of one field is malformed and this file's whole
 * doctrine says which way to resolve a malformed input: the readers below ask
 * whether ANY value trips the veto, since a veto costs an `unreachable` and
 * the alternative costs an accusation.
 */
function byLowercasedName(headers: Readonly<Record<string, string>>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [k, v] of Object.entries(headers)) {
    const name = k.toLowerCase();
    const seen = out.get(name);
    if (seen) seen.push(v);
    else out.set(name, [v]);
  }
  return out;
}

/** Cloudflare's documented challenge marker. Present on every Challenge Page
 *  type, in every language, at any body length - and the challenge page
 *  REPLACES the resource, so a body carrying it cannot be the document. */
function hasChallengeHeader(headers: Map<string, string[]>): boolean {
  return (headers.get("cf-mitigated") ?? []).some(
    (v) => typeof v === "string" && v.toLowerCase().includes("challenge"),
  );
}

/** True when SOME `content-type` value on the response is non-textual, which
 *  is N5's first trigger. An absent header yields false - see
 *  `isTextualContentType`. */
function hasNonTextualContentType(headers: Map<string, string[]>): boolean {
  const values = headers.get("content-type");
  if (values === undefined) return !isTextualContentType(undefined);
  return values.some((v) => !isTextualContentType(v));
}

/** Content types that carry prose a reader could read. An ABSENT header is
 *  treated as textual, and that is forced rather than merely defensible: the
 *  pdftotext rung returns `headers: {}` with real extracted text, so the
 *  opposite choice would veto every PDF the tool CAN read.
 *
 *  The value is read case-insensitively - both the type itself and any
 *  parameters after the `;`, which is what makes `APPLICATION/PDF` and
 *  `Text/Html; CharSet=utf-8` behave as their lowercase spellings do. */
function isTextualContentType(raw: string | undefined): boolean {
  const t = (raw ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (t === "") return true;
  return (
    t.startsWith("text/") ||
    t === "application/xhtml+xml" ||
    t === "application/xml" ||
    t === "application/json" ||
    t.endsWith("+xml") ||
    t.endsWith("+json")
  );
}

/** Binary decoded as UTF-8 is dense with replacement characters and C0 control
 *  bytes; prose is not - and no script is, since CJK, emoji and mathematical
 *  notation all sit above U+0020. Tests the RAW body: toText's tag stripping
 *  mangles binary in ways that hide the evidence.
 *
 *  CODE POINTS on both sides of the ratio, and for the window. The scan has
 *  always counted code points (`for...of` over a string iterates them), but it
 *  used to divide by `String.length`, which counts UTF-16 units - so every
 *  astral character added two to the denominator and nothing to the numerator,
 *  halving the measured density of any body carrying them. That halving is in
 *  the UNDER-veto direction, which is the accusation direction: an emoji-laden
 *  binary body measured at half its true density and read as prose.
 *
 *  Both numbers live in THRESHOLDS; read their docstrings before touching
 *  either, because neither is calibrated and the one that looks like a
 *  tolerance is not measured as one. */
function looksBinary(rawBody: string): boolean {
  if (rawBody.length === 0) return false;
  let bad = 0;
  let seen = 0;
  for (const ch of rawBody) {
    if (seen >= THRESHOLDS.binarySampleCodePoints) break;
    seen++;
    const c = ch.codePointAt(0) ?? 0;
    if (c === 0xfffd || c === 0 || c < 0x09 || (c > 0x0d && c < 0x20)) bad++;
  }
  return seen > 0 && bad / seen > THRESHOLDS.maxBinaryDensity;
}

export function computeSignals(input: SignalInput): SignalResult {
  // Normalised ONCE, here, so no veto below can depend on how a fetcher chose
  // to case its keys. See byLowercasedName.
  const headers = byLowercasedName(input.headers);
  const regions = toTextRegions(input.rawBody);
  const text = regions.join(" ");
  const inAnyRegion = (c: string) => regions.some((r) => phraseFound(r, c));
  const matchedClaims = input.claims.filter(inAnyRegion);
  const missedClaims = input.claims.filter((c) => !inAnyRegion(c));
  const sigRule = matchesChallengeSignature(text, input.rules?.signatures);
  const pathRule = matchesChallengePath(input.finalUrl, input.rules?.paths);

  return {
    text,
    regions,
    finalUrl: input.finalUrl,
    matchedClaims,
    missedClaims,
    firedRule: pathRule ?? sigRule,
    signals: {
      matched: matchedClaims.length,
      total: input.claims.length,
      proseChars: proseVolume(text),
      slugLabelOverlap: slugLabelOverlap(text, input.finalUrl, input.sourceLabel ?? ""),
      headMarkers: HEAD_MARKER.test(input.rawBody),
      challengeHeader: hasChallengeHeader(headers),
      challengePath: pathRule !== null,
      // A signature only vetoes on a SHORT body. A real article discussing bot
      // walls matches the wording; the length conjunction is what keeps it a
      // document. That is NOT the whole story above the floor: the prose floor
      // does not catch everything this conjunction misses. A wall that matches
      // a bundled signature but is padded past ~4,500 extracted characters is
      // vetoed by neither - the signature only applies below maxChallengeChars,
      // and the floor only blocks an accusation on a SHORT body. This is a
      // known, accepted gap with no fixture in the bundled corpus (the largest
      // non-vetoed challenge fixture is 1,180 chars, comfortably under the
      // floor); see the `known-gap` fixture in fixtures/corpus.json and
      // docs/calibration-2026-09.md for the measured exposure and why the
      // thresholds were left alone rather than "fixed".
      challengeSignature: sigRule !== null && proseVolume(text) < THRESHOLDS.maxChallengeChars,
      documentGone: input.status === 404 || input.status === 410,
      notText: hasNonTextualContentType(headers) || looksBinary(input.rawBody),
    },
  };
}
