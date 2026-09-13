# bulletin-srccheck Cutover Implementation Plan (Half B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `bulletin-srccheck.mjs`'s hand-rolled fetch ladder, challenge check, curl retry and phrase matcher with `testimonium@0.3.0`, behind a new adapter module, without losing capability.

**Architecture:** A new `scripts/lib/issue-check.mjs` exports `checkIssue(issue, opts)` which returns structured per-item results and **prints nothing**; `bulletin-srccheck.mjs` becomes argument parsing, rendering and an exit code. A tee fetcher wraps `defaultFetcher` so the caller keeps the raw bytes it needs for the originality measure. Parity is proven by two instruments: a stub-driven fixture corpus (new arm only, permanent) and a record/replay reconciliation against the current script on real drafts.

**Tech Stack:** Node ESM (`.mjs`), vitest, `testimonium@0.3.0`.

**Spec:** `testimonium/docs/superpowers/specs/2026-09-12-bulletin-srccheck-cutover-design.md`. Read it before Task 1 — this plan argues from it, and §8's nine difference classes are the vocabulary Task 8 adjudicates in.

**Provenance:** designed and specced in the testimonium session, which holds omnisscientia read-only. This plan is executed by the session that owns omnisscientia.

## Global Constraints

- **`testimonium@0.3.0` must be published before Task 1.** The adapter imports `toText`, which does not exist in 0.2.0. Verify with `npm view testimonium version` before starting.
- **`scripts/lib/source-fetch.mjs` must not be modified or deleted.** `citation-check.mjs` depends on it and is project 3. Task 8 verifies this with `git diff --stat`.
- **Do not modify `scripts/bulletin-validate.mjs`, `scripts/bulletin-review.mjs`, or `scripts/citation-check.mjs`.**
- The repo may have unrelated work in flight. Branch from a clean tree and confirm `git status` is clean before Task 1.
- Never write a literal NUL byte into a file — write it as its six-character unicode escape, and byte-check the file afterwards. This project has a recorded incident of an escape round-tripping into the raw character.
- Real `issue.json` files are ephemeral command-line arguments and are not committed. Tasks 1–6 must not depend on one existing.
- `_claims` strings are matched against source bytes. Never edit a `_claims` value to make a test pass.

---

### Task 1: `checkIssue` core — tee, `check()`, verdict mapping

**Files:**
- Create: `scripts/lib/issue-check.mjs`
- Test: `scripts/lib/__tests__/issue-check.test.ts`
- Create: `scripts/fixtures/srccheck/` (fixture bodies)

**Interfaces:**
- Produces: `checkIssue(issue, opts) -> Promise<{ items, tally }>` and `teeFetcher(inner, sink) -> Fetcher`.
  - `opts`: `{ fetcher?, allowUnclaimed?, identity?, hosts? }`. When `fetcher` is absent, build `defaultFetcher({ hosts, identity })` and wrap it in the tee.
  - each `item`: `{ n, category, sourceLabel, url, verdict, reads, claims, firedRule, originality, structural }`
  - each `reads` entry: `{ rung, status, bytes }`
  - each `claims` entry: `{ text, tag, rung }`, `tag` one of `"ok" | "ok*" | "MISS"`
- Consumes: `check`, `defaultFetcher`, `loadRules` from `testimonium`.

This task delivers verdicts and `reads[]` only. Pre-flight, structural rows, originality and rendering are Tasks 2–5; leave `structural: null` and `originality: null` for now.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { checkIssue } from "../issue-check.mjs";

/** A Fetcher whose rungs return canned bodies. Must never throw. */
function stub(byRung) {
  return {
    rungs: Object.keys(byRung),
    async fetch(_url, rung) {
      const b = byRung[rung];
      if (!b) return { rawBody: "", status: 0, headers: {}, finalUrl: "", bytes: 0 };
      return {
        rawBody: b.body,
        status: b.status ?? 200,
        headers: b.headers ?? {},
        finalUrl: _url,
        bytes: b.body.length,
      };
    },
  };
}

const DOC = `<html><body><p>${"The quarterly figure was 4.2 million units. ".repeat(200)}</p></body></html>`;

describe("checkIssue", () => {
  it("returns supported with a per-claim ok tag and the rung that located it", async () => {
    const issue = { items: [{ category: "x", source_url: "https://example.com/a",
                              _claims: ["The quarterly figure was 4.2 million units"], body: "" }] };
    const r = await checkIssue(issue, { fetcher: stub({ node: { body: DOC } }) });
    expect(r.items[0].verdict).toBe("supported");
    expect(r.items[0].claims[0].tag).toBe("ok");
    expect(r.items[0].claims[0].rung).toBe("node");
  });

  it("records one reads entry per rung attempted, with status and bytes", async () => {
    const issue = { items: [{ category: "x", source_url: "https://example.com/a",
                              _claims: ["a claim this document does not contain anywhere"], body: "" }] };
    const r = await checkIssue(issue, { fetcher: stub({ node: { body: DOC }, curl: { body: DOC } }) });
    expect(r.items[0].reads.map((x) => x.rung)).toEqual(["node", "curl"]);
    expect(r.items[0].reads[0]).toMatchObject({ status: 200, bytes: DOC.length });
  });

  it("marks a claim ok* when a later rung located it", async () => {
    const SHELL = `<html><body><div>${"Enable JavaScript to continue. ".repeat(250)}</div></body></html>`;
    const issue = { items: [{ category: "x", source_url: "https://example.com/a",
                              _claims: ["The quarterly figure was 4.2 million units"], body: "" }] };
    const r = await checkIssue(issue, { fetcher: stub({ node: { body: SHELL }, curl: { body: DOC } }) });
    expect(r.items[0].verdict).toBe("supported");
    expect(r.items[0].claims[0].tag).toBe("ok*");
    expect(r.items[0].claims[0].rung).toBe("curl");
  });

  it("returns unreachable and prints nothing at all", async () => {
    const logs = [];
    const orig = console.log;
    console.log = (...a) => logs.push(a.join(" "));
    try {
      const issue = { items: [{ category: "x", source_url: "https://example.com/a",
                                _claims: ["anything at all here"], body: "" }] };
      const r = await checkIssue(issue, { fetcher: stub({ node: { body: "", status: 0 } }) });
      expect(r.items[0].verdict).toBe("unreachable");
    } finally {
      console.log = orig;
    }
    expect(logs).toEqual([]);
  });
});
```

The `DOC` body must clear the 4,500-character prose floor — that is why it repeats. The shell body must also clear it, because the point of the `ok*` test is a *readable* shell that ends the climb, which is the false-miss shape 0.2.0's escalation exists to fix.

- [ ] **Step 2: Run and watch all four fail**

Run: `npx vitest run scripts/lib/__tests__/issue-check.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the tee**

```js
export function teeFetcher(inner, sink) {
  return {
    rungs: inner.rungs,
    async fetch(url, rung) {
      const r = await inner.fetch(url, rung);
      sink.push({ url, rung, rawBody: r.rawBody, status: r.status, bytes: r.bytes });
      return r;
    },
  };
}
```

Pass-through only. A `Fetcher` must not throw; this one adds no throw of its own, and a throw from `inner` is caught by testimonium's reader.

- [ ] **Step 4: Write `checkIssue`**

Per item: create a fresh `sink`, call `check(url, claims, { fetcher: tee, sourceLabel })`, then map.

The claim tags come from the result, not from re-matching:
- `MISS` for every entry in `result.missed`
- otherwise find the `evidence` entry whose `claims` contains the text; its `rung` is the claim's rung
- `ok` when that rung is `reads[0].rung`, `ok*` otherwise

**Disclose the `ok*` approximation in a comment:** `dedupeEvidence` merges overlapping excerpts across entries and keeps the first entry's rung, so a curl-located claim can render under a node rung when the two reads' excerpts overlap textually. It changes a `*` on rare items and is accepted.

- [ ] **Step 5: Run and watch all four pass**

Run: `npx vitest run scripts/lib/__tests__/issue-check.test.ts`
Expected: PASS.

- [ ] **Step 6: Prove the print test can fail**

Add a temporary `console.log("x")` inside `checkIssue`, re-run, confirm the fourth test goes red, remove it. A silence assertion that cannot fail is worthless, and this one is the contract the whole module split rests on.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/issue-check.mjs scripts/lib/__tests__/issue-check.test.ts
git commit -m "feat(srccheck): checkIssue core over testimonium check()"
```

---

### Task 2: Pre-flight validation, structural rows, tally and exit

**Files:**
- Modify: `scripts/lib/issue-check.mjs`
- Modify: `scripts/lib/__tests__/issue-check.test.ts`

**Interfaces:**
- Produces: `tally` as `{ unsupported, unclaimed, unreachable, orphaned, infrastructure }`; `item.structural` as `"no-source-url"` or `null`; `preflight(issue)` returning the problems found.
- Consumes: `validateClaims`, `classifyRun` from `testimonium`.

- [ ] **Step 1: Write the failing tests**

```ts
it("refuses a sub-floor claim before any fetch, naming the item", async () => {
  let fetched = 0;
  const f = { rungs: ["node"], async fetch() { fetched++; return { rawBody: "", status: 0, headers: {}, finalUrl: "", bytes: 0 }; } };
  const issue = { items: [{ category: "x", source_url: "https://example.com/a", _claims: ["too short"], body: "" }] };
  await expect(checkIssue(issue, { fetcher: f })).rejects.toThrow(/item 1/);
  expect(fetched).toBe(0);
});

it("refuses a non-string claim before any fetch", async () => {
  const issue = { items: [{ category: "x", source_url: "https://example.com/a", _claims: [42], body: "" }] };
  await expect(checkIssue(issue, { fetcher: stub({}) })).rejects.toThrow(/item 1/);
});

it("marks a missing source_url structural, and never unreachable", async () => {
  const issue = { items: [{ category: "x", _claims: ["a claim long enough to pass"], body: "" }] };
  const r = await checkIssue(issue, { fetcher: stub({}) });
  expect(r.items[0].structural).toBe("no-source-url");
  expect(r.items[0].verdict).toBeNull();
  expect(r.tally.unreachable).toBe(0);
});

it("counts an unclaimed item, and allowUnclaimed does not change the tally", async () => {
  const issue = { items: [{ category: "x", source_url: "https://example.com/a", _claims: [], body: "" }] };
  const a = await checkIssue(issue, { fetcher: stub({ node: { body: DOC } }) });
  const b = await checkIssue(issue, { fetcher: stub({ node: { body: DOC } }), allowUnclaimed: true });
  expect(a.tally.unclaimed).toBe(1);
  expect(b.tally.unclaimed).toBe(1);
});
```

The last test pins an easy mistake: `allowUnclaimed` is an **exit policy**, passed to `classifyRun` by the CLI. It must not change what `checkIssue` counted.

- [ ] **Step 2: Run and watch all four fail**

Run: `npx vitest run scripts/lib/__tests__/issue-check.test.ts`

- [ ] **Step 3: Implement the pre-flight**

Run `validateClaims` over every item's `_claims` **before the loop that fetches**. Report *all* offenders, not the first — an author fixing one at a time pays a network round trip per mistake. Throw with each offender's item number, the claim, and the reason `validateClaims` gave (`not-a-string` or `below-floor`).

Run the whole validator rather than length-checking: a non-string entry throws at `check()`'s door just as readily as a short one, and `validateClaims` already reports both.

- [ ] **Step 4: Implement structural rows and the tally**

An item with no `source_url` gets `structural: "no-source-url"`, `verdict: null`, and is **not** counted in any `RunTally` field. `orphaned` is always 0 — every claim in an issue belongs to one item. `infrastructure` is set only by pre-flight failure, never by anything a source does.

- [ ] **Step 5: Run and watch all four pass, then run the whole file**

Run: `npx vitest run scripts/lib/__tests__/issue-check.test.ts`
Expected: PASS, and Task 1's four still green.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/issue-check.mjs scripts/lib/__tests__/issue-check.test.ts
git commit -m "feat(srccheck): pre-flight validation, structural rows, run tally"
```

---

### Task 3: Originality over the tee

**Files:**
- Modify: `scripts/lib/issue-check.mjs`
- Modify: `scripts/lib/__tests__/issue-check.test.ts`

**Interfaces:**
- Produces: `item.originality` as `{ words, run }`; `longestSharedRun(bodyRaw, sourceHay)` moved into this module.
- Consumes: `toText`, `norm` from `testimonium`.

`longestSharedRun` moves **verbatim** from `bulletin-srccheck.mjs` — the quote-stripping regex, the 4-to-40 gram range, and the early `break`. Copy it with its docstring. Changing its algorithm is not in scope and would make Task 8's originality comparison meaningless.

- [ ] **Step 1: Write the failing tests**

```ts
it("measures against the read that actually carried the document, not the shell", async () => {
  const SHELL = `<html><body><div>${"Enable JavaScript to continue. ".repeat(250)}</div></body></html>`;
  const issue = { items: [{ category: "x", source_url: "https://example.com/a",
                            _claims: ["The quarterly figure was 4.2 million units"],
                            body: "The quarterly figure was 4.2 million units this period." }] };
  const r = await checkIssue(issue, { fetcher: stub({ node: { body: SHELL }, curl: { body: DOC } }) });
  expect(r.items[0].originality.words).toBeGreaterThanOrEqual(8);
});

it("excludes a quoted span from the measure", async () => {
  const issue = { items: [{ category: "x", source_url: "https://example.com/a",
                            _claims: ["The quarterly figure was 4.2 million units"],
                            body: `He said "The quarterly figure was 4.2 million units" yesterday.` }] };
  const r = await checkIssue(issue, { fetcher: stub({ node: { body: DOC } }) });
  expect(r.items[0].originality.words).toBeLessThan(8);
});

it("never measures against a vetoed read", async () => {
  const WALL = `<html><body><div>${"Are you a robot? Please verify you are human. ".repeat(200)}</div></body></html>`;
  const issue = { items: [{ category: "x", source_url: "https://example.com/a",
                            _claims: ["a claim that is nowhere in either body"],
                            body: "Are you a robot? Please verify you are human." }] };
  const r = await checkIssue(issue, { fetcher: stub({ node: { body: WALL }, curl: { body: WALL } }) });
  expect(r.items[0].originality.words).toBe(0);
});
```

The first test is the latent origin bug, pinned: today `longestSharedRun(it.body, hay)` uses `hay` and never `curlHay`, so a shell on node means the body is compared against the shell.

- [ ] **Step 2: Run and watch all three fail**

- [ ] **Step 3: Implement per-read maximum with vetoed reads excluded**

For each tee record, extract per rung — `norm(toText(rawBody))` for HTML rungs, `norm(rawBody)` for `pdftotext`, whose body is already extracted text — run `longestSharedRun` against each separately, and keep the longest.

**Per-read, never concatenated:** joining reads lets an n-gram span the seam and score a match present in neither source.

**Skip vetoed reads.** The origin never measures originality on a challenge page or an unclaimed item — both `continue` before reaching it — so including wall bodies would invent runs the origin never reports. Identify them from the result rather than re-classifying: an item whose verdict is `unreachable`, and any read whose body the classifier vetoed.

An item with no claims gets no originality measure, matching the origin's `continue`.

- [ ] **Step 4: Run and watch all three pass**

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/issue-check.mjs scripts/lib/__tests__/issue-check.test.ts
git commit -m "feat(srccheck): originality per read, excluding vetoed bodies"
```

---

### Task 4: Complete the fourteen fixture shapes

**Files:**
- Create: `scripts/fixtures/srccheck/*.html`, `*.txt`
- Modify: `scripts/lib/__tests__/issue-check.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–3. Adds no production code.

Tasks 1–3 already cover shapes 1, 2, 8, 9, 10, 11, 12, 13 and 14 in part. This task completes the set and gives every shape a stated expectation. **All fourteen, from spec §9A:**

| # | shape | expectation |
| --- | --- | --- |
| 1 | challenge interstitial | `unreachable` |
| 2 | node-shell + curl-document | escalation, `supported` |
| 3 | PDF | matched against raw extracted text |
| 4 | Bloomberg **pre-wall** body | claims MISS without `bloombergBody` |
| 5 | Bloomberg **wall** body | `unreachable` via the challenge signature |
| 6 | 404 | `unreachable` via `documentGone` |
| 7 | 403 serving full text | `supported` |
| 8 | fetch failure, `status: 0` | `unreachable` |
| 9 | unclaimed item | counted; fails unless `allowUnclaimed` |
| 10 | sub-16-character claim | pre-flight throw |
| 11 | non-string `_claims` entry | pre-flight throw |
| 12 | missing `source_url` | structural, exit 1 (Task 5 asserts the code) |
| 13 | originality run of 8+ words, and a quoted run excluded | measured / excluded |
| 14 | sub-floor **partial** match | `unreachable` |

- [ ] **Step 1: Write shape 14 first, and read what it proves**

```ts
it("a sub-floor page with SOME claims matched is unreachable, not unsupported", async () => {
  const SHORT = `<html><body><p>The figure was 4.2 million units in the quarter.</p></body></html>`;
  const issue = { items: [{ category: "x", source_url: "https://example.com/a",
                            _claims: ["The figure was 4.2 million units",
                                      "a second claim that is simply not on this page"], body: "" }] };
  const r = await checkIssue(issue, { fetcher: stub({ node: { body: SHORT }, curl: { body: SHORT } }) });
  expect(r.items[0].verdict).toBe("unreachable");
});

it("a sub-floor page with ALL claims matched is supported", async () => {
  const SHORT = `<html><body><p>The figure was 4.2 million units in the quarter.</p></body></html>`;
  const issue = { items: [{ category: "x", source_url: "https://example.com/a",
                            _claims: ["The figure was 4.2 million units"], body: "" }] };
  const r = await checkIssue(issue, { fetcher: stub({ node: { body: SHORT } }) });
  expect(r.items[0].verdict).toBe("supported");
});
```

These two are a **pair** and must be written together. They pin spec §8.1's table: a full match short-circuits before the prose floor, a partial match does not. This is the largest behavioural class in the cutover and the one Task 8 counts.

- [ ] **Step 2: Write shapes 3 through 7**

Shape 4 is the one with a stated expectation that may read as a bug: a pre-wall Bloomberg body's claims **MISS**, because the package has no `bloombergBody` and the article text lives in JSON state. That is spec §3.1's accepted loss, not a defect. Say so in the test name.

Shape 7 pins the §8.7 flip: the origin fails any non-2xx even when every claim matches; testimonium consults status only for 404/410, so a 403 serving the full text is `supported`.

Shape 3 must exercise `pdftotext` bodies as **raw text**, not HTML.

- [ ] **Step 3: Run the file**

Run: `npx vitest run scripts/lib/__tests__/issue-check.test.ts`
Expected: all green.

- [ ] **Step 4: Pin the count**

Add one test asserting the corpus covers fourteen named shapes, so a silently dropped fixture fails the suite:

```ts
it("covers all fourteen declared shapes", () => {
  expect(COVERED_SHAPES).toHaveLength(14);
});
```

Export `COVERED_SHAPES` as an array of the shape names from the test file and keep it beside the table above. A sweep with no expected number under-delivers silently.

- [ ] **Step 5: Commit**

```bash
git add scripts/fixtures/srccheck scripts/lib/__tests__/issue-check.test.ts
git commit -m "test(srccheck): fourteen fixture shapes with stated expectations"
```

---

### Task 5: The CLI

**Files:**
- Modify: `scripts/bulletin-srccheck.mjs` (rewrite)
- Test: `scripts/lib/__tests__/srccheck-render.test.ts`

**Interfaces:**
- Consumes: `checkIssue` from Task 1–3; `classifyRun` from `testimonium`.
- Produces: a `render(result)` function returning lines as an array, plus the `main` that prints them and exits.

Split `render` out as a pure function returning lines. Testing rendering by capturing stdout is what the module split exists to avoid.

- [ ] **Step 1: Write the failing tests**

```ts
it("renders one http line per read", () => {
  const lines = render({ items: [{ n: 1, category: "x", sourceLabel: "", url: "https://example.com/a",
    verdict: "supported", structural: null, firedRule: null, originality: { words: 3, run: "a b c" },
    reads: [{ rung: "node", status: 200, bytes: 1234 }, { rung: "curl", status: 200, bytes: 5678 }],
    claims: [{ text: "c", tag: "ok*", rung: "curl" }] }], tally: {} });
  expect(lines.join("\n")).toContain("http 200  1234 bytes");
  expect(lines.join("\n")).toContain("5678");
  expect(lines.join("\n")).toContain("[curl only]");
});

it("renders NOT READ without an empty parenthetical when no rule fired", () => {
  const lines = render({ items: [{ n: 1, category: "x", sourceLabel: "", url: "https://example.com/a",
    verdict: "unreachable", structural: null, firedRule: null, originality: null,
    reads: [{ rung: "node", status: 200, bytes: 900 }], claims: [] }], tally: {} });
  const text = lines.join("\n");
  expect(text).toContain("NOT READ");
  expect(text).not.toMatch(/\(\s*\)/);
});

it("exits 1 on a structural failure alone", () => {
  const code = exitFor({ items: [{ structural: "no-source-url" }],
                         tally: { unsupported: 0, unclaimed: 0, unreachable: 0, orphaned: 0, infrastructure: false } },
                       { allowUnclaimed: false });
  expect(code).toBe(1);
});
```

The third test is spec §7's structural gap. `RunTally` has no structural field, so `classifyRun` alone returns 0 here — the CLI must OR the flag in. Without this the gate silently passes the one item shape the script's header says it exists for.

- [ ] **Step 2: Run and watch all three fail**

- [ ] **Step 3: Write `render` and `exitFor`**

`render` reproduces every line the current script prints — the `=== item N [category] label` header, the url, one line per read, the per-claim `ok  ` / `ok* ` / `MISS` tags with `[curl only]`, the NOT READ line with the fired rule's note and `lastConfirmed` when one fired, the `warn no _claims` line, the `ORIG` / `orig` lines, and the `==== N PROBLEM(S)` / `ALL CLAIMS SUPPORTED` footer.

`exitFor` is `classifyRun(tally, { unreachable: true, unclaimed: !allowUnclaimed })`, then forced to at least 1 when any item has a `structural` value.

- [ ] **Step 4: Wire `main`**

Parse `process.argv[2]` as the issue path and `--allow-unclaimed` as a flag, build `defaultFetcher({ hosts: loadRules().hosts, identity: SRCCHECK_IDENTITY })`, call `checkIssue`, print `render`'s lines, exit `exitFor`'s code.

**`identity` is load-bearing.** `sec.gov` carries `requiresIdentity`; without it the package sends a browser UA that EDGAR refuses and every filing flips from `ok` to NOT READ. `SRCCHECK_IDENTITY` carries the value the origin already uses in `source-fetch.mjs`'s `SEC_UA`. Pass `source_label` through as `sourceLabel` too.

A flag that parses but reaches no call is the silent no-op this codebase names repeatedly — add a test that `--allow-unclaimed` changes the exit code for an unclaimed-only issue.

- [ ] **Step 5: Run everything**

Run: `npx vitest run scripts/lib/__tests__/`
Expected: green.

- [ ] **Step 6: Prove the ladder is gone**

```bash
grep -nE 'isChallengePage|curlText|AbortSignal|bloombergBody|uaFor' scripts/bulletin-srccheck.mjs
```

Expected: no output. If any remains, the inline ladder was not fully removed.

- [ ] **Step 7: Commit**

```bash
git add scripts/bulletin-srccheck.mjs scripts/lib/__tests__/srccheck-render.test.ts
git commit -m "refactor(srccheck): thin CLI over the issue-check adapter"
```

---

### Task 6: The instrumented legacy copy

**Files:**
- Create: `scripts/bulletin-srccheck.legacy.mjs`

**Interfaces:**
- Produces: a recording of `{ url, rung, rawBody, status }` for every fetch, written to a JSON file named by `--record <path>`.

- [ ] **Step 1: Copy the pre-cutover script**

```bash
git show <commit-before-task-5>:scripts/bulletin-srccheck.mjs > scripts/bulletin-srccheck.legacy.mjs
```

Take it from git, not from memory or from an edited buffer. Record the commit hash in the file's header comment.

- [ ] **Step 2: Add recording at each fetch site**

Four sites: the node `fetch`, `curlText`, and both `pdfText` calls. Record `rung` as `"node"`, `"curl"` and `"pdftotext"` respectively, to match testimonium's rung ids. For `pdfText`, record the extracted text as `rawBody` and `status: 0`, matching what testimonium's PDF rung returns.

- [ ] **Step 3: Verify it still behaves identically**

Run it against `scripts/fixtures/bulletin-review-canary.json` with and without `--record` and diff the stdout. Expected: identical. Recording must not change behaviour.

- [ ] **Step 4: Commit**

```bash
git add scripts/bulletin-srccheck.legacy.mjs
git commit -m "test(srccheck): instrumented legacy copy for the reconciliation"
```

---

### Task 7: The replay harness

**Files:**
- Create: `scripts/srccheck-reconcile.mjs`

**Interfaces:**
- Consumes: a recording from Task 6, and `checkIssue` from Tasks 1–3.
- Produces: a report naming, per item, the legacy output, the new output, and which of spec §8's nine classes the difference falls in.

- [ ] **Step 1: Write the replay fetcher**

```js
function replayFetcher(records) {
  const byKey = new Map(records.map((r) => [`${r.url}\u0000${r.rung}`, r]));
  const rungs = [...new Set(records.map((r) => r.rung))];
  return {
    rungs,
    async fetch(url, rung) {
      const r = byKey.get(`${url}\u0000${rung}`);
      if (!r) return { rawBody: "", status: 0, headers: {}, finalUrl: "", bytes: 0 };
      return { rawBody: r.rawBody, status: r.status, headers: {}, finalUrl: url, bytes: r.rawBody.length };
    },
  };
}
```

Write that key separator as the six-character escape shown, never as a raw byte, and byte-check the file after writing it.

**A rung the legacy arm never fetched returns an empty response.** That is correct and expected — it is spec §8.6, where the old arm gave up and the new one would have climbed. Report it as "attempted by one arm only", which is a finding, not a mismatch.

- [ ] **Step 2: Write the comparison**

For each item, compare the legacy tag set against the new one and classify every difference into one of §8's nine classes. Anything that fits none is reported as **UNCLASSIFIED**, which is the defect signal.

Byte equality holds by construction here, so drift is impossible and every difference is behavioural. Say that in the report header so a reader does not re-litigate it.

- [ ] **Step 3: Self-test on the canary**

Run both arms against `scripts/fixtures/bulletin-review-canary.json`. This needs network for the legacy recording pass.

Expected: item 1 is a sec.gov EDGAR exhibit, so it exercises the identity wire from Task 5 end to end. If it reads NOT READ, `identity` is not reaching `defaultFetcher` — fix that before going further, because every SEC citation depends on it.

- [ ] **Step 4: Commit**

```bash
git add scripts/srccheck-reconcile.mjs
git commit -m "test(srccheck): record/replay reconciliation harness"
```

---

### Task 8: Run the reconciliation and adjudicate

**Files:**
- Create: `docs/superpowers/worklogs/2026-09-12-srccheck-reconciliation.md`
- Delete: `scripts/bulletin-srccheck.legacy.mjs` (only at the end, and only if the bar clears)

**This task has no code.** It is the acceptance gate the owner set: capability parity plus a reconciliation run, every differing verdict adjudicated before the old code is deleted.

- [ ] **Step 1: Confirm a corpus exists**

Find the real `issue.json` files in the working directory. They are ephemeral and uncommitted.

**If none exist, STOP and report.** Instrument B cannot run and the cutover cannot clear its bar. Do not substitute the canary — three items is a smoke test, not a reconciliation.

- [ ] **Step 2: Record and replay**

Run the legacy arm with `--record` over every issue found, then the new arm over the same recordings.

- [ ] **Step 3: Adjudicate every difference in writing**

One row per difference: item, url, legacy output, new output, the §8 class it falls in, and the ruling. **Every UNCLASSIFIED row is a defect** — fix it and re-run, do not reclassify it to make the table clean.

- [ ] **Step 4: Report the §8.1 count explicitly**

Count the items whose verdict moved from a per-claim `ok`/`MISS` mix to `unreachable` because the source is under the 4,500-character prose floor. **Record the count and the fraction.**

This is a go/no-go, not a statistic. A large fraction means the bulletin's sources are systematically shorter than the floor testimonium calibrated against, and that is a threshold conversation with the owner **before** the cutover proceeds — not something to absorb quietly. State the number and make the call explicitly either way.

- [ ] **Step 5: Verify the untouched files**

```bash
git diff --stat main -- scripts/lib/source-fetch.mjs scripts/bulletin-validate.mjs scripts/citation-check.mjs scripts/bulletin-review.mjs
```

Expected: no output. Spec §2 and the global constraints both require it.

- [ ] **Step 6: Delete the legacy copy and commit**

Only after Steps 3 and 4 clear.

```bash
git rm scripts/bulletin-srccheck.legacy.mjs
git add docs/superpowers/worklogs/2026-09-12-srccheck-reconciliation.md
git commit -m "docs(srccheck): reconciliation adjudicated; legacy arm retired"
```

---

## Ordering

| edge | why |
| --- | --- |
| 0.3.0 published before 1 | the adapter imports `toText` |
| 1 before 2 | pre-flight and tally extend the module Task 1 creates |
| 1 before 3 | originality reads the tee records Task 1 populates |
| 2, 3 before 4 | the fixture shapes assert pre-flight throws and originality values |
| 1–4 before 5 | the CLI renders what the adapter returns |
| 5 before 6 | the legacy copy is taken from the commit *before* the rewrite |
| 6 before 7 | the replay harness consumes Task 6's recording |
| 7 before 8 | the reconciliation runs the harness |

Every task after the first modifies `scripts/lib/issue-check.mjs` or depends on its shape. **Run strictly sequentially, never in parallel.**
