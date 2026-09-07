import { THRESHOLDS } from "../classify/thresholds.js";
import type { RungId } from "./types.js";

export interface Attempt {
  readonly rung: RungId;
  readonly proseChars: number;
  readonly challenged: boolean;
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

  const last = history[history.length - 1];
  if (last && last.proseChars >= THRESHOLDS.minProseChars && !last.challenged) return { kind: "stop" };

  const tried = new Set(history.map((a) => a.rung));
  const next = HTML_ORDER.find((r) => available.includes(r) && !tried.has(r));
  return next ? { kind: "try", rung: next } : { kind: "stop" };
}
