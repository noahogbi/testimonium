import type { RungId } from "./types.js";

/** What the ladder is allowed to know about an attempt: the rung, and whether
 *  it read the document (isReadable in classify/verdict.ts - no veto fired AND
 *  the prose cleared the floor). Deliberately not the signals: a prose count
 *  plus a caller-supplied "challenged" bit is how check() and reachability()
 *  came to escalate on different rules at 6546176 (spec 6.6, "Escalation"). */
export interface Attempt {
  readonly rung: RungId;
  readonly readable: boolean;
}

export type Action = { kind: "try"; rung: RungId } | { kind: "stop" };

/** HTML rungs in escalation order. pdftotext is not here: it is selected by
 *  URL shape before any fetch, never as a fallback.
 *
 *  TWO rungs, and the count is load-bearing beyond escalation cost:
 *  check()'s rule 2 (src/check.ts) lets a readable read outrank a larger
 *  vetoed one, and with a THIRD HTML rung the trio [vetoed largest wall,
 *  unvetoed sub-floor read, readable read] would assemble a cross-read
 *  union into `supported` where 6546176 answered `unreachable` - a verdict
 *  move no spec section licenses. Adding a rung requires spec 6.6 to say
 *  what rule 2 does at three reads.
 *
 *  Module-private: `hasUntriedClimbableRung` below is how a caller asks "is
 *  there an HTML rung this fetcher offers that we have not tried yet"
 *  without ever seeing this list directly - the smaller public surface is
 *  deliberate, not an oversight. A caller that re-derived this list, or
 *  asked the question against its OWN copy of it, is exactly the second
 *  copy this file's own nextAction docstring warns about (fix round 2,
 *  Task 9: check.ts held such a copy, inline, until this moved here). */
const HTML_ORDER: readonly RungId[] = ["node", "curl"];

/** Is there a rung this ladder would still climb to? Lives here, not in a
 *  caller, because HTML_ORDER is this module's knowledge: a caller that
 *  reimplements the rung-selection rule is the second copy this file's own
 *  docstring warns about.
 *
 *  check()'s escalation trigger (spec 0.2.0 section 4) is this function's
 *  reason to exist: "is there an HTML rung this fetcher offers that we have
 *  not tried yet" used to be answered by a local copy in check.ts that
 *  intersected `fetcher.rungs` with its OWN import of `HTML_ORDER`. That
 *  copy was correct, but nothing forced it to stay that way, and its wrong
 *  form (counting every offered rung, `pdftotext` included, as climbable)
 *  turned out to be unobservable through check() end to end - `nextAction`
 *  below already restricts its own candidates to `HTML_ORDER`, so the wrong
 *  form cost one no-op call and nothing else. Asking the question HERE,
 *  against the one list this module owns, makes the wrong form a boolean
 *  you can assert directly (test/fetch/ladder.test.ts) instead of a defect
 *  hidden behind a second layer of the same restriction. */
export function hasUntriedClimbableRung(
  attempted: readonly RungId[],
  available: readonly RungId[],
  isPdfUrl: boolean,
): boolean {
  if (isPdfUrl) return false;
  return HTML_ORDER.some((r) => available.includes(r) && !attempted.includes(r));
}

/**
 * Pure ladder policy. Attempt history in, next action out.
 *
 * This exists so that no decision ABOUT a classification is made INSIDE IO
 * code. In the origin repo the rule "challenged at fetch, so try curl" lived in
 * the fetch function, one caller reimplemented it inline, and that copy then
 * diverged three ways on the day the rule landed.
 */
export function nextAction(
  history: readonly Attempt[],
  available: readonly RungId[],
  isPdfUrl: boolean,
  exhaustive = false,
): Action {
  if (isPdfUrl) {
    if (history.length > 0) return { kind: "stop" };
    return available.includes("pdftotext") ? { kind: "try", rung: "pdftotext" } : { kind: "stop" };
  }

  // Climb unless the last read was readable. A read vetoed by N4 or N5 alone -
  // a 404 over a full page of chrome, a PDF served as bytes - keeps climbing:
  // the next rung may hold the document, and the cost of asking is one fetch.
  //
  // `exhaustive` suspends only this early stop. check() sets it when the
  // verdict would be `unsupported` and a rung is untried, so the ladder looks
  // once more before this package accuses an author (spec 0.2.0 section 4).
  // The flag carries no claim: the climb decision stays `{rung, readable}`.
  const last = history[history.length - 1];
  if (!exhaustive && last?.readable) return { kind: "stop" };

  const tried = new Set(history.map((a) => a.rung));
  const next = HTML_ORDER.find((r) => available.includes(r) && !tried.has(r));
  return next ? { kind: "try", rung: next } : { kind: "stop" };
}
