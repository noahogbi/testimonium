import { describe, expect, it } from "vitest";
import { check } from "../src/check.js";
import type { Fetcher, RawResponse, RungId } from "../src/fetch/types.js";
import { CHALLENGE_PATHS, CHALLENGE_SIGNATURES, type Rule } from "../src/rules/challenge.js";
import { HOST_RULES } from "../src/rules/hosts.js";
import type { RuleSet } from "../src/rules/load.js";

// Deliberately NO fixture reads here. These tests exercise check() against a
// stub fetcher and must not depend on Task 3's manually captured corpus - a
// missing fixtures/corpus.json would otherwise crash the whole file at
// collection time, for tests that never touch the network.

function stub(per: Partial<Record<RungId, Partial<RawResponse>>>, rungs: RungId[] = ["node", "curl"]): Fetcher {
  return {
    rungs,
    async fetch(url, rung) {
      return {
        rawBody: "", status: 0, headers: {}, finalUrl: url, bytes: 0,
        ...(per[rung] ?? {}),
      } as RawResponse;
    },
  };
}

const LONG_PROSE = `<html><title>The Committee Report</title><body>${"The committee report states that spending rose sharply. ".repeat(120)}</body></html>`;

describe("check", () => {
  it("returns supported when every claim is present", async () => {
    const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }),
    });
    expect(r.verdict).toBe("supported");
    expect(r.evidence?.length).toBeGreaterThan(0);
  });

  it("returns unsupported when a claim is absent from a document we read", async () => {
    const r = await check("https://e.com/committee-report", ["spending rose sharply", "no such phrase"], {
      fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }),
    });
    expect(r.verdict).toBe("unsupported");
    expect(r.missed).toEqual(["no such phrase"]);
    expect(r).not.toHaveProperty("evidence");
  });

  it("falls through to curl when the node rung is challenged", async () => {
    const wall = "<html><body>Verifying you are human.</body></html>";
    const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: wall, status: 202 }, curl: { rawBody: LONG_PROSE, status: 200 } }),
    });
    expect(r.verdict).toBe("supported");
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
  });

  it("returns unreachable, not unsupported, when every rung is challenged", async () => {
    const wall = "<html><body>Verifying you are human.</body></html>";
    const r = await check("https://e.com/a", ["anything"], {
      fetcher: stub({ node: { rawBody: wall, status: 202 }, curl: { rawBody: wall, status: 202 } }),
    });
    expect(r.verdict).toBe("unreachable");
  });

  it("returns unreachable when a vendor challenge header is present at 200", async () => {
    const r = await check("https://e.com/a", ["anything"], {
      fetcher: stub({
        node: { rawBody: LONG_PROSE, status: 200, headers: { "cf-mitigated": "challenge" } },
        curl: { rawBody: LONG_PROSE, status: 200, headers: { "cf-mitigated": "challenge" } },
      }),
    });
    expect(r.verdict).toBe("unreachable");
  });

  it("returns unclaimed rather than supported for an empty claim list", async () => {
    const r = await check("https://e.com/a", [], { fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }) });
    expect(r.verdict).toBe("unclaimed");
  });

  it("marks the ladder truncated when a rung is unavailable", async () => {
    const r = await check("https://e.com/a", ["nope"], {
      fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }, ["node"]),
    });
    expect(r.ladderTruncated).toBe(true);
  });

  it("degrades a throwing fetcher to an unread rung rather than aborting the run", async () => {
    // The Fetcher contract says do not throw, but a third-party one might.
    // One bad rung must not abort a document with nineteen other citations in
    // it - and it must be warned about, not silently dropped.
    const throwing: Fetcher = {
      rungs: ["node", "curl"] as RungId[],
      async fetch() {
        throw new Error("boom");
      },
    };
    const r = await check("https://e.com/a", ["anything"], { fetcher: throwing });
    expect(r.verdict).toBe("unreachable");
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r).not.toHaveProperty("evidence");
  });

  it("keeps a rung that PROVED the claims when a later rung returns a bigger block page", async () => {
    // The ladder escalates whenever a rung reads under the prose floor, so a
    // SHORT REAL ARTICLE always escalates. If `curl` then returns a larger
    // block page, picking the winning read by prose volume alone computes the
    // verdict on the block page and reports as `unsupported` a claim the tool
    // had ALREADY located. A full match is its own proof of a read, so the
    // rung that made it settles the verdict.
    const shortReal = `<html><body><p>The committee report states that spending rose sharply.</p></body></html>`;
    const biggerBlock = `<html><body>${"Access to this content is restricted for your region. ".repeat(120)}</body></html>`;
    const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: shortReal, status: 200 }, curl: { rawBody: biggerBlock, status: 200 } }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("supported");
    expect(r.evidence?.[0]?.rung).toBe("node");
    expect(r.missed ?? []).toEqual([]);
  });

  it("never names a claim in `missed` that some rung located", async () => {
    // The partial case, which is worse than the all-or-nothing one: two claims
    // found on `node`, the third found nowhere, and a fat block page on `curl`.
    // `missed` is the INTERSECTION across reads, so only the genuinely absent
    // claim may be named.
    const first = "spending rose sharply";
    const second = "the review is ongoing";
    const found = [first, second];
    const absent = "a phrase no page carries";
    const shortReal = `<html><body><p>The committee report states that ${first}, and ${second}.</p></body></html>`;
    const biggerBlock = `<html><body>${"Access to this content is restricted for your region. ".repeat(120)}</body></html>`;
    const r = await check("https://e.com/committee-report", [...found, absent], {
      fetcher: stub({ node: { rawBody: shortReal, status: 200 }, curl: { rawBody: biggerBlock, status: 200 } }),
    });
    expect(r.verdict).toBe("unsupported");
    expect(r.missed).toEqual([absent]);
    for (const c of found) expect(r.missed).not.toContain(c);
  });

  it("rejects an empty or whitespace-only claim rather than attesting to it", async () => {
    // "".includes("") is true, so an empty claim matches EVERY document and
    // would mint `supported` with a null excerpt. parseClaimsFile protects the
    // CLI; check() is the exported front door and defends itself.
    for (const bad of ["", "   ", "\t\n"]) {
      await expect(
        check("https://e.com/a", [bad], { fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }) }),
      ).rejects.toThrow(/empty or whitespace-only/);
    }
    // An empty ARRAY is still legitimate - that is `unclaimed`, tested above.
    await expect(
      check("https://e.com/a", ["real claim", ""], { fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }) }),
    ).rejects.toThrow(/index 1/);
  });

  it("rejects a claim that survives trim() but NORMALIZES to empty", async () => {
    // The guard has to test the predicate the MATCHER uses. norm() deletes
    // commas and zero-width characters, so each of these normalizes to "" and
    // matches every document - while JS trim() sees a non-empty string and
    // waves it through. That minted `supported` with a null excerpt: an
    // attestation with nothing behind it, and reachable from the CLI, because
    // parseClaimsFile tested the same wrong predicate.
    for (const bad of [",", ",,,", "\u200b"]) {
      await expect(
        check("https://e.com/a", [bad], { fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }) }),
        JSON.stringify(bad),
      ).rejects.toThrow(/empty or whitespace-only/);
    }
  });

  it("assembles a full match across rungs rather than accusing from one of them", async () => {
    // The union case. Neither rung carries both claims: `node` reads a
    // sub-floor real article with the first, the ladder escalates because it is
    // sub-floor, and `curl` returns a fat page carrying the second. A match is
    // proof of a read, so between them BOTH claims are proven present - and
    // computing the verdict from the winning read alone returned `unsupported`
    // with an empty `missed` and no evidence, failing a build while naming
    // nothing.
    const c1 = "spending rose sharply";
    const c2 = "the review is ongoing";
    const shortReal = `<html><body><p>The committee report states that ${c1}.</p></body></html>`;
    const fat = `<html><body>${"Access to this content is restricted for your region. ".repeat(120)}<p>Separately, ${c2}.</p></body></html>`;
    const r = await check("https://e.com/committee-report", [c1, c2], {
      fetcher: stub({ node: { rawBody: shortReal, status: 200 }, curl: { rawBody: fat, status: 200 } }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("supported");
    // Each excerpt comes from the read that actually located its claim.
    expect(r.evidence?.map((e) => e.rung)).toEqual(["node", "curl"]);
    for (const e of r.evidence ?? []) expect(e.excerpt).not.toBeNull();
    expect(r.evidence?.[0]?.excerpt).toContain(c1);
    expect(r.evidence?.[1]?.excerpt).toContain(c2);
  });

  it("INVARIANT: an unsupported verdict always names at least one missed claim", async () => {
    // `unsupported` fails a build. A CI failure that names nothing is worse
    // than no check at all, and the schema cannot express the reason anywhere
    // else - `evidence` is gated off on a non-supported verdict. Asserted as a
    // property over the ladder shapes that produce it, not one example.
    const c1 = "spending rose sharply";
    const c2 = "the review is ongoing";
    const absent = "a phrase no page carries";
    const shortReal = `<html><body><p>The committee report states that ${c1}.</p></body></html>`;
    const fat = `<html><body>${"Access to this content is restricted for your region. ".repeat(120)}<p>Separately, ${c2}.</p></body></html>`;
    const fatOnly = `<html><body>${"Access to this content is restricted for your region. ".repeat(120)}</body></html>`;
    const scenarios: { name: string; claims: string[]; per: Parameters<typeof stub>[0] }[] = [
      { name: "union covers everything", claims: [c1, c2], per: { node: { rawBody: shortReal, status: 200 }, curl: { rawBody: fat, status: 200 } } },
      { name: "union covers everything but one", claims: [c1, c2, absent], per: { node: { rawBody: shortReal, status: 200 }, curl: { rawBody: fat, status: 200 } } },
      { name: "nothing located anywhere", claims: [absent], per: { node: { rawBody: fatOnly, status: 200 } } },
      { name: "one rung, partial match", claims: [c1, absent], per: { node: { rawBody: LONG_PROSE, status: 200 } } },
      { name: "sub-floor read only", claims: [absent], per: { node: { rawBody: shortReal, status: 200 } } },
    ];
    for (const s of scenarios) {
      const r = await check("https://e.com/committee-report", s.claims, { fetcher: stub(s.per) });
      if (r.verdict !== "unsupported") continue;
      expect(r.missed, s.name).toBeDefined();
      expect((r.missed ?? []).length, s.name).toBeGreaterThan(0);
    }
  });

  it("does not consult HTTP status outside the 404/410 veto", async () => {
    // The property the design actually holds. A 400 or a 500 says nothing
    // about whether the bytes are the document - spec 6.3 records a 400
    // serving 253KB and a 404 serving 112KB - so a document that matches its
    // claims under one of those statuses is supported.
    for (const status of [400, 418, 500, 503]) {
      const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
        fetcher: stub({ node: { rawBody: LONG_PROSE, status } }),
      });
      expect(r.verdict, `status ${status}`).toBe("supported");
    }
  });

  it("a 404 or 410 vetoes even a full match, end to end", async () => {
    // N4, exercised through the front door rather than only at the reducer.
    // A server is not authoritative about PRESENCE, which is why 2xx is never
    // proof of a read - but it IS authoritative when it says a resource does
    // not exist. Calibration forced this: no prose floor could reject a real
    // ECB 404 serving 13,221 characters of navigation chrome, and with the
    // veto removed zero thresholds satisfied the acceptance test.
    //
    // The cost is recorded and accepted: a misconfigured host serving a real
    // document under a 404 loses its evidence. That degrades to unreachable,
    // which renders nothing and fails nothing - the safe direction.
    for (const status of [404, 410]) {
      const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
        fetcher: stub({ node: { rawBody: LONG_PROSE, status } }),
      });
      expect(r.verdict, `status ${status}`).toBe("unreachable");
      expect(r, `status ${status}`).not.toHaveProperty("evidence");
    }
  });
});

describe("check with a local RuleSet (Task 15)", () => {
  // Task 15 fix round 1, Critical 2: loadRules()'s own tests only exercise
  // its pure merge logic. Nothing asserted that a local rule actually changes
  // a verdict, or that firedRule reaches a CitationResult - so a regression
  // turning `rules` back into an unused CheckOptions field would leave the
  // rest of the suite green. These two close that gap through check(), the
  // front door, the same way the 404/410 veto test above exercises N4 through
  // check() rather than only at verdict() directly.
  const CLAIM = "spending rose sharply";
  // Short enough that the signature veto's length conjunction applies
  // (< THRESHOLDS.maxChallengeChars = 800 extracted chars) - and it carries
  // BOTH the claim, so a full match is possible, and a wall phrase no bundled
  // CHALLENGE_SIGNATURES entry recognizes.
  const SHORT_WALL_BODY =
    `<html><body>The committee report states that ${CLAIM}. ` +
    `Please solve the puzzle to continue.</body></html>`;
  const LOCAL_SIGNATURE: Rule = {
    pattern: /please solve the puzzle/,
    lastConfirmed: "2026-08-01",
    note: "local puzzle wall, unknown to the bundled list",
  };
  const RULES_WITH_LOCAL_SIGNATURE: RuleSet = {
    signatures: [...CHALLENGE_SIGNATURES, LOCAL_SIGNATURE],
    paths: CHALLENGE_PATHS,
    hosts: HOST_RULES,
  };

  it("a local signature flips a full claim match from supported to unreachable", async () => {
    // Without the local rule, this body is an ordinary full match: no bundled
    // signature/path fires, status 200, matched === total.
    const withoutRules = await check("https://e.com/a", [CLAIM], {
      fetcher: stub({ node: { rawBody: SHORT_WALL_BODY, status: 200 } }),
    });
    expect(withoutRules.verdict).toBe("supported");

    // With it, the SAME body and SAME full match is vetoed - the challenge
    // check runs before the full-match check in verdict(), so this proves the
    // local rule is actually consulted by computeSignals via check(), not
    // merely loaded and validated.
    const withRules = await check("https://e.com/a", [CLAIM], {
      fetcher: stub({ node: { rawBody: SHORT_WALL_BODY, status: 200 } }),
      rules: RULES_WITH_LOCAL_SIGNATURE,
    });
    expect(withRules.verdict).toBe("unreachable");
  });

  it("carries firedRule as provenance on a non-supported verdict, with no renderable evidence", async () => {
    const r = await check("https://e.com/a", [CLAIM], {
      fetcher: stub({ node: { rawBody: SHORT_WALL_BODY, status: 200 } }),
      rules: RULES_WITH_LOCAL_SIGNATURE,
    });
    expect(r.verdict).toBe("unreachable");
    // Provenance carries the note and date, never the compiled pattern (a
    // RegExp does not survive JSON.stringify).
    expect(r.firedRule).toEqual({
      lastConfirmed: "2026-08-01",
      note: "local puzzle wall, unknown to the bundled list",
    });
    // Still no renderable fields on a non-supported verdict - firedRule is
    // provenance, not evidence.
    expect(r).not.toHaveProperty("evidence");
    expect(r).not.toHaveProperty("retrievedAt");
  });
});
