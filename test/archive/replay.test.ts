import { describe, expect, it, vi } from "vitest";
import { replayFetcher } from "../../src/archive/replay.js";
import { buildArchiveEntry, type RecordedRead } from "../../src/archive/record.js";
import { check } from "../../src/check.js";
import { EMPTY_RESPONSE, type RawResponse, type RungId } from "../../src/fetch/types.js";

const CLAIM = "spending rose sharply";
const DOC = `<html><title>The Committee Report</title><body>${`The committee report states that ${CLAIM}. `.repeat(120)}</body></html>`;
const WALL = "<html><body>Verifying you are human.</body></html>";
const URL_HTML = "https://e.com/report";
const URL_PDF = "https://e.com/filings/report.pdf";

const read = (rung: RungId, r: Partial<RawResponse>): RecordedRead => ({
  rung,
  response: { rawBody: "", status: 200, headers: {}, finalUrl: "", bytes: 0, ...r },
});

// Entries are built FROM buildArchiveEntry, never from hand-written literals,
// so a change to the entry shape cannot leave these fixtures asserting a stale
// one.
const entryOf = (reads: RecordedRead[]) =>
  buildArchiveEntry({
    verdict: "supported",
    claims: [CLAIM],
    reads,
    toolVersion: "0.1.0",
    localRulesHash: null,
    pdftotextVersion: null,
    archivedAt: "2026-09-09T00:00:00.000Z",
  });

/** A loader over the staged blob map - no filesystem, no binaries. */
const loaderFor = (staged: { blobs: ReadonlyMap<string, string> }) => (hash: string): string => {
  const body = staged.blobs.get(hash);
  if (body === undefined) throw new Error(`no blob ${hash}`);
  return body;
};

describe("the replay fetcher", () => {
  it("advertises the rungs recorded in the entry, never the machine's", () => {
    // The mutation this catches: `rungs: defaultFetcher().rungs`. This machine
    // has node (always) and usually curl and pdftotext, so an entry recording
    // curl alone cannot be satisfied by any machine-derived list.
    const s = entryOf([read("curl", { rawBody: DOC })]);
    expect(replayFetcher(s.entry, loaderFor(s)).rungs).toEqual(["curl"]);
    const p = entryOf([read("pdftotext", { rawBody: DOC, status: 0 })]);
    expect(replayFetcher(p.entry, loaderFor(p)).rungs).toEqual(["pdftotext"]);
  });

  it("makes check() attempt ONLY the recorded rung - the machine-independent form of the same pin", async () => {
    // Stronger than the assertion above and true on every machine: with rungs
    // taken from the machine, `nextAction` would try `node` first (HTML_ORDER
    // is ["node","curl"] and every machine has node), find no recorded read,
    // and climb - so rungsAttempted would be ["node","curl"].
    const s = entryOf([read("curl", { rawBody: DOC })]);
    const r = await check(URL_HTML, [CLAIM], { fetcher: replayFetcher(s.entry, loaderFor(s)) });
    expect(r.rungsAttempted).toEqual(["curl"]);
    expect(r.verdict).toBe("supported");
  });

  it("keeps ladderTruncated honest: rungsAvailable is the archive's list", async () => {
    // isLadderTruncated is computed from fetcher.rungs (src/io/evidence.ts).
    const p = entryOf([read("pdftotext", { rawBody: DOC, status: 0 })]);
    const r = await check(URL_PDF, [CLAIM], { fetcher: replayFetcher(p.entry, loaderFor(p)) });
    expect(r.rungsAvailable).toEqual(["pdftotext"]);
    expect(r.ladderTruncated).toBe(false);
    expect(r.verdict).toBe("supported");
  });

  it("replays a PDF citation with no pdftotext binary anywhere in the call", async () => {
    // This is what archiving the EXTRACTED TEXT buys: the replay arm runs on a
    // machine with no poppler at all. Requiring poppler to replay would break
    // recheck on precisely the CI and serverless runners 7.1 commits to
    // serving. The loader here is a Map lookup.
    const p = entryOf([read("pdftotext", { rawBody: DOC, status: 0 })]);
    const r = await check(URL_PDF, [CLAIM], { fetcher: replayFetcher(p.entry, loaderFor(p)) });
    expect(r.verdict).toBe("supported");
    expect(r.rungsAttempted).toEqual(["pdftotext"]);
  });

  it("returns each recorded read verbatim, INCLUDING an empty finalUrl", async () => {
    // The mutation this catches: `finalUrl: read.finalUrl || url` (or the index
    // key). readSource already applies `|| url`; filling the field here would
    // hand the classifier the normalized spelling the original read never saw,
    // and both N2 and the slug anchor read it.
    const s = entryOf([read("node", { rawBody: DOC, status: 203, headers: { "content-type": "text/html" }, finalUrl: "" })]);
    const got = await replayFetcher(s.entry, loaderFor(s)).fetch(URL_HTML, "node");
    expect(got.finalUrl).toBe("");
    expect(got.rawBody).toBe(DOC);
    expect(got.status).toBe(203);
    expect(got.headers).toEqual({ "content-type": "text/html" });
  });

  it("replays headers and status faithfully enough that a recorded wall still vetoes", async () => {
    // The mutation this catches: dropping headers. Without them the archived
    // wall reads as a document, the control arm answers a question the live arm
    // was never asked, and the difference gets attributed to the source.
    const s = entryOf([read("node", { rawBody: WALL, status: 202, headers: { "cf-mitigated": "challenge" } })]);
    const r = await check(URL_HTML, [CLAIM], { fetcher: replayFetcher(s.entry, loaderFor(s)) });
    expect(r.verdict).toBe("unreachable");
  });

  it("returns EMPTY_RESPONSE for a rung with no recorded read, and never throws", async () => {
    const s = entryOf([read("curl", { rawBody: DOC })]);
    await expect(replayFetcher(s.entry, loaderFor(s)).fetch(URL_HTML, "node")).resolves.toEqual(EMPTY_RESPONSE);
  });

  it("warns and returns EMPTY_RESPONSE when a blob is missing, rather than throwing", async () => {
    // A Fetcher MUST NOT THROW (spec 7.1): an unread rung is a result, not an
    // error. A corrupt archive degrades to A = unreachable, which lands on a
    // pipeline-drift or unreachable row - never on the accusing one.
    const s = entryOf([read("node", { rawBody: DOC })]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const got = await replayFetcher(s.entry, () => { throw new Error("gone"); }).fetch(URL_HTML, "node");
    expect(got).toEqual(EMPTY_RESPONSE);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("recomputes bytes from the replayed body", () => {
    // `bytes` is written by all three bundled fetchers and read by nothing -
    // SignalInput does not carry it - so it is not stored. Recomputing keeps
    // the RawResponse honest rather than shipping a zero.
    const s = entryOf([read("node", { rawBody: DOC })]);
    return expect(replayFetcher(s.entry, loaderFor(s)).fetch(URL_HTML, "node")).resolves.toMatchObject({
      bytes: DOC.length,
    });
  });

  it("keeps the FIRST read when a rung was somehow recorded twice", async () => {
    const s = entryOf([read("node", { rawBody: DOC }), read("node", { rawBody: WALL })]);
    const f = replayFetcher(s.entry, loaderFor(s));
    expect(f.rungs).toEqual(["node"]);
    expect((await f.fetch(URL_HTML, "node")).rawBody).toBe(DOC);
  });

  it("NEGATIVE CONTROL: an entry with no reads advertises nothing and reads nothing", async () => {
    // Without this, a replay fetcher that ignored the entry and returned a
    // constant body would pass several tests above.
    const s = entryOf([]);
    const f = replayFetcher(s.entry, loaderFor(s));
    expect(f.rungs).toEqual([]);
    expect(await f.fetch(URL_HTML, "node")).toEqual(EMPTY_RESPONSE);
  });
});
