import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("package surface", () => {
  it("exports only the public entry and package.json", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(Object.keys(pkg.exports).sort()).toEqual([".", "./package.json"]);
  });

  it("resolves types before default, and carries a legacy types field", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const root = pkg.exports["."];
    expect(Object.keys(root)).toEqual(["types", "default"]); // order is significant
    expect(pkg.types).toBe("./dist/index.d.ts");
  });

  it("does not expose internals as subpath exports", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const paths = Object.keys(pkg.exports);
    expect(paths.some((p) => p.includes("fetch") || p.includes("text"))).toBe(false);
  });

  it("declares no runtime dependencies", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  it("does not export the reader - raw reads are not a public surface (spec 5.3)", async () => {
    const api = Object.keys(await import("../src/index.js"));
    for (const name of ["readSource", "bestReadable", "isReadable", "isBlocked", "computeSignals", "nextAction"]) {
      expect(api, name).not.toContain(name);
    }
  });

  it("pins the exact set of named runtime exports, not just six names that must be absent", async () => {
    // The test above (spec 5.3) only proves six named internals are absent;
    // it says nothing about what IS present, so a name added to
    // src/index.ts by accident - or a name quietly dropped - passes it
    // either way. Task 9 touches this file to add VERSION's re-export, which
    // is the moment to close that gap: an allowlist pin turns any change to
    // the public runtime surface into a deliberate edit to a red test,
    // rather than a silent one. Type-only exports (CheckOptions,
    // ReachabilityResult, ReachabilityOptions, CitationResult, FiredRule,
    // RuleSet, Verdict, Fetcher, RawResponse, RungId, FetcherOptions,
    // ClaimProblem, RunTally, FailOn) are erased at compile time and never
    // appear in Object.keys, so they are not - and cannot be - part of this
    // list.
    const api = await import("../src/index.js");
    expect(Object.keys(api).sort()).toEqual([
      "THRESHOLDS",
      "VERSION",
      "check",
      "classifyRun",
      "defaultFetcher",
      "joinClaims",
      "loadRules",
      "norm",
      "normalizeUrl",
      "parseClaimsFile",
      "parseGfmFootnotes",
      "reachability",
      "toText",
      "validateClaims",
    ]);
  });

  it("THRESHOLDS is frozen - `as const` is compile-time only and does not stop a runtime assignment (fix round 1, Important 1)", async () => {
    const { THRESHOLDS } = await import("../src/index.js");
    expect(Object.isFrozen(THRESHOLDS)).toBe(true);
  });

  it("a mutation attempt on THRESHOLDS throws and leaves the value unchanged - the keystone boundary cannot move from outside the package", async () => {
    const { THRESHOLDS } = await import("../src/index.js");
    const before = THRESHOLDS.minProseChars;
    expect(() => {
      // @ts-expect-error - deliberately violating the readonly type to prove the runtime freeze, not just the compile-time type, holds.
      THRESHOLDS.minProseChars = 0;
    }).toThrow(TypeError);
    expect(THRESHOLDS.minProseChars).toBe(before);
  });

  it("VERSION agrees with package.json - src/version.ts is the source, this test is the join", async () => {
    // Plan 2 picked the source (Fable F13): src/version.ts. package.json's
    // own `version` is npm's and cannot be removed, so the two files stay
    // two files and this test is what keeps them equal. `harvest` stamps
    // VERSION into every draft it writes.
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const { VERSION } = await import("../src/index.js");
    expect(VERSION).toBe(pkg.version);
  });

  it("VERSION is typed string, not a literal - or every release is type-breaking", async () => {
    const { VERSION } = await import("../src/index.js");
    // Comparing to a LITERAL is the probe. Against `VERSION: "0.3.0"` this line
    // is TS2367 and `tsc --noEmit` fails; against `VERSION: string` it compiles.
    expect(VERSION === "0.99.0").toBe(false);
    expect(typeof VERSION).toBe("string");
  });
});
