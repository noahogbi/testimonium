import type { RungId } from "./types.js";

/** What the ladder is allowed to know about an attempt: the rung, and whether
 *  it read the document (isReadable in classify/verdict.ts - no veto fired AND
 *  the prose cleared the floor). Deliberately not the signals: a prose count
 *  plus a caller-supplied "challenged" bit is how check() and reachability()
 *  came to escalate on different rules at 3974d27 (spec 6.6, "Escalation"). */
export interface Attempt {
  readonly rung: RungId;
  readonly readable: boolean;
}

export type Action = { kind: "try"; rung: RungId } | { kind: "stop" };

/** HTML rungs in escalation order. pdftotext is not here: it is selected by
 *  URL shape before any fetch, never as a fallback. */
const HTML_ORDER: readonly RungId[] = ["node", "curl"];

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
): Action {
  if (isPdfUrl) {
    if (history.length > 0) return { kind: "stop" };
    return available.includes("pdftotext") ? { kind: "try", rung: "pdftotext" } : { kind: "stop" };
  }

  // Climb unless the last read was readable. A read vetoed by N4 or N5 alone -
  // a 404 over a full page of chrome, a PDF served as bytes - keeps climbing:
  // the next rung may hold the document, and the cost of asking is one fetch.
  const last = history[history.length - 1];
  if (last?.readable) return { kind: "stop" };

  const tried = new Set(history.map((a) => a.rung));
  const next = HTML_ORDER.find((r) => available.includes(r) && !tried.has(r));
  return next ? { kind: "try", rung: next } : { kind: "stop" };
}
