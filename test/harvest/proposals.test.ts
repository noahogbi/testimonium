import { describe, it, expect } from "vitest";
import { harvest } from "../../src/harvest.js";
import { parseGfmFootnotes } from "../../src/adapters/gfm-footnotes.js";
import type { Fetcher, RawResponse, RungId } from "../../src/fetch/types.js";

// No fixture reads, as in test/harvest.test.ts.
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

const WALL = "<html><body>Verifying you are human.</body></html>";
const FILLER = "<p>Background material about budgets and departmental process.</p>".repeat(120);

/** Drives the real harvest() over a footnoted document and a stub fetcher,
 *  and flattens every proposal's kept claims into one list - modeled on
 *  test/harvest.test.ts's own use of harvest() plus parseGfmFootnotes(). */
async function harvestDraft(markdown: string, fetcher: Fetcher): Promise<{ allClaims: string[] }> {
  const doc = parseGfmFootnotes(markdown);
  const r = await harvest(doc, { fetcher });
  return { allClaims: r.proposals.flatMap((p) => p.claims) };
}

describe("harvest proposals are check-matchable (per region)", () => {
  it("proposes no span that spans a region join", async () => {
    // Pre-change, harvest proposes the spanning phrase and the post-Task-3
    // check() then returns `unsupported` for it - the tool accusing an author
    // over its own suggestion, which is spec criterion 3's forbidden outcome.
    const spanning = "reviewed the quarterly filings without objection at the March session";

    // The draft's own prose carries the phrase verbatim, in one flat run - a
    // draft has no regions of its own to split it across.
    const md = [
      "Our draft says the committee reviewed the quarterly filings without " +
        "objection at the March session, which matters.[^1]",
      "",
      "A second point rests on a source nobody can read.[^2]",
      "",
      "[^1]: The Committee Report, https://e.com/report",
      "[^2]: A second outlet, https://f.com/story",
      "",
    ].join("\n");

    // The SOURCE page's only long run shared with the draft SPANS the join
    // between its body region and its description region: the body ends on
    // "...reviewed the" and the description opens on "quarterly filings...".
    // toText() (the old flat string harvest matched against) concatenates
    // them with one space and reads the whole phrase straight through; no
    // single region ever does (test/harvest/regions.test.ts pins that half).
    const page =
      `<meta name="description" content="quarterly filings without objection at the March session.">` +
      `<html><title>The Committee Report</title><body>${FILLER}<p>The committee reviewed the</p></body></html>`;

    const draft = await harvestDraft(md, stub({
      "https://e.com/report": { rawBody: page, status: 200 },
      "https://f.com/story": { rawBody: WALL, status: 202 },
    }));

    for (const claim of draft.allClaims) expect(claim).not.toContain(spanning);
    // THE POSITIVE CONTROL. The loop above passes over an empty list, so on its
    // own it could not tell "harvest refused the spanning phrase" from "harvest
    // proposed nothing". Per-region scanning splits the phrase into the two
    // real runs either side of the join, each inside one region - measured
    // 2026-09-23 against this exact page. Reverting per-region scanning
    // proposes the spanning run instead, and this equality goes red.
    expect(draft.allClaims).toEqual([
      "The committee reviewed the",
      "quarterly filings without objection at the March session",
    ]);
  });
});
