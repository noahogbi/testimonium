import { describe, it, expect } from "vitest";
import { toTextRegions } from "../../src/text/extract.js";
import { excerptFor } from "../../src/text/excerpt.js";
import { phraseFound } from "../../src/text/normalize.js";
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
    const ex = r.evidence?.[0]?.excerpt;
    // Non-null FIRST: with `?? ""` a null excerpt passed the not.toContain
    // below, so the test could not tell "excerpt from one region" from "no
    // excerpt at all".
    expect(ex).toEqual(expect.any(String));
    // Pre-change the excerpt reads "...The board met again in march quietly..." -
    // a passage conjoining two separate meta tags as one sequence.
    expect(ex).not.toContain("The board met again in march");
  });

  it("falls through to a later region when the first match cannot be excerpted", async () => {
    // The body MATCHES via norm's billion->bn fold but cannot be excerpted,
    // because excerptFor's fold deliberately omits length-changing folds. The
    // description carries the literal text and excerpts perfectly. Stopping at
    // the first MATCHING region drops evidence the flat lookup used to find.
    const page = `<html><head><meta name="description" content="Report says the deal was worth 6.5bn dollars in total, analysts noted."></head>` +
      `<body><p>In a filing on Tuesday the merger was valued at 6.5 billion dollars in total, the company said.</p></body></html>`;
    const regions = toTextRegions(page);
    const claim = "6.5bn dollars in total";
    expect(phraseFound(regions[0] as string, claim)).toBe(true);   // body matches
    expect(excerptFor(regions[0] as string, claim)).toBeNull();    // but cannot excerpt
    expect(excerptFor(regions[1] as string, claim)).not.toBeNull(); // a later one can
    // The OBSERVED behaviour, through check(). The assertions above re-derive
    // the traversal by hand and stay green if check() itself regresses -
    // reverting all of 049da8f left them green. This one does not: stopping
    // at the first MATCHING region yields a null excerpt here.
    const r = await check("https://x.test/a", [claim], { fetcher: fetcherFor(page) as never });
    expect(r.verdict).toBe("supported");
    expect(r.evidence?.[0]?.excerpt).toBe("Report says the deal was worth 6.5bn dollars in total, analysts noted.");
  });
});
