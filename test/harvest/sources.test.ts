import { describe, expect, it } from "vitest";
import { scanSources } from "../../src/harvest/sources.js";
import { parseClaimsFile } from "../../src/io/claims.js";
import { THRESHOLDS, proseVolume } from "../../src/classify/thresholds.js";
import { toText } from "../../src/text/extract.js";
import type { Fetcher, RawResponse, RungId } from "../../src/fetch/types.js";
import type { Footnote } from "../../src/adapters/types.js";

// No fixture reads: bodies are built inline, as test/check.test.ts's are.
function stub(per: Partial<Record<RungId, Partial<RawResponse>>>, rungs: RungId[] = ["node", "curl"]): Fetcher {
  return {
    rungs,
    async fetch(url, rung) {
      return { rawBody: "", status: 0, headers: {}, finalUrl: url, bytes: 0, ...(per[rung] ?? {}) } as RawResponse;
    },
  };
}

const DOC_BODY = `<html><title>The Committee Report</title><body>${"The committee report states that spending rose sharply. ".repeat(120)}</body></html>`;
const STUB_BODY = "<html><body><p>The committee report states that spending rose sharply.</p></body></html>";
const WALL = "<html><body>Verifying you are human.</body></html>";
const fn = (n: number, url: string | null, label = "L"): Footnote => ({ n, url, label });

describe("scanSources", () => {
  it("reads a normalized URL once, keyed by the first citation spelling", async () => {
    // Spec 8.2 step 1: citations are grouped by normalizeUrl; a URL cited
    // under two spellings is read once and keyed by the first spelling seen.
    // Reading it twice would double the fetches and give the draft file two
    // keys parseClaimsFile then refuses as a collision (Fable F8).
    let fetches = 0;
    const fetcher: Fetcher = {
      rungs: ["node", "curl"] as RungId[],
      async fetch(url) {
        fetches += 1;
        return { rawBody: DOC_BODY, status: 200, headers: {}, finalUrl: url, bytes: 0 };
      },
    };
    const scan = await scanSources(
      [fn(1, "https://e.com/a?utm_source=news"), fn(2, "https://E.com/a")],
      { fetcher },
    );
    expect(scan.sources.map((s) => s.url)).toEqual(["https://e.com/a?utm_source=news"]);
    expect(scan.sources[0]!.key).toBe("https://e.com/a");
    expect(fetches).toBe(1);
  });

  it("keeps only READABLE reads: a sub-floor stub proposes nothing (Fable F1)", async () => {
    // The stub passes all five vetoes and fails only the prose floor. Under
    // `!isBlocked` it would be a harvest source, and harvest would propose
    // the lede that check() then attests against a paywall stub.
    expect(proseVolume(toText(STUB_BODY))).toBeLessThan(THRESHOLDS.minProseChars);
    const scan = await scanSources([fn(1, "https://e.com/a")], {
      fetcher: stub({ node: { rawBody: STUB_BODY, status: 200 }, curl: { rawBody: STUB_BODY, status: 200 } }),
    });
    expect(scan.sources).toEqual([]);
    expect(scan.unreachable).toEqual([{ url: "https://e.com/a", rungsAttempted: ["node", "curl"] }]);
  });

  it("reports an unreachable URL with every rung it attempted", async () => {
    const scan = await scanSources([fn(1, "https://e.com/a")], {
      fetcher: stub({ node: { rawBody: WALL, status: 202 }, curl: { rawBody: WALL, status: 202 } }),
    });
    expect(scan.sources).toEqual([]);
    expect(scan.unreachable[0]!.rungsAttempted).toEqual(["node", "curl"]);
  });

  it("skips a notApplicable URL, lists it with its reason, and never fetches it", async () => {
    // Spec 8.2 step 1. The author has declared the URL not checkable; a
    // proposal for it is a proposal she has already refused.
    let fetches = 0;
    const fetcher: Fetcher = {
      rungs: ["node"] as RungId[],
      async fetch(url) {
        fetches += 1;
        return { rawBody: DOC_BODY, status: 200, headers: {}, finalUrl: url, bytes: 0 };
      },
    };
    const claims = parseClaimsFile('{"https://e.com/a":{"notApplicable":"rests on the filing itself"}}');
    const scan = await scanSources([fn(1, "https://e.com/a")], { fetcher, claims });
    expect(scan.sources).toEqual([]);
    expect(scan.skipped).toEqual([{ url: "https://e.com/a", reason: "rests on the filing itself" }]);
    expect(fetches).toBe(0);
  });

  it("flags a readable read whose finalUrl path differs from the cited path", async () => {
    // Fable F5, path 3: a redirect to a homepage that shares a sentence with
    // the draft. Reported beside the proposals, never gating - the author is
    // the one who decides whether the page she got is the page she cited.
    const scan = await scanSources([fn(1, "https://e.com/2019/committee-report")], {
      fetcher: stub({ node: { rawBody: DOC_BODY, status: 200, finalUrl: "https://e.com/" } }),
    });
    expect(scan.sources[0]!.redirectedTo).toBe("https://e.com/");
  });

  it("does not flag a redirect that keeps the path", async () => {
    // A tracking-parameter or scheme redirect is not the exposure; only a
    // different PATH is (spec 8.2 step 2).
    const scan = await scanSources([fn(1, "http://e.com/committee-report")], {
      fetcher: stub({ node: { rawBody: DOC_BODY, status: 200, finalUrl: "https://e.com/committee-report?ref=x" } }),
    });
    expect(scan.sources[0]!.redirectedTo).toBeNull();
  });

  it("never fetches a footnote with no external source", async () => {
    let fetches = 0;
    const fetcher: Fetcher = {
      rungs: ["node"] as RungId[],
      async fetch(url) {
        fetches += 1;
        return { rawBody: DOC_BODY, status: 200, headers: {}, finalUrl: url, bytes: 0 };
      },
    };
    const scan = await scanSources([fn(1, null, "an internal cross-link")], { fetcher });
    expect(scan.sources).toEqual([]);
    expect(scan.unreachable).toEqual([]);
    expect(fetches).toBe(0);
  });
});
