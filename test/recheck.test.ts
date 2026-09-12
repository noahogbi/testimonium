import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { recheck, type RecheckCitation } from "../src/recheck.js";
import * as checkModule from "../src/check.js";
import { buildArchiveEntry } from "../src/archive/record.js";
import { archiveIndexPath, writeArchive } from "../src/archive/store.js";
import { VERSION } from "../src/version.js";
import type { Fetcher, RawResponse, RungId } from "../src/fetch/types.js";
import type { RuleSet } from "../src/rules/load.js";
import type { FetcherOptions } from "../src/fetch/default-fetcher.js";

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

/** One fixed response per URL, keyed by exact match. For proving a per-citation
 *  property does not leak into a sibling citation's outcome - `live()` alone
 *  cannot do this because it ignores the URL it is asked for and answers every
 *  citation identically. */
function liveMap(
  byUrl: Readonly<
    Record<string, { rawBody: string; status?: number; finalUrl?: string; headers?: Readonly<Record<string, string>> }>
  >,
): Fetcher {
  return {
    rungs: ["node", "curl"],
    async fetch(url: string, _rung: RungId): Promise<RawResponse> {
      const e = byUrl[url];
      if (!e) return { rawBody: "", status: 0, headers: {}, finalUrl: "", bytes: 0 };
      return {
        rawBody: e.rawBody,
        status: e.status ?? 200,
        headers: e.headers ?? { "content-type": "text/html" },
        finalUrl: e.finalUrl ?? url,
        bytes: e.rawBody.length,
      };
    },
  };
}

/** Write a baseline the way `check` writes one: through buildArchiveEntry and
 *  writeArchive, never a hand-written index. */
function seed(
  dir: string,
  rawBody: string,
  over: { url?: string; finalUrl?: string; claims?: readonly string[] } = {},
): void {
  const staged = buildArchiveEntry({
    verdict: "supported",
    claims: over.claims ?? [CLAIM],
    reads: [{ rung: "node", response: { rawBody, status: 200, headers: { "content-type": "text/html" }, finalUrl: over.finalUrl ?? "", bytes: rawBody.length } }],
    toolVersion: VERSION,
    localRulesHash: null,
    pdftotextVersion: null,
    archivedAt: "2026-09-09T00:00:00.000Z",
  });
  writeArchive(dir, new Map([[over.url ?? URL, staged]]));
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

  it("passes the SAME sourceLabel to both arms - the control arm's founding invariant", async () => {
    // Verdict-inert TODAY only: C1's slugLabelOverlap is computed and
    // deliberately not consulted (classify/verdict.ts). The day it - or any
    // rule - reads it, L and A must still be asked about the same label or
    // the comparison silently becomes two different questions, and nothing
    // in compareCitation's decision procedure would notice. This spies on the
    // real `check()` rather than asserting a verdict, because no fixture can
    // make a divergence observable while C1 stays unconsulted.
    const dir = tmpArchive();
    seed(dir, WITH_CLAIM);
    const spy = vi.spyOn(checkModule, "check");
    await recheck(CITATIONS, { archiveDir: dir, fetcher: live(WITH_CLAIM) });
    expect(spy.mock.calls).toHaveLength(2);
    const labels = spy.mock.calls.map((call) => (call[2] as { sourceLabel?: string } | undefined)?.sourceLabel);
    expect(labels[0]).toBe(CITATIONS[0]?.label);
    expect(labels[1]).toBe(CITATIONS[0]?.label);
    spy.mockRestore();
  });

  it("does not leak one citation's live read statuses into another citation's outcome", async () => {
    // The recorder is built fresh, per citation, inside the loop (recheck.ts).
    // If it were hoisted above the loop instead, `recorder.reads` would still
    // hold the first citation's 404 by the time the second citation's outcome
    // is compared - liveGone is `live === "unreachable" && statuses include a
    // gone status`, so a leaked 404 would turn a genuinely-unreachable-for-
    // unrelated-reasons second citation into a false "gone" report. The second
    // citation is made unreachable by an N1 vendor-challenge header at status
    // 200 specifically so its OWN status is never a gone status - only a leak
    // from citation one could make it read gone.
    const dir = tmpArchive();
    const GONE_URL = "https://g.com/vanished";
    const CHALLENGED_URL = "https://h.com/story";
    seed(dir, WITH_CLAIM, { url: GONE_URL });
    seed(dir, WITH_CLAIM, { url: CHALLENGED_URL });
    const two: RecheckCitation[] = [
      { url: GONE_URL, label: "Vanished", claims: [CLAIM] },
      { url: CHALLENGED_URL, label: "Story", claims: [CLAIM] },
    ];
    const fetcher = liveMap({
      [GONE_URL]: { rawBody: "<html><body>Not found</body></html>", status: 404, headers: {} },
      [CHALLENGED_URL]: {
        rawBody: WITH_CLAIM,
        status: 200,
        headers: { "content-type": "text/html", "CF-Mitigated": "challenge" },
      },
    });
    const r = await recheck(two, { archiveDir: dir, fetcher });
    expect(r.outcomes[0]?.url).toBe(GONE_URL);
    expect(r.outcomes[0]?.category).toBe("gone");
    expect(r.outcomes[1]?.url).toBe(CHALLENGED_URL);
    expect(r.outcomes[1]?.live).toBe("unreachable");
    // The one assertion a leak would break: a status leaked from citation one
    // would make this "gone" instead.
    expect(r.outcomes[1]?.category).toBe("unreachable");
  });
});

describe("recheck: identity wiring (RecheckOptions -> FetcherOptions, live arm only)", () => {
  // Task 16's fourth and final wire proof - the twin of test/check.test.ts's
  // "check() itself forwards CheckOptions.identity" test, against recheck()
  // instead. An empty citation list still builds the LIVE fetcher
  // (buildFetcher runs before the per-citation loop), so this never touches
  // the network and never reaches replayFetcher() - proving the live arm's
  // wire without the replay arm's absence of one confounding the result.
  it("forwards RecheckOptions.identity into the defaultFetcher(...) call for the live fetcher, and omits it when absent", async () => {
    vi.resetModules();
    const defaultFetcherSpy = vi.fn((_opts: FetcherOptions = {}) => ({
      rungs: [] as RungId[],
      fetch: async () => {
        throw new Error("must not be called: rungs is empty");
      },
    }));
    vi.doMock("../src/fetch/default-fetcher.js", () => ({ defaultFetcher: defaultFetcherSpy }));
    try {
      const { recheck: recheckWithMockedFetcher } = await import("../src/recheck.js");

      await recheckWithMockedFetcher([], {
        archiveDir: tmpArchive(),
        identity: "example-app contact@example.com",
      });
      expect(defaultFetcherSpy).toHaveBeenCalledTimes(1);
      expect(defaultFetcherSpy.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({ identity: "example-app contact@example.com" }),
      );

      defaultFetcherSpy.mockClear();
      await recheckWithMockedFetcher([], { archiveDir: tmpArchive() });
      expect(defaultFetcherSpy).toHaveBeenCalledTimes(1);
      expect(defaultFetcherSpy.mock.calls[0]?.[0]).not.toHaveProperty("identity");
    } finally {
      vi.doUnmock("../src/fetch/default-fetcher.js");
      vi.resetModules();
    }
  });
});
