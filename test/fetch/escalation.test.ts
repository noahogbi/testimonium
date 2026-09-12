import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { check } from "../../src/check.js";
import { reachability } from "../../src/reachability.js";
import type { Fetcher, RawResponse } from "../../src/fetch/types.js";

// Task 9 (spec 0.2.0 section 4): `unsupported` is the only verdict that
// accuses an author, and the ladder stops at the first READABLE read - so a
// JavaScript or consent shell whose chrome clears the prose floor ends the
// climb with the real document still unread, and the claims report
// `unsupported` against an author whose citation was correct. check() now
// climbs once more before accusing, when the verdict would be `unsupported`
// and a rung is untried.
//
// The paired fixture exists because fixtures/corpus.json cannot express this:
// its rows are one body per row, so both rungs would replay identical bytes
// and escalation could never change a verdict on it. shell-node.html is over
// 4,500 extracted characters of chrome carrying NONE of the claims;
// document-curl.html carries them.
//
// Fixture bodies are read ONCE here, at module load, rather than inside each
// fetcher callback. `climb` (src/fetch/read-source.ts) catches anything a
// Fetcher throws and degrades it to EMPTY_RESPONSE with a console.warn - so a
// missing or renamed fixture file, read inside the callback, would not fail
// loudly as ENOENT. It would surface as `expected 'unsupported' to be
// 'supported'` plus an easy-to-miss warning, which is a much harder failure
// to diagnose than a read that throws at collection time.
const CLAIM = "the regulator imposed a fine of 290 million euros";
const SHELL_NODE_BODY = readFileSync("fixtures/paired/shell-node.html", "utf8");
const DOCUMENT_CURL_BODY = readFileSync("fixtures/paired/document-curl.html", "utf8");

/** Sub-floor and claim-free, so the ORDINARY (non-escalated) first climb
 *  keeps going past this read to the next HTML rung on its own - the
 *  ladder's existing "climb unless readable" rule (fetch/ladder.ts), nothing
 *  Task 9 added. Used as `node`'s read in the two fix-round tests below,
 *  where the point is to reach "both HTML rungs already attempted" WITHOUT
 *  invoking check()'s escalation trigger, so the trigger's own behavior -
 *  never a fallback the ordinary ladder would have taken anyway - is what
 *  is under test. */
const SUB_FLOOR_NO_CLAIM_BODY = "<html><body><p>A brief procedural note with nothing else to report here today.</p></body></html>";

/** Over the floor, no veto, claim-free. 6,321 extracted characters (measured
 *  via the real toText, same as the paired fixtures above) - comfortably
 *  readable, so a rung reading this settles the ladder without needing a
 *  second look. */
const LONG_NO_CLAIM_BODY = `<html><title>Administrative Filing</title><body>${"The annual filing describes routine administrative matters with no disputed items at all. ".repeat(70)}</body></html>`;

/** A claim present in neither body above. */
const MISSING_CLAIM = "the parliamentary committee recommended immediate divestment of the subsidiary";

/** A bare RawResponse from a fixture body, for the tests below that only care
 *  about the bytes each rung returns, not headers or status. */
function stub(rawBody: string): RawResponse {
  return { rawBody, headers: {}, finalUrl: "https://example.com/a", status: 200, bytes: rawBody.length };
}

describe("escalate before accusing", () => {
  it("climbs once more rather than accusing, when a rung is untried", async () => {
    const fetcher: Fetcher = {
      rungs: ["node", "curl"],
      async fetch(_url, rung) {
        const rawBody = rung === "node" ? SHELL_NODE_BODY : DOCUMENT_CURL_BODY;
        return { rawBody, headers: {}, finalUrl: _url, status: 200, bytes: rawBody.length };
      },
    };
    const r = await check("https://example.com/a", [CLAIM], { fetcher });
    expect(r.verdict).toBe("supported");
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
  });

  it("does not escalate when the first read already supports the claim", async () => {
    const calls: string[] = [];
    const fetcher: Fetcher = {
      rungs: ["node", "curl"],
      async fetch(_url, rung) {
        calls.push(rung);
        return { rawBody: DOCUMENT_CURL_BODY, headers: {}, finalUrl: _url, status: 200, bytes: DOCUMENT_CURL_BODY.length };
      },
    };
    const r = await check("https://example.com/a", [CLAIM], { fetcher });
    expect(r.verdict).toBe("supported");
    expect(calls).toEqual(["node"]);
  });

  it("never escalates from reachability, which has no verdict to protect", async () => {
    const calls: string[] = [];
    const fetcher: Fetcher = {
      rungs: ["node", "curl"],
      async fetch(_url, rung) {
        calls.push(rung);
        return stub(SHELL_NODE_BODY);
      },
    };
    await reachability(["https://example.com/a"], { fetcher });
    expect(calls).toEqual(["node"]);
  });

  it("escalates on an ordinary healthy page too, and still says unsupported", async () => {
    // The COMMON case, not the shell case: node reads a real document fine, the
    // claim simply is not in it, curl returns the same. Escalation fires (a rung
    // was untried) and the verdict is unchanged. Spec 0.2.0 section 4 states this
    // cost explicitly; an implementer who believed otherwise would encode a
    // fixture contradicting the design.
    const calls: string[] = [];
    const fetcher: Fetcher = {
      rungs: ["node", "curl"],
      async fetch(_url, rung) {
        calls.push(rung);
        return stub(DOCUMENT_CURL_BODY);
      },
    };
    const r = await check("https://example.com/a", ["a claim this document does not contain at all"], { fetcher });
    expect(r.verdict).toBe("unsupported");
    expect(calls).toEqual(["node", "curl"]);
  });

  // --- Fix round 1: documenting the HTML_ORDER-intersection contract -------
  //
  // NEITHER TEST BELOW IS A GUARD. Both were written, per fix-round-1
  // review, to catch check()'s own copy of "which rungs are climbable"
  // counting `pdftotext` (or any rung outside HTML_ORDER) as untried. Fix
  // round 1's mutation proof showed BOTH stay green under exactly that
  // mistake - see task-9-report.md's fix-round-1 section for the full
  // reasoning - because `nextAction` (fetch/ladder.ts) already restricts its
  // own candidates to HTML_ORDER regardless of what this predicate answers,
  // so the wrong form costs one no-op call and nothing a fetch-count
  // assertion can see. Fix round 2 moved the predicate itself to
  // `hasUntriedClimbableRung` in fetch/ladder.ts, where the same mistake IS
  // directly observable as a boolean - that is the real guard, pinned in
  // `test/fetch/ladder.test.ts`. The two tests below stay only as
  // documentation: if a future change to `nextAction` or the PDF guard ever
  // makes this mistake observable end to end, one of them would catch it.

  it("never fetches pdftotext as an HTML fallback, even when the fetcher offers it and it is technically untried", async () => {
    // Documentation, not a guard - see the block comment above. The real
    // discriminator for this contract is test/fetch/ladder.test.ts's
    // "hasUntriedClimbableRung" describe block.
    const calls: string[] = [];
    const fetcher: Fetcher = {
      rungs: ["node", "curl", "pdftotext"],
      async fetch(_url, rung) {
        calls.push(rung);
        const rawBody = rung === "node" ? SUB_FLOOR_NO_CLAIM_BODY : LONG_NO_CLAIM_BODY;
        return { rawBody, headers: {}, finalUrl: _url, status: 200, bytes: rawBody.length };
      },
    };
    const r = await check("https://example.com/a", [MISSING_CLAIM], { fetcher });
    expect(r.verdict).toBe("unsupported");
    expect(calls).toHaveLength(2);
    expect(calls).not.toContain("pdftotext");
  });

  it("never escalates a PDF citation, whatever else the fetcher offers", async () => {
    // Documentation, not a guard - see the block comment above. This one
    // cannot discriminate the fetch-round-1 mutation even in principle: that
    // mutation only ever touched the HTML_ORDER-intersection line, never the
    // `if (isPdfUrl) return false` guard above it, which short-circuits
    // every PDF URL before the mutated line is reached.
    const calls: string[] = [];
    const fetcher: Fetcher = {
      rungs: ["pdftotext"],
      async fetch(_url, rung) {
        calls.push(rung);
        return { rawBody: LONG_NO_CLAIM_BODY, headers: {}, finalUrl: _url, status: 200, bytes: LONG_NO_CLAIM_BODY.length };
      },
    };
    const r = await check("https://example.com/report.pdf", [MISSING_CLAIM], { fetcher });
    expect(r.verdict).toBe("unsupported");
    expect(calls).toHaveLength(1);
  });
});
