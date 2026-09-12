import { describe, expect, it } from "vitest";
import { replayFetcher } from "../../src/archive/replay.js";
import { buildArchiveEntry, type RecordedRead } from "../../src/archive/record.js";
import { check } from "../../src/check.js";
import type { RawResponse, RungId } from "../../src/fetch/types.js";

// A claim these bytes were never written about, so the archived body cannot
// prove it - the trigger this test arms.
const CLAIM = "a claim these bytes do not contain";
// Readable and unrelated: over THRESHOLDS.minProseChars (4,500) extracted
// characters (measured 5,559 via toText - see the task report), vetoed by
// nothing, and it never mentions CLAIM. A shorter or wall-shaped body would
// replay as `unreachable`, not `unsupported`, and the escalation trigger this
// test exists to arm would never fire - see the brief's "obvious test passes
// vacuously" note.
const FILLER = "The annual filing describes routine administrative matters at ordinary length. ";
const DOC = `<html><title>Routine Administrative Filing</title><body>${FILLER.repeat(70)}</body></html>`;
const URL_HTML = "https://e.com/filing";

const read = (rung: RungId, r: Partial<RawResponse>): RecordedRead => ({
  rung,
  response: { rawBody: "", status: 200, headers: {}, finalUrl: "", bytes: 0, ...r },
});

// Entries are built FROM buildArchiveEntry, never from hand-written literals -
// test/archive/replay.test.ts:12-37 has this exact pattern - so a change to
// the entry shape cannot leave this fixture asserting a stale one.
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

describe("the replay invariant: an archive offers no untried rung", () => {
  it("a 0.1.0 archive offers no untried rung, so escalation cannot fire on replay", async () => {
    // A one-rung entry, as 0.1.0 wrote them, whose bytes lack the claim.
    const staged = entryOf([read("node", { rawBody: DOC })]);
    const fetcher = replayFetcher(staged.entry, loaderFor(staged));
    expect(fetcher.rungs).toEqual(["node"]);

    const r = await check(URL_HTML, [CLAIM], { fetcher });

    // The trigger DID fire - this is an unsupported verdict - and found
    // nothing to climb to: `fetcher.rungs` has only "node", so there is no
    // untried rung for `hasUntriedClimbableRung` to hand to `check()`.
    expect(r.verdict).toBe("unsupported");
    expect(r.rungsAttempted).toEqual(["node"]);
  });
});
