import { describe, expect, it } from "vitest";
import { check } from "../src/check.js";
import { reachability } from "../src/reachability.js";
import type { Fetcher, RawResponse, RungId } from "../src/fetch/types.js";

// README, "Commands": on the same responses, judged by the same rules, a URL
// `reachability` calls readable is one `check` never calls `unreachable`,
// and one it calls unreadable is one `check` never calls `unsupported`.
// Both halves follow from spec 6.6: the gate accuses only from a readable
// read (rules 1-3), the preflight calls a URL readable iff some read is
// readable (rule 5), and both judge the same reads (one `readSource`).
// NO fixture reads here, as in check.test.ts.

function stub(per: Partial<Record<RungId, Partial<RawResponse>>>): Fetcher {
  return {
    rungs: ["node", "curl"] as RungId[],
    async fetch(url, rung) {
      return { rawBody: "", status: 0, headers: {}, finalUrl: url, bytes: 0, ...(per[rung] ?? {}) } as RawResponse;
    },
  };
}

const URL = "https://e.com/committee-report";
const DOC = `<html><title>The Committee Report</title><body>${"The committee report states that spending rose sharply. ".repeat(120)}</body></html>`;
const STUB_1 = "<html><body><p>The committee report states that spending rose sharply.</p></body></html>";
const STUB_2 = "<html><body><p>Separately, the review is ongoing, the committee said.</p></body></html>";
const CHALLENGED = { "cf-mitigated": "challenge" };

type Shape = {
  readonly name: string;
  readonly per: Partial<Record<RungId, Partial<RawResponse>>>;
  readonly claims: readonly string[];
  readonly readable: boolean;
};

// The two rows with a readable second read carry a claim the document lacks,
// so `check` must ACCUSE from that read - the half of the property that
// matters. Both rows use equal-prose bodies, which is the tie rule 2 decides.
const SHAPES: readonly Shape[] = [
  { name: "a readable first read", per: { node: { rawBody: DOC, status: 200 } }, claims: ["spending rose sharply"], readable: true },
  { name: "a walled first read (N1) and a readable second", per: { node: { rawBody: DOC, status: 200, headers: CHALLENGED }, curl: { rawBody: DOC, status: 200 } }, claims: ["spending rose sharply", "revenue fell"], readable: true },
  { name: "a 404 first read (N4) and a readable second", per: { node: { rawBody: DOC, status: 404 }, curl: { rawBody: DOC, status: 200 } }, claims: ["spending rose sharply", "revenue fell"], readable: true },
  { name: "two sub-floor reads whose union carries every claim", per: { node: { rawBody: STUB_1, status: 200 }, curl: { rawBody: STUB_2, status: 200 } }, claims: ["spending rose sharply", "the review is ongoing"], readable: false },
  { name: "two vetoed reads (N1, then N4)", per: { node: { rawBody: DOC, status: 200, headers: CHALLENGED }, curl: { rawBody: DOC, status: 404 } }, claims: ["spending rose sharply"], readable: false },
];

describe("reachability and check agree on the same reads", () => {
  it.each(SHAPES)("$name", async ({ per, claims, readable }) => {
    const fetcher = stub(per);
    const pre = await reachability([URL], { fetcher });
    const gate = await check(URL, claims, { fetcher });
    expect(pre.readable.map((x) => x.url)).toEqual(readable ? [URL] : []);
    expect(pre.unreadable.map((x) => x.url)).toEqual(readable ? [] : [URL]);
    if (readable) expect(gate.verdict).not.toBe("unreachable");
    else expect(gate.verdict).not.toBe("unsupported");
  });
});
