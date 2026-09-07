import { describe, expect, it } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRules } from "../../src/rules/load.js";
import { CHALLENGE_SIGNATURES } from "../../src/rules/challenge.js";

const withFile = (contents: string): string => {
  const p = join(mkdtempSync(join(tmpdir(), "tstm-")), "rules.json");
  writeFileSync(p, contents, "utf8");
  return p;
};

describe("loadRules", () => {
  it("returns the bundled snapshot when no path is given", () => {
    expect(loadRules().signatures.length).toBe(CHALLENGE_SIGNATURES.length);
  });

  it("ADDS local signatures to the bundled ones", () => {
    const p = withFile(
      JSON.stringify({ signatures: [{ pattern: "please solve the puzzle", lastConfirmed: "2026-09-07", note: "local" }] }),
    );
    const r = loadRules(p);
    expect(r.signatures.length).toBe(CHALLENGE_SIGNATURES.length + 1);
  });

  it("cannot remove a bundled rule, even by supplying an empty list", () => {
    const r = loadRules(withFile(JSON.stringify({ signatures: [], paths: [], hosts: [] })));
    expect(r.signatures.length).toBe(CHALLENGE_SIGNATURES.length);
  });

  it("requires lastConfirmed and note on every local rule", () => {
    expect(() => loadRules(withFile(JSON.stringify({ signatures: [{ pattern: "x" }] })))).toThrow(/lastConfirmed/);
  });

  it("rejects an invalid regex rather than crashing mid-run", () => {
    const p = withFile(JSON.stringify({ signatures: [{ pattern: "([", lastConfirmed: "2026-09-07", note: "bad" }] }));
    expect(() => loadRules(p)).toThrow(/pattern/);
  });

  it("throws a readable error for a missing file", () => {
    expect(() => loadRules("/no/such/rules.json")).toThrow(/rules file/);
  });
});
