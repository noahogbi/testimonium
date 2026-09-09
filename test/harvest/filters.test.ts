import { describe, expect, it } from "vitest";
import { applyFilters } from "../../src/harvest/filters.js";
import type { HarvestSource } from "../../src/harvest/sources.js";
import { norm } from "../../src/text/normalize.js";
import { THRESHOLDS } from "../../src/classify/thresholds.js";
import type { Rule } from "../../src/rules/challenge.js";

const source = (url: string, ...texts: string[]): HarvestSource => ({
  url,
  key: url,
  reads: texts.map((text, i) => ({ rung: i === 0 ? "node" : "curl", text, normText: norm(text) })),
  rungsAttempted: ["node"],
  redirectedTo: null,
});

const ONE = "the committee reported that spending rose sharply";
const TWO = "the review of procurement practices is still ongoing";
/** Built FROM the constant so Task 2 re-deriving the floor cannot turn these
 *  tests red for the wrong reason. */
const SHORT = "x".repeat(THRESHOLDS.minClaimChars - 1);
const base = {
  others: [] as HarvestSource[],
  existing: [] as string[],
  boilerplate: [] as Rule[],
};

describe("applyFilters", () => {
  it("keeps a span that survives every filter, in the source's own typography", () => {
    const r = applyFilters({ ...base, source: source("https://e.com/a", ONE), spans: [ONE] });
    expect(r.kept).toEqual([ONE]);
    expect(r.drops).toEqual({ floor: 0, frequency: 0, rules: 0, claimed: 0 });
  });

  it("filter 1 refuses a span under the floor, with the loader's own message", () => {
    // Spec 7.3's third site. The same builder the claims-file loader and
    // check()'s front door use, so an author meets one wording.
    const r = applyFilters({ ...base, source: source("https://e.com/a", SHORT), spans: [SHORT, ONE] });
    expect(r.kept).toEqual([ONE]);
    expect(r.drops.floor).toBe(1);
    expect(r.floorMessages[0]).toContain("https://e.com/a");
    expect(r.floorMessages[0]).toContain("characters once normalized");
    expect(r.floorMessages[0]).toContain("extend it to take in the surrounding words");
  });

  it("filter 2 drops a span another cited source also carries", () => {
    // Spec 8.2 filter 5.2 and 13 Q5: text in two of the draft's own sources
    // is the outlet's name, a cookie notice, a shared byline or a wire story
    // reprinted twice - not something the author learned from either page.
    const other = source("https://f.com/b", `Nav. ${ONE}. Footer.`);
    const r = applyFilters({ ...base, source: source("https://e.com/a", ONE), spans: [ONE], others: [other] });
    expect(r.kept).toEqual([]);
    expect(r.drops.frequency).toBe(1);
  });

  it("filter 2 never lets a URL's OWN other reads vote against it", () => {
    // A node read and a curl read of one URL carry the same text by
    // construction. Letting them vote would drop every proposal the tool
    // makes (Fable F10b), and `others` is the caller's contract for it.
    const r = applyFilters({
      ...base,
      source: source("https://e.com/a", `Node copy: ${ONE}.`, `Curl copy: ${ONE}.`),
      spans: [ONE],
    });
    expect(r.kept).toEqual([ONE]);
    expect(r.drops.frequency).toBe(0);
  });

  it("filter 2 is vacuous with nothing to compare against", () => {
    const r = applyFilters({ ...base, source: source("https://e.com/a", ONE), spans: [ONE, TWO], others: [] });
    expect(r.kept).toEqual([ONE, TWO]);
    expect(r.drops.frequency).toBe(0);
  });

  it("filter 3 tests a boilerplate rule against norm(span), not the raw span", () => {
    // Patterns are written against normalized text - the discipline
    // matchesChallengeSignature already follows - so case, smart quotes and
    // zero-width characters cannot dodge them.
    const RESERVED = "All Rights Reserved, by the publisher";
    const rule: Rule = { pattern: /all rights reserved/, lastConfirmed: "2026-09-08", note: "site footer" };
    const r = applyFilters({
      ...base,
      source: source("https://e.com/a", RESERVED),
      spans: [RESERVED, ONE],
      boilerplate: [rule],
    });
    expect(r.kept).toEqual([ONE]);
    expect(r.drops.rules).toBe(1);
  });

  it("filter 4 drops a span contained in an existing claim, and one containing it", () => {
    const inside = "spending rose sharply";
    const outside = `the committee reported that ${inside} in the fourth quarter`;
    const r = applyFilters({
      ...base,
      source: source("https://e.com/a", outside),
      spans: [inside, outside, TWO],
      existing: [ONE],
    });
    expect(r.kept).toEqual([TWO]);
    expect(r.drops.claimed).toBe(2);
  });

  it("runs the filters in the spec's order, so each drop is attributed once", () => {
    // A single span that would trip filters 1, 2, 3 and 4 is counted by the
    // FIRST one only. Order matters to the author reading the counts: a span
    // reported as boilerplate when it was really below the floor sends her
    // to write a rule she does not need.
    const rule: Rule = { pattern: new RegExp(SHORT), lastConfirmed: "2026-09-08", note: "matches the short span" };
    const r = applyFilters({
      source: source("https://e.com/a", SHORT),
      spans: [SHORT],
      others: [source("https://f.com/b", SHORT)],
      existing: [SHORT],
      boilerplate: [rule],
    });
    expect(r.drops).toEqual({ floor: 1, frequency: 0, rules: 0, claimed: 0 });
  });
});
