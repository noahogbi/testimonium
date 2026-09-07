import { describe, expect, it } from "vitest";
import { check } from "../src/check.js";
import type { Fetcher, RawResponse, RungId } from "../src/fetch/types.js";

// Deliberately NO fixture reads here. These tests exercise check() against a
// stub fetcher and must not depend on Task 3's manually captured corpus - a
// missing fixtures/corpus.json would otherwise crash the whole file at
// collection time, for tests that never touch the network.

function stub(per: Partial<Record<RungId, Partial<RawResponse>>>, rungs: RungId[] = ["node", "curl"]): Fetcher {
  return {
    rungs,
    async fetch(url, rung) {
      return {
        rawBody: "", status: 0, headers: {}, finalUrl: url, bytes: 0,
        ...(per[rung] ?? {}),
      } as RawResponse;
    },
  };
}

const LONG_PROSE = `<html><title>The Committee Report</title><body>${"The committee report states that spending rose sharply. ".repeat(120)}</body></html>`;

describe("check", () => {
  it("returns supported when every claim is present", async () => {
    const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }),
    });
    expect(r.verdict).toBe("supported");
    expect(r.evidence?.length).toBeGreaterThan(0);
  });

  it("returns unsupported when a claim is absent from a document we read", async () => {
    const r = await check("https://e.com/committee-report", ["spending rose sharply", "no such phrase"], {
      fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }),
    });
    expect(r.verdict).toBe("unsupported");
    expect(r.missed).toEqual(["no such phrase"]);
    expect(r).not.toHaveProperty("evidence");
  });

  it("falls through to curl when the node rung is challenged", async () => {
    const wall = "<html><body>Verifying you are human.</body></html>";
    const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: wall, status: 202 }, curl: { rawBody: LONG_PROSE, status: 200 } }),
    });
    expect(r.verdict).toBe("supported");
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
  });

  it("returns unreachable, not unsupported, when every rung is challenged", async () => {
    const wall = "<html><body>Verifying you are human.</body></html>";
    const r = await check("https://e.com/a", ["anything"], {
      fetcher: stub({ node: { rawBody: wall, status: 202 }, curl: { rawBody: wall, status: 202 } }),
    });
    expect(r.verdict).toBe("unreachable");
  });

  it("returns unreachable when a vendor challenge header is present at 200", async () => {
    const r = await check("https://e.com/a", ["anything"], {
      fetcher: stub({
        node: { rawBody: LONG_PROSE, status: 200, headers: { "cf-mitigated": "challenge" } },
        curl: { rawBody: LONG_PROSE, status: 200, headers: { "cf-mitigated": "challenge" } },
      }),
    });
    expect(r.verdict).toBe("unreachable");
  });

  it("returns unclaimed rather than supported for an empty claim list", async () => {
    const r = await check("https://e.com/a", [], { fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }) });
    expect(r.verdict).toBe("unclaimed");
  });

  it("marks the ladder truncated when a rung is unavailable", async () => {
    const r = await check("https://e.com/a", ["nope"], {
      fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }, ["node"]),
    });
    expect(r.ladderTruncated).toBe(true);
  });

  it("ignores HTTP status entirely - a document under a 404 still reads", async () => {
    const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: LONG_PROSE, status: 404 } }),
    });
    expect(r.verdict).toBe("supported");
  });
});
