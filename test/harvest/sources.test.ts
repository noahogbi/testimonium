import { describe, expect, it } from "vitest";
import { scanSources } from "../../src/harvest/sources.js";
import { parseClaimsFile } from "../../src/io/claims.js";
import { computeSignals } from "../../src/classify/signals.js";
import { THRESHOLDS, proseVolume } from "../../src/classify/thresholds.js";
import { isBlocked } from "../../src/classify/verdict.js";
import { toText, toTextRegions } from "../../src/text/extract.js";
import { norm } from "../../src/text/normalize.js";
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

  it("pins the shape of a source's reads: rung, its regions, and their norms - and no flat text", async () => {
    // Review r1, Important 1: the earlier tests pin which URLs become
    // sources but never what a source CONTAINS. Task 5's frequency filter
    // reads normRegions directly (spec 8.2 step 3); an unnormalized
    // normRegions, or one built from the flat joined text instead of per region,
    // would silently under-drop boilerplate with nothing here going red.
    // Built from toTextRegions/norm THEMSELVES, not restated, so a
    // change to either cannot desynchronize this pin from what they
    // actually do.
    //
    // The readable read is deliberately CURL, not node: a hardcoded
    // `rung: "node"` mutation would pass this assertion vacuously if the
    // fixture's real rung already happened to be "node".
    const scan = await scanSources([fn(1, "https://e.com/a")], {
      fetcher: stub({ node: { rawBody: WALL, status: 202 }, curl: { rawBody: DOC_BODY, status: 200 } }),
    });
    const regions = toTextRegions(DOC_BODY);
    expect(scan.sources[0]!.reads).toEqual([
      { rung: "curl", regions, normRegions: regions.map(norm) },
    ]);
    expect(scan.sources[0]!.rungsAttempted).toEqual(["node", "curl"]);
  });

  it("keeps only READABLE reads: a sub-floor stub proposes nothing (Fable F1)", async () => {
    // The stub passes all five vetoes and fails only the prose floor. Under
    // `!isBlocked` it would be a harvest source, and harvest would propose
    // the lede that check() then attests against a paywall stub.
    expect(proseVolume(toText(STUB_BODY))).toBeLessThan(THRESHOLDS.minProseChars);
    // The premise this whole test depends on: STUB_BODY trips no veto. If it
    // ever acquired one, the assertions below would pass VACUOUSLY under
    // `!isBlocked` too, and this test would silently stop exercising the
    // most important guard in the plan (review r1, Important 2). Held here
    // rather than trusted from the file's history.
    expect(isBlocked(computeSignals({
      rawBody: STUB_BODY, headers: {}, finalUrl: "https://e.com/a",
      status: 200, claims: [],
    }).signals)).toBe(false);
    const scan = await scanSources([fn(1, "https://e.com/a")], {
      fetcher: stub({ node: { rawBody: STUB_BODY, status: 200 }, curl: { rawBody: STUB_BODY, status: 200 } }),
    });
    expect(scan.sources).toEqual([]);
    expect(scan.unreachable).toEqual([{ url: "https://e.com/a", rungsAttempted: ["node", "curl"], pdfUrl: false }]);
  });

  it("reports an unreachable URL with every rung it attempted", async () => {
    const scan = await scanSources([fn(1, "https://e.com/a")], {
      fetcher: stub({ node: { rawBody: WALL, status: 202 }, curl: { rawBody: WALL, status: 202 } }),
    });
    expect(scan.sources).toEqual([]);
    expect(scan.unreachable[0]!.rungsAttempted).toEqual(["node", "curl"]);
  });

  it("carries pdfUrl on an unreachable PDF citation, for a machine that cannot read PDFs", async () => {
    // Task 8's report needs to tell "we could not read it" from "this
    // machine cannot read PDFs" (review r1, Minor 3) - the same distinction
    // `check` already surfaces via `isPdfUrl` (src/check.ts:89,164).
    const scan = await scanSources([fn(1, "https://e.com/paper.pdf")], {
      fetcher: stub({}, ["node", "curl"]),
    });
    expect(scan.sources).toEqual([]);
    expect(scan.unreachable).toEqual([{ url: "https://e.com/paper.pdf", rungsAttempted: [], pdfUrl: true }]);
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
