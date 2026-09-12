import { isBlocked } from "./classify/verdict.js";
import { buildFetcher } from "./fetch/build-fetcher.js";
import { bestReadable, readSource } from "./fetch/read-source.js";
import type { Fetcher, RungId } from "./fetch/types.js";
import type { RuleSet } from "./rules/load.js";

export interface ReachabilityResult {
  readonly readable: { url: string; proseChars: number; rung: RungId }[];
  readonly unreadable: { url: string; reason: string; rungsAttempted: RungId[] }[];
  readonly rate: number;
}

export interface ReachabilityOptions {
  readonly fetcher?: Fetcher;
  /** Bundled-plus-local rules (Task 15's `loadRules()`). `reachability` walks
   *  the same ladder `check` does, so it must consult the same rules: a
   *  preflight that calls a host readable while the gate calls it unreachable
   *  - because one honored a local rule and the other didn't - is worse than
   *  no preflight at all. */
  readonly rules?: RuleSet;
  /** Declared identity for hosts that require one, e.g. sec.gov's
   *  "<app> <contact email>". testimonium ships no identity of its own, and
   *  before Task 16 this option existed on FetcherOptions but was reachable
   *  from nowhere: reachability() never passed it, so every such citation
   *  took the warn-and-use-a-browser-UA branch. Matches CheckOptions.identity. */
  readonly identity?: string;
}

/**
 * Preflight. No claims file needed.
 *
 * This exists so a new user gets THEIR number before investing in a claims
 * file. One published corpus re-fetched at 96.8%, but that corpus was filtered
 * at authoring time for sources its author could read; a user who points this
 * at a hostile corpus and sees a wall of unreachable should be reading a
 * measurement, not concluding the tool is broken.
 */
export async function reachability(
  urls: readonly string[],
  opts: ReachabilityOptions = {},
): Promise<ReachabilityResult> {
  // buildFetcher (Task 16): the ONE construction shared with check(),
  // harvest() and recheck()'s live arm - see its own docstring. `opts` is
  // passed straight through rather than rebuilt field-by-field (fix round 1,
  // Important 1): `ReachabilityOptions` is a structural superset of
  // `BuildFetcherOptions`, and rebuilding it here would be a second copy of
  // the forwarding logic that drifts the moment a field is added to one
  // interface and not mirrored to the other.
  const fetcher = buildFetcher(opts);
  const readable: ReachabilityResult["readable"][number][] = [];
  const unreadable: ReachabilityResult["unreadable"][number][] = [];

  for (const url of urls) {
    // THE SAME READS THE GATE JUDGES FROM (spec 6.6). Until plan 1.2 this
    // function carried its own copy of the ladder loop, and its readable test
    // ORed the vetoes across every rung - so a host that walled node and
    // handed curl the document was readable to check() and unreadable here.
    const { reads, attempted } = await readSource(url, [], {
      fetcher,
      ...(opts.rules ? { rules: opts.rules } : {}),
    });

    // Rule 5: readable iff SOME read is readable. bestReadable() is the read
    // check() would aggregate from under rule 2, so the two cannot disagree
    // about which read counts.
    const best = bestReadable(reads);
    if (best) {
      readable.push({ url, proseChars: best.computed.signals.proseChars, rung: best.rung });
      continue;
    }

    // No read was readable: diagnose from all of them. The ladder of reasons is
    // unchanged from 6546176. A 404 is not an interstitial, and saying so would
    // be a new inaccuracy introduced by folding N4 into `blocked`. N5 implies
    // blocked (isBlocked ORs in notText), so a body that is not text at all
    // would otherwise fall into the `challenged` branch below and report as a
    // "challenge interstitial" - a false diagnosis of exactly the class the N4
    // carve-out exists to prevent. This branch MUST precede `challenged`, or it
    // is dead code.
    const gone = reads.some((r) => r.computed.signals.documentGone);
    const notText = reads.some((r) => r.computed.signals.notText);
    const challenged = reads.some((r) => isBlocked(r.computed.signals));
    const bestProse = reads.reduce((n, r) => Math.max(n, r.computed.signals.proseChars), 0);
    unreadable.push({
      url,
      reason: gone
        ? "the origin says the document is gone (404/410)"
        : notText
          ? "the body is not text (binary or a non-textual content-type)"
          : challenged
            ? "challenge interstitial"
            : `only ${bestProse} characters extracted`,
      rungsAttempted: attempted,
    });
  }

  return { readable, unreadable, rate: urls.length === 0 ? 1 : readable.length / urls.length };
}
