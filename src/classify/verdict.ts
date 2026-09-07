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
   *  404 serving 13,221 characters of nav chrome cleared every body-derived
   *  test - prose above two of nine real documents, overlap 1.00 - and no
   *  threshold pair could reject it. Body shape cannot see what the status
   *  line says plainly. */
  readonly documentGone: boolean;
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
 * The four vetoes, in ONE place, because two callers ask this question.
 *
 * `reachability` (the preflight) asked it separately and its copy omitted N4,
 * so a 404 serving intact navigation chrome read `readable` in the preflight
 * and `unreachable` in the gate - a preflight that contradicts the gate is
 * worse than no preflight. Exported so the two cannot drift again.
 */
export function isBlocked(
  s: Pick<Signals, "challengeHeader" | "challengePath" | "challengeSignature" | "documentGone">,
): boolean {
  return s.challengeHeader || s.challengePath || s.challengeSignature || s.documentGone;
}

export function verdict(s: Signals): Verdict {
  if (s.total === 0) return "unclaimed";
  if (isBlocked(s)) return "unreachable";
  if (s.matched === s.total) return "supported";
  // C1 (slugLabelOverlap) is reported on Signals but deliberately NOT consulted
  // here - see thresholds.ts. Prose volume plus the four vetoes carry the whole
  // separation: largest non-vetoed challenge 1,180 chars, smallest real
  // document 6,858, floor licensed at 4,500.
  return s.proseChars >= THRESHOLDS.minProseChars ? "unsupported" : "unreachable";
}
