import { createHash } from "node:crypto";
import type { Verdict } from "../classify/verdict.js";
import type { RungId } from "../fetch/types.js";
import { normalizeUrl } from "../io/claims.js";
import { norm } from "../text/normalize.js";

/**
 * The on-disk shape's version, stamped at the top of `index.json` exactly as
 * `<doc>.evidence.json` already carries `version: 1` (`writeEvidenceFile`,
 * src/io/evidence.ts).
 *
 * A committed file with no version field cannot be migrated later without
 * guessing what wrote it, and the archive is a compatibility surface the
 * moment the first one lands in someone's repository (spec 8.3).
 */
export const ARCHIVE_VERSION = 1;

/** One attempted read, as the classifier saw it. EVERY attempted read is
 *  recorded, not the winning one: the verdict is a union across every
 *  non-vetoed read (spec 6.6), and each read's veto is decided from its own
 *  headers (N1, N5), its finalUrl (N2) and its status (N4). A single archived
 *  body cannot reproduce that union. */
export interface ArchivedRead {
  readonly rung: RungId;
  readonly status: number;
  /** Every header the response carried EXCEPT `set-cookie`. See
   *  `withoutSetCookie`. */
  readonly headers: Readonly<Record<string, string>>;
  /** Verbatim, INCLUDING an empty string. `readSource` applies
   *  `response.finalUrl || url`, so replaying `""` reproduces what
   *  `computeSignals` originally saw; substituting a URL here would hand the
   *  classifier one it never had. */
  readonly finalUrl: string;
  /** SHA-256 of the body BEFORE gzip, lower-case hex. */
  readonly hash: string;
  /** The `pdftotext` version string on the machine that took this read, for a
   *  `pdftotext` rung only, or `null`. For this rung the stored blob is
   *  ALREADY tool-transformed - `pdfFetch` returns `pdftotext -layout`'s
   *  output as `rawBody` - so the local poppler build sits inside the live arm
   *  and outside the archive. A version that differs at recheck time is a
   *  named confound and that citation cannot reach exit 1 (spec 8.3). */
  readonly pdftotextVersion: string | null;
}

/** What one URL's baseline is. The archive is SELF-CONTAINED: it holds both
 *  the bytes and the verdict they produced, so `recheck` never reconciles two
 *  files and the evidence file and the archive cannot drift apart and be
 *  compared as a mismatched pair. */
export interface ArchiveEntry {
  readonly archivedAt: string;
  /** THE INVARIANT: always "supported". The archive is written only when a URL
   *  reaches `supported`, so "A differs from R" means precisely "A is not
   *  supported" (spec 8.3). Stored anyway, because a file on disk that asserts
   *  its own invariant can be checked; `compareCitation` checks it. */
  readonly verdict: Verdict;
  readonly claimsHash: string;
  /** `VERSION` from src/version.ts at write time. It identifies the BUNDLED
   *  rules, because the bundled signatures, paths and host rules compile into
   *  the package and carry one `lastConfirmed` per rule rather than one date
   *  for the set. A change here is OURS and stays pipeline drift. */
  readonly toolVersion: string;
  /** SHA-256 of the `--rules` file's bytes when one was passed, else null. A
   *  change here is the AUTHOR'S data and is a named confound. */
  readonly localRulesHash: string | null;
  readonly reads: readonly ArchivedRead[];
}

export interface ArchiveIndex {
  readonly version: number;
  readonly urls: Record<string, ArchiveEntry>;
}

/**
 * The archive's key, which MUST be `joinClaims`' key.
 *
 * `joinClaims` keys claims by `normalizeUrl(fn.url)` but hands `check()` the
 * AS-CITED spelling, which is what lands on `CitationResult.url`
 * (src/io/claims.ts, src/bin.ts). An archive keyed off the result would file
 * two spellings of one resource - a trailing slash, a `utm_` parameter - under
 * two entries, and the baseline would be silently missed: `recheck` would
 * report "no baseline" forever and exit 0 while doing nothing at all. This
 * function exists so both the write and the lookup go through ONE place, and
 * a test pins it against `joinClaims`.
 */
export function archiveKeyFor(url: string): string {
  return normalizeUrl(url);
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256")
    .update(typeof data === "string" ? Buffer.from(data, "utf8") : data)
    .digest("hex");
}

/**
 * The blob's digest, computed over the UTF-8 encoding of the body BEFORE gzip.
 *
 * Hashing the `.gz` would make the digest a function of the zlib version and
 * break idempotency across machines for identical content - every CI runner
 * with a different zlib would add a blob for a source nobody edited (spec 8.3).
 */
export function blobHash(body: string): string {
  return sha256Hex(body);
}

/** `blobs/<aa>/<hash>.gz`, sharded on the first two hex characters. */
export function blobRelPath(hash: string): string {
  return `blobs/${hash.slice(0, 2)}/${hash}.gz`;
}

/**
 * SHA-256 over that URL's claims, `norm()`-normalized, sorted, newline-joined.
 *
 * `norm()` because it is what the MATCHER runs, so the hash tracks exactly the
 * text a verdict depends on and an invisible whitespace edit does not read as
 * a claims change - the same reasoning as 7.3's floor: the predicate has to be
 * the matcher's. Sorted because reordering the claims of one URL changes
 * nothing about what is checked, and an order-sensitive hash would report a
 * confound - and suppress the comparison - for a reordering.
 */
export function claimsHashFor(claims: readonly string[]): string {
  return sha256Hex(claims.map(norm).sort().join("\n"));
}

/**
 * Every header except `set-cookie`, in any casing.
 *
 * A DENYLIST, not an allowlist: the header vetoes are dated data that rot and
 * get added to (7.2), so a set frozen today would leave a rule added tomorrow
 * unable to fire on an archived read, and the control arm would answer with a
 * veto the live arm no longer agrees with. `set-cookie` is never stored, in
 * any form, because these files are committed and a session cookie in git is a
 * credential leak.
 *
 * RESIDUAL, DISCLOSED (spec 8.3): any other response header a host chooses to
 * put a secret in is committed with the archive, so an author archiving an
 * authenticated page is publishing whatever that host returns.
 */
export function withoutSetCookie(headers: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "set-cookie") continue;
    out[k] = v;
  }
  return out;
}
