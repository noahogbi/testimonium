import { describe, expect, it, vi } from "vitest";
import {
  isPdf,
  pdfFetch,
  pdfRungAvailable,
  pdftotextVersion,
  toVersionProbe,
  type SpawnResultLike,
  type VersionProbe,
} from "../../src/fetch/pdf.js";

describe("isPdf", () => {
  it("matches a .pdf suffix", () => {
    expect(isPdf("https://example.com/report.pdf")).toBe(true);
  });

  it("matches a .pdf suffix followed by a query string", () => {
    expect(isPdf("https://example.com/report.pdf?download=1")).toBe(true);
  });

  it("matches a /pdf/ path segment with no .pdf suffix - the arxiv case", () => {
    // arxiv.org/pdf/1706.03762v7: content-negotiated, no ".pdf" anywhere in
    // the URL. Widened so this is caught pre-fetch, as ladder.ts requires.
    expect(isPdf("https://arxiv.org/pdf/1706.03762v7")).toBe(true);
  });

  it("matches a bare application/pdf content type", () => {
    expect(isPdf("https://example.com/doc", "application/pdf")).toBe(true);
  });

  it("does NOT match \"pdf\" as a substring of a longer path segment", () => {
    expect(isPdf("https://example.com/pdfstore/catalog")).toBe(false);
    expect(isPdf("https://example.com/nonpdfword/doc")).toBe(false);
    expect(isPdf("https://example.com/apdf/doc")).toBe(false);
  });

  it("does not match an ordinary HTML url", () => {
    expect(isPdf("https://example.com/article/2024/report")).toBe(false);
  });

  it("matches on the PATH only - a /pdf/ inside a query string is not a path segment", () => {
    // The doc comment and the plan both say "path segment"; the regex was
    // matching the whole URL, so a redirector or a tracking parameter carrying
    // "/pdf/" chose the PDF rung for an HTML page. Query and fragment are
    // stripped before matching.
    expect(isPdf("https://x.com/a?u=/pdf/")).toBe(false);
    expect(isPdf("https://x.com/a?next=https://y.com/pdf/123")).toBe(false);
    expect(isPdf("https://x.com/a#/pdf/")).toBe(false);
    expect(isPdf("https://x.com/article?file=report.pdf")).toBe(false);
    expect(isPdf("https://x.com/article#report.pdf")).toBe(false);
  });

  it("still matches a real .pdf path that carries a query string or fragment", () => {
    // The other direction, which stripping must NOT regress.
    expect(isPdf("https://x.com/doc.pdf?v=2")).toBe(true);
    expect(isPdf("https://x.com/doc.pdf#page=4")).toBe(true);
    expect(isPdf("https://arxiv.org/pdf/1706.03762v7?download=1")).toBe(true);
  });
});

describe("pdfFetch", () => {
  it("warns when the PDF rung fails instead of returning empty in silence", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // A URL that cannot be downloaded: the failure path, whichever stage owns it.
      // pdfFetch(url, userAgent) - both parameters are required (src/fetch/pdf.ts:35).
      pdfFetch("https://example.invalid/nope.pdf", "testimonium-test");
      expect(warn).toHaveBeenCalled();
      const msg = warn.mock.calls.map((c) => String(c[0])).join("\n");
      expect(msg).toMatch(/^warn /);
      expect(msg).toContain("example.invalid");
    } finally {
      warn.mockRestore();
    }
  });
});

describe("pdfRungAvailable", () => {
  // The PDF rung needs BOTH curl (to fetch) and pdftotext (to convert).
  // Injectable checks so every combination is tested directly, without
  // spawning a process or requiring a binary to be genuinely missing.
  it("is available when both binaries are present", () => {
    expect(pdfRungAvailable(() => true, () => true)).toBe(true);
  });

  it("is unavailable when curl is missing", () => {
    expect(pdfRungAvailable(() => false, () => true)).toBe(false);
  });

  it("is unavailable when pdftotext is missing", () => {
    expect(pdfRungAvailable(() => true, () => false)).toBe(false);
  });

  it("is unavailable when both are missing", () => {
    expect(pdfRungAvailable(() => false, () => false)).toBe(false);
  });
});

describe("pdftotextVersion", () => {
  // Measured on this machine 2026-09-09 with
  //   spawnSync("pdftotext", ["-v"], { encoding: "utf8", stdio: ["ignore","pipe","pipe"] })
  // which returned status 99, no error, an empty stdout, and this on stderr.
  // Xpdf's build exits NON-ZERO on -v and still prints its version, which is
  // why the probe must not treat a non-zero exit as absence: doing so records
  // nothing on a working install, silently, for exactly the rung whose version
  // is the only thing standing between a poppler upgrade and an exit 1.
  const XPDF_STDERR = "pdftotext version 4.00\r\nCopyright 1996-2017 Glyph & Cog, LLC\r\n";
  const probe = (p: Partial<VersionProbe>): VersionProbe => ({ missing: false, stdout: "", stderr: "", ...p });

  it("reads the version off stderr, where both known builds print it", () => {
    // THIS IS ALSO WHERE "a non-zero exit is not absence" is pinned, as far as
    // a test AT THIS LEVEL can pin it. Fable's correction 4: this plan carried
    // a second `it()` named for that property whose input - `probe({ missing:
    // false, stderr: XPDF_STDERR })` - was character-for-character this one's,
    // since `missing: false` is the helper's default. It could not go red
    // unless this test did, so it is deleted rather than left to overclaim a
    // property it could not check. The enforcement here is STRUCTURAL:
    // `VersionProbe` carries no exit status at all, so `pdftotextVersion` has
    // nothing to consult. The line that decides `missing` from a raw status -
    // `r.error !== undefined`, not `r.status !== 0` - is `toVersionProbe`'s,
    // below, and has its own tests (fix round 1): no test here reaches it,
    // because every test above injects its own `VersionRunner`.
    expect(pdftotextVersion(() => probe({ stderr: XPDF_STDERR }))).toBe("pdftotext version 4.00");
  });

  it("returns only the FIRST non-empty line, not the copyright line under it", () => {
    // The mutation this catches: returning the whole stream trimmed. A
    // multi-line version string would be written into every index entry and
    // compared as one, so a copyright year change would read as a confound.
    const v = pdftotextVersion(() => probe({ stderr: XPDF_STDERR }));
    expect(v).not.toContain("Copyright");
    expect(v).not.toContain("\n");
  });

  it("returns null when the binary could not be spawned at all", () => {
    expect(pdftotextVersion(() => probe({ missing: true }))).toBeNull();
  });

  it("falls back to stdout for a build that prints there instead", () => {
    // SHAPE, not a measurement: no build was observed printing to stdout on
    // this machine. The fallback exists because the stream is a property of
    // the build and this probe must not depend on which one is installed.
    expect(pdftotextVersion(() => probe({ stdout: "pdftotext version 0.0.0-test\n" }))).toBe(
      "pdftotext version 0.0.0-test",
    );
  });

  it("prefers stderr when a build writes to both", () => {
    expect(pdftotextVersion(() => probe({ stdout: "from stdout", stderr: "from stderr" }))).toBe("from stderr");
  });

  it("NEGATIVE CONTROL: a binary that ran and printed nothing records nothing", () => {
    // Without this, a probe that returned a constant string would pass every
    // test above and stamp a fabricated version into every index entry.
    expect(pdftotextVersion(() => probe({ stdout: "  \n\n", stderr: "" }))).toBeNull();
  });
});

describe("toVersionProbe", () => {
  // Fix round 1: pulled out of `probePdftotext` because no test above
  // reaches the real spawnSync-to-VersionProbe mapping at all - every one of
  // them injects its own `VersionRunner`. A prior review mutated
  // `missing: r.error !== undefined` to `missing: r.status !== 0` and ZERO
  // unit tests failed; on the real binary that mutation makes
  // `pdftotextVersion()` return `null` while `pdftotextAvailable()` returns
  // `true` - the exact silent disagreement this task exists to prevent. That
  // review also mutated both `?? ""` coalesces away and `tsc` stayed clean,
  // because `spawnSync`'s own return type claims `stdout`/`stderr` are
  // `string`, never `undefined`, even though the runtime value is
  // `undefined` on a failed spawn. `SpawnResultLike` declares them optional
  // for exactly this reason, so the coalesce is load-bearing at the type
  // level too: drop it and this file fails to typecheck.

  it("coalesces undefined stdout and stderr to empty strings", () => {
    // Measured (see the brief): both streams are `undefined`, not `""`, when
    // the spawn itself fails. Without this, `pdftotextVersion`'s
    // `stream.split(...)` would throw on `undefined.split(...)`.
    const raw: SpawnResultLike = { status: null, error: new Error("spawn ENOENT"), stdout: undefined, stderr: undefined };
    expect(toVersionProbe(raw)).toEqual({ missing: true, stdout: "", stderr: "" });
  });

  it("a non-zero status with no error is NOT missing - Xpdf's own exit code", () => {
    // This is the exact case the `r.status !== 0` mutation got wrong: status
    // 99, no `error`, must read as present, not missing.
    const raw: SpawnResultLike = { status: 99, stdout: "", stderr: "pdftotext version 4.00\n" };
    expect(toVersionProbe(raw)).toEqual({ missing: false, stdout: "", stderr: "pdftotext version 4.00\n" });
  });

  it("an ENOENT error IS missing, regardless of status", () => {
    const raw: SpawnResultLike = { status: null, error: new Error("spawn ENOENT"), stdout: "", stderr: "" };
    expect(toVersionProbe(raw).missing).toBe(true);
  });
});
