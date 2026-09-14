import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { sha256Hex } from "../src/archive/format.js";
import type { CitationOutcome } from "../src/archive/compare.js";
import type { FetcherOptions } from "../src/fetch/default-fetcher.js";
import type { Fetcher } from "../src/fetch/types.js";
import type { HostRule } from "../src/rules/hosts.js";
import type { RuleSet } from "../src/rules/load.js";
import type { ReachabilityResult, ReachabilityOptions } from "../src/reachability.js";
import type { HarvestReport, HarvestOptions } from "../src/harvest.js";
import type { CitationResult } from "../src/io/evidence.js";
import type { CheckOptions } from "../src/check.js";
import type { Document } from "../src/adapters/types.js";
import type { Joined } from "../src/io/claims.js";
import {
  archiveContextFor,
  archivePathFor,
  archiveUnreadableNotice,
  classifyRecheckRun,
  claimsPathFor,
  draftPathFor,
  evidencePathFor,
  failOnFor,
  harvestSummaryLine,
  jsonOutcome,
  main,
  renderOutcome,
  tallyFor,
  USAGE,
  validateFlags,
} from "../src/bin.js";
import { classifyRun } from "../src/run/classify.js";

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
    // would need (which flags each command accepts, short forms included) were
    // parked for plan 2 alongside the other validateFlags gap - `reachability
    // doc.md --fail-on-unreachable` is accepted and ignored. Plan 2 did not
    // close either: it re-parked them and added a third command to the same
    // gap, characterized below in "the command-agnostic gap now covers a third
    // command". Plan 3 re-parked them a second time and added a FOURTH command
    // plus two more command-scoped flags (`--no-archive` on check,
    // `--fail-on-gone` on recheck), so the gap now spans check, harvest,
    // recheck and reachability. Closing them would change all four, and
    // neither spec 8.2 nor 8.3 licenses such a change. This test exists
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
    // readable. Plan 3 added a fourth helper on the same rule,
    // `archivePathFor` (`<doc>.archive/`) - a directory rather than a file,
    // which is why this block still asserts over three.
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
  it("names all four commands", () => {
    // A command the usage line does not name is a command nobody finds.
    for (const command of ["check", "harvest", "recheck", "reachability"]) {
      expect(USAGE, command).toContain(command);
    }
  });

  it("names --identity, and both --help and -h as escape hatches (fix round 1, Minor 7)", () => {
    // -h works exactly as --help does (see the main() describe block below)
    // but was missing from USAGE until this fix - a usage string is where an
    // author would look to learn the short form exists at all.
    expect(USAGE).toContain("--identity");
    expect(USAGE).toContain("--help");
    expect(USAGE).toContain("-h");
  });
});

describe("validateFlags and identity", () => {
  it("accepts --identity <value> on every command", () => {
    // Task 16: identity is global, like --rules and --json - not
    // command-scoped like --fail-on-unreachable or --fail-on-gone.
    for (const command of ["check", "harvest", "recheck", "reachability"]) {
      expect(validateFlags([command, "doc.md", "--identity", "example-app contact@example.com"])).toBeNull();
    }
  });

  it("accepts --help without a value, alongside every other known flag", () => {
    expect(validateFlags(["check", "doc.md", "--help"])).toBeNull();
  });
});

describe("validateFlags and harvest", () => {
  it("accepts a harvest run with the global flags", () => {
    expect(validateFlags(["harvest", "doc.md", "--json", "--rules", "local.json"])).toBeNull();
  });

  it("CHARACTERIZATION: the command-agnostic gap now covers a fourth command", () => {
    // `harvest doc.md --fail-on-unreachable` is accepted and ignored, exactly
    // as `reachability doc.md --fail-on-unreachable` is. Per-command flag
    // tables stay parked - they would change check, recheck and reachability
    // too, and neither spec 8.2 nor 8.3 licenses such a change - and this test
    // is what makes closing the gap later a deliberate edit to a red test. Its
    // plan-3 twins are the two --no-archive / --fail-on-gone CHARACTERIZATION
    // cases below; this case and those two are one parked gap and move
    // together.
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

describe("archivePathFor", () => {
  it("puts <doc>.archive beside the evidence file", () => {
    expect(archivePathFor("essay.md")).toBe(evidencePathFor("essay.md").replace(".evidence.json", ".archive"));
  });

  it("keeps the document's directory and strips its extension, as the other path helpers do", () => {
    expect(archivePathFor("docs/drafts/essay.markdown")).toContain("drafts");
    expect(archivePathFor("docs/drafts/essay.markdown").endsWith("essay.archive")).toBe(true);
  });
});

describe("archiveContextFor", () => {
  const RULE: HostRule = { host: "sec.gov", requiresIdentity: true, lastConfirmed: "2026-09-01", note: "a local host rule" };
  const rules = (hosts: readonly HostRule[] = []): RuleSet => ({ signatures: [], paths: [], boilerplate: [], hosts });
  const fetcher = (rungs: string[]): Fetcher => ({
    rungs,
    async fetch() {
      throw new Error("archiveContextFor must not fetch");
    },
  });

  it("passes the loaded host rules into the fetcher it builds", () => {
    // A CLI that builds its own fetcher and omits `{ hosts }` gives the author
    // a --rules file that loads, validates and is never consulted. The
    // mutation this catches: `make({})`.
    let seen: FetcherOptions | undefined;
    const ctx = archiveContextFor(rules([RULE]), undefined, undefined, {
      make: (o) => { seen = o; return fetcher(["node"]); },
      version: () => null,
    });
    expect(ctx).not.toBeNull();
    // NEGATIVE CONTROL: without this, a factory that was never called would
    // leave `seen` undefined and the assertion below would be vacuous.
    expect(seen).toBeDefined();
    expect(seen?.hosts).toEqual([RULE]);
  });

  it("passes a declared --identity into the fetcher it builds, and omits the key when absent (Task 16)", () => {
    // Twin of the host-rules test above, for the same reason: `check`'s
    // command hands THIS function's fetcher to `check()` whenever archiving
    // is on (the default), and `recheck`'s command always does - so an
    // `identity` that stops here never reaches a citation at all on either
    // command, regardless of what `check()`/`recheck()`'s own options carry.
    let seen: FetcherOptions | undefined;
    const withId = archiveContextFor(rules(), undefined, "example-app contact@example.com", {
      make: (o) => { seen = o; return fetcher(["node"]); },
      version: () => null,
    });
    expect(withId).not.toBeNull();
    expect(seen).toBeDefined();
    expect(seen?.identity).toBe("example-app contact@example.com");

    seen = undefined;
    archiveContextFor(rules(), undefined, undefined, {
      make: (o) => { seen = o; return fetcher(["node"]); },
      version: () => null,
    });
    expect(seen).toBeDefined();
    expect(seen).not.toHaveProperty("identity");
  });

  it("probes the pdftotext version only when the fetcher advertises that rung", () => {
    let probes = 0;
    const withRung = archiveContextFor(rules(), undefined, undefined, {
      make: () => fetcher(["node", "curl", "pdftotext"]),
      version: () => { probes++; return "pdftotext version 4.00"; },
    });
    expect(withRung?.pdftotextVersion).toBe("pdftotext version 4.00");
    expect(probes).toBe(1);
  });

  it("does not spawn a probe on a machine whose ladder has no pdftotext rung", () => {
    let probes = 0;
    const withoutRung = archiveContextFor(rules(), undefined, undefined, {
      make: () => fetcher(["node"]),
      version: () => { probes++; return "should not be reached"; },
    });
    expect(withoutRung?.pdftotextVersion).toBeNull();
    expect(probes).toBe(0);
  });

  it("hashes the --rules file's bytes when one was passed", () => {
    const f = join(mkdtempSync(join(tmpdir(), "testimonium-rules-")), "local.json");
    writeFileSync(f, '{"signatures":[]}', "utf8");
    const ctx = archiveContextFor(rules(), f, undefined, { make: () => fetcher(["node"]), version: () => null });
    expect(ctx?.localRulesHash).toBe(sha256Hex(readFileSync(f)));
    rmSync(dirname(f), { recursive: true, force: true });
  });

  it("records null, not a hash, when no --rules file was passed", () => {
    const ctx = archiveContextFor(rules(), undefined, undefined, { make: () => fetcher(["node"]), version: () => null });
    expect(ctx?.localRulesHash).toBeNull();
  });

  it("declines to archive at all rather than record a wrong localRulesHash", () => {
    // An entry recording `null` when a --rules file WAS passed would be a
    // baseline that mis-reports the local-rules confound forever. Archiving
    // must never fail a run, so the answer is to skip archiving, not to throw
    // and not to guess.
    const ctx = archiveContextFor(rules(), "no/such/rules.json", undefined, { make: () => fetcher(["node"]), version: () => null });
    expect(ctx).toBeNull();
  });
});

describe("validateFlags and the archive flag", () => {
  it("accepts --no-archive", () => {
    expect(validateFlags(["check", "doc.md", "--no-archive"])).toBeNull();
  });

  it("names --no-archive in the usage string", () => {
    // A flag the usage line does not name is a flag nobody finds - and
    // validateFlags exits 2 on any --flag KNOWN_FLAGS does not carry, so the
    // two must move together.
    expect(USAGE).toContain("--no-archive");
  });

  it("CHARACTERIZATION: --no-archive is accepted and ignored on the other commands too", () => {
    // The command-agnostic gap, parked since plan 2 (ruling T9-R1 and the
    // per-command flag tables item): closing it would change every command and
    // no spec section licenses that. This test is what makes closing it later a
    // deliberate edit to a red test, and it now covers a fourth instance.
    expect(validateFlags(["harvest", "doc.md", "--no-archive"])).toBeNull();
    expect(validateFlags(["reachability", "doc.md", "--no-archive"])).toBeNull();
  });
});

describe("recheck exit codes", () => {
  it("exits 0 when nothing drifted", () => {
    expect(classifyRecheckRun({ sourceDrift: 0, pipelineDrift: 0, gone: 0 }, {})).toBe(0);
  });

  it("exits 1 on source drift - the author verifies the page and updates or removes the claim", () => {
    expect(classifyRecheckRun({ sourceDrift: 1, pipelineDrift: 0, gone: 0 }, {})).toBe(1);
  });

  it("exits 2 on pipeline drift - a regression in this tool, not a defect in the document", () => {
    expect(classifyRecheckRun({ sourceDrift: 0, pipelineDrift: 3, gone: 0 }, {})).toBe(2);
  });

  it("1 DOMINATES 2 for recheck, deliberately unlike classifyRun", () => {
    // Under `check`, a 2 means the tool could not do its job and the run is
    // void, so classifyRun tests infrastructure first and 2 wins outright.
    // Under `recheck` both signals are real results about different citations,
    // and letting our own regression mask genuine source drift at the exit code
    // would be this tool's defect suppressing the author's news. The two
    // policies are asserted side by side so the difference is deliberate rather
    // than accidental.
    expect(classifyRecheckRun({ sourceDrift: 1, pipelineDrift: 1, gone: 0 }, {})).toBe(1);
    expect(classifyRun({ unsupported: 1, unclaimed: 0, unreachable: 0, orphaned: 0, infrastructure: true }, {})).toBe(2);
  });

  it("exits 0 on a gone source by default", () => {
    // Failing by default would accuse over a transiently misconfigured 404,
    // which is the same false accusation in a new costume.
    expect(classifyRecheckRun({ sourceDrift: 0, pipelineDrift: 0, gone: 2 }, {})).toBe(0);
  });

  it("exits 1 on a gone source when the author opted in, mirroring --fail-on-unreachable", () => {
    // A genuinely dead link is the author's to fix, which is why the opt-in
    // exists at all and why it contributes 1 rather than 2.
    expect(classifyRecheckRun({ sourceDrift: 0, pipelineDrift: 0, gone: 1 }, { failOnGone: true })).toBe(1);
  });

  it("a gone source the author opted into still dominates pipeline drift", () => {
    expect(classifyRecheckRun({ sourceDrift: 0, pipelineDrift: 5, gone: 1 }, { failOnGone: true })).toBe(1);
  });
});

// A minimal-but-real CitationResult per verdict, matching the field set
// test/bin.test.ts's own mocked check() above already uses for "unreachable"
// - not a cast, so a required field this suite forgets fails to compile
// rather than passing silently.
function citationResult(verdict: CitationResult["verdict"]): CitationResult {
  return {
    url: "https://example.com/x",
    verdict,
    rungsAttempted: [],
    rungsAvailable: [],
    ladderTruncated: false,
  };
}

// A minimal-but-real Joined, matching src/io/claims.ts's own interface - not
// the `as unknown as Joined` cast an earlier draft of this plan used, which
// would have let a shape drift in `Joined` go unnoticed here.
function joined(overrides: Partial<Joined> = {}): Joined {
  return { checkable: [], notApplicable: [], unclaimed: [], orphanedClaims: [], ...overrides };
}

describe("tallyFor (Task 4)", () => {
  it("sources unclaimed and orphaned from joined, not from verdict rows", () => {
    // Unclaimed footnotes never reach check(): joinClaims routes them to
    // joined.unclaimed instead, so no result here ever carries an
    // "unclaimed" verdict - and orphanedClaims has no footnote row at all,
    // ever. Both fields must come from `joined`; `results` below carries
    // neither category, so a wrong extraction that counted them out of
    // `results` would report 0 for both instead of matching `joined`.
    //
    // Three "supported" rows against one "unreachable" row, deliberately
    // asymmetric: a mutation that counts "supported" into `unreachable`
    // instead of "unreachable" would report 3, not the expected 1, rather
    // than coincidentally matching it the way an equal-count fixture would.
    const results = [
      citationResult("supported"),
      citationResult("supported"),
      citationResult("supported"),
      citationResult("unreachable"),
    ];
    const j = joined({
      unclaimed: [
        { n: 1, url: "https://example.com/a", label: "a" },
        { n: 2, url: "https://example.com/b", label: "b" },
      ],
      orphanedClaims: ["https://example.com/c"],
    });
    expect(tallyFor(results, j)).toEqual({
      unsupported: 0,
      unclaimed: 2,
      unreachable: 1,
      orphaned: 1,
      infrastructure: false,
    });
  });

  it("counts unsupported and unreachable from results, not from joined", () => {
    // Every verdict present in a DIFFERENT count (4 supported, 2 unsupported,
    // 1 unreachable), so a mutation that counts the WRONG verdict into a
    // field lands on a number that matches no expected value, rather than
    // passing by coincidence. This suite's first draft used 1 supported, 2
    // unsupported, 1 unreachable - and a mutation that counted "supported"
    // into `unreachable` (instead of "unreachable" itself) still produced 1,
    // the correct answer, purely because count-of-supported equalled
    // count-of-unreachable in that fixture. Proven live in the task report
    // (mutation 2): the suite stayed green.
    const results = [
      citationResult("supported"),
      citationResult("supported"),
      citationResult("supported"),
      citationResult("supported"),
      citationResult("unsupported"),
      citationResult("unsupported"),
      citationResult("unreachable"),
    ];
    expect(tallyFor(results, joined())).toEqual({
      unsupported: 2,
      unclaimed: 0,
      unreachable: 1,
      orphaned: 0,
      infrastructure: false,
    });
  });

  it("infrastructure is always false: main()'s check command only reaches this call on its success path", () => {
    expect(tallyFor([], joined()).infrastructure).toBe(false);
  });
});

describe("failOnFor (Task 4)", () => {
  it("maps each argv flag to its FailOn field", () => {
    // Opposite default polarities, deliberately (src/run/classify.ts's own
    // doc comment): unclaimed fails unless the author opts OUT with
    // --allow-unclaimed; unreachable does not fail unless the author opts
    // IN with --fail-on-unreachable.
    expect(failOnFor(new Set())).toEqual({ unreachable: false, unclaimed: true });
    expect(failOnFor(new Set(["--fail-on-unreachable"]))).toEqual({ unreachable: true, unclaimed: true });
    expect(failOnFor(new Set(["--allow-unclaimed"]))).toEqual({ unreachable: false, unclaimed: false });
    expect(failOnFor(new Set(["--fail-on-unreachable", "--allow-unclaimed"]))).toEqual({
      unreachable: true,
      unclaimed: false,
    });
  });

  it("CHARACTERIZATION: never sets orphanedClaims - check has no flag that fails a run on an orphaned claim", () => {
    // Recorded, not changed here: wiring this would be a behaviour change
    // and is out of this task's scope. `toEqual` above already pins this
    // (an extra `orphanedClaims` key would fail those assertions too), and
    // this test exists so that pin has its own name and reason on record.
    expect(failOnFor(new Set(["--fail-on-unreachable", "--allow-unclaimed"]))).not.toHaveProperty(
      "orphanedClaims",
    );
  });
});

describe("classifyRun via tallyFor/failOnFor's fields - one field isolated per row (Task 4)", () => {
  // Each row leaves every OTHER field at 0 so the flag under test is the
  // only thing that can move the outcome. A table with unclaimed:1 on every
  // row would mask this: classifyRun's unclaimed clause defaults to failing
  // (`failOn.unclaimed !== false`) and dominates regardless of the flag
  // actually under test - measured directly against classifyRun, an earlier
  // draft of this suite used exactly that masked table and both
  // --fail-on-unreachable true and false returned 1.
  const ZERO = { unsupported: 0, unclaimed: 0, unreachable: 0, orphaned: 0, infrastructure: false };

  it.each([
    ["unreachable", { ...ZERO, unreachable: 1 }, { unreachable: true }, { unreachable: false }],
    ["unclaimed", { ...ZERO, unclaimed: 1 }, {}, { unclaimed: false }],
    ["orphanedClaims", { ...ZERO, orphaned: 1 }, { orphanedClaims: true }, {}],
  ] as const)("%s reaches the exit code, and only when its flag says so", (_name, tally, on, off) => {
    expect(classifyRun(tally, on)).toBe(1);
    expect(classifyRun(tally, off)).toBe(0);
  });

  it("failOnFor's default output reproduces the unreachable and unclaimed rows above", () => {
    // Ties failOnFor's actual return value to the isolated-row table, so a
    // flag that stops being wired in failOnFor is caught here too, not only
    // by the standalone failOnFor tests above.
    expect(classifyRun({ ...ZERO, unreachable: 1 }, failOnFor(new Set(["--fail-on-unreachable"])))).toBe(1);
    expect(classifyRun({ ...ZERO, unreachable: 1 }, failOnFor(new Set()))).toBe(0);
    expect(classifyRun({ ...ZERO, unclaimed: 1 }, failOnFor(new Set()))).toBe(1);
    expect(classifyRun({ ...ZERO, unclaimed: 1 }, failOnFor(new Set(["--allow-unclaimed"])))).toBe(0);
  });
});

describe("validateFlags and the recheck flag", () => {
  it("accepts --fail-on-gone and names it in the usage string", () => {
    expect(validateFlags(["recheck", "doc.md", "--fail-on-gone"])).toBeNull();
    expect(USAGE).toContain("--fail-on-gone");
  });

  it("CHARACTERIZATION: --fail-on-gone is accepted and ignored on the other commands too", () => {
    // The command-agnostic gap, still parked. Fifth instance.
    expect(validateFlags(["check", "doc.md", "--fail-on-gone"])).toBeNull();
    expect(validateFlags(["harvest", "doc.md", "--fail-on-gone"])).toBeNull();
  });
});

// A full CitationOutcome fixture, so each test below overrides only what it
// means to vary. `missed` defaults NON-EMPTY on purpose: the gate under test
// is which categories are ALLOWED to print it, so every fixture must give
// them something to wrongly print if the gate fails.
function outcome(overrides: Partial<CitationOutcome> & { category: CitationOutcome["category"] }): CitationOutcome {
  return {
    url: "http://example.com/report",
    key: "example.com/report",
    live: "unsupported",
    archived: null,
    recorded: null,
    archivedAt: "2020-01-01T00:00:00.000Z",
    confounds: [],
    liveGone: false,
    bundledVersionChanged: false,
    archivedToolVersion: null,
    missed: ["spending rose sharply"],
    ...overrides,
  };
}

describe("renderOutcome and the accusation gate", () => {
  // THE THING THIS GATE EXISTS TO PREVENT: `missed` is present on every
  // CitationOutcome (see RecheckReport.outcomes's doc comment), and only
  // `category === "sourceDrift"` may render it as a MISS: line. A gate
  // written as `if (o.missed.length > 0)` would FAIL 3 of the 4 tests below:
  // every fixture here is built WITH a non-empty `missed`, so that broken
  // gate would wrongly print MISS on pipelineDrift, noBaseline and clean, and
  // only the sourceDrift case would still pass. The non-empty fixtures are
  // precisely what catch it.
  it("prints MISS only on sourceDrift", () => {
    const lines = renderOutcome(outcome({ category: "sourceDrift", archived: "supported" }), 1).join("\n");
    expect(lines).toContain('MISS: "spending rose sharply"');
    expect(lines).toContain("SOURCE DRIFT");
  });

  it("never prints MISS on pipelineDrift, even though missed is non-empty", () => {
    const lines = renderOutcome(outcome({ category: "pipelineDrift", live: "supported", archived: "unsupported" }), 1).join(
      "\n",
    );
    expect(lines).not.toContain("MISS:");
    expect(lines).not.toContain("SOURCE DRIFT");
  });

  it("never prints MISS on noBaseline, even though missed is non-empty", () => {
    const lines = renderOutcome(outcome({ category: "noBaseline" }), 1).join("\n");
    expect(lines).not.toContain("MISS:");
    expect(lines).not.toContain("SOURCE DRIFT");
  });

  it("never prints MISS on clean, even though missed is non-empty", () => {
    // clean is the row a `live !== archived`-shaped mistake or a bare
    // `missed.length > 0` gate would reach too - the row furthest from an
    // accusation, and the one where printing MISS would be most misleading.
    const lines = renderOutcome(outcome({ category: "clean", live: "supported", archived: "supported" }), 1).join("\n");
    expect(lines).not.toContain("MISS:");
    expect(lines).not.toContain("SOURCE DRIFT");
  });
});

describe("jsonOutcome and the --json accusation gate", () => {
  // THE MEASURED BUG: `recheck --json` used to emit `report.outcomes`
  // unfiltered, so a `confounded` citation printed "not compared" to the
  // terminal while the JSON payload still carried its live arm's full
  // `missed` list. `jsonOutcome` is the fix, gated categorically on
  // `category === "sourceDrift"` exactly as `renderOutcome` is above.
  it("keeps missed on sourceDrift", () => {
    const o = outcome({ category: "sourceDrift", archived: "supported" });
    expect(jsonOutcome(o).missed).toEqual(o.missed);
  });

  it("empties missed on confounded, even though missed is non-empty - the measured leak", () => {
    const o = outcome({ category: "confounded", confounds: ["the claims for this URL changed"] });
    expect(jsonOutcome(o).missed).toEqual([]);
  });

  it("empties missed on every other category, even though missed is non-empty", () => {
    const others: CitationOutcome["category"][] = [
      "clean",
      "pipelineDrift",
      "gone",
      "unreachable",
      "noBaseline",
      "unclaimed",
    ];
    for (const category of others) {
      expect(jsonOutcome(outcome({ category })).missed, category).toEqual([]);
    }
  });

  it("changes nothing else about the outcome", () => {
    const o = outcome({ category: "gone", archivedAt: "2021-06-01T00:00:00.000Z" });
    expect(jsonOutcome(o)).toEqual({ ...o, missed: [] });
  });
});

describe("archiveUnreadableNotice", () => {
  it("is silent when the archive read cleanly", () => {
    expect(archiveUnreadableNotice(null)).toEqual([]);
  });

  it("names the reason and distinguishes archive corruption from check never having run", () => {
    const lines = archiveUnreadableNotice("doc.archive/index.json is not valid JSON").join("\n");
    expect(lines).toContain("doc.archive/index.json is not valid JSON");
    expect(lines).toContain("not because check was never run");
  });
});

describe("main(): --help and -h (Ruling T11-R1)", () => {
  // THE MEASURED BUG, pinned by exit code rather than by printed text: before
  // this task, `node dist/bin.js --help` printed "unknown flag --help" and
  // exited 2 - the most-typed flag on a published CLI erroring on first
  // contact. A usage string printed with exit 2 looks IDENTICAL to one
  // printed with exit 0 in a terminal, so a test that only checked what was
  // printed would still pass on the broken behaviour; `0` versus `2` is the
  // whole point, so every case here asserts the numeric return value.
  //
  // Neither branch touches the filesystem or the network - it returns before
  // argv is even destructured into a command and a document - which is what
  // makes driving the exported main() directly (rather than spawning
  // dist/bin.js, which the rest of this CLI's tests deliberately avoid; see
  // test/library-parity.test.ts's docstring) both safe and hermetic here.
  it("--help prints the usage string and exits 0", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const code = await main(["--help"]);
      expect(code).toBe(0);
      expect(log).toHaveBeenCalledWith(USAGE);
      expect(err).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      err.mockRestore();
    }
  });

  it("-h prints the usage string and exits 0, exactly as --help does", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const code = await main(["-h"]);
      expect(code).toBe(0);
      expect(log).toHaveBeenCalledWith(USAGE);
    } finally {
      log.mockRestore();
    }
  });

  it("--help anywhere in argv still wins, ahead of validateFlags and the command dispatch", () => {
    return (async () => {
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        // Neither "check" nor "no/such/doc.md" is ever reached: if they were,
        // this would try to read a file that does not exist and reject
        // instead of resolving, which is itself evidence the short-circuit
        // failed to fire before the document read.
        const code = await main(["check", "no/such/doc.md", "--help"]);
        expect(code).toBe(0);
        expect(log).toHaveBeenCalledWith(USAGE);
      } finally {
        log.mockRestore();
      }
    })();
  });

  it("--help wins over an actual unknown flag too, not just over the command dispatch", async () => {
    // The comment above main() names this exact case by name: "check doc.md
    // --bogus --help must still print help rather than 'unknown flag
    // --bogus'". Every test above puts --help alongside a KNOWN flag or none
    // at all; none of them drives an argv validateFlags would actually
    // reject, so none of them can tell "--help is checked first" apart from
    // "there was never anything for validateFlags to reject in the first
    // place". --bogus is not in KNOWN_FLAGS, so this is the one input where
    // the ordering claim and its absence produce different exit codes.
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const code = await main(["check", "doc.md", "--bogus", "--help"]);
      expect(code).toBe(0);
      expect(log).toHaveBeenCalledWith(USAGE);
      expect(err).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      err.mockRestore();
    }
  });

  it("CHARACTERIZATION: bare invocation (no arguments) still exits 2, unlike --help - it is a usage ERROR, not a request for help", async () => {
    // Distinguishes the fix from "any time USAGE is printed, exit 0": a run
    // missing its required <command> <doc.md> is still author-fixable-by-
    // reading-the-usage-string, but it is not what the user ASKED for, so it
    // keeps failing the naive `set -e` gate exactly as before this task.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const code = await main([]);
      expect(code).toBe(2);
      expect(err).toHaveBeenCalledWith(USAGE);
    } finally {
      err.mockRestore();
    }
  });
});

describe("main(): --identity value parsing", () => {
  const withDoc = (fn: (doc: string) => Promise<void> | void) => async () => {
    const dir = mkdtempSync(join(tmpdir(), "testimonium-identity-"));
    const doc = join(dir, "essay.md");
    // No footnotes: this test only needs main() to reach the --identity
    // parsing block, which runs after the document is read and before any
    // command dispatches, fetches, or writes.
    writeFileSync(doc, "No citations here.\n", "utf8");
    try {
      await fn(doc);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it(
    "refuses a trailing --identity with no value, the same silent-no-op guard --rules has",
    withDoc(async (doc) => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const code = await main(["reachability", doc, "--identity"]);
        expect(code).toBe(2);
        expect(err).toHaveBeenCalledWith(expect.stringContaining("--identity requires a value"));
      } finally {
        err.mockRestore();
      }
    }),
  );

  it(
    "refuses --identity immediately followed by another flag, rather than swallowing it as the value",
    withDoc(async (doc) => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const code = await main(["reachability", doc, "--identity", "--json"]);
        expect(code).toBe(2);
        expect(err).toHaveBeenCalledWith(expect.stringContaining("--identity requires a value"));
      } finally {
        err.mockRestore();
      }
    }),
  );

  it(
    "refuses an empty --identity value, the exact silent-no-op the guard exists to catch (fix round 1, Minor 5)",
    withDoc(async (doc) => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const code = await main(["reachability", doc, "--identity", ""]);
        expect(code).toBe(2);
        expect(err).toHaveBeenCalledWith(expect.stringContaining("--identity requires a value"));
      } finally {
        err.mockRestore();
      }
    }),
  );

  it(
    "refuses a whitespace-only --identity value too, not just a literally empty one",
    withDoc(async (doc) => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const code = await main(["reachability", doc, "--identity", "   "]);
        expect(code).toBe(2);
        expect(err).toHaveBeenCalledWith(expect.stringContaining("--identity requires a value"));
      } finally {
        err.mockRestore();
      }
    }),
  );
});

describe("main(): CLI --identity pass-through to each command (fix round 1, Important 2)", () => {
  // THE MEASURED GAP: every existing main([...]) test above is a --help
  // case, a bare-invocation case, or an --identity REFUSAL - all of which
  // return before any command dispatches. Removing `identity` from bin.ts's
  // reachability call (:387 at review time), harvest call (:434), or check
  // call (:633) left `npx tsc --noEmit` clean and all 538 tests green - the
  // recheck and check archiving paths are compile-enforced by
  // archiveContextFor's required `identity` parameter, but these three
  // pass-throughs are plain object-literal spreads with nothing pinning
  // them. Each test below mocks the command module ONE LEVEL BELOW bin.ts,
  // dynamic-imports a fresh bin.js so the mock takes effect, and asserts the
  // options object the command actually received - proving the wire at the
  // one hop these three lacked, the same way test/check.test.ts's spy on
  // defaultFetcher proves check()'s own construction site.

  const withDoc = (body: string, fn: (doc: string) => Promise<void> | void) => async () => {
    const dir = mkdtempSync(join(tmpdir(), "testimonium-cli-identity-"));
    const doc = join(dir, "essay.md");
    writeFileSync(doc, body, "utf8");
    try {
      await fn(doc);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it(
    "reachability: forwards --identity into reachability()'s options",
    withDoc("No citations here.\n", async (doc) => {
      vi.resetModules();
      const spy = vi.fn(
        async (_urls: readonly string[], _opts: ReachabilityOptions = {}): Promise<ReachabilityResult> => ({
          readable: [],
          unreadable: [],
          rate: 1,
        }),
      );
      vi.doMock("../src/reachability.js", () => ({ reachability: spy }));
      try {
        const { main: mainWithMockedReachability } = await import("../src/bin.js");
        const log = vi.spyOn(console, "log").mockImplementation(() => {});
        try {
          const code = await mainWithMockedReachability([
            "reachability",
            doc,
            "--identity",
            "example-app contact@example.com",
          ]);
          expect(code).toBe(0);
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ identity: "example-app contact@example.com" }),
          );

          spy.mockClear();
          await mainWithMockedReachability(["reachability", doc]);
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy.mock.calls[0]?.[1]).not.toHaveProperty("identity");
        } finally {
          log.mockRestore();
        }
      } finally {
        vi.doUnmock("../src/reachability.js");
        vi.resetModules();
      }
    }),
  );

  it(
    "harvest: forwards --identity into harvest()'s options",
    withDoc("No citations here.\n", async (doc) => {
      vi.resetModules();
      const spy = vi.fn(async (_doc: Document, _opts: HarvestOptions = {}): Promise<HarvestReport> => ({
        proposals: [],
        unreachable: [],
        skipped: [],
        frequencyVacuous: true,
      }));
      vi.doMock("../src/harvest.js", () => ({ harvest: spy }));
      try {
        const { main: mainWithMockedHarvest } = await import("../src/bin.js");
        const log = vi.spyOn(console, "log").mockImplementation(() => {});
        try {
          // --json: the draft prints to stdout instead of being written to
          // disk, so this test touches nothing outside the temp doc itself.
          const code = await mainWithMockedHarvest([
            "harvest",
            doc,
            "--json",
            "--identity",
            "example-app contact@example.com",
          ]);
          expect(code).toBe(0);
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ identity: "example-app contact@example.com" }),
          );

          spy.mockClear();
          await mainWithMockedHarvest(["harvest", doc, "--json"]);
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy.mock.calls[0]?.[1]).not.toHaveProperty("identity");
        } finally {
          log.mockRestore();
        }
      } finally {
        vi.doUnmock("../src/harvest.js");
        vi.resetModules();
      }
    }),
  );

  it(
    "check: forwards --identity into check()'s options on the --no-archive path",
    withDoc(
      "The committee's own filing says spending rose.[^1]\n\n" +
        "[^1]: Committee Report. https://example.com/report\n",
      async (doc) => {
        const claimsPath = join(dirname(doc), "essay.claims.json");
        writeFileSync(
          claimsPath,
          JSON.stringify({ "https://example.com/report": ["the committee's own filing says spending rose"] }),
          "utf8",
        );
        vi.resetModules();
        const spy = vi.fn(
          async (_url: string, _claims: readonly string[], _opts: CheckOptions = {}): Promise<CitationResult> => ({
            url: "https://example.com/report",
            verdict: "unreachable",
            rungsAttempted: [],
            rungsAvailable: [],
            ladderTruncated: false,
          }),
        );
        vi.doMock("../src/check.js", () => ({ check: spy }));
        try {
          const { main: mainWithMockedCheck } = await import("../src/bin.js");
          const log = vi.spyOn(console, "log").mockImplementation(() => {});
          try {
            // --no-archive: check()'s own construction site is what has to
            // carry `identity` here, not archiveContextFor's (Important 1's
            // sibling gap, already covered by Minor 6's proof) - this
            // isolates that one call site exactly as it isolates `fetcher`.
            const code = await mainWithMockedCheck([
              "check",
              doc,
              "--no-archive",
              "--allow-unclaimed",
              "--identity",
              "example-app contact@example.com",
            ]);
            expect(code).toBe(0);
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0]?.[2]).toEqual(
              expect.objectContaining({ identity: "example-app contact@example.com" }),
            );

            spy.mockClear();
            await mainWithMockedCheck(["check", doc, "--no-archive", "--allow-unclaimed"]);
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0]?.[2]).not.toHaveProperty("identity");
          } finally {
            log.mockRestore();
          }
        } finally {
          vi.doUnmock("../src/check.js");
          vi.resetModules();
        }
      },
    ),
  );
});
