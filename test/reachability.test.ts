import { describe, expect, it, vi } from "vitest";
import { reachability } from "../src/reachability.js";
import type { Fetcher, RawResponse, RungId } from "../src/fetch/types.js";
import type { FetcherOptions } from "../src/fetch/default-fetcher.js";
import { proseVolume } from "../src/classify/thresholds.js";
import { toText } from "../src/text/extract.js";

// NOTE: repeat(120) of this 35-char unit (plus the extracted <title>) totals
// ~4,208 chars - BELOW THRESHOLDS.minProseChars (4,500, calibrated in an
// earlier task). A fixture meant to represent a readable document must clear
// the floor with margin; repeat(140) totals ~4,908, matching the safety
// margin check.test.ts's own LONG_PROSE fixture carries (its 6,720 chars is
// far past 4,500 too). See task-14-report.md for this finding.
const LONG = `<html><title>A Report</title><body>${"Ordinary prose in a real document. ".repeat(140)}</body></html>`;
const WALL = "<html><body>Verifying you are human.</body></html>";

function stub(bodies: Record<string, string>, status = 200): Fetcher {
  return {
    rungs: ["node", "curl"] as RungId[],
    async fetch(url): Promise<RawResponse> {
      const rawBody = bodies[url] ?? "";
      return { rawBody, status, headers: {}, finalUrl: url, bytes: rawBody.length };
    },
  };
}

/** Per-RUNG bodies for one URL, recording the rungs fetched: the ladder's
 *  climb is observable even when the result carries no rungsAttempted (a
 *  readable entry does not). */
function perRung(per: Partial<Record<RungId, Partial<RawResponse>>>, calls: RungId[] = []): Fetcher {
  return {
    rungs: ["node", "curl"] as RungId[],
    async fetch(url, rung) {
      calls.push(rung);
      return { rawBody: "", status: 0, headers: {}, finalUrl: url, bytes: 0, ...(per[rung] ?? {}) } as RawResponse;
    },
  };
}

const REPL = String.fromCodePoint(0xfffd);
// A binary body decoded as UTF-8, long enough to clear the prose floor so the
// only thing that can veto it is N5, not the floor.
const BINARY = "%PDF-1.7 " + (" " + REPL + REPL).repeat(2500);

describe("reachability", () => {
  it("reports readable and unreadable without needing any claims", async () => {
    const r = await reachability(["https://e.com/a", "https://e.com/b"], {
      fetcher: stub({ "https://e.com/a": LONG, "https://e.com/b": WALL }),
    });
    expect(r.readable.map((x) => x.url)).toEqual(["https://e.com/a"]);
    expect(r.unreadable.map((x) => x.url)).toEqual(["https://e.com/b"]);
  });

  it("reports a rate as a fraction of the URLs given", async () => {
    const r = await reachability(["https://e.com/a", "https://e.com/b"], {
      fetcher: stub({ "https://e.com/a": LONG, "https://e.com/b": WALL }),
    });
    expect(r.rate).toBeCloseTo(0.5);
  });

  it("returns a rate of 1 for an empty list rather than dividing by zero", async () => {
    expect((await reachability([], { fetcher: stub({}) })).rate).toBe(1);
  });

  it("agrees with the gate on a 404 that still serves a full page of chrome", async () => {
    // The preflight computed `blocked` from the three challenge signals and
    // omitted N4, so a 404 serving intact navigation - the real ECB capture
    // extracts 13,216 characters of it - read `readable` here and
    // `unreachable` at the gate. A preflight that contradicts the gate is
    // worse than no preflight; both now call the SAME predicate.
    const r = await reachability(["https://e.com/gone"], {
      fetcher: stub({ "https://e.com/gone": LONG }, 404),
    });
    expect(r.readable).toEqual([]);
    expect(r.unreadable[0]?.reason).toMatch(/gone/);
  });

  it("reports a non-text body distinctly from a challenge interstitial (N5)", async () => {
    // Without the carve-out placed BEFORE the `challenged` branch, N5 implies
    // `isBlocked` and every preflighted binary body would fall through to
    // "challenge interstitial" - a false diagnosis of exactly the class the
    // N4 carve-out two lines above exists to prevent.
    const r = await reachability(["https://e.com/paper"], {
      fetcher: stub({ "https://e.com/paper": BINARY }, 200),
    });
    expect(r.readable).toEqual([]);
    expect(r.unreadable[0]?.reason).toMatch(/not text/);
    expect(r.unreadable[0]?.reason).not.toMatch(/challenge interstitial/);
  });

  it("degrades a throwing fetcher to an unread rung rather than aborting the preflight", async () => {
    // Ruling C12's contract, at the SECOND call site: check() caught and
    // warned, reachability called fetch unwrapped, and both are exported.
    const throwing: Fetcher = {
      rungs: ["node", "curl"] as RungId[],
      async fetch() {
        throw new Error("boom");
      },
    };
    const r = await reachability(["https://e.com/a"], { fetcher: throwing });
    expect(r.unreadable.map((x) => x.url)).toEqual(["https://e.com/a"]);
    expect(r.unreadable[0]?.rungsAttempted).toEqual(["node", "curl"]);
  });

  it("climbs past a first rung vetoed only by N4, and only by N5, over the floor", async () => {
    // Spec 6.6, "Escalation". The preflight's own copy of the loop already
    // climbed on all five vetoes at 6546176, and check()'s did not; this pins
    // the behaviour so moving onto the shared reader cannot lose it. The
    // matching test in check.test.ts is the one that failed first.
    for (const [name, per] of [
      ["N4", { node: { rawBody: LONG, status: 404 }, curl: { rawBody: LONG, status: 200 } }],
      ["N5", { node: { rawBody: LONG, status: 200, headers: { "content-type": "application/pdf" } }, curl: { rawBody: LONG, status: 200 } }],
    ] as const) {
      const calls: RungId[] = [];
      await reachability(["https://e.com/a"], { fetcher: perRung(per, calls) });
      expect(calls, name).toEqual(["node", "curl"]);
    }
  });

  it("calls a URL readable when a later rung read it, though an earlier rung was walled (rule 5)", async () => {
    // At 6546176 the preflight ORed the vetoes across every rung, so a host
    // that walled node and served curl the document was readable to check()
    // and unreadable here - the README carried it as a known disagreement.
    // Spec 6.6 rule 5: readable iff SOME read is readable, judged from the
    // same reads the gate judges from. Written first, this failed with
    // `expected [] to deeply equal [ { url: ..., proseChars: ..., rung: 'curl' } ]`.
    const r = await reachability(["https://e.com/a"], {
      fetcher: perRung({ node: { rawBody: WALL, status: 202 }, curl: { rawBody: LONG, status: 200 } }),
    });
    expect(r.readable).toEqual([{ url: "https://e.com/a", proseChars: proseVolume(toText(LONG)), rung: "curl" }]);
    expect(r.unreadable).toEqual([]);
    expect(r.rate).toBe(1);
  });

  it("still diagnoses an unreadable URL from every read: gone outranks the wall", async () => {
    // Rule 5 changes who is readable, not how an unreadable URL is described.
    const r = await reachability(["https://e.com/a"], {
      fetcher: perRung({ node: { rawBody: WALL, status: 202 }, curl: { rawBody: LONG, status: 404 } }),
    });
    expect(r.readable).toEqual([]);
    expect(r.unreadable[0]?.reason).toBe("the origin says the document is gone (404/410)");
    expect(r.unreadable[0]?.rungsAttempted).toEqual(["node", "curl"]);
  });
});

describe("reachability: identity wiring (ReachabilityOptions -> FetcherOptions)", () => {
  // Task 16's third wire proof - the twin of test/check.test.ts's "check()
  // itself forwards CheckOptions.identity" test, against reachability()
  // instead. An empty URL list still builds the fetcher (buildFetcher runs
  // before the per-URL loop), so this never touches the network.
  it("forwards ReachabilityOptions.identity into the defaultFetcher(...) call at the construction site, and omits it when absent", async () => {
    vi.resetModules();
    const defaultFetcherSpy = vi.fn((_opts: FetcherOptions = {}) => ({
      rungs: [] as RungId[],
      fetch: async () => {
        throw new Error("must not be called: rungs is empty");
      },
    }));
    vi.doMock("../src/fetch/default-fetcher.js", () => ({ defaultFetcher: defaultFetcherSpy }));
    try {
      const { reachability: reachabilityWithMockedFetcher } = await import("../src/reachability.js");

      await reachabilityWithMockedFetcher([], { identity: "example-app contact@example.com" });
      expect(defaultFetcherSpy).toHaveBeenCalledTimes(1);
      expect(defaultFetcherSpy.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({ identity: "example-app contact@example.com" }),
      );

      defaultFetcherSpy.mockClear();
      await reachabilityWithMockedFetcher([], {});
      expect(defaultFetcherSpy).toHaveBeenCalledTimes(1);
      expect(defaultFetcherSpy.mock.calls[0]?.[0]).not.toHaveProperty("identity");
    } finally {
      vi.doUnmock("../src/fetch/default-fetcher.js");
      vi.resetModules();
    }
  });
});
