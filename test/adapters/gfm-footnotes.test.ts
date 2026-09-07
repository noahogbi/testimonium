import { describe, expect, it } from "vitest";
import { parseGfmFootnotes } from "../../src/adapters/gfm-footnotes.js";

const DOC = `Some prose with a citation.[^1] And another.[^2] And a third.[^note]

[^1]: Jane Roe, "The Report", *Example Gov*, 12 May 2026. https://example.gov/report
[^2]: See the earlier piece at /posts/previous for background.
[^note]: Bare link <https://example.com/b> in angle brackets.
`;

describe("parseGfmFootnotes", () => {
  it("extracts each footnote definition in document order", () => {
    expect(parseGfmFootnotes(DOC).footnotes.map((f) => f.n)).toEqual([1, 2, 3]);
  });

  it("takes the first external URL as the source", () => {
    expect(parseGfmFootnotes(DOC).footnotes[0]!.url).toBe("https://example.gov/report");
  });

  it("returns null for a footnote with no external URL", () => {
    expect(parseGfmFootnotes(DOC).footnotes[1]!.url).toBeNull();
  });

  it("handles angle-bracket autolinks", () => {
    expect(parseGfmFootnotes(DOC).footnotes[2]!.url).toBe("https://example.com/b");
  });

  it("numbers non-numeric labels by document position", () => {
    expect(parseGfmFootnotes(DOC).footnotes[2]!.n).toBe(3);
  });

  it("keeps the definition text as the label, without the marker", () => {
    expect(parseGfmFootnotes(DOC).footnotes[0]!.label).toContain("The Report");
    expect(parseGfmFootnotes(DOC).footnotes[0]!.label).not.toContain("[^1]:");
  });

  it("does not treat a reference in the body as a definition", () => {
    expect(parseGfmFootnotes("Text.[^1]\n").footnotes).toEqual([]);
  });

  it("strips trailing punctuation from a bare URL", () => {
    const d = parseGfmFootnotes("[^1]: See https://example.gov/report.\n");
    expect(d.footnotes[0]!.url).toBe("https://example.gov/report");
  });
});
