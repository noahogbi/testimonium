import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toText } from "../../src/text/extract.js";

describe("toText", () => {
  it("removes script and style bodies entirely", () => {
    const html = "<p>real</p><script>var x = 'fake';</script><style>.a{color:red}</style>";
    expect(toText(html)).toBe("real");
  });

  it("decodes numeric entities in BOTH decimal and hex forms", () => {
    // CNBC emits &#x27; for an apostrophe. Without the hex branch a claim
    // quoting "we've made the decision to close AWS Mechanical Turk" reports
    // MISS against a page that plainly carries it, and the curl fallback
    // cannot rescue it because the entity is in the bytes from either fetcher.
    expect(toText("we&#x27;ve")).toBe("we've");
    expect(toText("we&#8217;ve")).toBe("we’ve");
  });

  it("leaves an out-of-range numeric entity in place rather than throwing", () => {
    expect(toText("&#1114112;")).toBe("&#1114112;");
  });

  it("collapses tag boundaries to whitespace, not to nothing", () => {
    expect(toText("<p>one</p><p>two</p>")).toBe("one two");
  });
});

describe("fixture corpus", () => {
  const corpus = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));

  it("has both halves", () => {
    const kinds = new Set(corpus.map((c: { kind: string }) => c.kind));
    expect(kinds).toEqual(new Set(["challenge", "document"]));
  });

  it("has at least 15 challenge fixtures and at least 8 document fixtures", () => {
    // 15, not 20: several of the battery's 23 cases are false-positive probes
    // rather than walls, and Step 3 classifies them individually. The real
    // gate is Task 4's acceptance test, not a headcount.
    const n = (k: string) => corpus.filter((c: { kind: string }) => c.kind === k).length;
    expect(n("challenge")).toBeGreaterThanOrEqual(15);
    expect(n("document")).toBeGreaterThanOrEqual(8);
  });

  it("every fixture file is readable and non-empty", () => {
    for (const c of corpus) {
      expect(readFileSync(c.path, "utf8").length).toBeGreaterThan(0);
    }
  });

  it("no fixture references a path outside this repo", () => {
    for (const c of corpus) {
      expect(c.path.startsWith("fixtures/")).toBe(true);
    }
  });
});
