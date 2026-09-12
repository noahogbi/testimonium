import { belowClaimFloor, claimFloorMessage } from "./claims.js";

/**
 * One offending claim, as `validateClaims` reports it. `claim` is `unknown`
 * because the whole point of `reason: "not-a-string"` is that the input at
 * this index was never guaranteed to be a string in the first place.
 */
export interface ClaimProblem {
  readonly index: number;
  readonly claim: unknown;
  readonly reason: "not-a-string" | "below-floor";
  readonly message: string;
}

/**
 * Enumerates every claim `check()` (src/check.ts) would refuse, instead of
 * throwing a `TypeError` on the first one via `findIndex`. A library caller
 * holding a claims file with several bad entries otherwise discovers them one
 * at a time - fix, rerun, discover the next - with no way to test a claim
 * before calling `check()` and no way to list what is wrong up front.
 *
 * It reuses `check()`'s own predicate and message builder, `belowClaimFloor`
 * and `claimFloorMessage` (src/io/claims.ts), rather than re-deriving the
 * floor test. A second copy of that rule is exactly how the loader and the
 * front door would drift apart - the fetch ladder already suffered that class
 * of bug once, when an inline copy of its climb rule diverged three ways the
 * day it landed. Because the predicate is shared, an empty result here is a
 * guarantee: `check()` cannot throw on any claim this function passed.
 *
 * Same two refusals as `check()`, but not the same order end-to-end: `check()`
 * scans the WHOLE array for any non-string claim before scanning for any
 * below-floor claim, while this function checks both refusals PER CLAIM, in
 * that order (so `belowClaimFloor` - which calls `norm()` - is never handed a
 * non-string), before moving to the next claim - so on an array mixing both
 * problems, the two can disagree about which one surfaces first.
 */
export function validateClaims(claims: readonly unknown[]): ClaimProblem[] {
  const problems: ClaimProblem[] = [];
  claims.forEach((claim, index) => {
    const where = `claim at index ${index}`;
    if (typeof claim !== "string") {
      problems.push({ index, claim, reason: "not-a-string", message: `${where} is not a string` });
      return;
    }
    if (belowClaimFloor(claim)) {
      problems.push({ index, claim, reason: "below-floor", message: claimFloorMessage(where, claim) });
    }
  });
  return problems;
}
