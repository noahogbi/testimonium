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
});
