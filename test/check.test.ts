import { describe, expect, it, vi } from "vitest";
import { check, type CheckOptions } from "../src/check.js";
import { THRESHOLDS, proseVolume } from "../src/classify/thresholds.js";
import { toText } from "../src/text/extract.js";
import type { Fetcher, RawResponse, RungId } from "../src/fetch/types.js";
import { CHALLENGE_PATHS, CHALLENGE_SIGNATURES, type Rule } from "../src/rules/challenge.js";
import { HOST_RULES } from "../src/rules/hosts.js";
import type { RuleSet } from "../src/rules/load.js";
import { defaultFetcher, userAgentFor, type FetcherOptions } from "../src/fetch/default-fetcher.js";

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

  it("a redirect to another host AND another article path is not moved away: it still attests", async () => {
    // 0.8.0 added the redirect gate this test used to pin the absence of
    // (spec 0.8.0 section 5). It fires only when a read lands on a site root
    // or an ancestor of the cited path. This redirect lands on a different
    // article on a different host - the shape of every one of the 15
    // legitimate redirects measured on 2026-09-25 - so it passes the gate,
    // stays `supported`, and carries no redirectedTo.
    const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
      fetcher: stub({
        node: {
          rawBody: LONG_PROSE,
          status: 200,
          finalUrl: "https://elsewhere.example.org/archive/2019/annual-review",
        },
      }),
    });
    expect(r.verdict).toBe("supported");
    expect(r).not.toHaveProperty("firedRule");
    expect(r).not.toHaveProperty("redirectedTo");
    expect(r.rungsAttempted).toEqual(["node"]);
  });

  it("does not accuse over a page that redirected to the site root: unreachable, and says where it landed", async () => {
    const r = await check("https://e.com/reports/2024-annual", ["revenue fell in the fourth quarter"], {
      fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200, finalUrl: "https://e.com/" } }),
    });
    expect(r.verdict).toBe("unreachable");
    expect(r.redirectedTo).toBe("https://e.com/");
    expect(r).not.toHaveProperty("missed");
    // A gated read is not an accusation, so it does not spend the escalation.
    expect(r.rungsAttempted).toEqual(["node"]);
  });

  it("still attests a claim found on a moved-away page, and says where it was served from", async () => {
    const r = await check("https://e.com/reports/2024-annual", ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200, finalUrl: "https://e.com/" } }),
    });
    expect(r.verdict).toBe("supported");
    expect(r.redirectedTo).toBe("https://e.com/");
  });

  it("keeps a genuine accusation from the unmoved rung when escalation lands on the root", async () => {
    // Review Focus 4. node reads the cited page and misses, so check() climbs;
    // curl lands on the site root with MORE prose. Without preferring the read
    // that stayed, curl would win and the real accusation would become
    // `unreachable`.
    const bigger = `<html><body>${"Welcome to our homepage, with news and features from across the site. ".repeat(200)}</body></html>`;
    expect(proseVolume(toText(bigger))).toBeGreaterThan(proseVolume(toText(LONG_PROSE)));
    const r = await check("https://e.com/reports/2024-annual", ["revenue fell in the fourth quarter"], {
      fetcher: stub({
        node: { rawBody: LONG_PROSE, status: 200 },
        curl: { rawBody: bigger, status: 200, finalUrl: "https://e.com/" },
      }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("unsupported");
    expect(r.missed).toEqual(["revenue fell in the fourth quarter"]);
    expect(r).not.toHaveProperty("redirectedTo");
  });

  it("returns unsupported when a claim is absent from a document we read", async () => {
    const r = await check("https://e.com/committee-report", ["spending rose sharply", "no such phrase appears here"], {
      fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }),
    });
    expect(r.verdict).toBe("unsupported");
    expect(r.missed).toEqual(["no such phrase appears here"]);
    // 0.2.0: an unsupported result now keeps the passage that DID match, so an
    // author fixing the miss can see what already landed.
    expect(r.evidence?.[0]?.claims).toEqual(["spending rose sharply"]);
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
    const r = await check("https://e.com/a", ["anything at all on this page"], {
      fetcher: stub({ node: { rawBody: wall, status: 202 }, curl: { rawBody: wall, status: 202 } }),
    });
    expect(r.verdict).toBe("unreachable");
  });

  it("returns unreachable when a vendor challenge header is present at 200", async () => {
    const r = await check("https://e.com/a", ["anything at all on this page"], {
      fetcher: stub({
        node: { rawBody: LONG_PROSE, status: 200, headers: { "cf-mitigated": "challenge" } },
        curl: { rawBody: LONG_PROSE, status: 200, headers: { "cf-mitigated": "challenge" } },
      }),
    });
    expect(r.verdict).toBe("unreachable");
  });

  it("honors N1 from a caller's fetcher that returns WIRE-CASED header keys", async () => {
    // A demonstrated false accusation. Header field names are case-insensitive
    // on the wire, and `Record<string, string>` is not. Both bundled fetchers
    // lowercase their keys as an implementation detail; nothing in the
    // RawResponse contract ever required it, so a caller-supplied
    // CheckOptions.fetcher - the documented bring-your-own-reader escape hatch
    // - that passes headers through as the server cased them used to lose N1
    // silently, and this exact input returned `unsupported` with the claim
    // named in `missed`. The body is padded past the prose floor so nothing
    // else can be doing the rejecting.
    const r = await check("https://e.com/a", ["a claim this wall does not carry"], {
      fetcher: stub({
        node: { rawBody: LONG_PROSE, status: 200, headers: { "CF-Mitigated": "challenge" } },
        curl: { rawBody: LONG_PROSE, status: 200, headers: { "CF-Mitigated": "challenge" } },
      }),
    });
    expect(r.verdict).toBe("unreachable");
  });

  it("honors N5's content-type trigger from a WIRE-CASED header key and value", async () => {
    // The same defect on N5's independent trigger, and cased both ways at
    // once: `Content-Type` as a key, `APPLICATION/PDF` as a value.
    const r = await check("https://e.com/a", ["a claim these bytes do not carry"], {
      fetcher: stub({
        node: { rawBody: LONG_PROSE, status: 200, headers: { "Content-Type": "APPLICATION/PDF" } },
        curl: { rawBody: LONG_PROSE, status: 200, headers: { "Content-Type": "APPLICATION/PDF" } },
      }),
    });
    expect(r.verdict).toBe("unreachable");
  });

  it("returns unclaimed rather than supported for an empty claim list", async () => {
    const r = await check("https://e.com/a", [], { fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }) });
    expect(r.verdict).toBe("unclaimed");
  });

  it("marks the ladder truncated when a rung is unavailable", async () => {
    const r = await check("https://e.com/a", ["nope not a phrase here"], {
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
    const r = await check("https://e.com/a", ["anything at all on this page"], { fetcher: throwing });
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

  it("ACCEPTED EXPOSURE: a sub-floor stub that proves the claim outranks a larger clean document read later", async () => {
    // NOT a desired behaviour - a deliberately accepted exposure, disclosed in
    // the README's "Measured limits" (the paywall-stub bullet) and in
    // docs/calibration-2026-09.md. A full match is its own proof of a read
    // (verdict.ts), so the FIRST rung to prove every claim settles the
    // verdict and the ladder never reconsiders once a later, larger, clean
    // rung shows up with no claim in it. A short unrecognised stub - nothing
    // here trips any challenge signal, header, path, or 404/410 - carrying the
    // claim beats a bigger document that plainly does not carry it. Do not
    // "fix" this by picking the largest read instead: that is the exact
    // regression Critical 1 (round 1 of this fix wave) already fixed the other
    // way, where a fat block page on `curl` overturned a claim `node` had
    // already proven.
    const shortStub = `<html><body><p>The committee report states that spending rose sharply.</p></body></html>`;
    const largerCleanWithoutClaim = `<html><title>The Committee Report</title><body>${"The committee report covers many other matters entirely, none of them this one. ".repeat(80)}</body></html>`;
    const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: shortStub, status: 200 }, curl: { rawBody: largerCleanWithoutClaim, status: 200 } }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("supported");
    expect(r.evidence?.[0]?.rung).toBe("node");
    expect(r.missed ?? []).toEqual([]);
  });

  it("ACCEPTED EXPOSURE: a stub that proves the claim at 200 outranks a later rung's 404 veto", async () => {
    // NOT a desired behaviour - a deliberately accepted exposure, same design
    // choice as the test above and disclosed in the same places. N4 (the
    // 404/410 veto) is real and load-bearing (see "a 404 or 410 vetoes even a
    // full match, end to end" below), but it only vetoes the READ IT APPLIES
    // TO. It cannot retroactively overturn a verdict an earlier rung already
    // proved, because `proven` is found by scanning `reads` for the first one
    // whose OWN verdict is `supported` - a rung that comes later and is itself
    // gone does not get consulted at all once that happens.
    //
    // THE 404 BODY HAS TO BE THE LARGER READ, and that is the whole reason it
    // is shaped this way. Every cross-rung test on this branch once used a
    // vetoed body SMALLER than the stub, so the fallback reducer - largest
    // prose volume wins - picked the same read `proven` picks and `proven`
    // discriminated nothing: deleting it left the entire suite green. The body
    // below is the shape the corpus's real ECB capture has, heavy navigation
    // chrome served at 404 (13,452 extracted characters there), reproduced
    // inline rather than read from fixtures/corpus.json because this file
    // deliberately holds no fixture reads - and because a test whose
    // discriminating power depends on a captured file's SIZE would degrade
    // silently the day that file was re-captured. The two assertions below
    // pin the property instead of trusting it.
    const shortStub = `<html><body><p>The committee report states that spending rose sharply.</p></body></html>`;
    const gone = `<html><body><nav>${"Home Publications Statistics Press Media Careers Legal notice Privacy statement Accessibility Sitemap Contact. ".repeat(130)}</nav><p>The page you requested could not be found.</p></body></html>`;
    expect(proseVolume(toText(gone))).toBeGreaterThan(proseVolume(toText(shortStub)));
    expect(proseVolume(toText(gone))).toBeGreaterThanOrEqual(THRESHOLDS.minProseChars);
    const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: shortStub, status: 200 }, curl: { rawBody: gone, status: 404 } }),
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

  it("rejects an empty or whitespace-only claim rather than attesting to it - now through the floor", async () => {
    // "".includes("") is true, so an empty claim matches EVERY document and
    // would mint `supported` with a null excerpt. parseClaimsFile protects the
    // CLI; check() is the exported front door and defends itself.
    // Since the claim floor landed this is refused BY the floor - all three
    // fold to 0 characters - and the message is the floor's. The predicate is
    // unchanged: it is still norm(), not trim().
    for (const bad of ["", "   ", "\t\n"]) {
      await expect(
        check("https://e.com/a", [bad], { fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }) }),
      ).rejects.toThrow(/0 characters once normalized/);
    }
    // An empty ARRAY is still legitimate - that is `unclaimed`, tested above.
    await expect(
      check("https://e.com/a", ["a real claim that clears the floor", ""], { fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }) }),
    ).rejects.toThrow(/index 1/);
  });

  it("REFUSES a claim under the floor at the front door, before any fetch", async () => {
    // The same refusal as the loader's, at the exported front door, with the
    // same message builder - spec 7.3 requires the three doors to agree.
    // Asserted BEFORE any IO: a caller bug is not a fetch failure, and a run
    // that spends twenty fetches before refusing its own input wastes the
    // author's time and the host's.
    let fetched = 0;
    const counting: Fetcher = {
      rungs: ["node", "curl"] as RungId[],
      async fetch(url) {
        fetched += 1;
        return { rawBody: LONG_PROSE, status: 200, headers: {}, finalUrl: url, bytes: 0 };
      },
    };
    const short = "x".repeat(THRESHOLDS.minClaimChars - 1);
    await expect(check("https://e.com/a", [short], { fetcher: counting })).rejects.toThrow(
      /characters once normalized/,
    );
    expect(fetched).toBe(0);
  });

  it("accepts a claim exactly at the floor", async () => {
    // Both strings are built from the constant, so Task 2 re-deriving the
    // floor cannot turn this boundary test red for the wrong reason.
    const atFloor = "y".repeat(THRESHOLDS.minClaimChars);
    const body = `<html><title>The Committee Report</title><body>${`The report says ${atFloor} here. `.repeat(200)}</body></html>`;
    const r = await check("https://e.com/a", [atFloor], {
      fetcher: stub({ node: { rawBody: body, status: 200 } }),
    });
    expect(r.verdict).toBe("supported");
  });

  it("rejects a claim that survives trim() but NORMALIZES to empty", async () => {
    // The guard has to test the predicate the MATCHER uses. norm() deletes
    // commas and zero-width characters, so each of these normalizes to "" and
    // matches every document - while JS trim() sees a non-empty string and
    // waves it through. That minted `supported` with a null excerpt: an
    // attestation with nothing behind it, and reachable from the CLI, because
    // parseClaimsFile tested the same wrong predicate.
    // Since the claim floor landed this is refused BY the floor - all three
    // fold to 0 characters - and the message is the floor's. The predicate is
    // unchanged: it is still norm(), not trim().
    for (const bad of [",", ",,,", "\u200b"]) {
      await expect(
        check("https://e.com/a", [bad], { fetcher: stub({ node: { rawBody: LONG_PROSE, status: 200 } }) }),
        JSON.stringify(bad),
      ).rejects.toThrow(/0 characters once normalized/);
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

  it("never lets a VETOED rung's match contribute to the union", async () => {
    // The union's dangerous edge. `node` reads a genuine sub-floor article
    // carrying c1, so the ladder escalates; `curl` returns a short wall whose
    // own boilerplate happens to carry c2. Assembling matches across every read
    // without asking whether each read was VETOED made the union complete and
    // minted `supported` - quoting the wall's own sentence as the passage
    // behind c2. A challenge body cannot be the document (spec 6.2), so a match
    // inside one is the wall's text and proves nothing about the citation.
    const c1 = "spending rose sharply";
    const c2 = "before you continue";
    const shortReal = `<html><body><p>${`The committee report states that ${c1}. `.repeat(8)}</p></body></html>`;
    // Both veto routes, because the two arrive by different signals: N1 fires
    // at any length, N3 only below maxChallengeChars.
    const sigWall = `<html><body><p>Just a moment ${c2}.</p></body></html>`;
    const walls: { name: string; per: Parameters<typeof stub>[0] }[] = [
      { name: "N3 signature wall", per: { node: { rawBody: shortReal, status: 200 }, curl: { rawBody: sigWall, status: 200 } } },
      { name: "N1 header wall", per: { node: { rawBody: shortReal, status: 200 }, curl: { rawBody: `<html><body><p>Please wait ${c2}.</p></body></html>`, status: 200, headers: { "cf-mitigated": "challenge" } } } },
    ];
    for (const w of walls) {
      const r = await check("https://e.com/committee-report", [c1, c2], { fetcher: stub(w.per) });
      expect(r.rungsAttempted, w.name).toEqual(["node", "curl"]);
      // The whole point: no false attestation, and nothing quoting the wall.
      expect(r.verdict, w.name).toBe("unreachable");
      expect(r, w.name).not.toHaveProperty("evidence");
    }

    // And when the winning read DOES clear the floor, the wall-only claim has
    // to land in `missed` rather than vanish: `node` is the wall carrying c2,
    // `curl` the real document carrying only c1.
    const longReal = `<html><title>The Committee Report</title><body>${`The committee report states that ${c1}. `.repeat(120)}</body></html>`;
    const r = await check("https://e.com/committee-report", [c1, c2], {
      fetcher: stub({ node: { rawBody: sigWall, status: 200 }, curl: { rawBody: longReal, status: 200 } }),
    });
    expect(r.verdict).toBe("unsupported");
    expect(r.missed).toEqual([c2]);
  });

  it("attributes evidence to the CLEAN read when a vetoed read located the same claim", async () => {
    // `locatedBy` keeps the first read to match, so before the veto skip a
    // wall that carried the claim outranked the later clean read that actually
    // proved it - the verdict was right and the published passage came from the
    // wall. Here `node` is a challenge shell that happens to quote the claim
    // and `curl` is the real document.
    const claim = "spending rose sharply";
    const wall = `<html><body><p>Just a moment. The committee report states that ${claim}.</p></body></html>`;
    const real = `<html><title>The Committee Report</title><body>${`The committee report states that ${claim}. `.repeat(120)}</body></html>`;
    const r = await check("https://e.com/committee-report", [claim], {
      fetcher: stub({ node: { rawBody: wall, status: 200 }, curl: { rawBody: real, status: 200 } }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("supported");
    expect(r.evidence?.map((e) => e.rung)).toEqual(["curl"]);
    expect(r.evidence?.[0]?.excerpt).not.toBeNull();
    // The wall's own opening must not be what the reader is shown.
    expect(r.evidence?.[0]?.excerpt).not.toContain("Just a moment");
  });

  it("INVARIANT: an unsupported verdict always names at least one missed claim", async () => {
    // `unsupported` fails a build. A CI failure that names nothing is worse
    // than no check at all, and the schema cannot express the reason anywhere
    // else: `evidence` - present on `unsupported` too, since 0.2.0 section 2 -
    // names only the claims that DID match, never the ones that failed, so
    // `missed` is the only field that can name a failure. Asserted as a
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

  it("climbs past a first rung vetoed only by N4 - a 404 carrying a full page of chrome", async () => {
    // Spec 6.6, "Escalation": climb unless the last read is readable. At
    // 6546176 this file's copy of the ladder climbed on N1, N2 and N3 only, so
    // a first rung answering 404 with a body over the floor ENDED the ladder -
    // while reachability's copy climbed on all five vetoes. Written before the
    // reader was unified, this failed with rungsAttempted ["node"] and the
    // verdict "unreachable": the proof that no test covered the seam.
    const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: LONG_PROSE, status: 404 }, curl: { rawBody: LONG_PROSE, status: 200 } }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("supported");
    expect(r.evidence?.[0]?.rung).toBe("curl");
  });

  it("climbs past a first rung vetoed only by N5 - a non-text content-type over the floor", async () => {
    const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
      fetcher: stub({
        node: { rawBody: LONG_PROSE, status: 200, headers: { "content-type": "application/pdf" } },
        curl: { rawBody: LONG_PROSE, status: 200 },
      }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("supported");
    expect(r.evidence?.[0]?.rung).toBe("curl");
  });

  it("I1: resolves rather than rejects when the PDF re-route's own fetch throws", async () => {
    // Measured before the fix: a fetcher that throws on the "pdftotext" rung
    // during the PDF re-route (src/fetch/read-source.ts's climb(), the
    // second fetch site) rejected check()'s returned promise outright -
    // "REJECTED: boom on pdftotext - the whole check() throws" - which
    // bin.ts turns into exit 2 for the entire document, not just this one
    // citation. The ladder's own rung fetch already degrades a throwing
    // fetcher to EMPTY_RESPONSE with a warning; the re-route now matches it.
    const pdfBody = "%PDF-1.4" + "   " + "not-text-stream-data";
    const fetcher: Fetcher = {
      rungs: ["node", "curl", "pdftotext"],
      async fetch(url, rung) {
        if (rung === "pdftotext") throw new Error("boom on pdftotext");
        return {
          rawBody: pdfBody,
          status: 200,
          headers: { "content-type": "application/pdf" },
          finalUrl: url,
          bytes: pdfBody.length,
        };
      },
    };
    // The await itself is the resolves-not-rejects assertion: were check()
    // still rejecting here, this test would fail with an unhandled rejection
    // rather than reach the expectations below.
    const r = await check("https://example.com/doc", ["quick brown fox jumps"], { fetcher });
    expect(r.rungsAttempted).toEqual(["node", "pdftotext"]);
    expect(r.verdict).toBe("unreachable");
  });

  it("climbs past a first rung vetoed only by N4 and ACCUSES from the readable second read", async () => {
    // The same escalation, where the readable second read carries only some
    // of the claims. This is the one place Task 2 moves a verdict toward an
    // accusation: at 6546176 the ladder stopped at the 404 and answered
    // `unreachable`; now it climbs, and the curl read - the largest read, no
    // veto, over the floor - is judged on its own and names what it lacks.
    // That is within the keystone rule (a readable read is positive proof of
    // a read) and it is disclosed in the CHANGELOG (Task 7).
    //
    // The curl body is asserted LARGER than the node body. Until Task 4 lands
    // rule 2, `check` still hands a prose tie to the first read, which here
    // is the vetoed 404: with equal bodies this pin would answer
    // `unreachable` after this task and only turn `unsupported` after
    // Task 4. The ordering keeps this a pin on escalation alone.
    const largerReport = `<html><title>The Committee Report</title><body>${"The committee report states that spending rose sharply. ".repeat(150)}</body></html>`;
    expect(proseVolume(toText(largerReport))).toBeGreaterThan(proseVolume(toText(LONG_PROSE)));
    const r = await check("https://e.com/committee-report", ["spending rose sharply", "revenue fell in the fourth quarter"], {
      fetcher: stub({ node: { rawBody: LONG_PROSE, status: 404 }, curl: { rawBody: largerReport, status: 200 } }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("unsupported");
    expect(r.missed).toEqual(["revenue fell in the fourth quarter"]);
    // 0.2.0: the claim that DID match is still carried as evidence.
    expect(r.evidence?.[0]?.claims).toEqual(["spending rose sharply"]);
  });

  it("a readable read outranks a LARGER vetoed one, and names what it did not carry (rule 2)", async () => {
    // Spec 6.6 rule 2 - the one aggregation change plan 1.2 makes, and one of
    // the two changes in the plan that can move a verdict toward accusation
    // (the other is Task 2's escalation, which accuses only when the readable
    // read is also the largest; this rule drops that condition, equal-prose
    // ties included). It does so only where a READABLE read exists to accuse
    // from. `node` is a fat challenge page over the floor - vetoed by N2, a
    // challenge PATH, rather than N1, so the wall carries a firedRule whose
    // absence from the result is asserted below; `curl` is the document,
    // smaller but readable, carrying one of the two claims. At 6546176 the
    // largest read won regardless of readability, the verdict was computed on
    // the wall, and the answer was `unreachable` - hiding a partial miss that
    // a readable read had positively shown. Written first, this failed with
    // `expected 'unreachable' to be 'unsupported'`.
    //
    // The size ordering is asserted, not assumed: the test discriminates only
    // while the vetoed read is the larger one.
    const smallerReadable = `<html><title>The Committee Report</title><body>${"The committee report states that spending rose sharply. ".repeat(90)}</body></html>`;
    expect(proseVolume(toText(smallerReadable))).toBeGreaterThanOrEqual(THRESHOLDS.minProseChars);
    expect(proseVolume(toText(smallerReadable))).toBeLessThan(proseVolume(toText(LONG_PROSE)));
    const r = await check("https://e.com/committee-report", ["spending rose sharply", "no such phrase appears here"], {
      fetcher: stub({
        node: { rawBody: LONG_PROSE, status: 200, finalUrl: "https://e.com/cdn-cgi/challenge-platform/h/b" },
        curl: { rawBody: smallerReadable, status: 200 },
      }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("unsupported");
    expect(r.missed).toEqual(["no such phrase appears here"]);
    // 0.2.0 (io/evidence.ts): an unsupported result now keeps the passage
    // that DID match, alongside the miss list.
    expect(r.evidence?.[0]?.claims).toEqual(["spending rose sharply"]);
    // At 6546176 the wall won and its Cloudflare path rule rode along as
    // provenance; the readable read fired no rule, so none is reported.
    expect(r).not.toHaveProperty("firedRule");
  });

  it("ACCEPTED EXPOSURE: a gone document whose chrome is served at 200 to a later rung is accused from that read", async () => {
    // Fable F1 on this plan. The node rung answers 404 with a full page of
    // navigation chrome (N4, over the floor); the curl rung answers the SAME
    // chrome at 200 - the shape of a CDN or mirror that has lost the status
    // but kept the error page. Escalation (Task 2) brings the ladder to the
    // curl read; rule 2 makes that read win although it is no larger than
    // the vetoed one; and the read is judged on its own: no veto, over the
    // floor, none of the claims - `unsupported`, on a document the origin
    // said was gone. This is the README's chrome-at-200 route reached
    // through the ladder instead of directly. It is accepted for the same
    // reason that route is: the 200 read is, by every signal the classifier
    // has, a readable document, and refusing it would refuse every readable
    // second read that follows a 404. Disclosed in the README (Task 7).
    //
    // Written first, this failed with `expected 'unreachable' to be
    // 'unsupported'`: after Task 2 the ladder climbs, but the tie between two
    // equal-prose reads still went to the first, vetoed one.
    const CHROME = `<html><title>Page not found</title><body>${"Browse our publications, statistics and press releases. ".repeat(120)}</body></html>`;
    expect(proseVolume(toText(CHROME))).toBeGreaterThanOrEqual(THRESHOLDS.minProseChars);
    const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: CHROME, status: 404 }, curl: { rawBody: CHROME, status: 200 } }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("unsupported");
    expect(r.missed).toEqual(["spending rose sharply"]);
  });

  it("ACCEPTED EXPOSURE: a full match assembled across two sub-floor reads is supported (rule 3's inherited shape)", async () => {
    // No read is readable and neither matches in full on its own, yet between
    // them the two non-vetoed stubs carry every claim. Rule 3 reaches
    // `unreachable` through verdict() on the largest read, exactly as 6546176
    // did, and verdict() answers `supported` for an unvetoed read whose union
    // match count is complete. This is the sub-floor-stub exposure the two
    // ACCEPTED EXPOSURE tests above accept, in its union form, pinned so the
    // shape is a choice and not an accident. It fails if rule 3 is ever
    // rewritten to refuse every sub-floor read - which would be a licensed
    // change only with a spec amendment.
    const c1 = "spending rose sharply";
    const c2 = "the review is ongoing";
    const stub1 = `<html><body><p>The committee report states that ${c1}.</p></body></html>`;
    const stub2 = `<html><body><p>Separately, ${c2}, the committee said.</p></body></html>`;
    const r = await check("https://e.com/committee-report", [c1, c2], {
      fetcher: stub({ node: { rawBody: stub1, status: 200 }, curl: { rawBody: stub2, status: 200 } }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("supported");
    expect(r.evidence?.map((e) => e.rung)).toEqual(["node", "curl"]);
  });

  it("ACCEPTED EXPOSURE: a sub-floor stub on the second rung attests a claim the origin said was gone (rule 1 through the escalation)", async () => {
    // rule 1 - "a full match proves a read, whatever its prose volume" -
    // reached through the escalation: at 6546176 the ladder stopped on
    // the 404 and answered `unreachable`; now it climbs, and the stub
    // attests. Licensed by spec 6.6 rule 1, disclosed by README's 404
    // bullet, and the second-worst outcome class in the keystone rule
    // (a false attestation), so the shape is pinned as a choice.
    const CHROME = `<html><title>Page not found</title><body>${"Browse our publications, statistics and press releases. ".repeat(120)}</body></html>`;
    const STUB = "<html><body><p>The committee report states that spending rose sharply.</p></body></html>";
    // The shape is the point: the 404 body is over the floor, the stub under it.
    expect(proseVolume(toText(CHROME))).toBeGreaterThanOrEqual(THRESHOLDS.minProseChars);
    expect(proseVolume(toText(STUB))).toBeLessThan(THRESHOLDS.minProseChars);
    const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
      fetcher: stub({ node: { rawBody: CHROME, status: 404 }, curl: { rawBody: STUB, status: 200 } }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("supported");
    expect(r.evidence?.[0]?.rung).toBe("curl");
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
    // ECB 404 serving 13,452 characters of navigation chrome, and with the
    // veto removed zero thresholds satisfied the acceptance test.
    //
    // The cost is recorded and accepted: a misconfigured host serving a
    // real document under a 404 - with nothing readable from a later rung,
    // as here, where curl answers the stub's empty default - loses its
    // evidence. That degrades to unreachable, which renders nothing and
    // fails nothing - the safe direction.
    for (const status of [404, 410]) {
      const r = await check("https://e.com/committee-report", ["spending rose sharply"], {
        fetcher: stub({ node: { rawBody: LONG_PROSE, status } }),
      });
      expect(r.verdict, `status ${status}`).toBe("unreachable");
      expect(r, `status ${status}`).not.toHaveProperty("evidence");
    }
  });
});

describe("N3 through the cross-read union (spec 6.3; plan 1.2 ledger R13)", () => {
  // The spec said the signature list "can withhold an accusation, never
  // supply one". It supplies one here. check.ts's union loop skips a VETOED
  // read's matches (a match inside a wall is the wall's text), so a claim
  // that ONLY the vetoed read carried is named in `missed` when a readable
  // later rung is judged - and removing the signature phrase, changing
  // nothing else, turns the same pair of responses into `supported`. The
  // veto is the but-for cause of the accusation.
  //
  // Pre-existing at 6546176: the union machinery is unchanged from it, and
  // N3 fires only under maxChallengeChars, so a vetoed N3 read is never the
  // larger read rule 2 chooses between. Plan 1.2 did not cause this and did
  // not fix it (ledger R13); this is the reviewed dispatch R13 asked for.
  const A = "spending rose sharply";
  const B = "the review is ongoing";
  // Under maxChallengeChars (800 extracted characters) - N3's length
  // conjunction - carrying a bundled signature ("just a moment") AND claim A.
  const WALL = `<html><body><p>Just a moment...</p><p>The committee report states that ${A}.</p></body></html>`;
  // Byte-for-byte the same but for the signature phrase.
  const NO_SIGNATURE = `<html><body><p>One moment please.</p><p>The committee report states that ${A}.</p></body></html>`;
  // Readable: over the prose floor, carrying B and NOT A.
  const READABLE = `<html><title>The Committee Report</title><body>${`Separately, ${B}, the committee said. `.repeat(140)}</body></html>`;

  it("a signature veto SUPPLIES an accusation the readable read alone would not", async () => {
    // The shapes the test's power rests on are asserted, not assumed.
    expect(proseVolume(toText(WALL))).toBeLessThan(THRESHOLDS.maxChallengeChars);
    expect(proseVolume(toText(READABLE))).toBeGreaterThanOrEqual(THRESHOLDS.minProseChars);
    expect(toText(READABLE)).not.toContain(A);

    const r = await check("https://e.com/committee-report", [A, B], {
      fetcher: stub({ node: { rawBody: WALL, status: 200 }, curl: { rawBody: READABLE, status: 200 } }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("unsupported");
    expect(r.missed).toEqual([A]);
    // The wall leaves no trace on the result it caused: `won` is the readable
    // read, which fired no rule. 0.2.0 (amends spec 7.4): an unsupported
    // result now carries evidence for the claim that DID match (B), even
    // though A is the one named as missed.
    expect(r).not.toHaveProperty("firedRule");
    expect(r.evidence?.[0]?.claims).toEqual([B]);
  });

  it("the same body without the signature phrase is supported, from the same two responses", async () => {
    expect(proseVolume(toText(NO_SIGNATURE))).toBeLessThan(THRESHOLDS.maxChallengeChars);

    const r = await check("https://e.com/committee-report", [A, B], {
      fetcher: stub({ node: { rawBody: NO_SIGNATURE, status: 200 }, curl: { rawBody: READABLE, status: 200 } }),
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("supported");
    // A from the sub-floor node read, B from the readable curl read: rule 3's
    // union, which the vetoed run above cannot reach.
    expect(r.evidence?.map((e) => e.rung)).toEqual(["node", "curl"]);
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
    boilerplate: [], // harvest's list; no bearing on check()
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

  it("carries firedRule as provenance on an unreachable verdict, with no renderable evidence", async () => {
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
      vetoed: true,
    });
    // Still no renderable fields on a non-supported verdict - firedRule is
    // provenance, not evidence.
    expect(r).not.toHaveProperty("evidence");
    expect(r).not.toHaveProperty("retrievedAt");
  });

  it("marks a signature that matched a body too long to veto as vetoed: false", async () => {
    // The padded-wall trace (README, known gaps): the signature matched, the
    // body is past maxChallengeChars so it vetoed nothing, and the verdict was
    // computed as for any page. firedRule stays - it is the only visible trace
    // of that gap - and now says it did not decide the verdict.
    const LONG =
      `<html><body>The committee report states that ${CLAIM}. Please solve the puzzle to continue. ` +
      `${"Background material about budgets and departmental process. ".repeat(20)}</body></html>`;
    expect(proseVolume(toText(LONG))).toBeGreaterThanOrEqual(THRESHOLDS.maxChallengeChars);
    const r = await check("https://e.com/a", [CLAIM], {
      fetcher: stub({ node: { rawBody: LONG, status: 200 } }, ["node"]),
      rules: RULES_WITH_LOCAL_SIGNATURE,
    });
    expect(r.verdict).toBe("supported");
    expect(r.firedRule).toEqual({
      lastConfirmed: "2026-08-01",
      note: "local puzzle wall, unknown to the bundled list",
      vetoed: false,
    });
  });

  it("reports the ESCALATED winner's own firedRule and vetoed, never the first read's", async () => {
    // check()'s escalation (spec 0.2.0 section 4): node reads a readable page
    // that misses the claim, so check() tries curl before accusing. curl is
    // larger, readable, and carries a signature on a body far too long to
    // veto. The winner moves to curl, and firedRule - with its vetoed - must
    // come from curl, the read the verdict was computed from.
    const MISS = "revenue fell in the fourth quarter";
    const filler = (s: string) => `${s} `.repeat(120);
    const nodeBody = `<html><body>${filler("The committee report discusses departmental budgets at length.")}</body></html>`;
    const curlBody =
      `<html><body>${filler("The committee report discusses departmental budgets at length.")}` +
      `${filler("Further background on procurement practices and staffing.")} Please solve the puzzle to continue.</body></html>`;
    expect(proseVolume(toText(nodeBody))).toBeGreaterThanOrEqual(THRESHOLDS.minProseChars);
    expect(proseVolume(toText(curlBody))).toBeGreaterThan(proseVolume(toText(nodeBody)));
    const r = await check("https://e.com/a", [MISS], {
      fetcher: stub({ node: { rawBody: nodeBody, status: 200 }, curl: { rawBody: curlBody, status: 200 } }),
      rules: RULES_WITH_LOCAL_SIGNATURE,
    });
    expect(r.rungsAttempted).toEqual(["node", "curl"]);
    expect(r.verdict).toBe("unsupported");
    expect(r.firedRule).toEqual({
      lastConfirmed: "2026-08-01",
      note: "local puzzle wall, unknown to the bundled list",
      vetoed: false,
    });
  });

  it("marks a challenge-path veto as vetoed: true", async () => {
    const r = await check("https://e.com/a", [CLAIM], {
      fetcher: stub({ node: { rawBody: SHORT_WALL_BODY, status: 200, finalUrl: "https://e.com/cdn-cgi/challenge-platform/h/b" } }, ["node"]),
    });
    expect(r.verdict).toBe("unreachable");
    expect(r.firedRule).toEqual({ lastConfirmed: "2026-09-06", note: "Cloudflare challenge platform.", vetoed: true });
  });
});

describe("check: identity wiring (CheckOptions -> FetcherOptions)", () => {
  // A stub fetcher on CheckOptions.fetcher bypasses buildFetcher's
  // defaultFetcher branch entirely (src/fetch/build-fetcher.ts - shared with
  // harvest(), reachability() and recheck()'s live arm since Task 16), so a
  // test that exercises check() with a stub fetcher can never observe
  // whether the identity wire exists. These tests assert against
  // defaultFetcher/userAgentFor directly, and pin the wire itself: a value
  // set on CheckOptions must arrive at FetcherOptions unchanged.

  it("supplies the declared identity to a host that requires one", () => {
    const withId = defaultFetcher({ identity: "example-app contact@example.com" });
    const withoutId = defaultFetcher({});
    // userAgentFor warns and falls back to a browser UA when identity is absent.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const a = userAgentFor("https://www.sec.gov/some/filing", { identity: "example-app contact@example.com" });
      const b = userAgentFor("https://www.sec.gov/some/filing", {});
      expect(a).toBe("example-app contact@example.com");
      expect(b).not.toBe(a);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
    expect(withId).toBeDefined();
    expect(withoutId).toBeDefined();
  });

  it("CheckOptions.identity reaches FetcherOptions", async () => {
    // The wire itself: a value set on CheckOptions must arrive at
    // defaultFetcher. Assert by type and by construction - check() must
    // accept the field and must not drop it. Read check()'s buildFetcher(...)
    // call (src/check.ts) and pin the object it forwards.
    const opts: CheckOptions = { identity: "example-app contact@example.com" };
    expect(opts.identity).toBe("example-app contact@example.com");
  });

  it("check() itself forwards CheckOptions.identity into the defaultFetcher(...) call at the construction site", async () => {
    // The two tests above pin the two halves (userAgentFor's behavior given
    // an identity, and that CheckOptions can carry one) but neither one
    // actually runs check()'s construction line, so neither can catch a
    // regression THERE specifically. This test replaces the real
    // defaultFetcher with a spy and drives it through the public check()
    // entry point with no opts.fetcher override, so the only path an
    // identity can travel is check()'s call into buildFetcher
    // (src/fetch/build-fetcher.ts), which is what actually calls
    // defaultFetcher.
    //
    // The spy's fetcher reports zero rungs, so ladder.ts's nextAction never
    // finds a rung to try and readSource never calls fetch() - this proves
    // the wire without ever touching the network.
    vi.resetModules();
    const defaultFetcherSpy = vi.fn((_opts: FetcherOptions = {}) => ({
      rungs: [] as RungId[],
      fetch: async () => {
        throw new Error("must not be called: rungs is empty");
      },
    }));
    vi.doMock("../src/fetch/default-fetcher.js", () => ({ defaultFetcher: defaultFetcherSpy }));
    try {
      const { check: checkWithMockedFetcher } = await import("../src/check.js");

      await checkWithMockedFetcher("https://e.com/a", [], {
        identity: "example-app contact@example.com",
      });
      expect(defaultFetcherSpy).toHaveBeenCalledTimes(1);
      expect(defaultFetcherSpy.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({ identity: "example-app contact@example.com" }),
      );

      defaultFetcherSpy.mockClear();
      await checkWithMockedFetcher("https://e.com/a", []);
      expect(defaultFetcherSpy).toHaveBeenCalledTimes(1);
      expect(defaultFetcherSpy.mock.calls[0]?.[0]).not.toHaveProperty("identity");
    } finally {
      vi.doUnmock("../src/fetch/default-fetcher.js");
      vi.resetModules();
    }
  });
});
