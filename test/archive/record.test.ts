import { describe, expect, it } from "vitest";
import { buildArchiveEntry, recordingFetcher, type RecordedRead } from "../../src/archive/record.js";
import { blobHash, claimsHashFor } from "../../src/archive/format.js";
import { check } from "../../src/check.js";
import type { Fetcher, RawResponse, RungId } from "../../src/fetch/types.js";

function stub(per: Partial<Record<RungId, Partial<RawResponse>>>, rungs: RungId[] = ["node", "curl"]): Fetcher {
  return {
    rungs,
    async fetch(url, rung) {
      return { rawBody: "", status: 0, headers: {}, finalUrl: url, bytes: 0, ...(per[rung] ?? {}) } as RawResponse;
    },
  };
}

const CLAIM = "spending rose sharply";
const DOC = `<html><title>The Committee Report</title><body>${`The committee report states that ${CLAIM}. `.repeat(120)}</body></html>`;
const WALL = "<html><body>Verifying you are human.</body></html>";

const read = (rung: RungId, r: Partial<RawResponse>): RecordedRead => ({
  rung,
  response: { rawBody: "", status: 0, headers: {}, finalUrl: "", bytes: 0, ...r },
});

const ENTRY_DEFAULTS = {
  verdict: "supported" as const,
  claims: [CLAIM],
  toolVersion: "0.1.0",
  localRulesHash: null,
  pdftotextVersion: null,
  archivedAt: "2026-09-09T00:00:00.000Z",
};

describe("the recording fetcher", () => {
  it("hands back the inner response unchanged", async () => {
    const inner = stub({ node: { rawBody: DOC, status: 200, headers: { "content-type": "text/html" } } });
    const rec = recordingFetcher(inner);
    expect(await rec.fetcher.fetch("https://e.com/report", "node")).toEqual(await inner.fetch("https://e.com/report", "node"));
  });

  it("advertises the inner fetcher's rungs verbatim, so the ladder and ladderTruncated are unchanged", async () => {
    // `rungsAvailable` and `isLadderTruncated` are both computed from
    // fetcher.rungs (src/io/evidence.ts). A wrapper that recomputed them would
    // change what `check` reports about the host.
    expect(recordingFetcher(stub({}, ["node"])).fetcher.rungs).toEqual(["node"]);
    expect(recordingFetcher(stub({}, ["node", "curl", "pdftotext"])).fetcher.rungs).toEqual(["node", "curl", "pdftotext"]);
  });

  it("records EVERY attempted read in order, not the winning one", async () => {
    // The fixture is designed to resist the mutation "record the last read" AND
    // "record the winning read": node is walled and curl carries the document,
    // so the winning read is the SECOND and the first is a body no verdict
    // rests on - and the archive needs both, because each read's veto is
    // decided from its own headers, finalUrl and status.
    const rec = recordingFetcher(stub({ node: { rawBody: WALL, status: 202 }, curl: { rawBody: DOC, status: 200 } }));
    const r = await check("https://e.com/report", [CLAIM], { fetcher: rec.fetcher });
    expect(r.verdict).toBe("supported");
    expect(rec.reads.map((x) => x.rung)).toEqual(["node", "curl"]);
    expect(rec.reads[0]?.response.rawBody).toBe(WALL);
    expect(rec.reads[1]?.response.rawBody).toBe(DOC);
  });

  it("composes with buildArchiveEntry: the real Recorder.reads from a check() run, not a hand-built fixture", async () => {
    // The two describe blocks below never meet on their own: every
    // buildArchiveEntry test elsewhere hand-builds RecordedRead[] through the
    // read() helper. TypeScript guarantees the shapes line up; it does not
    // guarantee the two halves interoperate. This pipes an ACTUAL
    // Recorder.reads - produced by a real check() run through the tee -
    // straight into buildArchiveEntry, with no hand-built fixture in between.
    const rec = recordingFetcher(stub({ node: { rawBody: WALL, status: 202 }, curl: { rawBody: DOC, status: 200 } }));
    const r = await check("https://e.com/report", [CLAIM], { fetcher: rec.fetcher });
    expect(r.verdict).toBe("supported");

    const staged = buildArchiveEntry({ ...ENTRY_DEFAULTS, verdict: r.verdict, reads: rec.reads });

    expect(staged.entry.reads.map((x) => x.rung)).toEqual(["node", "curl"]);
    expect(staged.entry.reads.map((x) => x.status)).toEqual([202, 200]);
    expect(staged.blobs.size).toBe(2);
    expect(staged.blobs.get(staged.entry.reads[0]!.hash)).toBe(WALL);
    expect(staged.blobs.get(staged.entry.reads[1]!.hash)).toBe(DOC);
  });

  it("records nothing for a rung whose inner fetch throws, and does not abort the run", async () => {
    // The Fetcher contract says a fetcher must not throw; readSource degrades a
    // throwing rung to an unread rung with a warning. The recorder must not
    // paper over that - a rung with no recorded read replays as EMPTY_RESPONSE,
    // which is exactly what the live arm saw.
    const inner: Fetcher = {
      rungs: ["node", "curl"],
      async fetch(url, rung) {
        if (rung === "curl") throw new Error("boom");
        return { rawBody: WALL, status: 202, headers: {}, finalUrl: url, bytes: 0 };
      },
    };
    const rec = recordingFetcher(inner);
    const r = await check("https://e.com/report", [CLAIM], { fetcher: rec.fetcher });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(rec.reads.map((x) => x.rung)).toEqual(["node"]);
  });
});

describe("buildArchiveEntry", () => {
  it("archives every attempted read, with one blob per distinct body", () => {
    const staged = buildArchiveEntry({
      ...ENTRY_DEFAULTS,
      reads: [read("node", { rawBody: WALL, status: 202 }), read("curl", { rawBody: DOC, status: 200 })],
    });
    expect(staged.entry.reads.map((r) => r.rung)).toEqual(["node", "curl"]);
    expect(staged.blobs.size).toBe(2);
    expect(staged.blobs.get(blobHash(WALL))).toBe(WALL);
    expect(staged.blobs.get(blobHash(DOC))).toBe(DOC);
    expect(staged.entry.reads[0]?.hash).toBe(blobHash(WALL));
  });

  it("collapses two identical bodies to ONE blob - content addressing", () => {
    const staged = buildArchiveEntry({
      ...ENTRY_DEFAULTS,
      reads: [read("node", { rawBody: DOC, status: 200 }), read("curl", { rawBody: DOC, status: 200 })],
    });
    expect(staged.entry.reads).toHaveLength(2);
    expect(staged.blobs.size).toBe(1);
    expect(staged.entry.reads[0]?.hash).toBe(staged.entry.reads[1]?.hash);
  });

  it("never records set-cookie, in any casing, and keeps every other header", () => {
    // These files are committed. A session cookie in git is a credential leak.
    const staged = buildArchiveEntry({
      ...ENTRY_DEFAULTS,
      reads: [read("node", { rawBody: DOC, status: 200, headers: { "Set-Cookie": "session=abc123", "CF-Mitigated": "challenge" } })],
    });
    expect(JSON.stringify(staged.entry)).not.toContain("abc123");
    expect(staged.entry.reads[0]?.headers).toEqual({ "CF-Mitigated": "challenge" });
  });

  it("records finalUrl verbatim, INCLUDING an empty one", () => {
    // readSource applies `response.finalUrl || url`. Storing anything other
    // than what came back - the index key, say - would hand the replayed
    // classifier a URL the original read never had, and both N2 and the slug
    // anchor read finalUrl.
    const staged = buildArchiveEntry({ ...ENTRY_DEFAULTS, reads: [read("node", { rawBody: DOC, status: 200, finalUrl: "" })] });
    expect(staged.entry.reads[0]?.finalUrl).toBe("");
  });

  it("stamps the pdftotext version on a pdftotext read and on no other rung", () => {
    // The mutation this catches: stamping it on every read. Only the pdftotext
    // rung's blob is tool output; a node read carrying a poppler version would
    // make an HTML citation confounded by a poppler upgrade.
    const staged = buildArchiveEntry({
      ...ENTRY_DEFAULTS,
      pdftotextVersion: "pdftotext version 4.00",
      reads: [read("node", { rawBody: DOC, status: 200 }), read("pdftotext", { rawBody: DOC, status: 0 })],
    });
    expect(staged.entry.reads[0]?.pdftotextVersion).toBeNull();
    expect(staged.entry.reads[1]?.pdftotextVersion).toBe("pdftotext version 4.00");
  });

  it("hashes the claims through claimsHashFor, so the confound test and the write agree", () => {
    // Built FROM the function under test rather than restating a literal
    // digest, so the fixture cannot go stale when the canonicalization changes.
    const staged = buildArchiveEntry({ ...ENTRY_DEFAULTS, claims: ["beta claim here", "alpha claim here"], reads: [] });
    expect(staged.entry.claimsHash).toBe(claimsHashFor(["alpha claim here", "beta claim here"]));
  });

  it("carries the verdict, the timestamp and both provenance halves through unchanged", () => {
    const staged = buildArchiveEntry({
      ...ENTRY_DEFAULTS,
      toolVersion: "9.9.9",
      localRulesHash: "deadbeef",
      reads: [read("node", { rawBody: DOC, status: 200 })],
    });
    expect(staged.entry.verdict).toBe("supported");
    expect(staged.entry.archivedAt).toBe("2026-09-09T00:00:00.000Z");
    expect(staged.entry.toolVersion).toBe("9.9.9");
    expect(staged.entry.localRulesHash).toBe("deadbeef");
  });

  it("records the status of each read, because N4 is decided from it", () => {
    const staged = buildArchiveEntry({
      ...ENTRY_DEFAULTS,
      reads: [read("node", { rawBody: "", status: 404 }), read("curl", { rawBody: DOC, status: 200 })],
    });
    expect(staged.entry.reads.map((r) => r.status)).toEqual([404, 200]);
  });

  it("NEGATIVE CONTROL: an entry with no reads stages no blobs and no reads", () => {
    // Without this, a builder that ignored its input entirely would pass the
    // provenance tests above.
    const staged = buildArchiveEntry({ ...ENTRY_DEFAULTS, reads: [] });
    expect(staged.entry.reads).toEqual([]);
    expect(staged.blobs.size).toBe(0);
  });
});
