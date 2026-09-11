import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { THRESHOLDS } from "../../src/classify/thresholds.js";

// The discipline test/classify/acceptance.test.ts imposes on the prose floor,
// applied to the claim floor (spec 8.2: "bind the result with an acceptance
// test ... the discipline section 6.3 imposed on the prose floor"): the
// populations are read from the repo, the assertions NAME what failed rather
// than counting it, and a margin is demanded so a number that only just holds
// cannot ship.
//
// WHAT THIS FILE READS, AND WHY IT CHANGED (2026-09-10). It used to walk the
// 210 claim strings in `fixtures/claims/`, frozen from four of the owner's
// unpublished drafts, and re-run the matcher over them. That corpus was
// deleted when this repository was made public: the claim text discloses what
// those drafts are about. It was replaced by `fixtures/claim-lengths.json`,
// which keeps the lengths and counts the assertions below actually consume -
// see that file's `_note`.
//
// ONE ASSERTION DID NOT SURVIVE THE REPLACEMENT, and it is not quietly gone.
// "NO claim at or above the floor matches a page it was not written about"
// re-ran `phraseFound` over every claim string against every unrelated
// `document` fixture. It cannot be re-derived from lengths, and a version of
// it rewritten to consult the stored `spurious` list would be a test that
// re-reads its own answer - it could no longer fail on evidence, only on the
// fixture being edited. So it was DELETED rather than faked. Its result is a
// dated measurement: on 2026-09-09, over 208 distinct claims and 10 unrelated
// document fixtures, exactly two matched a page they were not written about,
// both far below the floor. That measurement stands recorded in
// docs/calibration-2026-09.md ("Calibration of `minClaimChars` and
// `harvestSeedChars`", and the 2026-09-10 correction beneath it) and is NOT
// re-runnable from what this repository now ships. What remains below still
// fails if the floor is lowered - that is the assertion that guards the
// constant, and it was watched to fail before it was trusted.
//
// This is still the only test in plan 2 that reads a fixture. Every other one
// builds its bodies inline.

type Derived = {
  /** Frozen count of `kind: "document"` fixtures the measurement ran against. */
  documentFixtures: number;
  /** Every claim that matched a `document` fixture it was not written about. */
  spurious: { claim: string; n: number; hits: number }[];
  /** Every distinct claim's `norm(claim).length`, ascending. */
  lengths: number[];
};
const derived: Derived = JSON.parse(readFileSync("fixtures/claim-lengths.json", "utf8"));
const { lengths, spurious } = derived;

describe("acceptance test - the claim floor (spec 7.3, 13 Q3)", () => {
  it("the populations are the ones the floor is licensed against", () => {
    // Without this every assertion below passes vacuously on an empty
    // population - an instrument that reports success without running, which
    // is this repository's most-repeated defect. It was watched to fail: with
    // `lengths` emptied, this reports `expected 0 to be greater than or equal
    // to 200` while the margin and naming assertions below pass, examining
    // nothing.
    //
    // `documentFixtures` is deliberately the FROZEN count, not a live count of
    // fixtures/corpus.json. It is the population the 2026-09-09 measurement was
    // taken against, and that number cannot change retroactively; asserting it
    // equals today's corpus would fail the day someone ADDS a document fixture,
    // and could not then be repaired, because the claims it was derived from
    // are gone.
    expect(derived.documentFixtures).toBeGreaterThanOrEqual(10);
    expect(lengths.length).toBeGreaterThanOrEqual(200);
  });

  it("the floor clears the observed ceiling with margin", () => {
    // A floor that only just clears the ceiling is one fixture away from not
    // clearing it. The prose floor demands 200 characters of air on a
    // 4,500-character threshold; 3 on a 16-character one is the same idea at
    // this scale.
    //
    // THIS IS THE ASSERTION THAT GUARDS THE CONSTANT. Every other file that
    // mentions `minClaimChars` consumes it without checking its value, so all
    // of them stay green at 8. This one does not.
    const ceiling = Math.max(0, ...spurious.map((r) => r.n));
    expect(ceiling).toBeLessThanOrEqual(THRESHOLDS.minClaimChars - 3);
  });

  it("names what it pins: every claim that demonstrably attests nothing is refused", () => {
    // Fable F6: the floor is NOT derived from these events - two of them is
    // not a derivation. What this pins is that on THAT corpus every claim
    // shown to match a page it was not written about is refused, and the
    // failure message names it.
    for (const r of spurious) {
      expect(r.n, JSON.stringify(r.claim)).toBeLessThan(THRESHOLDS.minClaimChars);
    }
  });

  it("the cost of the floor stays a small minority of real claims", () => {
    // 18 of 208, 8.7 percent, on 2026-09-09. The bound is loose on purpose:
    // it exists to catch a floor raised until it refuses a quarter of an
    // author's file, not to pin today's ratio.
    const refused = lengths.filter((n) => n < THRESHOLDS.minClaimChars).length;
    expect(refused / lengths.length).toBeLessThan(0.15);
  });

  it("the seed length is at least the floor (spec 8.2, Thresholds)", () => {
    expect(THRESHOLDS.harvestSeedChars).toBeGreaterThanOrEqual(THRESHOLDS.minClaimChars);
  });
});
