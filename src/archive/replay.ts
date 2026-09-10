import { EMPTY_RESPONSE, type Fetcher, type RawResponse, type RungId } from "../fetch/types.js";
import type { ArchivedRead, ArchiveEntry } from "./format.js";

/**
 * THE CONTROL ARM'S READER. It reads local blobs and needs no binaries at all.
 *
 * `recheck` runs `check()` twice - once with the recording fetcher over the
 * live source, once with this - so no second judgement path is written and the
 * control arm is PROVABLY the same code as the live arm. That is not an
 * economy: a control that ran through different code could not isolate a change
 * in the code.
 *
 * ITS RUNGS ARE THE ARCHIVE'S, NEVER THE MACHINE'S. `defaultFetcher` probes for
 * `curl` and `pdftotext` and advertises what it finds; doing the same here
 * would make the control arm a fact about the recheck machine. A PDF archived
 * where `pdftotext` exists and rechecked where it does not would attempt
 * NOTHING in either arm - `nextAction` stops a PDF URL immediately when the
 * rung is unavailable - giving `L = A = unreachable` against `R = supported`:
 * spurious drift on every PDF citation on every runner without poppler,
 * produced by the instrument built to remove it. It also keeps
 * `ladderTruncated` honest, since that is computed from `fetcher.rungs`
 * (`isLadderTruncated`, src/io/evidence.ts).
 *
 * `loadBlob` is injected so this module never touches the filesystem and no
 * test needs one; `bin.ts` and `recheck()` pass `readBlob(dir, hash)`.
 */
export function replayFetcher(entry: ArchiveEntry, loadBlob: (hash: string) => string): Fetcher {
  const byRung = new Map<RungId, ArchivedRead>();
  // First wins. A rung recorded twice is not something the shipped ladder
  // produces - `nextAction` never repeats one - but an index is a file on disk
  // and a total function is better than an ambiguity.
  for (const r of entry.reads) if (!byRung.has(r.rung)) byRung.set(r.rung, r);

  return {
    rungs: [...byRung.keys()],
    async fetch(_url: string, rung: RungId): Promise<RawResponse> {
      const recorded = byRung.get(rung);
      // An unread rung is a RESULT, not an error (spec 7.1).
      if (recorded === undefined) return EMPTY_RESPONSE;
      let rawBody: string;
      try {
        rawBody = loadBlob(recorded.hash);
      } catch (e) {
        // THIS MUST NOT THROW. A corrupt archive degrades to A = unreachable,
        // which lands on a pipeline-drift or unreachable row - never on the
        // one row permitted to accuse.
        console.warn(
          `warn archive blob ${recorded.hash} for rung "${rung}" could not be read: ` +
            `${e instanceof Error ? e.message : String(e)}`,
        );
        return EMPTY_RESPONSE;
      }
      return {
        rawBody,
        status: recorded.status,
        headers: recorded.headers,
        // VERBATIM, including "". readSource applies `response.finalUrl || url`,
        // so returning "" reproduces what computeSignals originally saw;
        // substituting anything here hands it a URL the classifier never had.
        finalUrl: recorded.finalUrl,
        bytes: rawBody.length,
      };
    },
  };
}
