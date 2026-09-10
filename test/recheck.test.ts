import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { recheck, type RecheckCitation } from "../src/recheck.js";
import { buildArchiveEntry } from "../src/archive/record.js";
import { archiveIndexPath, writeArchive } from "../src/archive/store.js";
import { VERSION } from "../src/version.js";
import type { Fetcher, RawResponse, RungId } from "../src/fetch/types.js";
import type { RuleSet } from "../src/rules/load.js";

const CLAIM = "spending rose sharply";
const body = (sentence: string) =>
  `<html><title>The Committee Report</title><body>${`The committee report states that ${sentence}. `.repeat(120)}</body></html>`;
const WITH_CLAIM = body(CLAIM);
const WITHOUT_CLAIM = body("procurement practices were reviewed");
const URL = "https://e.com/report";
const CITATIONS: RecheckCitation[] = [{ url: URL, label: "The Committee Report", claims: [CLAIM] }];

const roots: string[] = [];
function tmpArchive(): string {
  const d = mkdtempSync(join(tmpdir(), "testimonium-recheck-"));
  roots.push(d);
  return join(d, "essay.archive");
}
afterEach(() => {
  for (const d of roots.splice(0)) rmSync(d, { recursive: true, force: true });
});

function live(rawBody: string, status = 200, finalUrl = URL): Fetcher {
  return {
    rungs: ["node", "curl"],
    async fetch(_url: string, _rung: RungId): Promise<RawResponse> {
      return { rawBody, status, headers: { "content-type": "text/html" }, finalUrl, bytes: rawBody.length };
    },
  };
}

/** Write a baseline the way `check` writes one: through buildArchiveEntry and
 *  writeArchive, never a hand-written index. */
function seed(dir: string, rawBody: string, over: { finalUrl?: string; claims?: readonly string[] } = {}): void {
  const staged = buildArchiveEntry({
    verdict: "supported",
    claims: over.claims ?? [CLAIM],
    reads: [{ rung: "node", response: { rawBody, status: 200, headers: { "content-type": "text/html" }, finalUrl: over.finalUrl ?? "", bytes: rawBody.length } }],
    toolVersion: VERSION,
    localRulesHash: null,
    pdftotextVersion: null,
    archivedAt: "2026-09-09T00:00:00.000Z",
  });
  writeArchive(dir, new Map([[URL, staged]]));
}

function blobCount(dir: string): number {
  const root = join(dir, "blobs");
  if (!existsSync(root)) return 0;
  return readdirSync(root).reduce((n, shard) => n + readdirSync(join(root, shard)).length, 0);
}

describe("recheck", () => {
  it("reports clean when the live source and the archived bytes both prove the claim", async () => {
    const dir = tmpArchive();
    seed(dir, WITH_CLAIM);
    const r = await recheck(CITATIONS, { archiveDir: dir, fetcher: live(WITH_CLAIM) });
    expect(r.outcomes[0]?.category).toBe("clean");
    expect(r.archiveUnreadable).toBeNull();
  });

  it("reports SOURCE DRIFT when the live page lost a claim the stored bytes still prove", async () => {
    const dir = tmpArchive();
    seed(dir, WITH_CLAIM);
    const r = await recheck(CITATIONS, { archiveDir: dir, fetcher: live(WITHOUT_CLAIM) });
    expect(r.outcomes[0]?.category).toBe("sourceDrift");
    expect(r.outcomes[0]?.live).toBe("unsupported");
    expect(r.outcomes[0]?.archived).toBe("supported");
    expect(r.outcomes[0]?.missed).toEqual([CLAIM]);
  });

  it("reports PIPELINE DRIFT when the gate passes live and the stored bytes no longer do", async () => {
    const dir = tmpArchive();
    seed(dir, WITHOUT_CLAIM);
    const r = await recheck(CITATIONS, { archiveDir: dir, fetcher: live(WITH_CLAIM) });
    expect(r.outcomes[0]?.category).toBe("pipelineDrift");
  });

  it("reports no baseline, and never accuses, when nothing was ever archived", async () => {
    const r = await recheck(CITATIONS, { archiveDir: tmpArchive(), fetcher: live(WITHOUT_CLAIM) });
    expect(r.outcomes[0]?.category).toBe("noBaseline");
    expect(r.outcomes[0]?.live).toBe("unsupported");
  });

  it("NEVER writes the archive, even on the run that finds drift", async () => {
    // check is the ONLY archive writer, so a drifted source cannot silently
    // become its own new baseline and there is no way to "fix" a drift report
    // by running recheck again. The mutation this catches: any writeArchive
    // call inside recheck. The fixture is designed for it - the live body
    // DIFFERS from the archived one, so a write would necessarily add a blob
    // and change the index.
    const dir = tmpArchive();
    seed(dir, WITH_CLAIM);
    const before = readFileSync(archiveIndexPath(dir), "utf8");
    const blobsBefore = blobCount(dir);
    const r = await recheck(CITATIONS, { archiveDir: dir, fetcher: live(WITHOUT_CLAIM) });
    expect(r.outcomes[0]?.category).toBe("sourceDrift");
    expect(readFileSync(archiveIndexPath(dir), "utf8")).toBe(before);
    expect(blobCount(dir)).toBe(blobsBefore);
  });

  it("returns the LIVE arm's results, never the replay arm's - they are what goes in the evidence file", async () => {
    const dir = tmpArchive();
    seed(dir, WITH_CLAIM);
    const r = await recheck(CITATIONS, { archiveDir: dir, fetcher: live(WITHOUT_CLAIM) });
    expect(r.liveResults).toHaveLength(1);
    expect(r.liveResults[0]?.verdict).toBe("unsupported");
    expect(r.liveResults[0]?.url).toBe(URL);
    // The replay arm said "supported" for the same URL; writing that to the
    // evidence file would put a verdict computed from bytes on disk into the
    // file a reader's renderer consumes.
    expect(r.outcomes[0]?.archived).toBe("supported");
  });

  it("passes the local rules to the REPLAY arm as well as the live one", async () => {
    // A LOCAL PATH RULE, not a signature: N3 only vetoes BELOW
    // THRESHOLDS.maxChallengeChars (src/classify/signals.ts), so a signature
    // cannot veto these above-floor bodies at all. N2 has no length
    // conjunction and reads finalUrl, which the archive records per read.
    // The archived read's finalUrl matches the rule; the live read's does not,
    // so the rule can only reach A. The mutation this catches: omitting
    // `rules` from the replay arm's check() call - under it A stays
    // `supported` and the outcome is clean.
    const dir = tmpArchive();
    seed(dir, WITH_CLAIM, { finalUrl: "https://e.com/local-wall-marker/report" });
    const rules: RuleSet = {
      signatures: [],
      paths: [{ pattern: /local-wall-marker/, lastConfirmed: "2026-09-09", note: "a local path rule for this test" }],
      hosts: [],
      boilerplate: [],
    };
    const r = await recheck(CITATIONS, { archiveDir: dir, fetcher: live(WITH_CLAIM), rules });
    expect(r.outcomes[0]?.live).toBe("supported");
    expect(r.outcomes[0]?.archived).toBe("unreachable");
    expect(r.outcomes[0]?.category).toBe("pipelineDrift");
  });

  it("returns one outcome per citation, in the order they were given", async () => {
    const dir = tmpArchive();
    seed(dir, WITH_CLAIM);
    const two: RecheckCitation[] = [
      { url: "https://f.com/story", label: "Another", claims: [CLAIM] },
      ...CITATIONS,
    ];
    const r = await recheck(two, { archiveDir: dir, fetcher: live(WITH_CLAIM) });
    expect(r.outcomes.map((o) => o.url)).toEqual(["https://f.com/story", URL]);
    expect(r.outcomes[0]?.category).toBe("noBaseline");
    expect(r.outcomes[1]?.category).toBe("clean");
  });

  it("warns and reports every citation as no baseline when the index cannot be read", async () => {
    const dir = tmpArchive();
    mkdirSync(dir, { recursive: true });
    writeFileSync(archiveIndexPath(dir), "{ not json", "utf8");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await recheck(CITATIONS, { archiveDir: dir, fetcher: live(WITH_CLAIM) });
    expect(r.archiveUnreadable).toContain("index.json");
    expect(r.outcomes[0]?.category).toBe("noBaseline");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("reports a 404 on the live source as gone, from the recording wrapper's own status", async () => {
    // CitationResult carries no status (7.4). This is the whole reason the
    // recording wrapper is used on recheck's LIVE arm too.
    const dir = tmpArchive();
    seed(dir, WITH_CLAIM);
    const r = await recheck(CITATIONS, { archiveDir: dir, fetcher: live("<html><body>Not found</body></html>", 404) });
    expect(r.outcomes[0]?.category).toBe("gone");
    expect(r.outcomes[0]?.archivedAt).toBe("2026-09-09T00:00:00.000Z");
  });
});
