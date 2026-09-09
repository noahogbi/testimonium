import { describe, expect, it } from "vitest";
import {
  classifyRun,
  claimsPathFor,
  draftPathFor,
  evidencePathFor,
  harvestSummaryLine,
  USAGE,
  validateFlags,
} from "../src/bin.js";

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
    // so anything with one dash is invisible to it. A user who abbreviates
    // `--json` to `-j` gets no error either way, and which failure they get
    // depends only on where they put it (both verified against the built CLI
    // on 2026-09-07):
    //
    //   check doc.md -j   ->  ignored entirely. The run proceeds, `-j` is not
    //                         in `flags` (that set is also `--`-only), so it
    //                         silently does nothing and the gate exits 0.
    //   check -j doc.md   ->  `-j` is destructured as the DOCUMENT path, so
    //                         the run dies with "cannot read -j: ENOENT" and
    //                         exit 2 - a message that names the wrong problem.
    //
    // The trailing form is the one asserted here, because it is the one that
    // fails silently rather than loudly.
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

describe("draftPathFor", () => {
  it("names <doc>.claims.draft.json beside the document, like its two siblings", () => {
    // Spec 8.2, "CLI": bin.ts gains draftPathFor beside claimsPathFor and
    // evidencePathFor. All three replace the document's extension, so the
    // three files sit together and a versioned prose directory stays
    // readable.
    expect(draftPathFor("essay.md").endsWith("essay.claims.draft.json")).toBe(true);
    expect(claimsPathFor("essay.md").endsWith("essay.claims.json")).toBe(true);
    expect(evidencePathFor("essay.md").endsWith("essay.evidence.json")).toBe(true);
    // The draft is NOT the claims file, and the names must not collide.
    expect(draftPathFor("essay.md")).not.toBe(claimsPathFor("essay.md"));
  });

  it("keeps the document's directory", () => {
    expect(draftPathFor("docs/drafts/essay.markdown")).toContain("drafts");
    expect(draftPathFor("docs/drafts/essay.markdown").endsWith("essay.claims.draft.json")).toBe(true);
  });
});

describe("the usage string", () => {
  it("names all three commands", () => {
    // A command the usage line does not name is a command nobody finds.
    for (const command of ["check", "harvest", "reachability"]) {
      expect(USAGE, command).toContain(command);
    }
  });
});

describe("validateFlags and harvest", () => {
  it("accepts a harvest run with the global flags", () => {
    expect(validateFlags(["harvest", "doc.md", "--json", "--rules", "local.json"])).toBeNull();
  });

  it("CHARACTERIZATION: the command-agnostic gap now covers a third command", () => {
    // `harvest doc.md --fail-on-unreachable` is accepted and ignored, exactly
    // as `reachability doc.md --fail-on-unreachable` is. Per-command flag
    // tables stay parked - they would change check and reachability too, and
    // spec 8.2 licenses no such change - and this test is what makes closing
    // the gap later a deliberate edit to a red test.
    expect(validateFlags(["harvest", "doc.md", "--fail-on-unreachable"])).toBeNull();
    expect(validateFlags(["harvest", "doc.md", "--explain-fetch"])).toBeNull();
  });
});

describe("harvestSummaryLine", () => {
  it("is singular at exactly one proposal, plural everywhere else", () => {
    // Fix round 1: the shipped line read "1 proposals", ungrammatical at the
    // one count where an author is most likely to be reading closely - her
    // first successful harvest of a single-source document.
    expect(harvestSummaryLine("essay.claims.draft.json", 1, 1)).toContain("1 proposal across");
    expect(harvestSummaryLine("essay.claims.draft.json", 1, 1)).not.toContain("1 proposals");
    expect(harvestSummaryLine("essay.claims.draft.json", 0, 3)).toContain("0 proposals across");
    expect(harvestSummaryLine("essay.claims.draft.json", 5, 3)).toContain("5 proposals across");
  });

  it("names the URL count 'readable', because it is not the draft's key count", () => {
    // report.proposals.length counts every READABLE source, whether or not
    // it proposed anything; buildDraft omits a zero-claim entry, so a run
    // that read 3 URLs and proposed from only 1 writes a draft with ONE key.
    // "3 URLs" alone would read as a claim about the file just written, and
    // it would be wrong.
    const line = harvestSummaryLine("essay.claims.draft.json", 1, 3);
    expect(line).toContain("across 3 readable URLs");
    // "readable" is the word doing the work above; without it "3 URLs" would
    // misdescribe the one-key draft this run just wrote.
    expect(line).not.toContain("across 3 URLs");
  });
});
