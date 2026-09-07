import { computeSignals } from "./classify/signals.js";
import { verdict } from "./classify/verdict.js";
import { defaultFetcher } from "./fetch/default-fetcher.js";
import { nextAction, type Attempt } from "./fetch/ladder.js";
import { isPdf } from "./fetch/pdf.js";
import { EMPTY_RESPONSE, type Fetcher, type RawResponse, type RungId } from "./fetch/types.js";
import { dedupeEvidence, excerptFor, type Evidence } from "./text/excerpt.js";
import { norm } from "./text/normalize.js";
import { buildResult, type CitationResult } from "./io/evidence.js";
import type { RuleSet } from "./rules/load.js";

export interface CheckOptions {
  /** Bring your own reader - a headless browser, a paid proxy - behind the
   *  same interface. The bundled ladder is the reference implementation. */
  readonly fetcher?: Fetcher;
  /** The author's own footnote text. Feeds C1's content-word pool, which is
   *  how a PDF at a hashed URL with no title still has something to correlate
   *  against. Optional; omitting it only makes an accusation harder to earn. */
  readonly sourceLabel?: string;
  /** Bundled-plus-local challenge rules, from `loadRules()`. Omitting it uses
   *  the bundled snapshot only - the same behavior as before this option
   *  existed. */
  readonly rules?: RuleSet;
}

// NOTE: there is deliberately no `failOn` here. check() returns ONE result and
// cannot fail a run; run-level policy belongs to the caller and lives in the
// CLI's classifyRun. An option the function ignores is worse than no option.

/**
 * THE FRONT DOOR. It owns the verdict.
 *
 * There is deliberately no fetch-level public entry point that returns text and
 * leaves the caller to decide what it means. In the origin repo the keystone
 * mapping lived in the caller, a second caller reimplemented it inline, and
 * that copy diverged three ways on the day the rule landed. Comments do not
 * bind; the ladder has to be un-copyable.
 */
export async function check(
  url: string,
  claims: readonly string[],
  opts: CheckOptions = {},
): Promise<CitationResult> {
  // An empty or whitespace-only claim matches EVERYTHING ("".includes("") is
  // true), so it would mint a `supported` verdict with a null excerpt - an
  // attestation with nothing behind it. The CLI is protected by
  // parseClaimsFile, but check() is the exported front door and has to defend
  // itself. Rejected at the door, before any IO, because it is a caller bug
  // rather than a fetch failure: an empty ARRAY is still fine and reads
  // `unclaimed`.
  //
  // The predicate is `norm()`, NOT `trim()`, because norm() is what the
  // matcher runs. Anything norm() folds to "" matches every document exactly
  // as "" does, and trim() does not see it: "," and ",,," survive trim (norm
  // deletes commas) and U+200B is not whitespace to JS at all. Testing a
  // weaker predicate than the matcher uses is how the guard let a false
  // attestation through.
  const blank = claims.findIndex((c) => typeof c !== "string" || !norm(c));
  if (blank !== -1) {
    throw new TypeError(
      `check(${url}): claim at index ${blank} is empty or whitespace-only once normalized; an empty claim matches every document`,
    );
  }

  // The local `rules.hosts` must reach the default fetcher's UA/identity
  // logic - a local host rule that loads and validates but is never consulted
  // is the same silent-no-op failure that signatures/paths had (Critical 1).
  const fetcher = opts.fetcher ?? defaultFetcher(opts.rules ? { hosts: opts.rules.hosts } : {});
  const pdfUrl = isPdf(url);
  const history: Attempt[] = [];
  const attempted: RungId[] = [];
  // EVERY rung's computation is kept, not just the longest. The rung is carried
  // WITH the signals, not read off the end of the history: taking the last
  // attempted rung mis-attributes evidence whenever an earlier rung is the one
  // that read the document.
  const reads: { rung: RungId; computed: ReturnType<typeof computeSignals> }[] = [];

  for (;;) {
    const action = nextAction(history, fetcher.rungs, pdfUrl);
    if (action.kind === "stop") break;

    // A Fetcher must not throw - see the contract on the interface. The three
    // bundled rungs all return EMPTY_RESPONSE on failure. A third-party
    // fetcher that throws anyway degrades to an unread rung rather than
    // aborting a run midway through a document, and is WARNED about rather
    // than swallowed.
    let response: RawResponse;
    try {
      response = await fetcher.fetch(url, action.rung);
    } catch (e) {
      console.warn(
        `warn fetcher rung "${action.rung}" threw for ${url}: ${e instanceof Error ? e.message : String(e)}`,
      );
      response = EMPTY_RESPONSE;
    }
    attempted.push(action.rung);
    const computed = computeSignals({
      rawBody: response.rawBody,
      headers: response.headers,
      finalUrl: response.finalUrl || url,
      status: response.status,
      claims,
      sourceLabel: opts.sourceLabel ?? "",
      ...(opts.rules ? { rules: opts.rules } : {}),
    });

    reads.push({ rung: action.rung, computed });

    history.push({
      rung: action.rung,
      proseChars: computed.signals.proseChars,
      challenged:
        computed.signals.challengeHeader ||
        computed.signals.challengePath ||
        computed.signals.challengeSignature,
    });
  }

  if (reads.length === 0) {
    return buildResult({
      url, verdict: claims.length === 0 ? "unclaimed" : "unreachable",
      evidence: [], rungsAttempted: attempted, rungsAvailable: fetcher.rungs,
      missed: [], isPdfUrl: pdfUrl,
    });
  }

  // A full match is its own proof of a read (verdict.ts), so a rung that
  // reached `supported` settles it. Discarding that read merely because a later
  // rung returned a longer body is how a citation the tool ALREADY verified
  // becomes an accusation - and the ladder escalates on ANY sub-floor read, so
  // a short real article followed by a fat block page is the ordinary case,
  // not an exotic one.
  const proven = reads.find((r) => verdict(r.computed.signals) === "supported");
  const won = proven ?? reads.reduce((a, b) =>
    b.computed.signals.proseChars > a.computed.signals.proseChars ? b : a);

  // A claim located by ANY rung is proven present - a match is proof of a read.
  // Assembling across reads is what stops an `unsupported` verdict that names
  // nothing, and it keeps verdict() the only place a verdict is decided.
  //
  // Without this, the match count came from the single winning read while
  // `missed` was the intersection across all of them, so a union that covered
  // every claim with no single rung covering them all returned `unsupported`
  // with an EMPTY `missed` and no evidence: a build failed, and the tool named
  // nothing it could be failed for.
  const locatedBy = new Map<string, (typeof reads)[number]>();
  for (const r of reads) {
    for (const c of r.computed.matchedClaims) if (!locatedBy.has(c)) locatedBy.set(c, r);
  }
  const missedAll = claims.filter((c) => !locatedBy.has(c));

  const v = verdict({ ...won.computed.signals, matched: claims.length - missedAll.length });

  // Each claim's excerpt and rung come from the read that actually LOCATED it.
  // Quoting the winning read for a claim another rung found would attach a
  // passage to a document it did not come from.
  const evidence: Evidence[] = claims.flatMap((claim) => {
    const r = locatedBy.get(claim);
    return r ? [{ claims: [claim], excerpt: excerptFor(r.computed.text, claim), rung: r.rung }] : [];
  });

  return buildResult({
    url,
    verdict: v,
    evidence: dedupeEvidence(evidence),
    rungsAttempted: attempted,
    rungsAvailable: fetcher.rungs,
    // The INTERSECTION across every read, never one rung's miss list. A claim
    // located on `node` and absent from `curl`'s block page was located; naming
    // it here would accuse the author of a citation the tool itself verified.
    // Since the verdict is now computed from the same union, an `unsupported`
    // result cannot reach here with this list empty.
    missed: v === "unsupported" ? missedAll : [],
    isPdfUrl: pdfUrl,
    firedRule: won.computed.firedRule,
  });
}
