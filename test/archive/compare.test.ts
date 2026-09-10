import { describe, expect, it, vi } from "vitest";
import { compareCitation, isGoneStatus, type CompareInput } from "../../src/archive/compare.js";
import { buildArchiveEntry, type RecordedRead } from "../../src/archive/record.js";
import { computeSignals } from "../../src/classify/signals.js";
import type { ArchiveEntry } from "../../src/archive/format.js";
import type { RungId } from "../../src/fetch/types.js";
import type { Verdict } from "../../src/classify/verdict.js";

const URL = "https://e.com/report";
const KEY = "https://e.com/report";
const CLAIMS = ["spending rose sharply"];
const AT = "2026-09-09T00:00:00.000Z";

const rec = (rung: RungId): RecordedRead => ({
  rung,
  response: { rawBody: "body", status: 200, headers: {}, finalUrl: "", bytes: 4 },
});

/** Entries are built FROM buildArchiveEntry so the claimsHash is always the one
 *  the shipped canonicalization produces, never a stale literal. */
function entry(over: Partial<{
  claims: readonly string[];
  toolVersion: string;
  localRulesHash: string | null;
  pdftotextVersion: string | null;
  rungs: RungId[];
  verdict: Verdict;
}> = {}): ArchiveEntry {
  return buildArchiveEntry({
    verdict: over.verdict ?? "supported",
    claims: over.claims ?? CLAIMS,
    reads: (over.rungs ?? ["node"]).map((r) => rec(r)),
    toolVersion: over.toolVersion ?? "0.1.0",
    localRulesHash: over.localRulesHash ?? null,
    pdftotextVersion: over.pdftotextVersion ?? null,
    archivedAt: AT,
  }).entry;
}

function mk(over: Partial<CompareInput> = {}): CompareInput {
  return {
    url: URL,
    key: KEY,
    liveVerdict: "supported",
    liveMissed: [],
    liveStatuses: [200],
    replayVerdict: "supported",
    entry: entry(),
    claims: CLAIMS,
    toolVersion: "0.1.0",
    localRulesHash: null,
    pdftotextVersion: null,
    ...over,
  };
}

describe("the decision procedure", () => {
  it("L = supported, A = supported -> clean", () => {
    expect(compareCitation(mk()).category).toBe("clean");
  });

  it("L = unsupported, A = supported -> SOURCE DRIFT, the only row permitted to accuse", () => {
    const o = compareCitation(mk({ liveVerdict: "unsupported", liveMissed: CLAIMS, replayVerdict: "supported" }));
    expect(o.category).toBe("sourceDrift");
    expect(o.missed).toEqual(CLAIMS);
    expect(o.archivedAt).toBe(AT);
  });

  it("L = supported, A = unsupported -> PIPELINE DRIFT, never source drift", () => {
    // THE DELETED TABLE'S ROW 2. It called this "differ" and issued exit 1 with
    // "the author verifies the page and updates or removes the claim" - for a
    // citation the gate itself passes TODAY. The signature of a change in OUR
    // code: a new challenge signature matching the archived template, a norm()
    // change breaking a phrase the live page no longer carries. The mutation
    // this catches: `category: live !== archived ? "sourceDrift" : "clean"`.
    expect(compareCitation(mk({ liveVerdict: "supported", replayVerdict: "unsupported" })).category).toBe("pipelineDrift");
  });

  it("L = supported, A = unreachable -> pipeline drift", () => {
    expect(compareCitation(mk({ liveVerdict: "supported", replayVerdict: "unreachable" })).category).toBe("pipelineDrift");
  });

  it("L = unreachable, A = unsupported -> listed, never an accusation", () => {
    // The deleted table made this exit 1: an accusation issued from a read that
    // never happened, which is the thing verdict() categorically refuses -
    // every veto returns `unreachable` and `unsupported` is reachable only
    // through isReadable.
    const o = compareCitation(mk({ liveVerdict: "unreachable", liveStatuses: [500], replayVerdict: "unsupported" }));
    expect(o.category).toBe("unreachable");
  });

  it("L = unreachable, A = supported -> listed, never an accusation", () => {
    // The carve-out the deleted table contradicted two paragraphs above itself.
    expect(compareCitation(mk({ liveVerdict: "unreachable", liveStatuses: [503], replayVerdict: "supported" })).category).toBe(
      "unreachable",
    );
  });

  it("L = unsupported, A = unsupported -> pipeline drift, not an accusation", () => {
    expect(compareCitation(mk({ liveVerdict: "unsupported", replayVerdict: "unsupported" })).category).toBe("pipelineDrift");
  });

  it("a 404 on the live read is GONE, its own category, and names the date", () => {
    const o = compareCitation(mk({ liveVerdict: "unreachable", liveStatuses: [404], replayVerdict: "supported" }));
    expect(o.category).toBe("gone");
    expect(o.archivedAt).toBe(AT);
    expect(o.liveGone).toBe(true);
  });

  it("a 410 is gone too", () => {
    expect(compareCitation(mk({ liveVerdict: "unreachable", liveStatuses: [410] })).category).toBe("gone");
  });

  it("NEGATIVE CONTROL: a 500 is NOT gone - a transient wall must not read as link rot", () => {
    // Failing by default over a transiently misconfigured origin is the same
    // false accusation in a new costume. Without this test, `liveGone = true`
    // would pass every gone test above.
    const o = compareCitation(mk({ liveVerdict: "unreachable", liveStatuses: [500, 403] }));
    expect(o.category).toBe("unreachable");
    expect(o.liveGone).toBe(false);
  });

  it("finds the 404 on ANY recorded read, not just the last", () => {
    // The ladder climbs past an N4-only veto, so a 404 on node followed by a
    // wall on curl is the ordinary shape of a deleted page.
    expect(compareCitation(mk({ liveVerdict: "unreachable", liveStatuses: [404, 202] })).category).toBe("gone");
  });

  it("NEGATIVE CONTROL: a 404 on one rung followed by a rung that READ the document is neither gone nor flagged", () => {
    // Fable's correction 5. `liveGone` was computed over every live read
    // regardless of the verdict, and the ladder climbs past an N4-only veto -
    // so a node rung that 404s followed by a curl rung that reads the document
    // gives L = supported, category clean, with the report printing "the live
    // read was a 404 or 410, so this source may be gone" under a citation it
    // had just read. A UA-dependent 404 is a real shape. The mutation this
    // catches: dropping the `liveVerdict === "unreachable"` conjunct.
    const o = compareCitation(mk({ liveVerdict: "supported", liveStatuses: [404, 200], replayVerdict: "supported" }));
    expect(o.category).toBe("clean");
    expect(o.liveGone).toBe(false);
  });

  it("isGoneStatus agrees with N4 in computeSignals, so the two copies cannot drift", () => {
    // CitationResult carries no status (7.4), so recheck reads gone-ness off
    // the recording wrapper and this predicate is a second copy of N4. This
    // test is the join.
    for (const status of [404, 410, 403, 500, 200, 0, 301]) {
      const s = computeSignals({ rawBody: "x", headers: {}, finalUrl: URL, status, claims: [] });
      expect(isGoneStatus(status), `status ${status}`).toBe(s.signals.documentGone);
    }
  });
});

describe("the named confounds", () => {
  it("a changed claimsHash is a confound, and suppresses the accusing row", () => {
    // The ordinary sequence: the author edits a claim, check fails, the
    // baseline is therefore NOT refreshed, and the author runs recheck to ask
    // whether the source moved as well. Answering that with a failing exit code
    // would be answering a question with an accusation.
    const o = compareCitation(mk({
      liveVerdict: "unsupported",
      replayVerdict: "supported",
      claims: ["a different claim entirely"],
    }));
    expect(o.category).toBe("confounded");
    expect(o.confounds.join(" ")).toContain("claims");
  });

  it("a differing pdftotext version is a confound", () => {
    const o = compareCitation(mk({
      entry: entry({ rungs: ["pdftotext"], pdftotextVersion: "pdftotext version 4.00" }),
      pdftotextVersion: "pdftotext version 24.02.0",
      liveVerdict: "unsupported",
      replayVerdict: "supported",
    }));
    expect(o.category).toBe("confounded");
    expect(o.confounds.join(" ")).toContain("pdftotext");
  });

  it("a machine with no pdftotext at all differs from a recorded version", () => {
    const o = compareCitation(mk({
      entry: entry({ rungs: ["pdftotext"], pdftotextVersion: "pdftotext version 4.00" }),
      pdftotextVersion: null,
      liveVerdict: "unsupported",
      replayVerdict: "supported",
    }));
    expect(o.category).toBe("confounded");
  });

  it("NEGATIVE CONTROL: the SAME pdftotext version is not a confound", () => {
    const o = compareCitation(mk({
      entry: entry({ rungs: ["pdftotext"], pdftotextVersion: "pdftotext version 4.00" }),
      pdftotextVersion: "pdftotext version 4.00",
      liveVerdict: "unsupported",
      replayVerdict: "supported",
    }));
    expect(o.category).toBe("sourceDrift");
  });

  it("a changed local --rules file is a confound - it is the author's own data", () => {
    const o = compareCitation(mk({
      entry: entry({ localRulesHash: "aaaa" }),
      localRulesHash: "bbbb",
      liveVerdict: "unsupported",
      replayVerdict: "supported",
    }));
    expect(o.category).toBe("confounded");
    expect(o.confounds.join(" ")).toContain("--rules");
  });

  it("a --rules file added or removed since archiving is a confound in both directions", () => {
    expect(compareCitation(mk({ entry: entry({ localRulesHash: null }), localRulesHash: "aaaa" })).category).toBe("confounded");
    expect(compareCitation(mk({ entry: entry({ localRulesHash: "aaaa" }), localRulesHash: null })).category).toBe("confounded");
  });

  it("a changed BUNDLED version is NOT a confound - it is ours, and it stays on its own row", () => {
    // The mirror rule. Treating a version bump as a confound would suppress the
    // comparison on every citation after every release, which would retire the
    // instrument by upgrading it. It is NAMED in the report and changes nothing.
    const o = compareCitation(mk({
      entry: entry({ toolVersion: "0.1.0" }),
      toolVersion: "0.2.0",
      liveVerdict: "supported",
      replayVerdict: "unsupported",
    }));
    expect(o.category).toBe("pipelineDrift");
    expect(o.bundledVersionChanged).toBe(true);
    expect(o.archivedToolVersion).toBe("0.1.0");
    expect(o.confounds).toEqual([]);
  });

  it("a changed bundled version does not rescue an author from a real source drift either", () => {
    const o = compareCitation(mk({
      entry: entry({ toolVersion: "0.1.0" }),
      toolVersion: "0.2.0",
      liveVerdict: "unsupported",
      replayVerdict: "supported",
    }));
    expect(o.category).toBe("sourceDrift");
    expect(o.bundledVersionChanged).toBe(true);
  });

  it("a confounded citation whose live read 404'd is GONE, with the confound named on the outcome", () => {
    // FABLE'S CORRECTION 2, and 8.3's amended procedure block: the gone row is
    // evaluated ABOVE the named confounds. Under the ordering this replaced,
    // `recheck --fail-on-gone` returned 0 for a genuinely deleted page whenever
    // that URL's claims had been edited since archiving - the opt-in flag the
    // author passed to catch dead links, silently disabled by an unrelated
    // edit, on the ordinary sequence (edit a claim, check fails, recheck). No
    // confound can explain an origin's 404. The confounds are still carried on
    // the outcome and printed, so the reorder changes which category wins and
    // not what the author is told. The mutation this catches: moving the
    // confound short-circuit back above the gone check.
    const o = compareCitation(mk({
      claims: ["a different claim entirely"],
      liveVerdict: "unreachable",
      liveStatuses: [404],
    }));
    expect(o.category).toBe("gone");
    expect(o.liveGone).toBe(true);
    expect(o.confounds.join(" ")).toContain("claims");
    expect(o.archivedAt).toBe(AT);
  });
});

describe("the baseline invariant", () => {
  it("no entry -> no baseline, and NOT an accusation even when the live arm is unsupported", () => {
    const o = compareCitation(mk({ entry: null, replayVerdict: null, liveVerdict: "unsupported", liveMissed: CLAIMS }));
    expect(o.category).toBe("noBaseline");
    expect(o.archived).toBeNull();
    expect(o.recorded).toBeNull();
  });

  it("an archived verdict that is not `supported` violates R and degrades to no baseline", () => {
    // R is always "supported" because only a supported check writes a baseline.
    // A hand-edited or corrupt index that breaks it must never reach the
    // accusing row: trusting it would accuse from a baseline that never proved
    // anything. The mutation this catches: dropping the invariant check.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const o = compareCitation(mk({
      entry: entry({ verdict: "unsupported" }),
      liveVerdict: "unsupported",
      replayVerdict: "supported",
    }));
    expect(o.category).toBe("noBaseline");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("L = unclaimed is reported and accuses nobody", () => {
    expect(compareCitation(mk({ liveVerdict: "unclaimed", replayVerdict: "supported" })).category).toBe("unclaimed");
  });

  it("carries both arms' verdicts on every outcome, so the report can attribute", () => {
    const o = compareCitation(mk({ liveVerdict: "unsupported", replayVerdict: "supported" }));
    expect(o.live).toBe("unsupported");
    expect(o.archived).toBe("supported");
    expect(o.recorded).toBe("supported");
    expect(o.url).toBe(URL);
    expect(o.key).toBe(KEY);
  });
});
