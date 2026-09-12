import { defaultFetcher } from "./default-fetcher.js";
import type { Fetcher } from "./types.js";
import type { RuleSet } from "../rules/load.js";

export interface BuildFetcherOptions {
  /** Bring your own reader - bypasses every branch below and is returned
   *  untouched, exactly as `CheckOptions.fetcher` always has. */
  readonly fetcher?: Fetcher;
  /** Bundled-plus-local host rules, from `loadRules()`. Omitted keeps the
   *  bundled snapshot only, matching `hostRuleFor`'s own default. */
  readonly rules?: RuleSet;
  /** Declared identity for hosts that require one, e.g. sec.gov's
   *  "<app> <contact email>". See `FetcherOptions.identity`'s doc comment
   *  for what an absent one costs. */
  readonly identity?: string;
}

/**
 * ONE fetcher construction, shared by every entry point that builds a LIVE
 * fetcher: check(), harvest(), reachability(), and recheck()'s live arm.
 * recheck()'s REPLAY arm reaches this function too - it calls check() with
 * `fetcher: replayFetcher(...)` already set, and that flows into a
 * buildFetcher(opts) call same as any other - but it is returned untouched
 * by the bring-your-own-fetcher branch below, so no default is built and no
 * identity or host rule can attach to a read that never leaves disk (fix
 * round 1, Minor 4 - an earlier version of this comment said replay "never
 * reaches this function", which was false: the invariant it was protecting
 * was true, the mechanism named for it was not).
 *
 * UNTIL TASK 16, `recheck.ts` carried this exact comment where its own copy
 * of the construction lived:
 *
 *   PAIRED WITH check.ts:74's identical defaultFetcher(opts.rules ? { hosts:
 *   opts.rules.hosts } : {}) call. check() is off-limits to this plan, so
 *   this is a second copy of the host-rule wiring rather than a shared
 *   helper - an edit to one call that is not mirrored in the other silently
 *   drops local host rules from whichever side got missed.
 *
 * That comment predicted its own failure exactly: Task 5 added the
 * `identity` spread to check()'s copy and did not mirror it to harvest.ts,
 * reachability.ts or recheck.ts, and src/bin.ts had no `--identity` flag at
 * all, so 0.2.0 would have shipped its headline fix unreachable from the
 * CLI (Ruling T5-R1 is what added this task to fix it). This function is
 * what that comment was asking for, now that the plan touching it is
 * allowed to touch check() too (Task 16 is not plan 3). There is no fourth
 * hand-copied construction to go stale, and no comment warning about one
 * either - the warning's subject no longer exists.
 */
export function buildFetcher(opts: BuildFetcherOptions): Fetcher {
  return (
    opts.fetcher ??
    defaultFetcher({
      ...(opts.rules ? { hosts: opts.rules.hosts } : {}),
      ...(opts.identity ? { identity: opts.identity } : {}),
    })
  );
}
