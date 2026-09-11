import { isBlocked, verdict } from "./classify/verdict.js";
import { defaultFetcher } from "./fetch/default-fetcher.js";
import { bestReadable, readSource, type Read } from "./fetch/read-source.js";
import type { Fetcher } from "./fetch/types.js";
import { dedupeEvidence, excerptFor, type Evidence } from "./text/excerpt.js";
import { belowClaimFloor, claimFloorMessage } from "./io/claims.js";
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
 *
 * Since plan 1.2 the loop itself lives in fetch/read-source.ts (spec 6.6),
 * shared with reachability() and kept off the public surface for the same
 * reason: a caller holding raw reads can assemble a verdict this function
 * never issued.
 */
export async function check(
  url: string,
  claims: readonly string[],
  opts: CheckOptions = {},
): Promise<CitationResult> {
  // Claims are validated at the door, before any IO, because a claim the tool
  // could never verify is a caller bug rather than a fetch failure. An empty
  // ARRAY is still fine and reads `unclaimed`.
  //
  // Two refusals, in this order. A non-string is a type error and is checked
  // first so that norm() is never handed one. Then the floor (spec 7.3),
  // which SUBSUMES the empty-claim guard that stood here: `""` matches every
  // document ("".includes("") is true) and would mint `supported` with a null
  // excerpt, and so do "," and U+200B, both of which survive trim() while norm()
  // folds them away - the predicate has to be the MATCHER's. All three are 0
  // normalized characters and all three are under the floor.
  //
  // parseClaimsFile refuses the same two things with the same message
  // builder; check() is the exported front door and defends itself, because
  // a programmatic caller never passes through the loader.
  const notString = claims.findIndex((c) => typeof c !== "string");
  if (notString !== -1) {
    throw new TypeError(`check(${url}): claim at index ${notString} is not a string`);
  }
  const short = claims.findIndex(belowClaimFloor);
  if (short !== -1) {
    throw new TypeError(claimFloorMessage(`check(${url}): claim at index ${short}`, claims[short] as string));
  }

  // The local `rules.hosts` must reach the default fetcher's UA/identity
  // logic - a local host rule that loads and validates but is never consulted
  // is the same silent-no-op failure that signatures/paths had (Critical 1).
  const fetcher = opts.fetcher ?? defaultFetcher(opts.rules ? { hosts: opts.rules.hosts } : {});
  // THE ONE LADDER (spec 6.6). Every rung's read comes back, in order, with
  // its rung attached - the rung is carried WITH the signals, not read off the
  // end of the history, because taking the last attempted rung mis-attributes
  // evidence whenever an earlier rung is the one that read the document.
  const { reads, attempted, pdfUrl } = await readSource(url, claims, {
    fetcher,
    sourceLabel: opts.sourceLabel ?? "",
    ...(opts.rules ? { rules: opts.rules } : {}),
  });

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
  // becomes an accusation - and the HTML ladder escalates on ANY sub-floor
  // read, so a short real article followed by a fat block page is the ordinary
  // case, not an exotic one. HTML is load-bearing: `nextAction` returns from
  // its `isPdfUrl` branch before the escalation rule is reached
  // (fetch/ladder.ts), so a PDF citation gets one rung whatever it read and
  // this route needs two. The unqualified form of this sentence shipped false
  // for a PDF URL until 2026-09-09.
  const proven = reads.find((r) => verdict(r.computed.signals) === "supported");
  // Rule 2 (spec 6.6): failing a proof, the READABLE read with the most prose
  // - not the largest read. A fat challenge page over the floor used to
  // outrank a smaller readable document, so the verdict was computed on the
  // wall and a partial miss the document had positively shown became
  // `unreachable`. This is one of the two places plan 1.2 moves a verdict
  // toward accusation (the other is the ladder's escalation - the climb
  // predicate is `nextAction` in fetch/ladder.ts, driven by the readable
  // bit read-source.ts supplies. The two compose: after an N4/N5-only veto
  // the readable second read wins here even at equal prose, which is the
  // ACCEPTED EXPOSURE pinned in test/check.test.ts.), and it does so only
  // where a readable read exists to accuse from; the union below still
  // decides WHICH claims are missed.
  // Rule 3: with no readable read either, the largest read carries the
  // verdict to verdict(), which returns `unreachable` for a vetoed or
  // sub-floor body - the 6546176 route, kept so that no unlicensed verdict
  // moves. (Its one inherited shape, a full match assembled across unvetoed
  // sub-floor reads, is pinned as an accepted exposure in check.test.ts.)
  const largest = reads.reduce((a, b) => (b.computed.signals.proseChars > a.computed.signals.proseChars ? b : a));
  const won = proven ?? bestReadable(reads) ?? largest;

  // A claim located by ANY rung is proven present - a match is proof of a read.
  // Assembling across reads is what stops an `unsupported` verdict that names
  // nothing, and it keeps verdict() the only place a verdict is decided.
  //
  // Without this, the match count came from the single winning read while
  // `missed` was the intersection across all of them, so a union that covered
  // every claim with no single rung covering them all returned `unsupported`
  // with an EMPTY `missed` and no evidence: a build failed, and the tool named
  // nothing it could be failed for.
  const locatedBy = new Map<string, Read>();
  for (const r of reads) {
    // A read the classifier itself vetoed is NOT the document - spec 6.2 is
    // explicit that a challenge body cannot be one. A match inside it is the
    // WALL'S text, and letting it prove a claim both mints a false attestation
    // and publishes the wall as the evidence behind it. The same skip fixes
    // attribution: without it the FIRST read to match wins, so a vetoed wall
    // carrying a claim outranks a later clean read that genuinely proves it.
    if (isBlocked(r.computed.signals)) continue;
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
