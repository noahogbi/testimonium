import type { Verdict } from "../classify/verdict.js";
import type { Fetcher, RawResponse, RungId } from "../fetch/types.js";
import { blobHash, claimsHashFor, withoutSetCookie, type ArchiveEntry, type ArchivedRead } from "./format.js";

export interface RecordedRead {
  readonly rung: RungId;
  readonly response: RawResponse;
}

export interface Recorder {
  /** Pass THIS through `CheckOptions.fetcher`. */
  readonly fetcher: Fetcher;
  /** Every `(rung, RawResponse)` pair handed back, in the order attempted.
   *  Live: it fills as `check()` runs. */
  readonly reads: RecordedRead[];
}

/**
 * THE TEE. It keeps what the fetch already returned, and changes nothing.
 *
 * The archive cannot be written from inside `check()`: `readSource` drops every
 * `RawResponse` the moment `computeSignals` has run on it, and `SignalResult`
 * carries no `rawBody`, no headers and no status. The bytes exist only here.
 * `bin.ts` builds `defaultFetcher` itself, wraps it in this, and passes the
 * wrapper through the `CheckOptions.fetcher` option that already exists - so
 * `check()` gains no sink, stays pure, and keeps raw reads off the public
 * surface (spec 5.3, 6.6, 8.3).
 *
 * `rungs` is the inner fetcher's, verbatim: `rungsAvailable` and
 * `isLadderTruncated` are both computed from it (src/io/evidence.ts), so a
 * wrapper that recomputed them would change what `check` reports about the
 * host.
 *
 * It does NOT catch. A `Fetcher` must not throw (spec 7.1); when a
 * third-party one does anyway, `readSource` degrades it to an unread rung with
 * a warning, and nothing is recorded for that rung - which replays as
 * `EMPTY_RESPONSE`, exactly what the live arm saw.
 */
export function recordingFetcher(inner: Fetcher): Recorder {
  const reads: RecordedRead[] = [];
  return {
    reads,
    fetcher: {
      rungs: inner.rungs,
      async fetch(url: string, rung: RungId): Promise<RawResponse> {
        const response = await inner.fetch(url, rung);
        reads.push({ rung, response });
        return response;
      },
    },
  };
}

export interface EntryInput {
  /** The verdict `check()` returned. The caller stages an entry only when this
   *  is "supported" - see the invariant on `ArchiveEntry.verdict`. */
  readonly verdict: Verdict;
  readonly claims: readonly string[];
  readonly reads: readonly RecordedRead[];
  readonly toolVersion: string;
  readonly localRulesHash: string | null;
  /** This machine's `pdftotext` version, stamped on `pdftotext` reads only. */
  readonly pdftotextVersion: string | null;
  readonly archivedAt: string;
}

export interface StagedEntry {
  readonly entry: ArchiveEntry;
  /** hash -> body, for every blob this entry references. Content-addressed, so
   *  two reads of identical bytes collapse to one. */
  readonly blobs: ReadonlyMap<string, string>;
}

/**
 * One URL's baseline, from the tee's buffer plus the verdict `check()` returned.
 *
 * EVERY ATTEMPTED READ is archived, not the winning one: the verdict is a union
 * across every non-vetoed read (spec 6.6), and each read's veto is decided from
 * its own headers (N1, N5), its `finalUrl` (N2) and its status (N4). A single
 * archived body cannot reproduce that union, and the ordinary symptom would be
 * a live arm still `supported` against a single-body replay reading
 * `unsupported`.
 */
export function buildArchiveEntry(input: EntryInput): StagedEntry {
  const blobs = new Map<string, string>();
  const reads: ArchivedRead[] = input.reads.map((r) => {
    const hash = blobHash(r.response.rawBody);
    blobs.set(hash, r.response.rawBody);
    return {
      rung: r.rung,
      status: r.response.status,
      headers: withoutSetCookie(r.response.headers),
      finalUrl: r.response.finalUrl,
      hash,
      // ONLY this rung's blob is tool output (`pdfFetch` returns
      // `pdftotext -layout`'s text as `rawBody`), so only this rung records a
      // version. Stamping it on an HTML read would make an HTML citation
      // confounded by a poppler upgrade.
      pdftotextVersion: r.rung === "pdftotext" ? input.pdftotextVersion : null,
    };
  });
  return {
    entry: {
      archivedAt: input.archivedAt,
      verdict: input.verdict,
      claimsHash: claimsHashFor(input.claims),
      toolVersion: input.toolVersion,
      localRulesHash: input.localRulesHash,
      reads,
    },
    blobs,
  };
}
