import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Fix round 1 (review Important finding): the original extractor matched
 * the bare token `type <Name>` anywhere in the file text, with no regard
 * for whether it sat inside an `export` clause. Measured against the real
 * src/index.ts, that let a directly-declared `export interface Foo {}` or
 * `export type Foo = ...;` land silently invisible (the count stayed 23),
 * while an `import { type X }` or a comment merely mentioning "type X"
 * pushed the count to 24 for the wrong reason. An addition landing
 * unnoticed is exactly what this pin exists to prevent (spec 2.7,
 * acceptance criterion 5), so this is now anchored to statements that
 * actually begin with `export`, with comments stripped first.
 *
 * Four shapes, each independent - the four regexes below require different
 * characters immediately after `export`/`export type`, so at most one can
 * match a given statement, and none of them can match a line beginning
 * `import` or text that only survives inside a stripped comment:
 *   1. `export type { A, B } from "...";`  - both export syntaxes remain
 *      covered, per the original comment this replaces.
 *   2. `export { fn, type A } from "...";`  - only the `type A` entries
 *      count; a bare value name like `fn` does not.
 *   3. `export interface A { ... }`         - direct declarations, missed
 *      entirely by the old regex.
 *   4. `export type A = ...;`               - direct type aliases.
 */
function stripComments(src: string): string {
  return src.replace(
    /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (m) => (m[0] === '"' || m[0] === "'" || m[0] === "`" ? m : ""),
  );
}

function exportedTypeNames(src: string): string[] {
  const clean = stripComments(src);
  const names = new Set<string>();

  for (const m of clean.matchAll(/^[ \t]*export\s+type\s*\{([\s\S]*?)\}/gm)) {
    for (const part of m[1]!.split(",")) {
      const name = part.trim();
      if (name) names.add(name);
    }
  }

  for (const m of clean.matchAll(/^[ \t]*export\s*\{([\s\S]*?)\}/gm)) {
    for (const part of m[1]!.split(",")) {
      const tm = part.trim().match(/^type\s+([A-Za-z]\w*)/);
      if (tm) names.add(tm[1]!);
    }
  }

  for (const m of clean.matchAll(/^[ \t]*export\s+interface\s+([A-Za-z]\w*)/gm)) {
    names.add(m[1]!);
  }

  for (const m of clean.matchAll(/^[ \t]*export\s+type\s+([A-Za-z]\w*)\s*=/gm)) {
    names.add(m[1]!);
  }

  return [...names].sort();
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
