import { archiveKeyFor } from "./archive/format.js";
import { compareCitation, type CitationOutcome } from "./archive/compare.js";
import { recordingFetcher } from "./archive/record.js";
import { replayFetcher } from "./archive/replay.js";
import { readArchive, readBlob } from "./archive/store.js";
import { check } from "./check.js";
import type { Verdict } from "./classify/verdict.js";
import { buildFetcher } from "./fetch/build-fetcher.js";
import type { Fetcher } from "./fetch/types.js";
import type { CitationResult } from "./io/evidence.js";
import type { RuleSet } from "./rules/load.js";
import { VERSION } from "./version.js";

export interface RecheckCitation {
  /** The URL AS CITED. `archiveKeyFor` normalizes it for the lookup. */
  readonly url: string;
  readonly label: string;
  readonly claims: readonly string[];
}

export interface RecheckOptions {
  readonly archiveDir: string;
  readonly rules?: RuleSet;
  /** The LIVE fetcher, BEFORE recording - this function wraps it itself.
   *  Bring your own reader, exactly as CheckOptions does. */
  readonly fetcher?: Fetcher;
  /** Declared identity for hosts that require one, e.g. sec.gov's
   *  "<app> <contact email>". testimonium ships no identity of its own, and
   *  before Task 16 this option existed on FetcherOptions but was reachable
   *  from nowhere: recheck() never passed it, so every such citation took
   *  the warn-and-use-a-browser-UA branch. Matches CheckOptions.identity.
   *  Feeds only the LIVE fetcher built below - the replay arm reads archived
   *  bytes via `replayFetcher()` and never sends a request, so there is
   *  nothing for an identity to attach to on that side. */
  readonly identity?: string;
  readonly localRulesHash?: string | null;
  readonly pdftotextVersion?: string | null;
  readonly toolVersion?: string;
}

export interface RecheckReport {
  /** One per input citation, in the SAME ORDER. Each outcome's `missed` is
   *  the LIVE arm's miss list on EVERY row - present even on rows that do
   *  not accuse - and is an ACCUSATION only when `category === "sourceDrift"`:
   *  `pipelineDrift` and `confounded` carry it too, and both blame this tool
   *  or the author's own machine, never the source. */
  readonly outcomes: CitationOutcome[];
  /** The LIVE arm's results - what is true of the source today, and the only
   *  arm whose verdicts describe the world. The caller writes these to
   *  `<doc>.evidence.json`. */
  readonly liveResults: CitationResult[];
  /** Set when an archive exists and this build could not read it. Every
   *  citation then reports `no baseline` and contributes 0. */
  readonly archiveUnreadable: string | null;
}

/**
 * Re-run each claim against the live source AND against the bytes stored when
 * that source last read `supported`, and report what changed.
 *
 * IT IS THE INSTRUMENT, NOT A POLICY: no cron, no rot score, no staleness
 * badge, because the drift rate is unmeasured (spec 12).
 *
 * IT NEVER WRITES THE ARCHIVE and never refreshes a baseline - `check` is the
 * only archive writer, so a drifted source cannot silently become its own new
 * baseline, and there is no way to "fix" a drift report by running `recheck`
 * again. This module does not import `writeArchive`.
 *
 * WHAT THE ARCHIVE CANNOT TELL YOU: it detects change, never correctness. A
 * source that was already wrong when it first read `supported` is archived
 * wrong, and `recheck` will call it clean for as long as it stays wrong.
 */
export async function recheck(
  citations: readonly RecheckCitation[],
  opts: RecheckOptions,
): Promise<RecheckReport> {
  // THE LIVE FETCHER, built through fetch/build-fetcher.ts (Task 16) - the
  // shared construction this file's own comment used to ask for by name,
  // back when check() was off-limits to the plan that could have written it.
  // It no longer is, so there is one construction instead of four and no
  // comment warning about a second copy drifting from the first. `opts` is
  // passed straight through rather than rebuilt field-by-field (fix round 1,
  // Important 1): `RecheckOptions` is a structural superset of
  // `BuildFetcherOptions`, and rebuilding it here would be a second copy of
  // the forwarding logic that drifts the moment a field is added to one
  // interface and not mirrored to the other.
  //
  // Replay below (further down this function) does NOT call buildFetcher
  // directly: it calls check() with `fetcher: replayFetcher(...)` set, and
  // check()'s OWN buildFetcher(opts) call sees that pre-built fetcher and
  // returns it untouched via the bring-your-own-fetcher branch (fix round 1,
  // Minor 4 - buildFetcher IS reached there; the corrected claim is that no
  // default is built and no identity or host rule can attach, not that the
  // function is never called).
  const live = buildFetcher(opts);
  const archive = readArchive(opts.archiveDir);
  const index = archive.kind === "ok" ? archive.index : null;
  const archiveUnreadable = archive.kind === "unreadable" ? archive.reason : null;
  if (archiveUnreadable !== null) {
    console.warn(`warn ${archiveUnreadable} - every citation will report "no baseline"`);
  }

  const rules = opts.rules;
  const outcomes: CitationOutcome[] = [];
  const liveResults: CitationResult[] = [];

  for (const c of citations) {
    // The recording wrapper is used on the LIVE arm too, and not to archive
    // anything: `CitationResult` carries no status and no signals (7.4), so the
    // only place the CLI can see a 404 is the fetcher it owns.
    const recorder = recordingFetcher(live);
    const liveResult = await check(c.url, c.claims, {
      sourceLabel: c.label,
      fetcher: recorder.fetcher,
      ...(rules ? { rules } : {}),
    });
    liveResults.push(liveResult);

    const key = archiveKeyFor(c.url);
    const entry = index?.urls[key] ?? null;

    // THE CONTROL ARM. The same `check()`, the same claims, the same rules,
    // the same label - only the bytes differ, which is the whole point. A
    // control that ran through different code could not isolate a change in
    // the code.
    let replayVerdict: Verdict | null = null;
    if (entry !== null && entry.verdict === "supported") {
      const replayed = await check(c.url, c.claims, {
        sourceLabel: c.label,
        fetcher: replayFetcher(entry, (hash) => readBlob(opts.archiveDir, hash)),
        ...(rules ? { rules } : {}),
      });
      replayVerdict = replayed.verdict;
    }

    outcomes.push(
      compareCitation({
        url: c.url,
        key,
        liveVerdict: liveResult.verdict,
        liveMissed: liveResult.missed ?? [],
        liveStatuses: recorder.reads.map((r) => r.response.status),
        replayVerdict,
        entry,
        claims: c.claims,
        toolVersion: opts.toolVersion ?? VERSION,
        localRulesHash: opts.localRulesHash ?? null,
        pdftotextVersion: opts.pdftotextVersion ?? null,
      }),
    );
  }

  return { outcomes, liveResults, archiveUnreadable };
}
