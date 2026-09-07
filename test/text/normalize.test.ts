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
});

describe("phraseFound", () => {
  it("matches across typographic differences", () => {
    expect(phraseFound("we\u2019ve made the decision", "we've made the decision")).toBe(true);
  });

  it("does not match paraphrase", () => {
    expect(phraseFound("the company shut the service down", "the company closed the service")).toBe(false);
  });
});
