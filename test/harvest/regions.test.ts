import { describe, it, expect } from "vitest";
import { computeSignals } from "../../src/classify/signals.js";
import { phraseFound } from "../../src/text/normalize.js";

describe("harvest proposals are check-matchable", () => {
  it("proposes no span that check() would then reject", () => {
    const html = `<meta name="description" content="quarterly filings without objection.">` +
                 `<body><p>The committee reviewed the</p></body>`;
    const s = computeSignals({ rawBody: html, headers: {}, finalUrl: "https://x.test/", status: 200, claims: [] });
    // Any span a per-region harvest could propose must live inside one region.
    const spanning = "reviewed the quarterly filings without objection";
    expect(phraseFound(s.text, spanning)).toBe(true);           // the flat string still contains it
    expect(s.regions.some((r) => phraseFound(r, spanning))).toBe(false); // no region does
  });
});
