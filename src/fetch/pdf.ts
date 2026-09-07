import { execFileSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EMPTY_RESPONSE, type RawResponse } from "./types.js";

export const isPdf = (url: string, contentType = ""): boolean =>
  /\.pdf($|\?)/i.test(url) || /application\/pdf/i.test(contentType);

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
    // captured. The classifier does not consult status, so this is honest
    // rather than lossy - and it is not a fabricated 200.
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
