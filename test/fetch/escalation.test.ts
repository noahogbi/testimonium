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

const CLAIM = "the regulator imposed a fine of 290 million euros";

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
        const file = rung === "node" ? "fixtures/paired/shell-node.html" : "fixtures/paired/document-curl.html";
        const rawBody = readFileSync(file, "utf8");
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
        const rawBody = readFileSync("fixtures/paired/document-curl.html", "utf8");
        return { rawBody, headers: {}, finalUrl: _url, status: 200, bytes: rawBody.length };
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
        return stub(readFileSync("fixtures/paired/shell-node.html", "utf8"));
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
        return stub(readFileSync("fixtures/paired/document-curl.html", "utf8"));
      },
    };
    const r = await check("https://example.com/a", ["a claim this document does not contain at all"], { fetcher });
    expect(r.verdict).toBe("unsupported");
    expect(calls).toEqual(["node", "curl"]);
  });
});
