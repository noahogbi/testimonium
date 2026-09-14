import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Fix round 1 (review Important finding): the original extractor matched
 * the bare token `type <Name>` anywhere in the file text, with no regard
 * for whether it sat inside an `export` clause.
 *
 * Fix round 2 (review Important finding, four more gaps of the same
 * shape): round 1 still worked by ENUMERATING syntaxes it recognised -
 * `export * from "...";` (wildcard) and `export { type Evidence as
 * EvidenceAlias } from "...";` (alias - it re-added "Evidence", already in
 * the set, and never recorded the actually-new public name
 * "EvidenceAlias") both stayed silently at 23; `export type
 * GenericAlias<T> = T[];` also stayed at 23 because the direct-alias regex
 * required `=` immediately after the name, which a generic parameter list
 * defeats. "Extract the forms I recognise" can only ever be as complete as
 * the last review's imagination, and every gap it leaves is a silent 23
 * that looks exactly like success.
 *
 * INVERTED DESIGN: rather than adding a fifth pattern, this enumerates
 * every statement that begins with `export` (from the comment-stripped
 * source), classifies each into one of four known forms, and THROWS on any
 * statement matching none of them - `export declare interface Weird {}`,
 * say, or anything nobody has written a case for yet. An unrecognised
 * export syntax is then a loud failure that forces someone to extend this
 * function deliberately, never a quiet pass. (Known, currently-unreachable
 * limitation: stripComments below tokenises line comments and block
 * comments textually, so a regex LITERAL ending in an escaped slash -
 * `/foo\//` - could in
 * principle be misread as the start of a line comment. src/index.ts is a
 * pure barrel of export statements and contains no regex literals, so this
 * is not reachable today; noted rather than fixed, to avoid solving a
 * problem this file does not have.)
 *
 * The four known forms, classified in this order (each requires a
 * different character immediately after `export`/`export type`, so at
 * most one can ever match a given statement):
 *   1. `export type { A, B as C } from "...";`   - block type-only form.
 *   2. `export { fn, type A as B } from "...";`  - mixed form; only
 *      comma-separated entries that themselves start with `type ` count -
 *      a bare value name like `fn` does not.
 *   3. `export interface A<T> { ... }`  - direct declaration. Generics
 *      need no special handling: only the identifier right after
 *      `interface` is captured, and nothing after it is inspected.
 *   4. `export type A<T, U = X> = ...;`  - direct type alias. An optional
 *      generic parameter list is skipped by depth-counting `<`/`>` (not a
 *      character class), so a default type parameter's own `=` cannot be
 *      mistaken for the alias's `=`.
 * Both syntaxes recognise `as` aliasing and record the ALIAS as the public
 * name, never the original - a consumer can only import the name actually
 * exported.
 */
function stripComments(src: string): string {
  return src.replace(
    /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (m) => (m[0] === '"' || m[0] === "'" || m[0] === "`" ? m : ""),
  );
}

const IDENT = "[A-Za-z]\\w*";

/** Names inside an `export {...}` or `export type {...}` brace list.
 *  `requireTypePrefix` is true for the mixed form (2), where a bare entry
 *  is a runtime value and must be skipped rather than counted; false for
 *  the type-only block form (1), where every entry already denotes a
 *  type and a per-entry `type` prefix is not legal syntax to begin with.
 *  Either way, `X as Y` records `Y` - the name a consumer actually has. */
function braceNames(inner: string, requireTypePrefix: boolean): string[] {
  const out: string[] = [];
  for (const raw of inner.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    if (requireTypePrefix) {
      const m = part.match(new RegExp(`^type\\s+(${IDENT})(?:\\s+as\\s+(${IDENT}))?$`));
      if (m) out.push(m[2] ?? m[1]!);
      // A value-only entry (no `type` prefix) is a runtime name, not a
      // type - skip it. Deliberate, not a gap: this is what lets a mixed
      // export list like `{ check, type CheckOptions }` count only the
      // second half.
      continue;
    }
    const m = part.match(new RegExp(`^(${IDENT})(?:\\s+as\\s+(${IDENT}))?$`));
    if (!m) {
      throw new Error(`type-surface pin: unrecognized entry inside "export type { ... }": "${part}"`);
    }
    out.push(m[2] ?? m[1]!);
  }
  return out;
}

/** `export type Name<T, U = X> = ...;` - returns `Name` if `rest` starts
 *  with a direct type-alias declaration (optionally generic), else null so
 *  the caller can try the next form. Depth-counts `<`/`>` rather than
 *  matching a character class up to `=`, so a default type parameter's own
 *  `=` (`<T = string>`) cannot be mistaken for the alias's `=`. */
function genericAliasName(rest: string): string | null {
  const head = rest.match(new RegExp(`^export\\s+type\\s+(${IDENT})`));
  if (!head) return null;
  let i = head[0].length;
  const isSpace = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r";
  while (i < rest.length && isSpace(rest[i]!)) i++;
  if (rest[i] === "<") {
    let depth = 0;
    for (; i < rest.length; i++) {
      if (rest[i] === "<") depth++;
      else if (rest[i] === ">") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
  }
  while (i < rest.length && isSpace(rest[i]!)) i++;
  return rest[i] === "=" ? head[1]! : null;
}

/**
 * Classify ONE export statement - `rest` is the source text starting
 * exactly at its `export` keyword and running to end-of-file. Each
 * classifier is self-terminating (via its own brace capture, or by simply
 * not caring what follows the name it captures) so the statement's true
 * end never needs to be found. Returns the public type names the
 * statement introduces (zero or more), or THROWS if it matches none of
 * the four known forms - see the module docstring for why that is the
 * point, not a bug.
 */
function classify(rest: string): string[] {
  let m = rest.match(/^export\s+type\s*\{([\s\S]*?)\}/);
  if (m) return braceNames(m[1]!, false);

  m = rest.match(/^export\s*\{([\s\S]*?)\}/);
  if (m) return braceNames(m[1]!, true);

  m = rest.match(new RegExp(`^export\\s+interface\\s+(${IDENT})`));
  if (m) return [m[1]!];

  const alias = genericAliasName(rest);
  if (alias) return [alias];

  const firstLine = (rest.split("\n")[0] ?? "").trim();
  throw new Error(
    `type-surface pin: unrecognized export statement - extend exportedTypeNames ` +
      `to classify it (confirm whether it introduces a public type name): ${firstLine}`,
  );
}

function exportedTypeNames(src: string): string[] {
  const clean = stripComments(src);
  const names = new Set<string>();
  const startRe = /^[ \t]*export\b/gm;
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(clean))) {
    for (const name of classify(clean.slice(m.index))) names.add(name);
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
