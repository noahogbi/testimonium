import { describe, expect, it } from "vitest";
import { movedAway } from "../../src/classify/moved.js";

describe("movedAway", () => {
  it("fires on a non-root page landing on a site root, on any host", () => {
    expect(movedAway("https://e.com/reports/2024-annual", "https://e.com/")).toBe(true);
    expect(movedAway("https://e.com/reports/2024-annual", "https://e.com")).toBe(true);
    expect(movedAway("https://e.com/reports/2024-annual", "https://other.org/")).toBe(true);
  });

  it("fires on a page landing on an ancestor of its own path", () => {
    expect(movedAway("https://e.com/news/2024/story", "https://e.com/news")).toBe(true);
    expect(movedAway("https://e.com/news/2024/story", "https://e.com/news/")).toBe(true);
    expect(movedAway("https://blog.e.com/2024/post", "https://e.com/2024")).toBe(true);
  });

  it("does not fire on the same page, a child, a root cited URL, or an unreadable landing", () => {
    // Same page after scheme, www., trailing slash, query, fragment and case.
    expect(movedAway("http://www.e.com/a/b", "https://e.com/A/B/?q=1#top")).toBe(false);
    // Review Focus 3: a child path is not an ancestor.
    expect(movedAway("https://e.com/news", "https://e.com/news/index.html")).toBe(false);
    // Review Focus 1: a cited root is never moved away.
    expect(movedAway("https://e.com/", "https://e.com/")).toBe(false);
    expect(movedAway("https://e.com/", "https://other.org/landing")).toBe(false);
    // A sibling whose name starts with the landed path is not under it.
    expect(movedAway("https://e.com/newsroom/x", "https://e.com/news")).toBe(false);
    // No evidence of a move.
    expect(movedAway("https://e.com/a/b", "")).toBe(false);
    expect(movedAway("https://e.com/a/b", "not a url")).toBe(false);
    expect(movedAway("not a url", "https://e.com/")).toBe(false);
    // Review Focus 2: encoding and a malformed escape.
    expect(movedAway("https://e.com/Caf%C3%A9/x", "https://e.com/caf\u00e9")).toBe(true);
    expect(movedAway("https://e.com/a/%E0%A4%A/b", "https://e.com/a/%E0%A4%A")).toBe(true);
  });

  it("treats a query-addressed page at the root as a page, not the root", () => {
    // Final review, Important 2. `/?p=123` (WordPress short links, `?id=`,
    // `?article=`) has path `/`, so a removal redirect to the bare homepage
    // read as "cited root, never moved" and was still accused.
    expect(movedAway("https://e.com/?p=123", "https://e.com/")).toBe(true);
    expect(movedAway("https://e.com/?p=123", "https://e.com")).toBe(true);
    // Narrow: a canonical move to the article's own path is not moved away,
    // nor is the same query, nor a landing that still carries a query.
    expect(movedAway("https://e.com/?p=123", "https://e.com/2024/post/")).toBe(false);
    expect(movedAway("https://e.com/?p=123", "https://e.com/?p=123")).toBe(false);
    expect(movedAway("https://e.com/?p=123", "https://e.com/?lang=en")).toBe(false);
  });

  it("does not fire on any of the 15 redirects measured on 2026-09-25 - each is the same article at a new address", () => {
    const MEASURED: [string, string][] = [
      ["https://www.euronews.com/my-europe/2026/09/10/the-eu-got-access-to-anthropics-most-powerful-model-three-months-later", "https://www.euronews.com/2026/09/10/the-eu-got-access-to-anthropics-most-powerful-model-three-months-later"],
      ["https://openai.com/index/introducing-ai-futures/", "https://openai.com/index/introducing-intelligence-age/"],
      ["https://www.euronews.com/my-europe/2026/07/30/eu-opens-call-for-seven-gigafactories-to-train-next-generation-ai-technologies", "https://www.euronews.com/2026/07/30/eu-opens-call-for-seven-gigafactories-to-train-next-generation-ai-technologies"],
      ["https://www.euronews.com/next/2026/05/13/trump-called-nvidias-jensen-huang-to-join-china-summit-at-last-minute-report", "https://www.euronews.com/2026/05/13/trump-called-nvidias-jensen-huang-to-join-china-summit-at-last-minute-report"],
      ["https://www.sec.gov/Archives/edgar/data/0001517375/000151737526000052/spt-20260715.htm", "https://www.sec.gov/Archives/edgar/data/1517375/000151737526000052/spt-20260715.htm"],
      ["https://cognition.ai/blog/series-e", "https://cognition.com/blog/series-e"],
      ["https://cognition.ai/blog/series-d", "https://cognition.com/blog/series-d"],
      ["https://deepmind.google/blog/introducing-agentic-video-in-gemini/", "https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-agentic-video-in-gemini/"],
      ["https://developers.openai.com/codex/app/computer-use", "https://learn.chatgpt.com/docs/computer-use"],
      ["https://openai.com/index/economic-research-exchange/", "https://openai.com/index/introducing-the-openai-economic-research-exchange/"],
      ["https://techcrunch.com/2026/07/15/apple-intelligence-approved-for-launch-in-china-with-alibabas-qwen-ai/", "https://techcrunch.com/2026/07/16/apple-intelligence-approved-for-launch-in-china-with-alibabas-qwen-ai/"],
      ["https://newsroom.intel.com/corporate/intel-announces-upsize-and-pricing-of-20-billion-common-stock-offering", "https://www.intel.com/content/www/us/en/newsroom/news/corporate/intel-announces-upsize-and-pricing-of-20-billion-common-stock-offering.html"],
      ["https://www.assorthealth.com/blog/assort-health-raises-120-million-series-c-to-scale-largest-deployment-of-ai-agents-for-the-patient-journey", "https://www.assorthealth.com/press/assort-health-raises-120-million-series-c-to-scale-largest-deployment-of-ai-agents-for-the-patient-journey"],
      ["https://ilga.gov/legislation/billstatus.asp?DocNum=315&GAID=18&GA=104&DocTypeID=SB", "https://ilga.gov/Legislation/BillStatus?DocNum=315&GAID=18&GA=104&DocTypeID=SB"],
      ["https://www.theregister.com/2026/05/04/five_eyes_agentic_ai_recommendations/", "https://www.theregister.com/security/2026/05/04/five-eyes-warn-agentic-ai-is-too-dangerous-for-rapid-rollout/5229103"],
    ];
    expect(MEASURED).toHaveLength(15);
    for (const [c, l] of MEASURED) expect(movedAway(c, l), `${c} -> ${l}`).toBe(false);
  });
});
