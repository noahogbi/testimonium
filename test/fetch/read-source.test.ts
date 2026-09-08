import { describe, expect, it, vi } from "vitest";
import { bestReadable, readSource, type Read } from "../../src/fetch/read-source.js";
import { computeSignals } from "../../src/classify/signals.js";
import type { Fetcher, RawResponse, RungId } from "../../src/fetch/types.js";

// Deliberately NO fixture reads here, as in check.test.ts: the reader is a
// loop, and the loop's behaviour is what these pin.
function stub(per: Partial<Record<RungId, Partial<RawResponse>>>, rungs: RungId[] = ["node", "curl"]): Fetcher {
  return {
    rungs,
    async fetch(url, rung) {
      return { rawBody: "", status: 0, headers: {}, finalUrl: url, bytes: 0, ...(per[rung] ?? {}) } as RawResponse;
    },
  };
}

const URL = "https://e.com/committee-report";
const SENTENCE = "The committee report states that spending rose sharply. ";
// 120 repetitions measure 6,740 prose characters; 90 measure 5,060. Both clear
// the 4,500 floor; the second is the smaller.
const LONG_PROSE = `<html><title>The Committee Report</title><body>${SENTENCE.repeat(120)}</body></html>`;
const SMALLER_PROSE = `<html><title>The Committee Report</title><body>${SENTENCE.repeat(90)}</body></html>`;
const WALL = "<html><body>Verifying you are human.</body></html>";

describe("readSource", () => {
  it("returns every rung's read in the order attempted, vetoed reads included", async () => {
    const r = await readSource(URL, ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: WALL, status: 202 }, curl: { rawBody: LONG_PROSE, status: 200 } }),
      sourceLabel: "Quarterly Newsletter Digest",
    });
    expect(r.attempted).toEqual(["node", "curl"]);
    expect(r.reads.map((x) => x.rung)).toEqual(["node", "curl"]);
    expect(r.reads[0]?.computed.signals.challengeSignature).toBe(true);
    expect(r.reads[1]?.computed.matchedClaims).toEqual(["spending rose sharply"]);
    expect(r.pdfUrl).toBe(false);
    // Pins that sourceLabel crosses check -> readSource -> computeSignals (a
    // seam no test covered). The label-free overlap for reads[1] is already
    // 1.0 here (URL path alone matches the body), so this call carries an
    // unrelated label instead of none, and the matching label below scores
    // strictly higher.
    const second = await readSource(URL, ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: WALL, status: 202 }, curl: { rawBody: LONG_PROSE, status: 200 } }),
      sourceLabel: "The Committee Report",
    });
    expect(second.reads[1]!.computed.signals.slugLabelOverlap).toBeGreaterThan(
      r.reads[1]!.computed.signals.slugLabelOverlap,
    );
  });

  it("stops after the first readable read", async () => {
    const r = await readSource(URL, [], {
      fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 }, curl: { rawBody: LONG_PROSE, status: 200 } }),
    });
    expect(r.attempted).toEqual(["node"]);
  });

  it("climbs past a first read vetoed only by N4, and only by N5, over the floor", async () => {
    // Spec 6.6, "Escalation": the unified rule is the wider of the two the
    // callers used to hold. At 3974d27 check() stopped here and reachability()
    // climbed. check.test.ts and reachability.test.ts pin each caller; this
    // pins the loop they now share.
    const n4 = stub({ node: { rawBody: LONG_PROSE, status: 404 }, curl: { rawBody: LONG_PROSE, status: 200 } });
    const n5 = stub({
      node: { rawBody: LONG_PROSE, status: 200, headers: { "content-type": "application/pdf" } },
      curl: { rawBody: LONG_PROSE, status: 200 },
    });
    for (const [name, fetcher] of [["N4", n4], ["N5", n5]] as const) {
      const r = await readSource(URL, [], { fetcher });
      expect(r.attempted, name).toEqual(["node", "curl"]);
    }
  });

  it("degrades a throwing fetcher to an unread rung, warns, and keeps climbing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const throwing: Fetcher = { rungs: ["node", "curl"], async fetch() { throw new Error("boom"); } };
      const r = await readSource(URL, [], { fetcher: throwing });
      expect(r.attempted).toEqual(["node", "curl"]);
      expect(r.reads.map((x) => x.computed.signals.proseChars)).toEqual([0, 0]);
      expect(warn).toHaveBeenCalledTimes(2);
      expect(String(warn.mock.calls[0]?.[0])).toContain(`rung "node" threw for ${URL}: boom`);
    } finally {
      warn.mockRestore();
    }
  });

  it("selects pdftotext by URL shape and attempts nothing when the machine lacks it", async () => {
    const r = await readSource("https://e.com/paper.pdf", [], { fetcher: stub({}, ["node", "curl"]) });
    expect(r.pdfUrl).toBe(true);
    expect(r.attempted).toEqual([]);
    expect(r.reads).toEqual([]);
  });
});

describe("bestReadable", () => {
  const read = (rung: RungId, rawBody: string, status = 200, headers: Record<string, string> = {}): Read => ({
    rung,
    computed: computeSignals({ rawBody, headers, finalUrl: URL, status, claims: [] }),
  });

  it("is undefined when no read is readable", () => {
    expect(bestReadable([])).toBeUndefined();
    expect(bestReadable([read("node", WALL, 202), read("curl", LONG_PROSE, 404)])).toBeUndefined();
  });

  it("returns the readable read with the most prose, ignoring a larger vetoed one", () => {
    const reads = [read("node", LONG_PROSE, 200, { "cf-mitigated": "challenge" }), read("curl", SMALLER_PROSE)];
    expect(bestReadable(reads)?.rung).toBe("curl");
  });

  it("breaks a tie toward the earlier rung", () => {
    expect(bestReadable([read("node", LONG_PROSE), read("curl", LONG_PROSE)])?.rung).toBe("node");
  });
});
