import { THRESHOLDS } from "./thresholds.js";

export type Verdict = "supported" | "unsupported" | "unreachable" | "unclaimed";

export interface Signals {
  /** P1: claim phrases found in the extracted body. */
  readonly matched: number;
  readonly total: number;
  /** P2: extracted prose characters. */
  readonly proseChars: number;
  /** C1: fraction of slug and title content words present in the BODY. */
  readonly slugLabelOverlap: number;
  /** C2: og:type=article or json-ld. REPORTED, NEVER LICENSING - a paywall
   *  stub keeps the whole head. Present here so --explain-fetch can show it. */
  readonly headMarkers: boolean;
  /** N1 */ readonly challengeHeader: boolean;
  /** N2 */ readonly challengePath: boolean;
  /** N3 */ readonly challengeSignature: boolean;
  /** N4: HTTP 404 or 410 - the document is gone.
   *
   *  The ONE place status is consulted, and the asymmetry is the whole
   *  justification. A server is not authoritative about PRESENCE (a 400
   *  serving 253KB, a 404 serving 112KB), which is why 2xx is never proof of
   *  a read. But 404/410 IS the origin stating the resource does not exist,
   *  and that it is authoritative about. Calibration forced this: a real ECB
   *  404 serving 13,216 characters of nav chrome cleared every body-derived
   *  test - prose above two of nine real documents, overlap 1.00 - and no
   *  threshold pair could reject it. Body shape cannot see what the status
   *  line says plainly. */
  readonly documentGone: boolean;
  /** N5: the body is not text at all.
   *
   *  The other four vetoes ask whether a server or a wall stopped us. This one
   *  asks whether what came back is prose in the first place. Without it a
   *  content-negotiated PDF - an arxiv or DOI link with no ".pdf" in the path -
   *  decodes to a megabyte of "prose", clears every threshold, and turns a
   *  claim the document genuinely contains into an accusation. Measured on a
   *  real paper: 1,037,512 extracted characters, 230x the floor, no veto. */
  readonly notText: boolean;
}

/**
 * Spec section 6.2, transcribed. THE KEYSTONE RULE LIVES HERE.
 *
 * "unsupported" requires positive proof we read the real page. Attestation and
 * accusation carry different burdens: a full match is its own proof of a read,
 * while an accusation needs body-derived evidence - PROSE VOLUME - and no veto.
 * (Slug/title correlation was withdrawn from this burden by ruling C7: it was
 * measured three times and ranks the two populations backwards. It is still
 * computed and reported, and it does not gate.) `matched > 0` does not license
 * an accusation on its own, because a wall padded with boilerplate can mint one.
 *
 * Every branch that returns "unsupported" is a branch that can publish a false
 * accusation against an author's accurate work if it is wrong. Change nothing
 * here without a fixture.
 */
/**
 * The five vetoes, in ONE place, because FOUR call sites ask this question:
 *
 *   1. `verdict()`, below - the gate's own `unreachable` branch.
 *   2. `isReadable()`, below - the reader's stop condition (spec 6.6).
 *   3. `reachability()` in src/reachability.ts - the preflight's reason
 *      ladder ("challenge interstitial").
 *   4. `check()` in src/check.ts - which uses it to keep a vetoed read's
 *      matches out of the cross-rung union, since a match inside a body the
 *      classifier called not-the-document is the WALL'S text, not the
 *      author's evidence.
 *
 * The preflight asked it separately once and its copy omitted N4, so a 404
 * serving intact navigation chrome read `readable` in the preflight and
 * `unreachable` in the gate - a preflight that contradicts the gate is worse
 * than no preflight. Exported so no copy of the veto set can drift from this
 * one. (This comment said "two callers" while there were three, then "three" while plan 1.2 made four; the count is
 * load-bearing, because a fourth site added without importing from here is the
 * exact failure the export exists to prevent.)
 */
export function isBlocked(
  s: Pick<Signals, "challengeHeader" | "challengePath" | "challengeSignature" | "documentGone" | "notText">,
): boolean {
  return s.challengeHeader || s.challengePath || s.challengeSignature || s.documentGone || s.notText;
}

/**
 * Readable: no veto fires AND the prose clears the floor (spec 6.6). THE ONE
 * definition of "we read this document". readSource escalates until a read is
 * readable, scanSources() (harvest) keeps only readable reads as candidates,
 * reachability() reports a URL readable iff some read is, and
 * check() prefers a readable read over a larger vetoed one. It is NOT
 * `!isBlocked`: 22 of the 25 challenge fixtures and every paywall stub pass
 * all five vetoes and fail only the floor (docs/calibration-2026-09.md, "Read
 * together"). A caller that asks `!isBlocked` when it means "readable" will
 * treat a wall as a document.
 */
export function isReadable(
  s: Pick<Signals, "challengeHeader" | "challengePath" | "challengeSignature" | "documentGone" | "notText" | "proseChars">,
): boolean {
  return !isBlocked(s) && s.proseChars >= THRESHOLDS.minProseChars;
}

export function verdict(s: Signals): Verdict {
  if (s.total === 0) return "unclaimed";
  if (isBlocked(s)) return "unreachable";
  if (s.matched === s.total) return "supported";
  // C1 (slugLabelOverlap) is reported on Signals but deliberately NOT consulted
  // here - see thresholds.ts. Prose volume plus the five vetoes carry the whole
  // separation: largest non-vetoed challenge 1,180 chars, smallest real
  // document 6,394, floor licensed at 4,500. (Re-run scripts/calibrate.mjs to
  // reproduce; see docs/calibration-2026-09.md.)
  // `isBlocked` already returned above, so this is the floor alone - but it
  // is asked through isReadable so the gate's "unsupported" and the reader's
  // "readable" cannot drift apart.
  return isReadable(s) ? "unsupported" : "unreachable";
}
