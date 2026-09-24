import { describe, it, expect } from "vitest";
import { computeSignals } from "../../src/classify/signals.js";

const sig = (rawBody: string, claims: string[]) =>
  computeSignals({ rawBody, headers: {}, finalUrl: "https://x.test/", status: 200, claims });

describe("per-region matching", () => {
  it("does NOT match a claim spanning the body/description join", () => {
    const h = `<meta name="description" content="quarterly filings without objection.">` +
              `<body><p>The committee reviewed the</p></body>`;
    expect(sig(h, ["reviewed the quarterly filings without objection"]).signals.matched).toBe(0);
  });

  it("does NOT match a claim spanning two description values", () => {
    const h = `<meta name="description" content="The board met in March.">` +
              `<meta property="og:description" content="Revenue rose twelve percent.">` +
              `<body><p>Body.</p></body>`;
    expect(sig(h, ["met in March. Revenue rose twelve percent"]).signals.matched).toBe(0);
  });

  it("DOES match a claim inside one description value", () => {
    const h = `<meta name="description" content="Revenue rose twelve percent.">` +
              `<body><p>Body.</p></body>`;
    expect(sig(h, ["Revenue rose twelve percent"]).signals.matched).toBe(1);
  });

  it("DOES match a claim a cross-join fold had destroyed", () => {
    // norm folds "12 billion" to "12bn" across the join, so this claim fails
    // against the flat concatenation and must succeed against the region.
    const h = `<meta name="description" content="billion users grew during the quarter">` +
              `<body><p>Revenue was 12</p></body>`;
    expect(sig(h, ["billion users grew"]).signals.matched).toBe(1);
  });

  it("a short page whose signature phrase exists only across a region join is not vetoed by it", () => {
    // Measured 2026-09-23 at 0.6.2: the join-only page below WAS vetoed
    // (challengeSignature true, firedRule "JS-disabled shell, imperative phrasing.").
    const joinOnly =
      `<meta name="description" content="javascript on to read this page.">` +
      `<html><body><p>Our report on transit spending. Please turn</p></body></html>`;
    const inRegion = `<html><body><p>Our report on transit spending. Please turn javascript on to read this page.</p></body></html>`;
    const claims = ["our report on transit spending"];
    expect(sig(joinOnly, claims).regions).toEqual(["Our report on transit spending. Please turn", "javascript on to read this page."]);
    expect(sig(joinOnly, claims).signals.challengeSignature).toBe(false);
    expect(sig(joinOnly, claims).firedRule).toBeNull();
    expect(sig(inRegion, claims).signals.challengeSignature).toBe(true);
    expect(sig(inRegion, claims).firedRule?.note).toBe("JS-disabled shell, imperative phrasing.");
  });
});
