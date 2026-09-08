import { describe, expect, it, vi } from "vitest";

// The PREDICATE `pdfRungAvailable` is thoroughly tested in pdf.test.ts. The
// WIRING was not: reverting defaultFetcher's one call from `pdfRungAvailable()`
// to `pdftotextAvailable()` left the whole suite green, so nothing pinned the
// fact that the advertised rung is gated on BOTH binaries. That revert is
// exactly the regression pdfRungAvailable was extracted to prevent - on a
// machine with pdftotext and no curl it makes every PDF citation attempt the
// rung, fail, and report `unreachable` with `ladderTruncated: false`, the one
// field built to disclose that gap.
//
// Only the two leaf probes are stubbed. `pdfRungAvailable` itself is the real
// implementation, delegated to with the probes as its injectable parameters,
// so this exercises the shipped predicate rather than a copy of it. No change
// to default-fetcher.ts: the wiring is observable through `rungs` as it
// stands.
const probes = vi.hoisted(() => ({ curl: true, pdftotext: true }));

vi.mock("../../src/fetch/curl.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/fetch/curl.js")>();
  return { ...actual, curlAvailable: () => probes.curl };
});

vi.mock("../../src/fetch/pdf.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/fetch/pdf.js")>();
  return {
    ...actual,
    pdftotextAvailable: () => probes.pdftotext,
    pdfRungAvailable: () => actual.pdfRungAvailable(() => probes.curl, () => probes.pdftotext),
  };
});

const { defaultFetcher } = await import("../../src/fetch/default-fetcher.js");

describe("defaultFetcher - which rungs it advertises", () => {
  it("advertises all three when both binaries are present", () => {
    probes.curl = true;
    probes.pdftotext = true;
    expect(defaultFetcher().rungs).toEqual(["node", "curl", "pdftotext"]);
  });

  it("withholds the PDF rung when curl is missing, even though pdftotext is present", () => {
    // THE WIRING TEST. `pdftotextAvailable()` alone answers true here, so a
    // defaultFetcher gated on it would advertise a rung that cannot run:
    // pdfFetch downloads with curl before it converts.
    probes.curl = false;
    probes.pdftotext = true;
    expect(defaultFetcher().rungs).toEqual(["node"]);
  });

  it("withholds the PDF rung when pdftotext is missing", () => {
    probes.curl = true;
    probes.pdftotext = false;
    expect(defaultFetcher().rungs).toEqual(["node", "curl"]);
  });

  it("advertises only the node rung when neither binary is present", () => {
    probes.curl = false;
    probes.pdftotext = false;
    expect(defaultFetcher().rungs).toEqual(["node"]);
  });
});
