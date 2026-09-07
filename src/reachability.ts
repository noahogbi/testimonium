import { computeSignals } from "./classify/signals.js";
import { THRESHOLDS } from "./classify/thresholds.js";
import { defaultFetcher } from "./fetch/default-fetcher.js";
import { nextAction, type Attempt } from "./fetch/ladder.js";
import { isPdf } from "./fetch/pdf.js";
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
  const fetcher = opts.fetcher ?? defaultFetcher(opts.rules ? { hosts: opts.rules.hosts } : {});
  const readable: ReachabilityResult["readable"][number][] = [];
  const unreadable: ReachabilityResult["unreadable"][number][] = [];

  for (const url of urls) {
    const history: Attempt[] = [];
    const attempted: RungId[] = [];
    let bestProse = 0;
    let bestRung: RungId = "node";
    let challenged = false;

    for (;;) {
      const action = nextAction(history, fetcher.rungs, isPdf(url));
      if (action.kind === "stop") break;
      const response = await fetcher.fetch(url, action.rung);
      attempted.push(action.rung);
      const c = computeSignals({
        rawBody: response.rawBody,
        headers: response.headers,
        finalUrl: response.finalUrl || url,
        status: response.status,
        claims: [],
        ...(opts.rules ? { rules: opts.rules } : {}),
      });
      const blocked =
        c.signals.challengeHeader || c.signals.challengePath || c.signals.challengeSignature;
      if (c.signals.proseChars > bestProse) {
        bestProse = c.signals.proseChars;
        bestRung = action.rung;
      }
      challenged = challenged || blocked;
      history.push({ rung: action.rung, proseChars: c.signals.proseChars, challenged: blocked });
    }

    if (bestProse >= THRESHOLDS.minProseChars && !challenged) {
      readable.push({ url, proseChars: bestProse, rung: bestRung });
    } else {
      unreadable.push({
        url,
        reason: challenged ? "challenge interstitial" : `only ${bestProse} characters extracted`,
        rungsAttempted: attempted,
      });
    }
  }

  return { readable, unreadable, rate: urls.length === 0 ? 1 : readable.length / urls.length };
}
