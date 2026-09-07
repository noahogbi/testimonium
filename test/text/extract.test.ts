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

const CP = String.fromCodePoint;
const EM = CP(0x2014); // em dash
const EN = CP(0x2013); // en dash
const EACUTE = CP(0xe9); // e-acute
const HELLIP = CP(0x2026);
const LDQUO = CP(0x201c);
const RDQUO = CP(0x201d);

describe("entity decoding is canonical", () => {
  it("decodes every spelling of one code point identically", () => {
    // toText once disagreed with ITSELF: &#8212; and &mdash; became "--" while
    // &#x2014; fell through to the numeric branch and produced the literal
    // character, which norm folds to "-". A claim copied verbatim from a
    // rendered page then matched or missed depending on how the SOURCE markup
    // spelled a character no author can see.
    const forms = ["&mdash;", "&#8212;", "&#x2014;", EM];
    const out = forms.map((f) => toText("<p>profits" + f + "up sharply</p>"));
    expect(new Set(out).size, JSON.stringify(out)).toBe(1);
  });

  it("agrees with norm on every dash spelling", () => {
    for (const f of ["&mdash;", "&#8212;", "&#x2014;", EM, "&ndash;", "&#8211;", EN]) {
      const text = toText("<p>profits" + f + "up sharply</p>");
      expect(phraseFound(text, "profits" + EM + "up sharply"), f).toBe(true);
    }
  });

  it("decodes the named entities a real citation hits", () => {
    expect(toText("<p>caf&eacute;</p>")).toBe("caf" + EACUTE);
    expect(toText("<p>&Eacute;cole</p>")).toBe(CP(0xc9) + "cole");
    expect(toText("<p>fen&ecirc;tre</p>")).toBe("fen" + CP(0xea) + "tre");
    expect(toText("<p>TNF-&alpha;</p>")).toBe("TNF-" + CP(0x3b1));
    expect(toText("<p>and so on&hellip;</p>")).toBe("and so on" + HELLIP);
    expect(toText("<p>a &lt; b &gt; c</p>")).toBe("a < b > c");
    expect(toText("<p>&ldquo;quoted&rdquo;</p>")).toBe(LDQUO + "quoted" + RDQUO);
  });

  it("still decodes &amp; LAST so an escaped entity does not double-decode", () => {
    // "&amp;#x27;" is a literal "&#x27;" on the page, not an apostrophe.
    expect(toText("<p>&amp;#x27;</p>")).toBe("&#x27;");
  });

  it("leaves an unknown entity raw rather than guessing", () => {
    expect(toText("<p>&nosuchentity;</p>")).toBe("&nosuchentity;");
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
