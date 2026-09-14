import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";

/**
 * This pin exists because the public TYPE surface becomes a permanent
 * compatibility commitment the moment declarations ship: an addition must
 * not be able to land unnoticed.
 *
 * WHY THE COMPILER API AND NOT A REGEX. Four review rounds each found the
 * same failure shape in a text-based extractor - an export that produced
 * NEITHER a recorded name NOR a throw, i.e. a silent count of 23 that looks
 * exactly like success:
 *   1. a bare-token regex matched `type X` anywhere, comments and `import`
 *      lines included;
 *   2. `export * from`, `export { type X as Y }` and generic aliases were
 *      unenumerated;
 *   3. the mixed-form entry parser kept an unconditional `continue` past a
 *      failed parse;
 *   4. the statement scanner was line-anchored (`/^[ \t]*export\b/gm`), so a
 *      second export statement sharing a physical line was never visited.
 * Each fix was correct for its target; the constant was the approach. A
 * regex reimplementation of "what is a type export" can only ever be as
 * complete as the last review's imagination. The parser that TypeScript
 * itself uses has no such gap: it enumerates statements, not lines, and it
 * already knows every export form the language has. So this reads
 * `src/index.ts` with `ts.createSourceFile` and walks `sourceFile.statements`,
 * classifying each into exactly one of three outcomes - contributes names,
 * contributes nothing, or THROWS. There is no fourth, silent outcome.
 */

/**
 * The statement-level `export` modifier, as on `export interface X {}` or
 * `export const x = 1`. An `export ... from "..."` / `export { ... }`
 * declaration is an `ExportDeclaration` node instead and carries no such
 * modifier, so it is handled on its own branch before this is consulted.
 */
function hasExportModifier(stmt: ts.Statement): boolean {
  if (!ts.canHaveModifiers(stmt)) return false;
  const mods = ts.getModifiers(stmt);
  return mods !== undefined && mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** Node kind plus its source text, whitespace-collapsed, for throw messages. */
function describeStatement(stmt: ts.Node, sf: ts.SourceFile): string {
  const kind = ts.SyntaxKind[stmt.kind] ?? String(stmt.kind);
  const text = stmt.getText(sf).replace(/\s+/g, " ").trim();
  return `${kind} \`${text.length > 120 ? `${text.slice(0, 120)}...` : text}\``;
}

/**
 * The public type names ONE statement adds to the surface. Returns a
 * (possibly empty) list, or throws when the statement exports something
 * this pin cannot account for.
 */
function typeNamesOfStatement(stmt: ts.Statement, sf: ts.SourceFile): string[] {
  if (ts.isExportDeclaration(stmt)) {
    const clause = stmt.exportClause;
    if (clause === undefined) {
      // `export * from "./x.js"` - re-exports every type the target module
      // has, invisibly, and the set can change without this file changing.
      throw new Error(
        `type-surface pin: a wildcard re-export can carry types this pin cannot ` +
          `enumerate - list the names explicitly instead: ${describeStatement(stmt, sf)}`,
      );
    }
    if (!ts.isNamedExports(clause)) {
      // `export * as ns from "./x.js"` - same problem, wrapped in a namespace.
      throw new Error(
        `type-surface pin: unclassifiable export - decide deliberately whether it ` +
          `adds public type names, then extend typeNamesOfStatement: ${describeStatement(stmt, sf)}`,
      );
    }
    const names: string[] = [];
    for (const spec of clause.elements) {
      // Two independent type-only markers: `stmt.isTypeOnly` is the
      // declaration-level one (`export type { A, B }`), `spec.isTypeOnly` the
      // specifier-level one (`export { value, type A }`). A specifier's
      // `name` is the name the CONSUMER imports and `propertyName` the
      // original, so `export { type Foo as Bar }` records `Bar`.
      if (stmt.isTypeOnly || spec.isTypeOnly) names.push(spec.name.text);
    }
    return names;
  }

  if (ts.isExportAssignment(stmt)) {
    // `export default ...` / `export = ...` in a barrel: not a shape this
    // package uses, and `export default` can be given a type-only meaning.
    throw new Error(
      `type-surface pin: unclassifiable export - decide deliberately whether it ` +
        `adds public type names, then extend typeNamesOfStatement: ${describeStatement(stmt, sf)}`,
    );
  }

  // Anything without the `export` modifier is invisible to consumers:
  // `import` declarations (including `import { type X }`), file-local
  // declarations, and so on. Comments never reach here at all - the parser
  // keeps them as trivia, not statements.
  if (!hasExportModifier(stmt)) return [];

  if (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) {
    // `export interface X<T> {}` / `export type X<T> = ...` - the name is
    // the name, generics and all; nothing after it needs inspecting.
    return [stmt.name.text];
  }

  if (
    ts.isVariableStatement(stmt) ||
    ts.isFunctionDeclaration(stmt) ||
    ts.isClassDeclaration(stmt)
  ) {
    // Value declarations legitimately contribute nothing to the type
    // surface, so they are recognized-and-inert rather than a throw. Their
    // public names are guarded separately, by the runtime export allowlist
    // in test/exports.test.ts, which pins `Object.keys(api)` exactly - and
    // a class's instance type shares its runtime name, so that allowlist
    // catches a new class too.
    return [];
  }

  // Everything else - `export enum`, `export namespace`, `export import X =`,
  // and any form a future TypeScript adds. An enum in particular genuinely
  // introduces a type, so a human should decide deliberately rather than
  // have this pin guess.
  throw new Error(
    `type-surface pin: unclassifiable export - decide deliberately whether it ` +
      `adds public type names, then extend typeNamesOfStatement: ${describeStatement(stmt, sf)}`,
  );
}

function exportedTypeNames(src: string): string[] {
  const sf = ts.createSourceFile("index.ts", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  // `createSourceFile` never throws on malformed input - it returns a
  // best-effort tree - so without this a syntax error would yield a partial
  // name set and, very likely, a quiet 23. `parseDiagnostics` is internal;
  // if a TypeScript upgrade renames it, that is itself a loud failure here
  // rather than a silently skipped check.
  const diagnostics = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  if (diagnostics === undefined) {
    throw new Error(
      "type-surface pin: cannot read SourceFile.parseDiagnostics (internal API, likely " +
        "renamed by a TypeScript upgrade) - the pin cannot prove src/index.ts parsed cleanly",
    );
  }
  if (diagnostics.length > 0) {
    const first = diagnostics[0]!;
    throw new Error(
      `type-surface pin: src/index.ts did not parse cleanly, so the extracted names ` +
        `cannot be trusted: ${ts.flattenDiagnosticMessageText(first.messageText, " ")}`,
    );
  }

  const names = new Set<string>();
  for (const stmt of sf.statements) {
    for (const name of typeNamesOfStatement(stmt, sf)) names.add(name);
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
