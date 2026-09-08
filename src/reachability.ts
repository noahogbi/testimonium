import { computeSignals } from "./classify/signals.js";
import { THRESHOLDS } from "./classify/thresholds.js";
import { isBlocked, isReadable } from "./classify/verdict.js";
import { defaultFetcher } from "./fetch/default-fetcher.js";
import { nextAction, type Attempt } from "./fetch/ladder.js";
import { isPdf } from "./fetch/pdf.js";
import { EMPTY_RESPONSE, type Fetcher, type RawResponse, type RungId } from "./fetch/types.js";
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
    let gone = false;
    let notText = false;

    for (;;) {
      const action = nextAction(history, fetcher.rungs, isPdf(url));
      if (action.kind === "stop") break;
      // Same contract, same treatment as check(): a Fetcher must not throw,
      // and a third-party one that does degrades to an unread rung rather than
      // aborting a preflight over an entire corpus (ruling C12, second call
      // site). Warned about, never swallowed.
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
      const c = computeSignals({
        rawBody: response.rawBody,
        headers: response.headers,
        finalUrl: response.finalUrl || url,
        status: response.status,
        claims: [],
        ...(opts.rules ? { rules: opts.rules } : {}),
      });
      // THE SHARED PREDICATE, not a second copy. This one used to omit N4
      // (documentGone), so a 404 serving nav chrome read `readable` here and
      // `unreachable` at the gate.
      const blocked = isBlocked(c.signals);
      if (c.signals.proseChars > bestProse) {
        bestProse = c.signals.proseChars;
        bestRung = action.rung;
      }
      challenged = challenged || blocked;
      gone = gone || c.signals.documentGone;
      notText = notText || c.signals.notText;
      history.push({ rung: action.rung, readable: isReadable(c.signals) });
    }

    if (bestProse >= THRESHOLDS.minProseChars && !challenged) {
      readable.push({ url, proseChars: bestProse, rung: bestRung });
    } else {
      unreadable.push({
        url,
        // A 404 is not an interstitial, and saying so would be a new
        // inaccuracy introduced by folding N4 into `blocked`.
        // N5 implies `blocked` (isBlocked ORs in notText), so a body that is
        // not text at all would otherwise fall into the `challenged` branch
        // below and report as a "challenge interstitial" - a false diagnosis
        // of exactly the class the N4 carve-out two lines above exists to
        // prevent. This branch MUST precede `challenged`, or it is dead code.
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
  }

  return { readable, unreadable, rate: urls.length === 0 ? 1 : readable.length / urls.length };
}
