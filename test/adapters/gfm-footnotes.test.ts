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

  it("keeps a parenthesised path intact, bare and as a markdown link", () => {
    // /wiki/Mercury_(planet) is an ordinary URL shape. Excluding ")" from the
    // character class truncated it mid-URL; the truncated URL then fetches,
    // 404s, and reports unreachable - indistinguishable from a broken link.
    const bare = parseGfmFootnotes("[^1]: See https://en.wikipedia.org/wiki/Mercury_(planet) for details.\n");
    expect(bare.footnotes[0]!.url).toBe("https://en.wikipedia.org/wiki/Mercury_(planet)");
    const md = parseGfmFootnotes("[^1]: See [the article](https://en.wikipedia.org/wiki/Mercury_(planet)) here.\n");
    expect(md.footnotes[0]!.url).toBe("https://en.wikipedia.org/wiki/Mercury_(planet)");
  });

  it("still strips an unbalanced closing paren from a prose aside", () => {
    // The reason ")" was excluded in the first place. Balance, not exclusion,
    // is what tells these two cases apart.
    const d = parseGfmFootnotes("[^1]: Background (see https://example.com/x) and more.\n");
    expect(d.footnotes[0]!.url).toBe("https://example.com/x");
  });

  it("reads an indented continuation line under CRLF as well as LF", () => {
    // A JS regex `.` never matches \r, so the continuation alternative failed
    // silently on every CRLF document and the URL vanished into url: null.
    const lf = parseGfmFootnotes("[^1]: Jane Roe, The Report.\n    https://example.gov/report\n");
    const crlf = parseGfmFootnotes("[^1]: Jane Roe, The Report.\r\n    https://example.gov/report\r\n");
    expect(lf.footnotes[0]!.url).toBe("https://example.gov/report");
    expect(crlf.footnotes[0]!.url).toBe("https://example.gov/report");
  });

  it("does NOT absorb an unindented following paragraph", () => {
    // The most dangerous shape found: a continuation rule that excluded blank
    // lines but never required indentation pulled the next paragraph in and
    // attributed ITS url to the citation. The tool would then fetch and
    // verify claims against a source the author never cited.
    const d = parseGfmFootnotes(
      "[^1]: See the discussion at /posts/previous for background.\n" +
        "Meanwhile, in unrelated news, https://unrelated.example.com/wrong was published.\n",
    );
    expect(d.footnotes[0]!.url).toBeNull();
    expect(d.footnotes[0]!.label).not.toContain("unrelated");
  });

  it("ignores footnote syntax inside a fenced code block", () => {
    // A code sample showing footnote syntax is documentation, not a citation.
    const d = parseGfmFootnotes(
      "Docs:\n\n```markdown\n[^1]: Example https://example.com/sample\n```\n\n[^1]: Real https://example.gov/real\n",
    );
    expect(d.footnotes).toHaveLength(1);
    expect(d.footnotes[0]!.url).toBe("https://example.gov/real");
  });

  it("closes a fence only on a run of the same character, at least as long", () => {
    // A four-tick fence wrapping a three-tick example is how documentation
    // about markdown is written. Truncating the marker to three characters let
    // the inner ``` close early: the trapped example leaked out as a live
    // citation, and the real closer became a new opener that swallowed every
    // footnote after it.
    const doc =
      "````markdown\n" +
      "To close a normal fence, write:\n" +
      "```\n" +
      "[^1]: Trapped https://example.com/trapped\n" +
      "````\n\n" +
      "[^2]: Real https://example.gov/real\n";
    const d = parseGfmFootnotes(doc);
    expect(d.footnotes).toHaveLength(1);
    expect(d.footnotes[0]!.url).toBe("https://example.gov/real");
  });

  it("does not treat a prose reference NEAR a url as a definition", () => {
    // The original version of this test used text containing no URL at all,
    // so a parser that merely scanned for https:// would also have passed it.
    const d = parseGfmFootnotes(
      "See the discussion at https://example.com/prose-mention for background.[^1] No definition follows.\n",
    );
    expect(d.footnotes).toEqual([]);
  });

  it("prose drops a whole footnote definition, continuation lines included", () => {
    // Fable F17: DEFINITION consumes indented continuation lines. A stripper
    // that took only the first line would leave the source's own title and
    // URL in the document's prose, and harvest would propose them back to
    // the author as claims she had copied.
    const md = [
      "The committee reported a rise in spending.[^1]",
      "",
      '[^1]: Jane Roe, "The Committee Report", Example Gov, 12 May 2026.',
      "    https://example.gov/report",
      "    Quoted: spending rose sharply in the fourth quarter.",
      "",
    ].join("\n");
    const { prose } = parseGfmFootnotes(md);
    expect(prose).toContain("The committee reported a rise in spending.");
    expect(prose).not.toContain("Jane Roe");
    expect(prose).not.toContain("https://example.gov/report");
    expect(prose).not.toContain("spending rose sharply in the fourth quarter");
  });

  it("prose blanks fenced code, so a code sample is never proposed as a claim", () => {
    // Four-tick fence around a three-tick example: the shape the parser's own
    // blankFencedCode exists for. prose uses the same pass, so the two views
    // of the document cannot disagree about what is code.
    //
    // The comment line's URL is NOT footnote-definition-shaped ("[^n]:" at
    // the start of a line), so nothing but blankFencedCode can be removing
    // it. Without this line the test passed even when blankFencedCode was
    // skipped entirely, because the [^9]: line is DEFINITION-shaped and the
    // DEFINITION pass alone strips it - a coincidence, not a discrimination.
    const md = [
      "Real prose the author wrote.",
      "",
      "````markdown",
      "```",
      "[^9]: Not a citation, https://example.com/not-cited",
      "// see https://example.com/leaked-if-not-blanked",
      "```",
      "````",
      "",
    ].join("\n");
    const { prose } = parseGfmFootnotes(md);
    expect(prose).toContain("Real prose the author wrote.");
    expect(prose).not.toContain("https://example.com/not-cited");
    expect(prose).not.toContain("https://example.com/leaked-if-not-blanked");
  });

  it("prose keeps a footnote REFERENCE marker's sentence - only definitions go", () => {
    const { prose } = parseGfmFootnotes("Spending rose sharply.[^1]\n\n[^1]: https://example.gov/a\n");
    expect(prose).toContain("Spending rose sharply.");
    expect(prose).not.toContain("example.gov");
  });

  it("body stays the original markdown; prose is normalized to LF", () => {
    // `body` is the contract every existing caller has: the original bytes,
    // line endings intact. `prose` is derived from the LF-normalized copy the
    // footnote loop reads, because a JS regex `.` never matches \r and the
    // two views must be built from one text.
    const md = "Prose line one.\r\nProse line two.\r\n\r\n[^1]: https://example.gov/a\r\n";
    const d = parseGfmFootnotes(md);
    expect(d.body).toBe(md);
    expect(d.prose).toContain("\n");
    expect(d.prose).not.toContain("\r");
    expect(d.prose).not.toContain("example.gov");
  });
});
