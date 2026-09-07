import { describe, expect, it } from "vitest";
import { excerptFor, dedupeEvidence } from "../../src/text/excerpt.js";

import { phraseFound } from "../../src/text/normalize.js";

const LONG = `The committee reported that spending rose by 23% over the period. ` +
  `Dr. Smith of the U.S. Army told reporters the figure was accurate. ` +
  `A further review is expected in the spring of next year, officials said.`;

/** A realistic document: the claim sits ~4,900 characters in, past enough
 *  whitespace for a per-character cursor bug to drift hundreds of characters.
 *  The short LONG fixture above cannot catch that, because +/-110 characters of
 *  padding absorbs the drift. */
const REALISTIC =
  "The quarterly filing shows revenue grew steadily across all divisions this year. ".repeat(61) +
  "Operating margin narrowed to 14.2% amid sustained pricing pressure. " +
  "Ordinary trailing prose continues for some distance after the claim. ".repeat(20);

describe("excerptFor", () => {
  it("returns null when the claim is not present", () => {
    expect(excerptFor(LONG, "no such phrase")).toBeNull();
  });

  // THE REGRESSION TEST. A cursor that counts folded characters rather than
  // mapping them drifts about one character per word, and returns a passage
  // that does not contain the claim - which then renders to a reader as the
  // quotation supporting it. Worse than showing no evidence at all.
  it("returns a passage that CONTAINS the claim, deep into a long document", () => {
    const claim = "operating margin narrowed to 14.2%";
    const e = excerptFor(REALISTIC, claim);
    expect(e).not.toBeNull();
    expect(phraseFound(e!, claim)).toBe(true);
  });

  it("honours its contract on every claim in a long document", () => {
    for (const claim of ["revenue grew steadily", "sustained pricing pressure", "Ordinary trailing prose"]) {
      const e = excerptFor(REALISTIC, claim);
      if (e !== null) expect(phraseFound(e, claim), claim).toBe(true);
    }
  });

  it("does not open mid-word", () => {
    const e = excerptFor(LONG, "the figure was accurate")!;
    expect(e.replace(/^…/, "")).not.toMatch(/^[a-z]/);
  });

  it("does not close mid-number", () => {
    const e = excerptFor(LONG, "spending rose")!;
    expect(e).not.toMatch(/\b2…?$/);
  });

  it("does not treat an abbreviation as a sentence end", () => {
    const e = excerptFor(LONG, "told reporters")!;
    expect(e).toContain("U.S. Army");
    expect(e).toContain("Dr. Smith");
  });

  it("returns null rather than a wrong passage when only a length-changing fold matched", () => {
    // norm() folds "6.5 billion" to "6.5bn". A per-character map cannot express
    // that, so the claim fails to locate and yields null - the safe outcome.
    expect(excerptFor("Revenue reached 6.5 billion dollars last year.", "6.5bn dollars")).toBeNull();
  });

  // THE ALIGNMENT TEST. norm() pulls a space back onto the preceding word
  // before punctuation; if foldWithMap did not reproduce that, every claim the
  // clause rescues would return `supported` with a NULL excerpt - a verdict
  // with no passage behind it, which is exactly what this file exists to stop.
  it.each([".", ";", ":", "!", "?", "%", ")", "]", "}"])("LOCATES what phraseFound matches, before %s", (p) => {
    const doc =
      `Ordinary lead text sits ahead of the claim here. The reported value is known ${p} and the report ` +
      `continues for a while afterwards without saying anything else of note.`;
    const claim = `The reported value is known${p}`;
    expect(phraseFound(doc, claim), `matcher, ${p}`).toBe(true);
    const e = excerptFor(doc, claim);
    expect(e, `located, ${p}`).not.toBeNull();
    expect(phraseFound(e!, claim), `contract, ${p}`).toBe(true);
  });

  it.each(["(", "[", "{"])("LOCATES what phraseFound matches, after %s", (p) => {
    const doc = `Ordinary lead text sits ahead of the claim here. See ${p} note 4 below for the full table of results.`;
    const claim = `See ${p}note 4 below`;
    expect(phraseFound(doc, claim), `matcher, ${p}`).toBe(true);
    const e = excerptFor(doc, claim);
    expect(e, `located, ${p}`).not.toBeNull();
    expect(phraseFound(e!, claim), `contract, ${p}`).toBe(true);
  });

  it("LOCATES a match whose space run also carries a comma", () => {
    // norm() deletes commas BEFORE it collapses whitespace, so the lookahead
    // in foldWithMap has to see past a DROP character inside the run too.
    const doc = "The lead sentence runs first. The total , however , was revised upward later that month.";
    const claim = "The total, however, was revised upward";
    expect(phraseFound(doc, claim)).toBe(true);
    const e = excerptFor(doc, claim);
    expect(e).not.toBeNull();
    expect(phraseFound(e!, claim)).toBe(true);
  });

  it("caps the window so a quotation stays a sentence, not a paragraph", () => {
    expect(excerptFor(LONG, "spending rose")!.length).toBeLessThanOrEqual(260);
  });

  it("locates a claim across every Unicode dash norm() folds", () => {
    // norm() folds all seven; FOLD once reproduced only two, so a source using
    // U+2011 matched but could not be located - supported verdict, no passage.
    for (const dash of ["‐", "‑", "‒", "–", "—", "―", "−"]) {
      const doc = `The committee reviewed GPT${dash}4 in detail. ` + "Further discussion followed at length. ".repeat(8);
      const e = excerptFor(doc, "GPT-4 in detail");
      expect(e, `dash U+${dash.codePointAt(0)!.toString(16)}`).not.toBeNull();
      expect(phraseFound(e!, "GPT-4 in detail"), `dash U+${dash.codePointAt(0)!.toString(16)}`).toBe(true);
    }
  });
});

describe("dedupeEvidence", () => {
  it("merges identical passages, keeping every claim on the survivor", () => {
    const merged = dedupeEvidence([
      { claims: ["a"], excerpt: "the same passage", rung: "node" },
      { claims: ["b"], excerpt: "the same passage", rung: "node" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.claims.sort()).toEqual(["a", "b"]);
  });

  // The motivating bug was two windows CENTRED A FEW CHARACTERS APART, not two
  // identical strings. Comparing for equality does not merge them.
  it("merges overlapping windows, not only identical ones", () => {
    const merged = dedupeEvidence([
      { claims: ["a"], excerpt: "…S0 S1 S2…", rung: "node" },
      { claims: ["b"], excerpt: "…S1…", rung: "node" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.claims.sort()).toEqual(["a", "b"]);
    // Keep whichever window shows more of the source.
    expect(merged[0]!.excerpt).toBe("…S0 S1 S2…");
  });

  it("keeps distinct passages apart", () => {
    expect(
      dedupeEvidence([
        { claims: ["a"], excerpt: "one passage here", rung: "node" },
        { claims: ["b"], excerpt: "a different one", rung: "node" },
      ]),
    ).toHaveLength(2);
  });

  it("keeps unlocated claims without inventing a passage", () => {
    const merged = dedupeEvidence([{ claims: ["a"], excerpt: null, rung: "node" }]);
    expect(merged[0]!.excerpt).toBeNull();
  });
});
