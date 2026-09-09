import { describe, expect, it } from "vitest";
import { harvest } from "../src/harvest.js";
import { parseGfmFootnotes } from "../src/adapters/gfm-footnotes.js";
import { parseClaimsFile } from "../src/io/claims.js";
import { THRESHOLDS, proseVolume } from "../src/classify/thresholds.js";
import { documentMismatchNote, normBoundaryNote } from "../src/harvest/spans.js";
import { toText } from "../src/text/extract.js";
import type { Fetcher, RawResponse, RungId } from "../src/fetch/types.js";

// No fixture reads, as in test/check.test.ts.
function stub(per: Partial<Record<string, Partial<RawResponse>>>, rungs: RungId[] = ["node", "curl"]): Fetcher {
  return {
    rungs,
    async fetch(url, rung) {
      const key = `${url}|${rung}`;
      return {
        rawBody: "", status: 0, headers: {}, finalUrl: url, bytes: 0,
        ...(per[key] ?? per[url] ?? {}),
      } as RawResponse;
    },
  };
}

const SHARED = "the committee reported that spending rose sharply in the fourth quarter";
const OTHER_SHARED = "procurement practices were reviewed across every department";
const FILLER = "<p>Background material about budgets and departmental process.</p>".repeat(120);
const page = (...paragraphs: string[]): string =>
  `<html><title>The Committee Report</title><body>${paragraphs.map((p) => `<p>${p}</p>`).join("")}${FILLER}</body></html>`;
const WALL = "<html><body>Verifying you are human.</body></html>";

// The norm()/foldWithMap boundary fixtures (fix round 1). Every sentence is
// built FROM the span the tests expect, so a change to the span cannot leave
// the fixture asserting against a stale copy of it.
const BOUNDARY_SPAN = "billion dollars on procurement across every department";
const DIGIT_SENT = `the agency spent 7 ${BOUNDARY_SPAN}`;
const SIX_SENT = `The agency spent 6 ${BOUNDARY_SPAN}.`;
const WORD_SENT = `The agency spent seven ${BOUNDARY_SPAN}.`;
const boundaryMd = (sentence: string): string =>
  [
    `Our draft says ${sentence}, which matters.[^1]`,
    "",
    "[^1]: The Committee Report, https://e.com/report",
    "",
  ].join("\n");

const MD = [
  `Our draft says ${SHARED}, which matters.[^1]`,
  "",
  `It adds that ${OTHER_SHARED}, separately.[^2]`,
  "",
  "[^1]: The Committee Report, https://e.com/report",
  "[^2]: A second outlet, https://f.com/story",
  "",
].join("\n");

describe("harvest", () => {
  it("proposes a span the draft and a readable source share", async () => {
    expect(proseVolume(toText(page(`${SHARED}.`)))).toBeGreaterThanOrEqual(THRESHOLDS.minProseChars);
    const doc = parseGfmFootnotes(MD);
    const r = await harvest(doc, {
      fetcher: stub({
        "https://e.com/report": { rawBody: page(`${SHARED}.`), status: 200 },
        "https://f.com/story": { rawBody: WALL, status: 202 },
      }),
    });
    const first = r.proposals.find((p) => p.url === "https://e.com/report");
    expect(first!.claims).toEqual([SHARED]);
    expect(first!.bugs).toEqual([]);
    expect(first!.drops).toEqual({ floor: 0, frequency: 0, rules: 0, claimed: 0 });
  });

  it("proposes nothing for a URL with no readable read, and reports the rungs tried", async () => {
    const doc = parseGfmFootnotes(MD);
    const r = await harvest(doc, {
      fetcher: stub({
        "https://e.com/report": { rawBody: page(`${SHARED}.`), status: 200 },
        "https://f.com/story": { rawBody: WALL, status: 202 },
      }),
    });
    expect(r.proposals.map((p) => p.url)).toEqual(["https://e.com/report"]);
    // `pdfUrl` rides along from Task 6's scan, which added it so this report
    // could tell "we could not read it" from "this machine cannot read PDFs".
    expect(r.unreachable).toEqual([
      { url: "https://f.com/story", rungsAttempted: ["node", "curl"], pdfUrl: false },
    ]);
  });

  it("CHARACTERIZATION: a URL has at most one readable read, because the ladder stops on it", async () => {
    // fetch/ladder.ts stops the moment a read is readable, so "the union over
    // a URL's readable reads" is a union over ONE read today. Harvest is
    // written for a list because spec 8.2 says reads, plural, and because
    // bestReadable in read-source.ts is defensive in the same way. If a
    // future ladder change makes two reads readable, this test turns red and
    // the union stops being theoretical.
    //
    // The SECOND source is readable at CURL only - node is walled - so the
    // expectation is ["node"] for one URL and ["curl"] for the other. A
    // `rungs: ["node"]` hardcoded in harvest.ts would satisfy a fixture where
    // every read happened to be node's, and this one refuses it (the same
    // mutation test/harvest/sources.test.ts designs its fixture against).
    const doc = parseGfmFootnotes(MD);
    const r = await harvest(doc, {
      fetcher: stub({
        "https://e.com/report": { rawBody: page(`${SHARED}.`), status: 200 },
        "https://f.com/story|node": { rawBody: WALL, status: 202 },
        "https://f.com/story|curl": { rawBody: page(`${OTHER_SHARED}.`), status: 200 },
      }),
    });
    // Both URLs must actually BE here, or the loop below characterizes
    // nothing: `for (const p of [])` asserts as loudly as a passing ladder.
    expect(r.proposals.map((p) => p.url)).toEqual(["https://e.com/report", "https://f.com/story"]);
    expect(r.proposals.map((p) => p.rungs)).toEqual([["node"], ["curl"]]);
  });

  it("drops a span a SECOND cited source also carries, and counts it", async () => {
    // Spec 8.2 filter 5.2. Both pages carry the first claim; the second
    // source's readable read votes it down, and the count says which filter
    // took it so the author can recover a genuine reprint.
    const doc = parseGfmFootnotes(MD);
    const r = await harvest(doc, {
      fetcher: stub({
        "https://e.com/report": { rawBody: page(`${SHARED}.`), status: 200 },
        "https://f.com/story": { rawBody: page(`${SHARED}.`, `${OTHER_SHARED}.`), status: 200 },
      }),
    });
    const first = r.proposals.find((p) => p.url === "https://e.com/report");
    expect(first!.claims).toEqual([]);
    expect(first!.drops.frequency).toBe(1);
    expect(r.frequencyVacuous).toBe(false);
  });

  it("never lets a source vote against its own spans, so the same page twice still proposes", async () => {
    // The caller's HALF of the self-exclusion contract, pinned here because
    // Task 7's `other.key !== input.source.key` guard is meant to be defence
    // in depth and not the only defence. A caller that leaves the source in
    // its own `others` drops 100% of its proposals - silently, and totally,
    // and "harvest proposed nothing" reads to an author exactly like "the
    // sources shared nothing".
    //
    // The fixture is built to catch that mutation specifically: BOTH cited
    // URLs serve a page carrying BOTH shared spans, so each URL's own read
    // contains every span it proposes. Self-exclusion is therefore the only
    // thing standing between these proposals and a total drop - while the
    // CROSS-source vote is neutralized by giving each URL a span of its own
    // that the other's page does not carry.
    const md = [
      `Our draft says ${SHARED}, which matters.[^1]`,
      "",
      `It adds that ${OTHER_SHARED}, separately.[^2]`,
      "",
      "[^1]: The Committee Report, https://e.com/report",
      "[^2]: A second outlet, https://f.com/story",
      "",
    ].join("\n");
    const r = await harvest(parseGfmFootnotes(md), {
      fetcher: stub({
        "https://e.com/report": { rawBody: page(`${SHARED}.`), status: 200 },
        "https://f.com/story": { rawBody: page(`${OTHER_SHARED}.`), status: 200 },
      }),
    });
    expect(r.proposals.map((p) => [p.url, p.claims])).toEqual([
      ["https://e.com/report", [SHARED]],
      ["https://f.com/story", [OTHER_SHARED]],
    ]);
    // Attributable absence: nothing dropped, and the frequency filter was
    // able to run - two readable sources - so a zero here is a filter that
    // ran and found nothing, not a filter that could not fire.
    expect(r.proposals.map((p) => p.drops.frequency)).toEqual([0, 0]);
    expect(r.frequencyVacuous).toBe(false);
  });

  it("says the frequency filter was vacuous when fewer than two sources were readable", async () => {
    // Fable Q5: vacuous, not wrong. The report says so in words (Task 9), and
    // this flag is what it says it from.
    const doc = parseGfmFootnotes(MD);
    const r = await harvest(doc, {
      fetcher: stub({
        "https://e.com/report": { rawBody: page(`${SHARED}.`), status: 200 },
        "https://f.com/story": { rawBody: WALL, status: 202 },
      }),
    });
    expect(r.frequencyVacuous).toBe(true);
    // The flag has to be about how many sources were READABLE, not about how
    // many the document cited: two were cited here and one could be read.
    expect(r.proposals).toHaveLength(1);
    expect(r.unreachable).toHaveLength(1);
  });

  it("joins the existing claims file by the NORMALIZED key, so filter 4 can see it", async () => {
    // The composition seam Task 7 cannot reach: `applyFilters` is handed
    // `existing`, and this is the only code that decides what `existing` is.
    // The citation carries a tracking parameter the claims file does not, so
    // the join only happens through `normalizeUrl` - looking the entry up by
    // `source.url`, or handing `[]` down unconditionally, re-proposes a claim
    // the author already wrote, and this test goes red rather than the author
    // finding her own claim in her draft.
    const md = [
      `Our draft says ${SHARED}, which matters.[^1]`,
      "",
      `It adds that ${OTHER_SHARED}, separately.[^2]`,
      "",
      "[^1]: The Committee Report, https://e.com/report?utm_source=news",
      "[^2]: A second outlet, https://f.com/story",
      "",
    ].join("\n");
    const claims = parseClaimsFile(JSON.stringify({ "https://e.com/report": [SHARED] }));
    const r = await harvest(parseGfmFootnotes(md), {
      claims,
      fetcher: stub({
        "https://e.com/report?utm_source=news": { rawBody: page(`${SHARED}.`), status: 200 },
        "https://f.com/story": { rawBody: WALL, status: 202 },
      }),
    });
    const first = r.proposals.find((p) => p.key === "https://e.com/report");
    // Attributable: the span was FOUND and then dropped by filter 4 by name,
    // which an empty `claims` with a zeroed `drops` would not distinguish.
    expect(first!.claims).toEqual([]);
    expect(first!.drops).toEqual({ floor: 0, frequency: 0, rules: 0, claimed: 1 });
  });

  it("never proposes for a notApplicable URL, and never fetches it", async () => {
    const fetched: string[] = [];
    const fetcher: Fetcher = {
      rungs: ["node"] as RungId[],
      async fetch(url) {
        fetched.push(url);
        return { rawBody: page(`${SHARED}.`), status: 200, headers: {}, finalUrl: url, bytes: 0 };
      },
    };
    const claims = parseClaimsFile('{"https://f.com/story":{"notApplicable":"rests on the filing itself"}}');
    const r = await harvest(parseGfmFootnotes(MD), { fetcher, claims });
    expect(r.skipped).toEqual([{ url: "https://f.com/story", reason: "rests on the filing itself" }]);
    expect(fetched).toEqual(["https://e.com/report"]);
  });

  it("carries a readable read's redirect away from the cited path into the report", async () => {
    const doc = parseGfmFootnotes(MD);
    const r = await harvest(doc, {
      fetcher: stub({
        "https://e.com/report": { rawBody: page(`${SHARED}.`), status: 200, finalUrl: "https://e.com/" },
        "https://f.com/story": { rawBody: WALL, status: 202 },
      }),
    });
    expect(r.proposals[0]!.redirectedTo).toBe("https://e.com/");
  });

  it("carries a norm() boundary line from the SOURCE side, and proposes nothing for it", async () => {
    // Fix round 1, Important 1 and 2. `norm()` rewrites "(digit) billion" to
    // "(digit)bn" and `foldWithMap` deliberately does not, so a span whose
    // left boundary snaps past a DIFFERING digit onto "billion" is absent
    // from `norm(sourceText)`, which holds "6bn". Assertion 1 fires on a page
    // that is working perfectly.
    //
    // TWO properties in one fixture, both of which were wrong before this
    // round. First, `bugs` reaches the report at all: an earlier comment in
    // harvest.ts claimed no fixture could produce a line, and this is that
    // fixture. Second, the LINE says what it is - it used to read `not found
    // in the source: "..."`, indistinguishable from a genuine offset-map
    // fault, which is how a real fault could hide inside a routine boundary
    // effect.
    //
    // The DROP is deliberate and is not what this pins: assertion 1 asks
    // whether `phraseFound` will find the span, `check()` uses that same
    // predicate, so proposing it would set the author up for a false
    // accusation against her own citation.
    const r = await harvest(parseGfmFootnotes(boundaryMd(DIGIT_SENT)), {
      fetcher: stub({ "https://e.com/report": { rawBody: page(SIX_SENT), status: 200 } }),
    });
    const first = r.proposals[0]!;
    expect(first.claims).toEqual([]);
    expect(first.bugs).toEqual([normBoundaryNote(BOUNDARY_SPAN)]);
    expect(first.bugs[0]).not.toMatch(/^not found in the source/);
    expect(first.bugs[0]).toContain("NOT A BUG");
  });

  it("carries the same boundary from the DOCUMENT side, named as the two things it can be", async () => {
    // Assertion 1's twin, and reachable by fixture for the same reason.
    // The SOURCE spells the magnitude in words, so nothing is rewritten there
    // and assertion 1 passes; the DRAFT spells it in digits, so
    // `norm(docProse)` holds "7bn" and assertion 2 fires. Unlike assertion 1,
    // assertion 2 CAN also fire on a real bug - a shifted offset map reaches
    // it before assertion 3 does - so its line names both readings rather
    // than asserting the wrong one. Fixing only assertion 1 would have left
    // its twin carrying exactly the defect this round found.
    const r = await harvest(parseGfmFootnotes(boundaryMd(DIGIT_SENT)), {
      fetcher: stub({ "https://e.com/report": { rawBody: page(WORD_SENT), status: 200 } }),
    });
    const first = r.proposals[0]!;
    expect(first.claims).toEqual([]);
    expect(first.bugs).toEqual([documentMismatchNote(BOUNDARY_SPAN)]);
    expect(first.bugs[0]).toContain("a BUG if");
    expect(first.bugs[0]).toContain("NOT a bug if");
  });
});
