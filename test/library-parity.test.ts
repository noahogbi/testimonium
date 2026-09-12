import { describe, expect, it } from "vitest";
import {
  check,
  classifyRun,
  joinClaims,
  parseClaimsFile,
  parseGfmFootnotes,
  type CitationResult,
  type Fetcher,
  type RawResponse,
  type RunTally,
} from "../src/index.js";

/**
 * Task 14's acceptance test. Everything below comes from `../src/index.js` -
 * nothing else. That import list is the actual thing under test: if a later
 * change removes one of these names from the exports map, this file fails to
 * import (proven in the task report, not here - removing it from src/ would
 * be a src/ change, which this test-only task may not make).
 *
 * What is asserted is exactly `CitationResult[]` and the exit code -
 * `check()`'s output and `classifyRun()`'s output - not evidence-file bytes,
 * not stdout, not the archive. Those stay sealed (spec's own words: "the
 * criterion is scoped so it is satisfiable").
 *
 * No CLI process is spawned anywhere in this file. `src/bin.ts` builds its
 * own `defaultFetcher` and cannot be handed a stub, so a subprocess test
 * would make live network calls; instead this file drives the same four
 * steps `main()`'s `check` branch drives - parse, then `check()` per URL,
 * then tally, then `classifyRun` - directly, against a fetcher this file
 * owns.
 */

// The RawResponse field shape (rawBody, status, headers, finalUrl, bytes) is
// copied from test/check.test.ts's `stub()` rather than invented here.
function fetcherFor(bodies: Readonly<Record<string, string>>): Fetcher {
  return {
    rungs: ["node", "curl"],
    async fetch(url): Promise<RawResponse> {
      const rawBody = bodies[url] ?? "";
      return { rawBody, status: rawBody ? 200 : 404, headers: {}, finalUrl: url, bytes: rawBody.length };
    },
  };
}

const SUPPORTING_PROSE = `<html><title>Committee Annual Report</title><body>${"The committee's own filing states that spending rose sharply last year. ".repeat(80)}</body></html>`;
const OFF_TOPIC_PROSE = `<html><title>City Growth Announcement</title><body>${"The city's announcement covers roadwork schedules and a routine budget line item. ".repeat(80)}</body></html>`;

const DOC = `The committee's own filing says spending rose sharply last year.[^1] The city's own announcement covers unrelated municipal matters.[^2]

[^1]: Committee Annual Report. https://example.com/committee-report
[^2]: City Growth Announcement. https://example.com/city-announcement
`;

const COMMITTEE_URL = "https://example.com/committee-report";
const CITY_URL = "https://example.com/city-announcement";

/**
 * Drives the same four steps `main()`'s `check` branch drives in
 * src/bin.ts, against `fetcher`, and returns exactly what a library consumer
 * gets back: the per-citation `CitationResult[]` and the exit code.
 */
async function runCheckLikeTheCli(
  claimsJson: string,
  fetcher: Fetcher,
): Promise<{ results: CitationResult[]; exitCode: 0 | 1 | 2 }> {
  const document = parseGfmFootnotes(DOC);
  const claims = parseClaimsFile(claimsJson);
  const joined = joinClaims(document.footnotes, claims);

  const results: CitationResult[] = [];
  let unsupported = 0;
  let unreachable = 0;
  for (const c of joined.checkable) {
    const r = await check(c.url, c.claims, { sourceLabel: c.label, fetcher });
    results.push(r);
    if (r.verdict === "unsupported") unsupported++;
    else if (r.verdict === "unreachable") unreachable++;
  }

  const tally: RunTally = {
    unsupported,
    unclaimed: joined.unclaimed.length,
    unreachable,
    orphaned: joined.orphanedClaims.length,
    infrastructure: false,
  };
  // Same defaults `main()` passes with neither --fail-on-unreachable nor
  // --allow-unclaimed on the argv (src/bin.ts's classifyRun call).
  const exitCode = classifyRun(tally, { unreachable: false, unclaimed: true });
  return { results, exitCode };
}

describe("library parity: importing only src/index.js reproduces the CLI's results and exit code", () => {
  it("one supported, one unsupported citation -> matching verdicts and exit 1", async () => {
    const claimsJson = JSON.stringify({
      [COMMITTEE_URL]: ["spending rose sharply"],
      [CITY_URL]: ["population doubled in a decade"],
    });
    const fetcher = fetcherFor({ [COMMITTEE_URL]: SUPPORTING_PROSE, [CITY_URL]: OFF_TOPIC_PROSE });

    const { results, exitCode } = await runCheckLikeTheCli(claimsJson, fetcher);

    expect(results).toHaveLength(2);
    expect(results[0]?.url).toBe(COMMITTEE_URL);
    expect(results[0]?.verdict).toBe("supported");
    expect(results[1]?.url).toBe(CITY_URL);
    expect(results[1]?.verdict).toBe("unsupported");
    expect(results[1]?.missed).toEqual(["population doubled in a decade"]);

    // unsupported > 0 dominates: classifyRun's own doc comment, reproduced
    // by a caller that never touches classifyRun's source.
    expect(exitCode).toBe(1);
  });

  it("both citations supported -> exit 0, the CLI's clean run", async () => {
    const claimsJson = JSON.stringify({
      [COMMITTEE_URL]: ["spending rose sharply"],
      [CITY_URL]: ["roadwork schedules"],
    });
    const fetcher = fetcherFor({ [COMMITTEE_URL]: SUPPORTING_PROSE, [CITY_URL]: OFF_TOPIC_PROSE });

    const { results, exitCode } = await runCheckLikeTheCli(claimsJson, fetcher);

    expect(results.map((r) => r.verdict)).toEqual(["supported", "supported"]);
    expect(exitCode).toBe(0);
  });
});
