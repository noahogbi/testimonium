import { describe, expect, it } from "vitest";
import { buildResult } from "../../src/io/evidence.js";

const RENDERABLE = ["excerpt", "retrievedAt", "evidence"];
const BASE = {
  url: "https://e.com/a",
  evidence: [{ claims: ["p"], excerpt: "the passage", rung: "node" as const }],
  rungsAttempted: ["node"] as const,
  rungsAvailable: ["node", "curl"] as const,
  missed: [] as readonly string[],
  isPdfUrl: false,
};

describe("buildResult", () => {
  it("carries evidence and a retrieval date on supported", () => {
    const r = buildResult({ ...BASE, verdict: "supported" });
    expect(r.evidence?.[0]?.excerpt).toBe("the passage");
    expect(typeof r.retrievedAt).toBe("string");
  });

  it.each(["unreachable", "unclaimed"] as const)("strips every renderable field on %s", (verdict) => {
    const r = buildResult({ ...BASE, verdict });
    for (const k of RENDERABLE) expect(r).not.toHaveProperty(k);
  });

  it("strips renderable fields on unsupported too", () => {
    // An accusation is not a render surface either. The author sees the misses
    // in CLI output; a reader sees nothing.
    const r = buildResult({ ...BASE, verdict: "unsupported", missed: ["q"] });
    for (const k of RENDERABLE) expect(r).not.toHaveProperty(k);
    expect(r.missed).toEqual(["q"]);
  });
});

describe("ladderTruncated", () => {
  const at = (available: readonly string[], isPdfUrl: boolean) =>
    buildResult({ ...BASE, verdict: "unreachable", rungsAvailable: available as never, isPdfUrl }).ladderTruncated;

  it("is false for an HTML url on a node+curl machine, even with both walled", () => {
    // The HTML ladder never uses pdftotext, so its absence is not truncation.
    expect(at(["node", "curl"], false)).toBe(false);
  });

  it("is true for an HTML url when curl is unavailable", () => {
    expect(at(["node"], false)).toBe(true);
  });

  it("is TRUE for a PDF url when pdftotext is unavailable, even though nothing was attempted", () => {
    // THE SERVERLESS CASE. Nothing is attempted at all, so any formula based on
    // attempted-versus-available reports false here - the one case the field
    // exists to disclose.
    expect(at(["node", "curl"], true)).toBe(true);
  });

  it("is false for a PDF url on a machine that has pdftotext", () => {
    expect(at(["node", "curl", "pdftotext"], true)).toBe(false);
  });

  it("always records rung provenance", () => {
    expect(buildResult({ ...BASE, verdict: "unreachable" }).rungsAvailable).toEqual(["node", "curl"]);
  });
});
