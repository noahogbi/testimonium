import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EMPTY_RESPONSE, type RawResponse } from "./types.js";

/**
 * Take the FINAL hop's headers from a `curl -D` dump.
 *
 * With -L the dump holds one block per hop, separated by a blank line, plus
 * any 1xx informational blocks. Reading the first block returns the redirect's
 * headers rather than the document's, which would miss cf-mitigated on the hop
 * that actually served the challenge.
 */
export function parseHeaderDump(dump: string): Record<string, string> {
  const blocks = dump
    .split(/\r?\n\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .filter((b) => !/^HTTP\/[\d.]+ 1\d\d/.test(b));
  const last = blocks[blocks.length - 1];
  if (!last) return {};
  const out: Record<string, string> = {};
  for (const line of last.split(/\r?\n/).slice(1)) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return out;
}

/** Some hosts reject a UA-only curl and serve the real page as soon as an
 *  Accept header is present. axios.com is the measured case: -A <Chrome> alone
 *  returned a 5,777-byte block page and adding Accept returned the full
 *  176,605-byte article, same UA, same binary. Sending it costs nothing either
 *  way - it is what a real browser sends. */
const CURL_HEADERS = [
  "-H", "Accept: text/html,application/xhtml+xml",
  "-H", "Accept-Language: en-US,en;q=0.9",
];

export function curlFetch(url: string, userAgent: string): RawResponse {
  const stem = join(tmpdir(), `testimonium-${process.pid}-${Date.now()}`);
  const bodyFile = `${stem}.body`;
  const dumpFile = `${stem}.hdr`;
  try {
    const w = execFileSync(
      "curl",
      ["-s", "--compressed", "--max-time", "25", "-A", userAgent, ...CURL_HEADERS,
       "-L", "-D", dumpFile, "-o", bodyFile, "-w", "%{http_code}\n%{url_effective}", url],
      { encoding: "utf8" },
    );
    const [code = "0", effective = url] = w.trim().split("\n");
    const rawBody = readFileSync(bodyFile, "utf8");
    return {
      rawBody,
      status: Number(code) || 0,
      headers: parseHeaderDump(readFileSync(dumpFile, "utf8")),
      finalUrl: effective,
      bytes: rawBody.length,
    };
  } catch (e) {
    console.warn(
      `warn curl rung failed for ${url}: ${e instanceof Error ? e.message : String(e)}`,
    );
    return EMPTY_RESPONSE;
  } finally {
    for (const f of [bodyFile, dumpFile]) {
      try {
        unlinkSync(f);
      } catch {
        /* nothing to clean up */
      }
    }
  }
}

export function curlAvailable(): boolean {
  try {
    execFileSync("curl", ["--version"], { stdio: "ignore" });
    return true;
  } catch (e) {
    // Same reasoning as pdftotextAvailable(): a non-zero exit means the
    // binary RAN, so it is present; only a spawn failure (ENOENT) means it
    // is genuinely missing. curl happens to exit 0 on --version today, but
    // probing on exit code alone is the same latent bug waiting to happen.
    return (e as NodeJS.ErrnoException)?.code !== "ENOENT";
  }
}
