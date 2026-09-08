import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("package surface", () => {
  it("exports only the public entry and package.json", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(Object.keys(pkg.exports).sort()).toEqual([".", "./package.json"]);
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

  it("VERSION agrees with package.json - two copies of one number until plan 2 picks a source", async () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const { VERSION } = await import("../src/index.js");
    expect(VERSION).toBe(pkg.version);
  });
});
