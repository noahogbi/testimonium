import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/** Both export syntaxes. `export { x, type Y }` and `export type { A, B }` are
 *  both in use, and an earlier sweep matching only the first reported 8 of 14 -
 *  an instrument error that looked exactly like a spec error. */
function exportedTypeNames(src: string): string[] {
  const inline = [...src.matchAll(/\btype\s+([A-Za-z]\w*)/g)].map((m) => m[1]!);
  const blocks = [...src.matchAll(/export\s+type\s*\{([^}]*)\}/g)]
    .flatMap((m) => m[1]!.split(",").map((s) => s.trim()))
    .filter(Boolean);
  return [...new Set([...inline, ...blocks])].sort();
}

const EXPECTED = [
  "BuiltinRung", "CheckOptions", "CitationResult", "ClaimEntry", "ClaimProblem",
  "ClaimsFile", "Document", "Evidence", "FailOn", "Fetcher", "FetcherOptions",
  "FiredRule", "Footnote", "HostRule", "Joined", "RawResponse",
  "ReachabilityOptions", "ReachabilityResult", "Rule", "RuleSet", "RunTally",
  "RungId", "Verdict",
].sort();

describe("public type surface", () => {
  it("exports exactly the pinned 23 types - an addition is as much a change as a removal", () => {
    const src = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(exportedTypeNames(src)).toEqual(EXPECTED);
  });
});
