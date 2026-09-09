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
const THREE = "wildlife officials tracked the herd across the valley";
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
    // ONE alone is norm-invariant (already lowercase, no punctuation quirks),
    // so `kept.push(norm(span))` would pass unnoticed against it (review
    // finding, Important 3). TYPO's normalized form drops its comma and
    // lowercases its capitals, so a mutation that kept the NORMALIZED string
    // instead of the span itself is visible here.
    const TYPO = "The Committee Reported, Spending Rose Sharply Overall";
    const r = applyFilters({ ...base, source: source("https://e.com/a", ONE), spans: [ONE, TYPO] });
    expect(r.kept).toEqual([ONE, TYPO]);
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

  it("filter 2 never lets a URL's OWN other reads vote against it, while a genuine other source still can", () => {
    // A node read and a curl read of one URL carry the same text by
    // construction. Letting them vote would drop every proposal the tool
    // makes (Fable F10b), and `others` is the caller's contract for it.
    // TWO is dropped by a genuine other source in the SAME call, so ONE's
    // survival is attributable to self-exclusion specifically and not to
    // filter 2 never having run at all - deleting filter 2 outright left
    // this test green before (review finding, Important 2).
    const r = applyFilters({
      ...base,
      source: source("https://e.com/a", `Node copy: ${ONE}.`, `Curl copy: ${ONE}.`),
      spans: [ONE, TWO],
      others: [source("https://f.com/b", TWO)],
    });
    expect(r.kept).toEqual([ONE]);
    expect(r.drops.frequency).toBe(1);
  });

  it("filter 2 is vacuous with nothing to compare against, and still runs when there IS something", () => {
    // With others: [], nothing CAN be dropped whether or not the filter
    // runs at all - deleting filter 2 outright left this exact assertion
    // green (review finding, Important 2: "a filter that could not run in
    // exactly the way it would for a filter that ran and dropped nothing").
    // The second call in this test adds a genuine other source carrying a
    // companion span (THREE) that IS dropped, so ONE and TWO's survival in
    // BOTH calls is attributable to the filter running and finding nothing
    // to match, not to it never running.
    const vacuous = applyFilters({ ...base, source: source("https://e.com/a", ONE), spans: [ONE, TWO], others: [] });
    expect(vacuous.kept).toEqual([ONE, TWO]);
    expect(vacuous.drops.frequency).toBe(0);

    const withOther = applyFilters({
      ...base,
      source: source("https://e.com/a", ONE),
      spans: [ONE, TWO, THREE],
      others: [source("https://f.com/b", THREE)],
    });
    expect(withOther.kept).toEqual([ONE, TWO]);
    expect(withOther.drops.frequency).toBe(1);
  });

  it("never lets the caller's `others` self-vote, even when it wrongly includes the source itself", () => {
    // Controller ruling (fix round 1, Important 6): a caller mistake here
    // has a 100% blast radius - EVERY proposal disappears silently, and
    // "harvest proposed nothing" reads exactly like "the sources shared
    // nothing". The guard belongs in filters.ts, by `.key`, not solely in
    // the caller's contract to build `others` correctly - Task 8 pins the
    // caller's side separately.
    const mine = source("https://e.com/a", ONE);
    const r = applyFilters({ ...base, source: mine, spans: [ONE, TWO], others: [mine] });
    expect(r.kept).toEqual([ONE, TWO]);
    expect(r.drops.frequency).toBe(0);
  });

  it("filter 2 reads the read's own normText, never recomputing norm(read.text) (Task 5's exact defect)", () => {
    // With the `source()` helper, normText is always norm(text) by
    // construction, so a mutation substituting `norm(read.text)` for
    // `read.normText` has nothing to disagree with (review finding,
    // Important 3 - the sentence Task 5 was caught violating stays unpinned
    // without this). Built by hand instead: this other source's stored
    // normText deliberately disagrees with norm(its own text) - a stand-in
    // for a stale/pre-computed value. Correct code trusts the STORED value
    // and drops ONE; code that recomputes norm(read.text) would see
    // unrelated filler text, find no match, and keep it.
    const staleNormText: HarvestSource = {
      url: "https://f.com/b",
      key: "https://f.com/b",
      reads: [{ rung: "node", text: "completely unrelated filler text", normText: norm(ONE) }],
      rungsAttempted: ["node"],
      redirectedTo: null,
    };
    const r = applyFilters({ ...base, source: source("https://e.com/a", ONE), spans: [ONE], others: [staleNormText] });
    expect(r.kept).toEqual([]);
    expect(r.drops.frequency).toBe(1);
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
    // The existing entry is ONE's title case, not ONE itself: `existing`'s
    // norm-invariant literal (ONE) would let `.map(norm) -> .slice()`
    // (skipping normalization) pass unnoticed, since ONE already equals its
    // own norm() (review finding, Important 3). Title-casing it normalizes
    // right back to ONE's exact norm form, so the two containment checks
    // below are unaffected - but a mutation that stops normalizing
    // `existing` sees the raw title case and no longer matches.
    const inside = "spending rose sharply";
    const outside = `the committee reported that ${inside} in the fourth quarter`;
    const existingTypo = "The Committee Reported That Spending Rose Sharply";
    const r = applyFilters({
      ...base,
      source: source("https://e.com/a", outside),
      spans: [inside, outside, TWO],
      existing: [existingTypo],
    });
    expect(r.kept).toEqual([TWO]);
    expect(r.drops.claimed).toBe(2);
  });

  it("runs the filters in the spec's order, so each drop is attributed once", () => {
    // Three spans, each eligible for every filter from its own rank onward
    // and no earlier one - only the floor's priority over the rest was
    // previously pinned; swapping rules<->claimed or frequency<->rules left
    // the suite green (review finding, Important 1):
    //   SHORT   trips 1-4, attributed to 1 (floor).
    //   SPAN_23 trips 2 and 3 (another source carries it, AND a rule
    //           matches it), attributed to 2 (frequency).
    //   SPAN_34 trips 3 and 4 (a rule matches it, AND it is an existing
    //           claim), attributed to 3 (rules).
    // Order matters to the author reading the counts: a span reported as
    // boilerplate when it was really below the floor sends her to write a
    // rule she does not need.
    const SPAN_23 = "regulators opened a fresh inquiry into pricing practices";
    const SPAN_34 = "analysts said the currency weakened against every major peer";
    const rule: Rule = {
      pattern: new RegExp(`${SHORT}|regulators opened a fresh inquiry|currency weakened against every major peer`),
      lastConfirmed: "2026-09-08",
      note: "matches all three probe spans, to prove each is attributed to its EARLIEST eligible filter",
    };
    const r = applyFilters({
      source: source("https://e.com/a", SHORT, SPAN_34),
      spans: [SHORT, SPAN_23, SPAN_34],
      others: [source("https://f.com/b", SHORT, SPAN_23)],
      existing: [SHORT, SPAN_34],
      boilerplate: [rule],
    });
    expect(r.drops).toEqual({ floor: 1, frequency: 1, rules: 1, claimed: 0 });
  });
});
