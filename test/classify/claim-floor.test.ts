import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { toText } from "../../src/text/extract.js";
import { norm } from "../../src/text/normalize.js";
import { THRESHOLDS } from "../../src/classify/thresholds.js";

// The discipline test/classify/acceptance.test.ts imposes on the prose floor,
// applied to the claim floor (spec 8.2: "bind the result with an acceptance
// test ... the discipline section 6.3 imposed on the prose floor"): the
// populations are read from the repo, the assertions NAME what failed rather
// than counting it, and a margin is demanded so a number that only just holds
// cannot ship.
//
// This is the only new test in plan 2 that reads fixtures. Every other one
// builds its bodies inline.

type Fixture = { path: string; kind: "challenge" | "document" | "known-gap" };
const corpus: Fixture[] = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));
// Normalized ONCE per document. `d.includes(norm(c))` is exactly
// phraseFound(text, c) with the haystack pre-normalized - the same saving
// harvest's filter 2 makes, for the same reason.
const documents = corpus
  .filter((f) => f.kind === "document")
  .map((f) => norm(toText(readFileSync(f.path, "utf8"))));

/** The walker scripts/calibrate-claim-floor.mjs uses, restated in TypeScript:
 *  claim strings only, no `_` notes, no notApplicable reason strings. */
function walk(v: unknown, out: string[]): void {
  if (typeof v === "string") {
    out.push(v);
    return;
  }
  if (Array.isArray(v)) {
    for (const x of v) walk(x, out);
    return;
  }
  if (v && typeof v === "object") {
    if (typeof (v as { notApplicable?: unknown }).notApplicable === "string") return;
    for (const [k, x] of Object.entries(v)) if (!k.startsWith("_")) walk(x, out);
  }
}

const raw: string[] = [];
for (const f of readdirSync("fixtures/claims").filter((n) => n.endsWith("-claims.json")).sort()) {
  walk(JSON.parse(readFileSync(`fixtures/claims/${f}`, "utf8")), raw);
}
const rows = [...new Set(raw)].map((c) => ({
  c,
  n: norm(c).length,
  hits: documents.filter((d) => d.includes(norm(c))).length,
}));
const spurious = rows.filter((r) => r.hits > 0);

describe("acceptance test - the claim floor (spec 7.3, 13 Q3)", () => {
  it("the populations are the ones the floor is licensed against", () => {
    // Without this every assertion below passes vacuously on an empty
    // fixtures/claims/ - an instrument that reports success without running,
    // which is this repository's most-repeated defect.
    expect(documents.length).toBeGreaterThanOrEqual(10);
    expect(rows.length).toBeGreaterThanOrEqual(200);
  });

  it("NO claim at or above the floor matches a page it was not written about", () => {
    const failures = spurious.filter((r) => r.n >= THRESHOLDS.minClaimChars).map((r) => r.c);
    expect(failures).toEqual([]);
  });

  it("the floor clears the observed ceiling with margin", () => {
    // A floor that only just clears the ceiling is one fixture away from not
    // clearing it. The prose floor demands 200 characters of air on a
    // 4,500-character threshold; 3 on a 16-character one is the same idea at
    // this scale.
    const ceiling = Math.max(0, ...spurious.map((r) => r.n));
    expect(ceiling).toBeLessThanOrEqual(THRESHOLDS.minClaimChars - 3);
  });

  it("names what it pins: every claim that demonstrably attests nothing is refused", () => {
    // Fable F6: the floor is NOT derived from these events - two of them is
    // not a derivation. What this pins is that on THIS corpus every claim
    // shown to match a page it was not written about is refused, and the
    // failure message names it.
    for (const r of spurious) {
      expect(r.n, JSON.stringify(r.c)).toBeLessThan(THRESHOLDS.minClaimChars);
    }
  });

  it("the cost of the floor stays a small minority of real claims", () => {
    // 18 of 208, 8.7 percent, on 2026-09-09. The bound is loose on purpose:
    // it exists to catch a floor raised until it refuses a quarter of an
    // author's file, not to pin today's ratio.
    const refused = rows.filter((r) => r.n < THRESHOLDS.minClaimChars).length;
    expect(refused / rows.length).toBeLessThan(0.15);
  });

  it("the seed length is at least the floor (spec 8.2, Thresholds)", () => {
    expect(THRESHOLDS.harvestSeedChars).toBeGreaterThanOrEqual(THRESHOLDS.minClaimChars);
  });
});
