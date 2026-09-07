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
