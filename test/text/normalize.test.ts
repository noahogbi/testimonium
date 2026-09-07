import { describe, expect, it } from "vitest";
import { norm, phraseFound } from "../../src/text/normalize.js";

describe("norm", () => {
  it("folds smart quotes to ASCII", () => {
    expect(norm("\u2018quoted\u2019 and \u201Cquoted\u201D")).toBe("'quoted' and \"quoted\"");
  });

  it("strips zero-width characters injected by syndication mirrors", () => {
    // A single Reuters-carrying article held 21 of these mid-phrase.
    expect(norm("in contact\u2060with Tesla")).toBe("in contactwith tesla");
    expect(norm("Austin,\u200BTexas")).toBe("austintexas");
  });

  it("folds every Unicode dash to ASCII hyphen", () => {
    // OpenAI writes model names with U+2011 NON-BREAKING HYPHEN.
    expect(norm("GPT\u20116 Astra")).toBe("gpt-6 astra");
    expect(norm("a\u2010b\u2012c\u2013d\u2014e\u2015f\u2212g")).toBe("a-b-c-d-e-f-g");
  });

  it("folds billion and million renderings", () => {
    expect(norm("$6.5 billion")).toBe(norm("$6.5bn"));
    expect(norm("40 million users")).toBe(norm("40mn users"));
  });

  it("strips commas so digit grouping cannot cause a miss", () => {
    expect(norm("1,234,567")).toBe("1234567");
  });

  it("collapses whitespace and trims", () => {
    expect(norm("  a   b  ")).toBe("a b");
  });

  it("pulls a space before punctuation back onto the word", () => {
    // toText replaces EVERY tag with a space, including the </i> that sits
    // immediately before a period in "...or file not <i>found</i>." So the
    // tool's own extractor produces a space no reader of the rendered page
    // ever saw, and a verbatim claim misses against it. On a document that
    // cleared the prose floor, that miss is an ACCUSATION.
    expect(norm("or file not found .")).toBe("or file not found.");
    expect(norm("a ; b : c ! d ? e 23 % f ) g ] h }")).toBe("a; b: c! d? e 23% f) g] h}");
    expect(norm("( a [ b { c")).toBe("(a [b {c");
  });

  it("does NOT remove the space AFTER terminal punctuation", () => {
    // The other direction would make the claim "1.5" match a list rendering
    // "1. 5 things" - a match manufactured out of a numbered list.
    expect(norm("1. 5 things")).toBe("1. 5 things");
  });
});

describe("phraseFound", () => {
  it("matches across typographic differences", () => {
    expect(phraseFound("we\u2019ve made the decision", "we've made the decision")).toBe(true);
  });

  it("does not match paraphrase", () => {
    expect(phraseFound("the company shut the service down", "the company closed the service")).toBe(false);
  });

  it("matches a phrase copied verbatim from a rendered page across an inline tag", () => {
    // The Wikipedia case from the first real run: <i>file not found</i>. in
    // the markup, "file not found ." out of toText, and a hand-copied claim
    // punctuated the way a person punctuates.
    const extracted = "The code is often referred to as page not found or file not found .";
    expect(phraseFound(extracted, "referred to as page not found or file not found.")).toBe(true);
  });

  it("still refuses a numbered-list rendering of a decimal", () => {
    expect(phraseFound("1. 5 things you should know", "1.5 things")).toBe(false);
  });
});
