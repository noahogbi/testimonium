import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { toText, toTextRegions } from "../../src/text/extract.js";

describe("toTextRegions", () => {
  it("joins back to exactly what toText returns, over every fixture", () => {
    const dirs = ["fixtures/documents", "fixtures/challenge", "fixtures/paired"];
    let checked = 0;
    for (const dir of dirs) {
      let names: string[];
      try { names = readdirSync(dir); } catch { continue; }
      for (const f of names) {
        if (!/\.html?$/i.test(f)) continue;
        const html = readFileSync(`${dir}/${f}`, "utf8");
        expect(toTextRegions(html).join(" "), f).toBe(toText(html));
        checked++;
      }
    }
    // Guard against the glob silently matching nothing.
    expect(checked).toBeGreaterThan(30);
  });

  it("reproduces 0.5.0's toText byte for byte, per fixture", () => {
    // The real fidelity proof. The join test above is a tautology once toText is
    // DEFINED as the join; this one compares against hashes taken before the change.
    const expected = JSON.parse(readFileSync("fixtures/totext-0-5-0.json", "utf8")) as Record<string, string>;
    const names = Object.keys(expected);
    expect(names.length).toBeGreaterThan(30);
    for (const rel of names) {
      const got = createHash("sha256").update(toText(readFileSync(rel, "utf8"))).digest("hex");
      expect(got, rel).toBe(expected[rel]);
    }
  });

  it("returns the body alone when there is no description", () => {
    expect(toTextRegions("<body><p>Only body.</p></body>")).toEqual(["Only body."]);
  });

  it("returns each distinct description value as its own region", () => {
    const h = `<meta name="description" content="First one.">` +
              `<meta property="og:description" content="Second one.">` +
              `<body><p>Body.</p></body>`;
    expect(toTextRegions(h)).toEqual(["Body.", "First one.", "Second one."]);
  });

  it("deduplicates identical values into one region", () => {
    const s = "Same sentence.";
    const h = `<meta name="description" content="${s}">` +
              `<meta property="og:description" content="${s}">` +
              `<body><p>Body.</p></body>`;
    expect(toTextRegions(h)).toEqual(["Body.", s]);
  });

  it("omits an empty region rather than emitting a stray separator", () => {
    // A description that decodes to whitespace only. Without the empty-region
    // filter this yields a trailing "" and toText gains a trailing separator -
    // which the 38-fixture hash test does NOT catch, because no fixture is
    // shaped this way. Verified by mutation.
    const h = `<meta name="description" content="&nbsp;"><body><p>Body.</p></body>`;
    expect(toTextRegions(h)).toEqual(["Body."]);
  });

  it("returns the description at index 0 when the body normalizes to empty", () => {
    // Position is not a label. Callers must identify a region by searching it.
    const h = `<meta name="description" content="Real content."><body>   </body>`;
    expect(toTextRegions(h)).toEqual(["Real content."]);
  });
});
