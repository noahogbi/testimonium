import { describe, it, expect } from "vitest";
import { check } from "../../src/check.js";

const fetcherFor = (html: string) => ({
  rungs: ["node"] as const,
  async fetch(url: string) {
    return { rawBody: html, status: 200, headers: { "content-type": "text/html" }, finalUrl: url, bytes: html.length };
  },
});

describe("excerpt provenance", () => {
  it("never returns a passage that spans two regions", async () => {
    // Every claim must clear THRESHOLDS.minClaimChars (16 normalized chars) or
    // check() throws at the door and the test fails for the wrong reason.
    // "met in march" is 12 and was rejected by an earlier draft of this plan.
    const h = `<meta name="description" content="The board met again">` +
              `<meta property="og:description" content="in march quietly the group met again in march quietly at noon">` +
              `<body><p>Body.</p></body>`;
    const r = await check("https://x.test/a", ["met again in march quietly"], { fetcher: fetcherFor(h) as never });
    expect(r.verdict).toBe("supported");
    const ex = r.evidence?.[0]?.excerpt ?? "";
    // Pre-change the excerpt reads "...The board met again in march quietly..." -
    // a passage conjoining two separate meta tags as one sequence.
    expect(ex).not.toContain("The board met again in march");
  });
});
