import { phraseFound } from "../text/normalize.js";
import { toText } from "../text/extract.js";
import { THRESHOLDS, proseVolume, slugLabelOverlap } from "./thresholds.js";
import { matchesChallengePath, matchesChallengeSignature, type Rule } from "../rules/challenge.js";
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
}

export interface SignalResult {
  readonly signals: Signals;
  readonly text: string;
  readonly matchedClaims: readonly string[];
  readonly missedClaims: readonly string[];
  /** Which rule fired, for --explain-fetch. */
  readonly firedRule: Rule | null;
}

const HEAD_MARKER = /<meta[^>]+property=["']og:type["'][^>]+content=["']article["']|"@type"\s*:\s*"(NewsArticle|Article|Report)"|"datePublished"/i;

/** Cloudflare's documented challenge marker. Present on every Challenge Page
 *  type, in every language, at any body length - and the challenge page
 *  REPLACES the resource, so a body carrying it cannot be the document. */
function hasChallengeHeader(headers: Readonly<Record<string, string>>): boolean {
  const v = headers["cf-mitigated"];
  return typeof v === "string" && v.toLowerCase().includes("challenge");
}

export function computeSignals(input: SignalInput): SignalResult {
  const text = toText(input.rawBody);
  const matchedClaims = input.claims.filter((c) => phraseFound(text, c));
  const missedClaims = input.claims.filter((c) => !phraseFound(text, c));
  const sigRule = matchesChallengeSignature(text);
  const pathRule = matchesChallengePath(input.finalUrl);

  return {
    text,
    matchedClaims,
    missedClaims,
    firedRule: pathRule ?? sigRule,
    signals: {
      matched: matchedClaims.length,
      total: input.claims.length,
      proseChars: proseVolume(text),
      slugLabelOverlap: slugLabelOverlap(text, input.finalUrl, input.sourceLabel ?? ""),
      headMarkers: HEAD_MARKER.test(input.rawBody),
      challengeHeader: hasChallengeHeader(input.headers),
      challengePath: pathRule !== null,
      // A signature only vetoes on a SHORT body. A real article discussing bot
      // walls matches the wording; the length conjunction is what keeps it a
      // document. The prose floor catches anything this misses.
      challengeSignature: sigRule !== null && proseVolume(text) < THRESHOLDS.maxChallengeChars,
      documentGone: input.status === 404 || input.status === 410,
    },
  };
}
