import { execFileSync, spawnSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { curlAvailable } from "./curl.js";
import { EMPTY_RESPONSE, type RawResponse } from "./types.js";

/** A `/pdf/` path segment is a cheap, pre-fetch recovery for the
 *  content-negotiated case: arxiv.org/pdf/1706.03762v7 carries no `.pdf`
 *  suffix but does carry this segment. Checked on the URL alone, before any
 *  fetch, exactly as the `.pdf` suffix is - `ladder.ts` requires the rung be
 *  chosen up front. Worst case the guess is wrong and the body is HTML,
 *  which reads as `unreachable` (pdftotext fails on non-PDF bytes) - never
 *  an accusation. A bare "pdf" substring inside a longer path segment
 *  (`/pdfs/`, `/mypdf/`) does NOT match; the slashes on both sides require a
 *  whole segment.
 *
 *  **Matched against the PATH, with query and fragment stripped first.** Both
 *  patterns used to run over the whole URL string, so `?u=/pdf/` on a
 *  redirector and `#report.pdf` on an anchor chose the PDF rung for an HTML
 *  page - contradicting this comment and the plan, which both say "path
 *  segment". Stripping also fixes the mirror defect: `.pdf` followed by a
 *  FRAGMENT is a real PDF and the old `\.pdf($|\?)` did not match it. */
export const isPdf = (url: string, contentType = ""): boolean => {
  const path = url.split("#")[0]?.split("?")[0] ?? "";
  return /\.pdf$/i.test(path) || /\/pdf\//i.test(path) || /application\/pdf/i.test(contentType);
};

/** Extract a PDF's text so a filing can be phrase-checked against its own
 *  bytes. Without this a PDF URL is matched as HTML, every claim misses, and
 *  the result reads identically to a fabricated claim. `-layout` keeps column
 *  order. The extension is checked BEFORE any fetch: if a large PDF fetch
 *  throws and execution falls through to curl, curl hands back PDF bytes as
 *  "text" and the source is libelled. */
export function pdfFetch(url: string, userAgent: string): RawResponse {
  const tmp = join(tmpdir(), `testimonium-${process.pid}-${Date.now()}.pdf`);
  try {
    execFileSync("curl", ["-s", "--compressed", "--max-time", "30", "-A", userAgent, "-L", "-o", tmp, url]);
    const text = execFileSync("pdftotext", ["-layout", tmp, "-"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    // status 0: no server told us anything about this document that we
    // captured. N4 is the one place the classifier consults status
    // (404/410, "the document is gone"), and 0 is neither, so it does not
    // trip that veto - this is honest rather than lossy, and it is not a
    // fabricated 200.
    return { rawBody: text, status: 0, headers: {}, finalUrl: url, bytes: text.length };
  } catch {
    return EMPTY_RESPONSE;
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* nothing to clean up */
    }
  }
}

export function pdftotextAvailable(): boolean {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch (e) {
    // Xpdf's pdftotext exits 99 on -v, and other builds differ again. A
    // non-zero exit means the binary RAN, so it is present; only a spawn
    // failure (ENOENT) means it is genuinely missing. Probing on exit code
    // alone reported a working install as absent and silently disabled the
    // PDF rung.
    return (e as NodeJS.ErrnoException)?.code !== "ENOENT";
  }
}

/** The PDF rung needs BOTH binaries: `pdfFetch` downloads with curl, then
 *  converts with pdftotext. `defaultFetcher` used to advertise the rung on
 *  `pdftotextAvailable()` alone, as an inline `&&` at the call site - on a
 *  machine with pdftotext and no curl, every PDF citation attempted the
 *  rung, failed, and reported `unreachable` with `ladderTruncated: false`,
 *  the one field built to disclose exactly that gap. Extracted to its own
 *  predicate, with the two checks as injectable parameters, so a test can
 *  exercise every combination directly rather than spawning a process or
 *  requiring a binary to be genuinely absent from the test machine. */
export function pdfRungAvailable(
  hasCurl: () => boolean = curlAvailable,
  hasPdftotext: () => boolean = pdftotextAvailable,
): boolean {
  return hasCurl() && hasPdftotext();
}

/** Both streams of a `pdftotext -v` probe, plus whether the binary could be
 *  spawned at all. A NON-ZERO EXIT IS NOT `missing`: Xpdf's build exits 99 on
 *  `-v` and prints its version anyway, which is the same line
 *  `pdftotextAvailable` already draws. */
export interface VersionProbe {
  readonly missing: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

export type VersionRunner = () => VersionProbe;

/** `spawnSync`, not `execFileSync`, for two measured reasons: both known
 *  builds print the version to STDERR and `execFileSync` returns only stdout,
 *  and `execFileSync` throws on Xpdf's non-zero exit. `spawnSync` never throws
 *  and returns both streams whatever the status. */
const probePdftotext: VersionRunner = () => {
  const r = spawnSync("pdftotext", ["-v"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return {
    // `error` is set only when the process could not be spawned (ENOENT).
    missing: r.error !== undefined,
    // Both are `undefined`, not "", when the spawn itself failed.
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
};

/**
 * The first line `pdftotext -v` prints, or null when the binary is absent or
 * printed nothing.
 *
 * PROVENANCE FOR THE ARCHIVE (spec 8.3). `pdfFetch` returns `pdftotext
 * -layout`'s output as `rawBody`, so what is archived for a PDF is already
 * tool-transformed and the local poppler build sits inside the live arm and
 * outside the archive. Recording the version is what lets `recheck` name a
 * poppler difference as a named confound instead of failing the author's build
 * over a PDF nobody touched.
 *
 * RESIDUE, DISCLOSED: two different builds reporting the same version string
 * are not distinguishable at all.
 *
 * The runner is injectable so no test spawns a binary, exactly as
 * `pdfRungAvailable` takes its two predicates.
 */
export function pdftotextVersion(run: VersionRunner = probePdftotext): string | null {
  const probe = run();
  if (probe.missing) return null;
  for (const stream of [probe.stderr, probe.stdout]) {
    const line = stream.split(/\r?\n/).map((s) => s.trim()).find((s) => s.length > 0);
    if (line !== undefined) return line;
  }
  return null;
}
