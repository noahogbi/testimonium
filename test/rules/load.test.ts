import { describe, expect, it } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRules } from "../../src/rules/load.js";
import { CHALLENGE_SIGNATURES } from "../../src/rules/challenge.js";
import { HOST_RULES } from "../../src/rules/hosts.js";

const withFile = (contents: string): string => {
  const p = join(mkdtempSync(join(tmpdir(), "tstm-")), "rules.json");
  writeFileSync(p, contents, "utf8");
  return p;
};

describe("loadRules", () => {
  it("returns the bundled snapshot when no path is given", () => {
    // Content, not just length: the bundled list is returned untouched, in
    // order - not just a same-sized list.
    const r = loadRules();
    expect(r.signatures).toEqual(CHALLENGE_SIGNATURES);
    expect(r.hosts).toEqual(HOST_RULES);
  });

  it("ADDS local signatures to the bundled ones", () => {
    const p = withFile(
      JSON.stringify({ signatures: [{ pattern: "please solve the puzzle", lastConfirmed: "2026-09-07", note: "local" }] }),
    );
    const r = loadRules(p);
    expect(r.signatures.length).toBe(CHALLENGE_SIGNATURES.length + 1);
    // Content: the bundled rules are still there, in order, untouched, and
    // the new one is appended with the fields as given, pattern compiled.
    expect(r.signatures.slice(0, CHALLENGE_SIGNATURES.length)).toEqual(CHALLENGE_SIGNATURES);
    const added = r.signatures[r.signatures.length - 1];
    expect(added?.note).toBe("local");
    expect(added?.lastConfirmed).toBe("2026-09-07");
    expect(added?.pattern.test("please solve the puzzle")).toBe(true);
  });

  it("cannot remove a bundled rule, even by supplying an empty list", () => {
    const r = loadRules(withFile(JSON.stringify({ signatures: [], paths: [], hosts: [] })));
    expect(r.signatures.length).toBe(CHALLENGE_SIGNATURES.length);
  });

  it("requires lastConfirmed and note on every local rule", () => {
    expect(() => loadRules(withFile(JSON.stringify({ signatures: [{ pattern: "x" }] })))).toThrow(/lastConfirmed/);
  });

  it("requires a note even when lastConfirmed is present", () => {
    // The prior test only ever reaches the lastConfirmed branch, since it
    // runs first in toRule() - this exercises the note branch independently.
    expect(() =>
      loadRules(withFile(JSON.stringify({ signatures: [{ pattern: "x", lastConfirmed: "2026-09-07" }] }))),
    ).toThrow(/note/);
  });

  it("rejects an invalid regex rather than crashing mid-run", () => {
    const p = withFile(JSON.stringify({ signatures: [{ pattern: "([", lastConfirmed: "2026-09-07", note: "bad" }] }));
    expect(() => loadRules(p)).toThrow(/pattern/);
  });

  it("throws a readable error for a missing file", () => {
    expect(() => loadRules("/no/such/rules.json")).toThrow(/rules file/);
  });

  it("ADDS a local host rule to the bundled ones", () => {
    // Same reasoning as signatures/paths: hostRuleFor now actually consults
    // this list (Critical 1's fix), so a local host rule has to load.
    const p = withFile(
      JSON.stringify({
        hosts: [{ host: "example.com", requiresIdentity: true, lastConfirmed: "2026-09-07", note: "local host" }],
      }),
    );
    const r = loadRules(p);
    expect(r.hosts.length).toBe(HOST_RULES.length + 1);
    expect(r.hosts.slice(0, HOST_RULES.length)).toEqual(HOST_RULES);
    expect(r.hosts[r.hosts.length - 1]).toMatchObject({ host: "example.com", requiresIdentity: true });
  });

  it("requires lastConfirmed and note on a local host rule too", () => {
    // toHostRule was only added once hosts stopped being inert - the local
    // file's own audit discipline must not be weaker for hosts than it is
    // for signatures/paths.
    expect(() =>
      loadRules(withFile(JSON.stringify({ hosts: [{ host: "example.com" }] }))),
    ).toThrow(/lastConfirmed/);
    expect(() =>
      loadRules(withFile(JSON.stringify({ hosts: [{ host: "example.com", lastConfirmed: "2026-09-07" }] }))),
    ).toThrow(/note/);
  });

  it("ships an empty boilerplate list, and a local file adds to it", () => {
    // Spec 8.2 filter 3. Bundled-empty is deliberate: a bundled rule needs a
    // lastConfirmed date from a live page, and the phrases plan 2's
    // calibration found were seen in fixtures.
    expect(loadRules().boilerplate).toEqual([]);
    const p = withFile(
      JSON.stringify({
        boilerplate: [{ pattern: "all rights reserved", lastConfirmed: "2026-09-08", note: "site footer" }],
      }),
    );
    const r = loadRules(p);
    expect(r.boilerplate.length).toBe(1);
    expect(r.boilerplate[0]!.note).toBe("site footer");
    expect(r.boilerplate[0]!.pattern.test("all rights reserved")).toBe(true);
  });

  it("holds a local boilerplate rule to the same dated discipline as every other rule", () => {
    // Fable F9: the draft proposed a bare string[] for these. A rule with no
    // date and no note is the rot the discipline exists to make visible, and
    // loadRules already refuses it for signatures, paths and hosts.
    expect(() => loadRules(withFile(JSON.stringify({ boilerplate: [{ pattern: "x" }] })))).toThrow(/lastConfirmed/);
    expect(() =>
      loadRules(withFile(JSON.stringify({ boilerplate: [{ pattern: "x", lastConfirmed: "2026-09-08" }] }))),
    ).toThrow(/note/);
  });
});
