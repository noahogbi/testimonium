import { isBlocked, verdict, type Verdict } from "./classify/verdict.js";
import { buildFetcher } from "./fetch/build-fetcher.js";
import { hasUntriedClimbableRung } from "./fetch/ladder.js";
import {
  bestReadable,
  continueReading,
  readSource,
  type Read,
  type ReadSourceOptions,
} from "./fetch/read-source.js";
import type { Fetcher } from "./fetch/types.js";
import { dedupeEvidence, excerptFor, type Evidence } from "./text/excerpt.js";
import { phraseFound } from "./text/normalize.js";
import { belowClaimFloor, claimFloorMessage } from "./io/claims.js";
import { buildResult, type CitationResult } from "./io/evidence.js";
import type { RuleSet } from "./rules/load.js";
import type { Rule } from "./rules/challenge.js";
import type { SignalResult } from "./classify/signals.js";

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
  /** Declared identity for hosts that require one, e.g. sec.gov's
   *  "<app> <contact email>". testimonium ships no identity of its own, and
   *  before 0.2.0 this option existed on FetcherOptions but was reachable from
   *  nowhere: check() never passed it, so every such citation took the
   *  warn-and-use-a-browser-UA branch. Spec 11.4 said this moved to
   *  configuration; this is the wire. */
  readonly identity?: string;
}

// NOTE: there is deliberately no `failOn` here. check() returns ONE result and
// cannot fail a run; run-level policy belongs to the caller and lives in the
// CLI's classifyRun. An option the function ignores is worse than no option.

/** `firedRule` and whether it decided the verdict, from ONE read. `firedRule`
 *  is `pathRule ?? sigRule` (classify/signals.ts), so it vetoed exactly when
 *  the path veto fired, or the signature veto did - a signature on a body at
 *  or past maxChallengeChars matched and vetoed nothing. */
function firedRuleOf(c: SignalResult): { rule: Rule; vetoed: boolean } | null {
  if (!c.firedRule) return null;
  return { rule: c.firedRule, vetoed: c.signals.challengePath || c.signals.challengeSignature };
}

/**
 * Reduce every rung's read into one verdict, one evidence list and the read
 * that WON - i.e. the read the verdict and `firedRule` are computed from.
 * Module-private: nothing outside check() may assemble a verdict from raw
 * reads (see the front door's own docstring on why readSource is not
 * exported).
 *
 * Extracted from check() by Task 9 (spec 0.2.0 section 4) so the escalation
 * trigger can call it twice - once on the first climb's reads, once more on
 * the reads after one more rung is tried - without duplicating the reduction
 * itself. Logic unchanged from the pre-Task-9 body.
 *
 * ONE MORE CONSEQUENCE OF THE SECOND CALL, worth naming because the spec's
 * "escalation cannot make a verdict worse" argument does not mention it:
 * `firedRule` can change between the two calls even when `v` does NOT - stays
 * `unsupported` on both. `won` is free to move to the new, second read (it can
 * be more readable, or carry more prose) while the verdict itself is
 * unaffected, and that second read can itself carry a non-null `firedRule`: a
 * body that matches a bundled challenge signature is vetoed by it only below
 * `THRESHOLDS.maxChallengeChars` (800 chars) - so a signature-matching body
 * padded past the 4,500-char floor passes every veto, reads as an ordinary
 * readable document, and still carries the signature match as reported
 * provenance. The result stays coherent (provenance always follows the read
 * the verdict was actually computed from), so this is not a defect - only a
 * visible field the escalation call can move without moving the verdict that
 * licenses it. Since 0.7.0 that provenance says so: its `vetoed` is false.
 */
function assemble(
  claims: readonly string[],
  reads: readonly Read[],
): { v: Verdict; evidence: Evidence[]; missedAll: string[]; won: Read } {
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
    if (!r) return [];
    // Try EVERY matching region, not just the first. A region can match the
    // claim and still fail to excerpt it: `excerptFor`'s fold deliberately omits
    // norm()'s length-changing substitutions, so a body reading "6.5 billion
    // dollars" matches the claim "6.5bn dollars" while excerpting null, and a
    // description reading "6.5bn dollars" excerpts it perfectly. Stopping at the
    // first MATCHING region instead of the first EXCERPTABLE one silently
    // dropped evidence the pre-region flat lookup used to find by scanning past
    // the un-excerptable occurrence.
    //
    // Order is body first, then descriptions, so a region a reader actually sees
    // still wins over metadata whenever both can excerpt. Falling back to null
    // is correct and renders nothing; falling back to the FLAT text would return
    // exactly the join-spanning passage this release exists to prevent.
    let excerpt: string | null = null;
    for (const region of r.computed.regions) {
      if (!phraseFound(region, claim)) continue;
      excerpt = excerptFor(region, claim);
      if (excerpt !== null) break;
    }
    return [{ claims: [claim], excerpt, rung: r.rung }];
  });

  return { v, evidence: dedupeEvidence(evidence), missedAll, won };
}

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
  // buildFetcher (Task 16) is the ONE construction shared with harvest(),
  // reachability() and recheck()'s live arm - see its own docstring for why
  // this used to be four hand-copied calls. `opts` is passed straight
  // through rather than rebuilt into a fresh object here: `CheckOptions` is a
  // structural superset of `BuildFetcherOptions` (fix round 1, Important 1) -
  // rebuilding it field-by-field at this call site is exactly the kind of
  // second copy that drifts when a field is added to one but not the other.
  const fetcher = buildFetcher(opts);
  // THE ONE LADDER (spec 6.6). Every rung's read comes back, in order, with
  // its rung attached - the rung is carried WITH the signals, not read off the
  // end of the history, because taking the last attempted rung mis-attributes
  // evidence whenever an earlier rung is the one that read the document.
  //
  // Built once, above BOTH passes: `continueReading` below resumes with this
  // SAME options object, and `CheckOptions` is not substitutable for it -
  // `fetcher` is optional on the former, required on the latter
  // (fetch/read-source.ts).
  const readOpts: ReadSourceOptions = {
    fetcher,
    ...(opts.sourceLabel ? { sourceLabel: opts.sourceLabel } : {}),
    ...(opts.rules ? { rules: opts.rules } : {}),
  };
  const source = await readSource(url, claims, readOpts);

  if (source.reads.length === 0) {
    return buildResult({
      url, verdict: claims.length === 0 ? "unclaimed" : "unreachable",
      evidence: [], rungsAttempted: source.attempted, rungsAvailable: fetcher.rungs,
      missed: [], isPdfUrl: source.pdfUrl,
    });
  }

  let reads = source.reads;
  let attempted = source.attempted;
  let a = assemble(claims, reads);

  // Escalate before accusing (spec 0.2.0 section 4). `unsupported` is the only
  // verdict that accuses an author, and the ladder stops at the first readable
  // read - so a shell whose chrome clears the prose floor ends the climb with
  // the document still unread. Looking once more costs one fetch and is spent
  // only on the outcome the keystone rule cares most about.
  //
  // This fires on EVERY unsupported with a rung untried, which includes the
  // ordinary healthy-page case, not just a shell. That cost is accepted; the
  // origin retried on every miss too.
  if (a.v === "unsupported" && hasUntriedClimbableRung(source.attempted, fetcher.rungs, source.pdfUrl)) {
    const more = await continueReading(url, claims, readOpts, source);
    reads = more.reads;
    attempted = more.attempted;
    a = assemble(claims, reads);
  }

  return buildResult({
    url,
    verdict: a.v,
    evidence: a.evidence,
    rungsAttempted: attempted,
    rungsAvailable: fetcher.rungs,
    // The INTERSECTION across every read, never one rung's miss list. A claim
    // located on `node` and absent from `curl`'s block page was located; naming
    // it here would accuse the author of a citation the tool itself verified.
    // Since the verdict is now computed from the same union, an `unsupported`
    // result cannot reach here with this list empty.
    missed: a.v === "unsupported" ? a.missedAll : [],
    isPdfUrl: source.pdfUrl,
    firedRule: firedRuleOf(a.won.computed),
  });
}
