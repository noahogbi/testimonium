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

  it("carries evidence and retrievedAt on unsupported too, for the claims that DID match", () => {
    // 0.2.0: an accusation is a render surface after all, for the passages
    // that landed. The author still sees `missed` in CLI output; a reader now
    // also sees the excerpts that were not the problem.
    const r = buildResult({ ...BASE, verdict: "unsupported", missed: ["q"] });
    expect(r.evidence?.[0]?.excerpt).toBe("the passage");
    expect(typeof r.retrievedAt).toBe("string");
    expect(r.missed).toEqual(["q"]);
  });

  it("keeps the passages a partially-supported footnote did prove", () => {
    const r = buildResult({
      url: "https://example.com/a",
      verdict: "unsupported",
      evidence: [{ claims: ["the first claim that matched"], excerpt: "...matched...", rung: "node" }],
      missed: ["a claim that did not match"],
      rungsAttempted: ["node"],
      rungsAvailable: ["node", "curl"],
      isPdfUrl: false,
    });
    expect(r.missed).toEqual(["a claim that did not match"]);
    expect(r.evidence).toHaveLength(1);
    expect(r.retrievedAt).toBeTypeOf("string");
  });

  it("leaves an unreachable result bare - we did not read the page", () => {
    const r = buildResult({
      url: "https://example.com/b",
      verdict: "unreachable",
      evidence: [{ claims: ["x"], excerpt: "y", rung: "node" }],
      missed: [],
      rungsAttempted: ["node"],
      rungsAvailable: ["node", "curl"],
      isPdfUrl: false,
    });
    expect(r.evidence).toBeUndefined();
    expect(r.retrievedAt).toBeUndefined();
  });

  it.each(["supported", "unreachable", "unclaimed"] as const)(
    "carries NO `missed` on %s - only an accusing verdict may accuse",
    (verdict) => {
      // `missed` names the claims the author allegedly failed to support. It
      // used to sit in `base` on every verdict, so `unreachable` - the verdict
      // that means "we could not look" - shipped an accusation list beside it.
      // Gated by construction, the same doctrine as evidence/retrievedAt.
      expect(buildResult({ ...BASE, verdict, missed: ["q"] })).not.toHaveProperty("missed");
    },
  );
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
