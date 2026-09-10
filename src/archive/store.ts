import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { ARCHIVE_VERSION, blobRelPath, type ArchiveEntry, type ArchivedRead, type ArchiveIndex } from "./format.js";
import type { StagedEntry } from "./record.js";

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function archiveIndexPath(dir: string): string {
  return join(dir, "index.json");
}

export function blobPath(dir: string, hash: string): string {
  return join(dir, blobRelPath(hash));
}

/** Three outcomes, not two. "Absent" is the ordinary first run and reports
 *  every citation as `no baseline`, exit 0. "Unreadable" is a store this build
 *  does not understand: it is reported and treated as absent on the read side,
 *  and REFUSED on the write side, because overwriting it would destroy
 *  baselines silently. Neither can accuse anyone. */
export type ArchiveRead =
  | { readonly kind: "absent" }
  | { readonly kind: "unreadable"; readonly reason: string }
  | { readonly kind: "ok"; readonly index: ArchiveIndex };

export function readArchive(dir: string): ArchiveRead {
  const path = archiveIndexPath(dir);
  if (!existsSync(path)) return { kind: "absent" };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return { kind: "unreadable", reason: `${path} is not valid JSON: ${msg(e)}` };
  }
  if (typeof raw !== "object" || raw === null) {
    return { kind: "unreadable", reason: `${path} is not an object` };
  }
  const { version, urls } = raw as { version?: unknown; urls?: unknown };
  if (version !== ARCHIVE_VERSION) {
    return {
      kind: "unreadable",
      reason: `${path} is version ${String(version)}; this build reads version ${ARCHIVE_VERSION}`,
    };
  }
  if (typeof urls !== "object" || urls === null) {
    return { kind: "unreadable", reason: `${path} has no urls object` };
  }
  return { kind: "ok", index: { version: ARCHIVE_VERSION, urls: urls as Record<string, ArchiveEntry> } };
}

/** One blob, gunzipped. Throws when it is missing or corrupt; the replay
 *  fetcher catches, warns and returns EMPTY_RESPONSE, because a `Fetcher` must
 *  not throw (spec 7.1). */
export function readBlob(dir: string, hash: string): string {
  return gunzipSync(readFileSync(blobPath(dir, hash))).toString("utf8");
}

/**
 * Do these two entries differ in anything that MATTERS?
 *
 * Material is what the comparison actually reads: the reads' `(rung, status,
 * finalUrl, hash)` tuples IN ORDER, `claimsHash`, `toolVersion`,
 * `localRulesHash`, and each read's `pdftotextVersion` (spec 8.3).
 *
 * IT IGNORES `headers` AS WELL AS `archivedAt`, AND IT HAS TO. The node rung
 * returns a fresh `date` on every response - often `age` and `x-request-id`
 * too - so a predicate that compared headers would never fire, and the index
 * churn this function exists to stop would survive its own fix. Keeping the
 * whole OLD entry, old headers and old date included, is coherent: the entry is
 * a record of what was seen at `archivedAt`.
 */
function materiallyEqual(a: ArchiveEntry, b: ArchiveEntry): boolean {
  if (a.claimsHash !== b.claimsHash) return false;
  if (a.toolVersion !== b.toolVersion) return false;
  if (a.localRulesHash !== b.localRulesHash) return false;
  if (a.reads.length !== b.reads.length) return false;
  return a.reads.every((r, i) => {
    const o = b.reads[i] as ArchivedRead;
    return (
      r.rung === o.rung &&
      r.status === o.status &&
      r.finalUrl === o.finalUrl &&
      r.hash === o.hash &&
      r.pdftotextVersion === o.pdftotextVersion
    );
  });
}

/**
 * Overlay this run's baselines onto whatever is already there.
 *
 * MERGES, never replaces. Only a `supported` `check` stages an entry, so a
 * failing run must leave the previous baseline standing - that is the run on
 * which the author asks `recheck` whether the source moved as well (spec 8.3).
 *
 * PRESERVES an entry that changed in nothing material, byte for byte. These
 * files are committed: the caller stamps a fresh `archivedAt` on every run and
 * every entry stores that read's response headers, so without this a green
 * `check` over an unchanged corpus leaves a dirty tree on every run, forever.
 * `archivedAt` therefore means "established or last materially changed", and
 * "gone since `<archivedAt>`" reads "gone since at least that date".
 *
 * Blobs are written BEFORE the index, so an interrupted run never leaves an
 * index naming a blob that is not on disk. A blob that already exists is not
 * rewritten: the store is content-addressed, so identical content is
 * necessarily an identical file, and skipping the write is what makes
 * re-running `check` against an unchanged source idempotent.
 *
 * THROWS rather than overwriting a store this build cannot read. The CLI wraps
 * the one call in one `try`/`catch` and warns: archiving must never fail a run
 * (13 Q4).
 */
export function writeArchive(dir: string, staged: ReadonlyMap<string, StagedEntry>): void {
  if (staged.size === 0) return;
  const existing = readArchive(dir);
  if (existing.kind === "unreadable") {
    throw new Error(`refusing to overwrite the archive: ${existing.reason}`);
  }
  const urls: Record<string, ArchiveEntry> = { ...(existing.kind === "ok" ? existing.index.urls : {}) };
  for (const [key, s] of staged) {
    for (const [hash, body] of s.blobs) {
      const p = blobPath(dir, hash);
      if (existsSync(p)) continue;
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, gzipSync(Buffer.from(body, "utf8")));
    }
    const previous = urls[key];
    // PRESERVE. Not a micro-optimization - a property of a COMMITTED file: a
    // fresh `archivedAt` and a fresh `date` header are not news, and rewriting
    // the entry for them would diff this file on every green run.
    if (previous !== undefined && materiallyEqual(previous, s.entry)) continue;
    urls[key] = s.entry;
  }
  // Sorted, because these files are committed and a key order that followed
  // insertion would rewrite the whole index whenever a citation moved in the
  // document.
  const sorted: Record<string, ArchiveEntry> = {};
  for (const k of Object.keys(urls).sort()) sorted[k] = urls[k] as ArchiveEntry;
  mkdirSync(dir, { recursive: true });
  writeFileSync(archiveIndexPath(dir), `${JSON.stringify({ version: ARCHIVE_VERSION, urls: sorted }, null, 2)}\n`, "utf8");
}
