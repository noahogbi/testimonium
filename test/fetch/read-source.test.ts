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
    // Pins that readSource hands sourceLabel to computeSignals (a seam no test
    // covered). The check -> readSource hop is not pinned: the label reaches
    // only slugLabelOverlap, which never gates and is not on CitationResult,
    // so nothing check() returns can observe it. The label-free overlap for
    // reads[1] is already 1.0 here (URL path alone matches the body), so this
    // call carries an unrelated label instead of none, and the matching label
    // below scores strictly higher.
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
    // callers used to hold. At 6546176 check() stopped here and reachability()
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

  it("re-routes to the PDF rung when an HTML rung returns application/pdf", async () => {
    // fixtures/documents/sample.pdf does not exist; the body is built here
    // instead. The PDF magic prefix followed by C0 control bytes is what
    // makes this "not text" on its own bytes, independent of the
    // content-type header also tripping N5's other branch - the point is a
    // body that is not text arriving with a PDF content-type, same as a real
    // PDF served without a .pdf URL would.
    const pdfBody = "%PDF-1.4" + "\u0000\u0000\u0000" + "not-text-stream-data";
    const extracted = "The quick brown fox jumps over the lazy dog.";
    const fetcher: Fetcher = {
      rungs: ["node", "curl", "pdftotext"],
      async fetch(url, rung) {
        if (rung === "pdftotext") {
          return { rawBody: extracted, status: 200, headers: {}, finalUrl: url, bytes: extracted.length };
        }
        return {
          rawBody: pdfBody,
          status: 200,
          headers: { "content-type": "application/pdf" },
          finalUrl: url,
          bytes: pdfBody.length,
        };
      },
    };
    const out = await readSource("https://example.com/doc", ["quick brown fox jumps"], { fetcher });
    expect(out.attempted).toContain("pdftotext");
  });

  it("carries the finalUrl each read was classified under", async () => {
    // RawResponse has always carried it and computeSignals has always
    // received it; nothing could read it back. Harvest needs it to report a
    // redirect away from the cited path (spec 8.2 step 2). It is REPORTED
    // and gates nothing - test/check.test.ts's redirect pin asserts that the
    // verdict is unmoved by it.
    const body = `<html><body>${"The committee report states that spending rose sharply. ".repeat(120)}</body></html>`;
    const { reads } = await readSource("https://e.com/a", [], {
      fetcher: {
        rungs: ["node", "curl"] as RungId[],
        async fetch() {
          return {
            rawBody: body,
            status: 200,
            headers: {},
            finalUrl: "https://e.com/elsewhere",
            bytes: 0,
          };
        },
      },
    });
    expect(reads[0]!.computed.finalUrl).toBe("https://e.com/elsewhere");
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
