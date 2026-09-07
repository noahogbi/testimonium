import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toText } from "../../src/text/extract.js";
import { phraseFound } from "../../src/text/normalize.js";

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

// ONE CASE PER PUNCTUATION CLASS, so the set in normalize.ts cannot silently
// shrink. Each is the same defect: an inline tag closes immediately before the
// punctuation, toText inserts a space there, and a claim copied verbatim from
// the RENDERED page - where no such space exists - misses. A miss on a
// document that cleared the prose floor is a false accusation, so this is the
// keystone rule's territory, not typography.
describe("a claim copied from the rendered page survives toText's tag spacing", () => {
  it.each([".", ";", ":", "!", "?", "%", ")", "]", "}"])("closing punctuation %s", (p) => {
    const html = `<p>the reported value is <i>known</i>${p} and the text continues</p>`;
    expect(toText(html)).toContain(` ${p}`); // the artifact the extractor really produces
    expect(phraseFound(toText(html), `the reported value is known${p} and the text continues`)).toBe(true);
  });

  it.each(["(", "[", "{"])("opening punctuation %s", (p) => {
    const html = `<p>see ${p}<i>note</i> below</p>`;
    expect(toText(html)).toContain(`${p} `);
    expect(phraseFound(toText(html), `see ${p}note below`)).toBe(true);
  });
});

describe("fixture corpus", () => {
  const corpus = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));

  it("has both halves, and no kind beyond the declared known-gap one", () => {
    // `known-gap` is a THIRD kind on purpose, and it is not a population: it
    // files a real capture a second time under the status that exposes a
    // documented hole, so the exposure lives as a fixture rather than as a
    // line in a ledger. Neither calibration nor the acceptance test reads it.
    const kinds = new Set(corpus.map((c: { kind: string }) => c.kind));
    expect(kinds).toEqual(new Set(["challenge", "document", "known-gap"]));
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
