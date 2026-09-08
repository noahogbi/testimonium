import { describe, expect, it } from "vitest";
import { classifyRun, validateFlags } from "../src/bin.js";

describe("exit codes", () => {
  it("exits 0 when everything is supported", () => {
    expect(classifyRun({ unsupported: 0, unclaimed: 0, unreachable: 0, orphaned: 0, infrastructure: false }, {})).toBe(0);
  });

  it("exits 1 on an unsupported citation - an author-fixable defect", () => {
    expect(classifyRun({ unsupported: 1, unclaimed: 0, unreachable: 0, orphaned: 0, infrastructure: false }, {})).toBe(1);
  });

  it("exits 1 on an unclaimed citation, because a gate that checks nothing must not pass", () => {
    expect(classifyRun({ unsupported: 0, unclaimed: 1, unreachable: 0, orphaned: 0, infrastructure: false }, {})).toBe(1);
  });

  it("exits 0 on unreachable by default", () => {
    expect(classifyRun({ unsupported: 0, unclaimed: 0, unreachable: 3, orphaned: 0, infrastructure: false }, {})).toBe(0);
  });

  it("exits 1 on unreachable when the caller opted in", () => {
    expect(
      classifyRun({ unsupported: 0, unclaimed: 0, unreachable: 1, orphaned: 0, infrastructure: false }, { unreachable: true }),
    ).toBe(1);
  });

  it("exits 0 on an orphaned claim by default - a warning, not a failure", () => {
    expect(classifyRun({ unsupported: 0, unclaimed: 0, unreachable: 0, orphaned: 2, infrastructure: false }, {})).toBe(0);
  });

  it("exits 2 on infrastructure failure, never 1", () => {
    expect(classifyRun({ unsupported: 5, unclaimed: 0, unreachable: 0, orphaned: 0, infrastructure: true }, {})).toBe(2);
  });
});

describe("validateFlags", () => {
  it("accepts a run with no flags at all", () => {
    expect(validateFlags(["check", "doc.md"])).toBeNull();
  });

  it("accepts every documented flag together", () => {
    expect(
      validateFlags([
        "check",
        "doc.md",
        "--json",
        "--rules",
        "local.json",
        "--fail-on-unreachable",
        "--allow-unclaimed",
        "--explain-fetch",
      ]),
    ).toBeNull();
  });

  it("rejects a typo'd flag by name - the invisible-CI-hardening case", () => {
    // node dist/bin.js check doc.md --fail-on-unrechable exits 0 silently
    // today: a user who believes they hardened CI has not.
    expect(validateFlags(["check", "doc.md", "--fail-on-unrechable"])).toBe("--fail-on-unrechable");
  });

  it("rejects any other unrecognized flag", () => {
    expect(validateFlags(["reachability", "doc.md", "--bogus"])).toBe("--bogus");
  });

  it("CHARACTERIZATION: a single-dash flag is not validated at all - `-j` passes as a positional", () => {
    // The limit named plainly: validateFlags inspects only `--`-prefixed args,
    // so anything with one dash is invisible to it and falls through to be
    // read as a positional command or document argument. `-j` is the obvious
    // hazard - a user who abbreviates `--json` gets no error, and `main()`
    // then reads "-j" as the document path and exits 2 with a file-read
    // message that names the wrong problem.
    //
    // NOT desired behaviour and NOT to be "fixed" here. The flag tables this
    // would need (which flags each command accepts, short forms included) are
    // parked for plan 2 alongside the other validateFlags gap - `reachability
    // doc.md --fail-on-unreachable` is accepted and ignored. This test exists
    // so the limit is written down where the behaviour lives, and so closing
    // it later is a deliberate edit to a red test rather than a silent
    // widening. It replaces a case that was byte-for-byte identical to
    // "accepts a run with no flags at all" above and discriminated nothing.
    expect(validateFlags(["check", "doc.md", "-j"])).toBeNull();
    expect(validateFlags(["check", "doc.md", "-fail-on-unreachable"])).toBeNull();
  });
});
