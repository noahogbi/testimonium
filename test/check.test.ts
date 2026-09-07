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

  it("degrades a throwing fetcher to an unread rung rather than aborting the run", async () => {
    // The Fetcher contract says do not throw, but a third-party one might.
    // One bad rung must not abort a document with nineteen other citations in
    // it - and it must be warned about, not silently dropped.
    const throwing: Fetcher = {
      rungs: ["node", "curl"] as RungId[],
      async fetch() {
        throw new Error("boom");
      },
    };
    const r = await check("https://e.com/a", ["anything"], { fetcher: throwing });
    expect(r.verdict).toBe("unreachable");
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r).not.toHaveProperty("evidence");
  });

  it("does not consult HTTP status outside the 404/410 veto", async () => {
    // The property the design actually holds. A 400 or a 500 says nothing
    // about whether the bytes are the document - spec 6.3 records a 400
    // serving 253KB and a 404 serving 112KB - so a document that matches its
    // claims under one of those statuses is supported.
    for (const status of [400, 418, 500, 503]) {
      const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
        fetcher: stub({ node: { rawBody: LONG_PROSE, status } }),
      });
      expect(r.verdict, `status ${status}`).toBe("supported");
    }
  });

  it("a 404 or 410 vetoes even a full match, end to end", async () => {
    // N4, exercised through the front door rather than only at the reducer.
    // A server is not authoritative about PRESENCE, which is why 2xx is never
    // proof of a read - but it IS authoritative when it says a resource does
    // not exist. Calibration forced this: no prose floor could reject a real
    // ECB 404 serving 13,221 characters of navigation chrome, and with the
    // veto removed zero thresholds satisfied the acceptance test.
    //
    // The cost is recorded and accepted: a misconfigured host serving a real
    // document under a 404 loses its evidence. That degrades to unreachable,
    // which renders nothing and fails nothing - the safe direction.
    for (const status of [404, 410]) {
      const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
        fetcher: stub({ node: { rawBody: LONG_PROSE, status } }),
      });
      expect(r.verdict, `status ${status}`).toBe("unreachable");
      expect(r, `status ${status}`).not.toHaveProperty("evidence");
    }
  });
});
