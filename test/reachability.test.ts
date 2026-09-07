import { describe, expect, it } from "vitest";
import { reachability } from "../src/reachability.js";
import type { Fetcher, RawResponse, RungId } from "../src/fetch/types.js";

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
    // extracts 13,221 characters of it - read `readable` here and
    // `unreachable` at the gate. A preflight that contradicts the gate is
    // worse than no preflight; both now call the SAME predicate.
    const r = await reachability(["https://e.com/gone"], {
      fetcher: stub({ "https://e.com/gone": LONG }, 404),
    });
    expect(r.readable).toEqual([]);
    expect(r.unreadable[0]?.reason).toMatch(/gone/);
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
});
