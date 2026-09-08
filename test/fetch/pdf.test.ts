import { describe, expect, it } from "vitest";
import { isPdf, pdfRungAvailable } from "../../src/fetch/pdf.js";

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
