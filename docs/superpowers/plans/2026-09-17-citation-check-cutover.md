# citation-check Cutover Implementation Plan (Half B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `scripts/citation-check.mjs` onto testimonium without writing a wrong stored row.

**Architecture:** A shared fetcher/tee core is extracted from `issue-check.mjs` so both gates construct their fetcher once; humain's extractor becomes a decorator around it; a new `scripts/lib/post-check.mjs` returns intended patches and writes nothing; `citation-check.mjs` shrinks to a CLI that owns the database. Safety comes from a dry-run reconciliation over every post with stored rows, comparing intended patches.

**Tech Stack:** Node ESM (`.mjs`), vitest, `testimonium@0.5.0`.

**Spec:** `docs/superpowers/specs/2026-09-15-citation-check-cutover-design.md` in the testimonium repo. **Read it before Task 1** — its §14 records three review rounds, and several of its rules exist because an earlier draft got them wrong.

**Provenance:** designed and specced in the testimonium session, which holds omnisscientia read-only. Executed by the session that owns omnisscientia.

## Global Constraints

- **`testimonium@0.5.0` must be published before Task 2.** Verify with `npm view testimonium version`. Task 1 can proceed without it.
- **Only `supported` rows render to readers** (`inject-evidence.ts:76`). A wrong `supported` publishes a passage under an unsupported claim; every other wrong status renders nothing. **Never write `supported` wrongly** — this outranks every other consideration in this plan.
- The status vocabulary is enforced by a CHECK constraint: `unverified`, `supported`, `unsupported`, `unreachable`, `not_applicable`.
- **Do NOT run `fixtures/challenge-battery.mjs`.**
- Never write a NUL byte, and run a full **non-ASCII codepoint sweep** on anything you write — a NUL check alone misses a zero-width joiner, which has happened here.
- Files are CRLF. **Assert every text edit actually applied.**
- **`scripts/lib/source-fetch.mjs` keeps every export until Task 7 clears.** `citation-check.mjs` is its last consumer.
- Do not tag, publish, or push.

---

### Task 1: Extract the shared fetcher core, and pin the construction directly

**Files:**
- Create: `scripts/lib/fetch-core.mjs`
- Modify: `scripts/lib/issue-check.mjs`
- Test: `scripts/lib/__tests__/fetch-core.test.ts` (create)

**Interfaces:**
- Produces: `buildTeedFetcher({ fetcher, hosts, identity, sink })` returning a `Fetcher`, and `rungForClaim(result, claimText)`.
- Consumes: `defaultFetcher`, `loadRules` from `testimonium`.

**Why this exists, and why the obvious proof does not work.** The construction `defaultFetcher({ hosts, identity })` has already caused one silent capability loss in this project: project 2's spec records the sec.gov identity wire missing from one path, which would have flipped every EDGAR filing to NOT READ. A second hand-written copy is a copy that will diverge.

**But project 2's fourteen-shape corpus cannot prove this refactor safe.** Every shape injects `{ fetcher: stub(...) }`, and `bulletin-srccheck.mjs` passes its own `defaultFetcher` — so the `opts.fetcher ?? defaultFetcher(...)` fallback is exercised by neither the tests nor production. A refactor that breaks the identity wiring re-runs the corpus green.

- [ ] **Step 1: Write the test that the corpus cannot**

```ts
import { describe, it, expect } from "vitest";
import { buildTeedFetcher } from "../fetch-core.mjs";
import { loadRules } from "testimonium";

describe("fetch-core construction", () => {
  it("wires the declared identity through to a host that requires one", async () => {
    // sec.gov carries requiresIdentity. Without the wire it gets a browser UA
    // and refuses - which is the capability loss project 2 nearly shipped.
    const seen = [];
    const inner = {
      rungs: ["node"],
      async fetch(url, rung) {
        seen.push({ url, rung });
        return { rawBody: "", status: 0, headers: {}, finalUrl: url, bytes: 0 };
      },
    };
    const f = buildTeedFetcher({ fetcher: inner, sink: [], identity: "x y@z", hosts: loadRules().hosts });
    await f.fetch("https://www.sec.gov/Archives/edgar/x.htm", "node");
    expect(seen).toHaveLength(1);
  });

  it("delegates rungs rather than inventing them", () => {
    const inner = { rungs: ["node", "curl"], async fetch() { throw new Error("unused"); } };
    expect(buildTeedFetcher({ fetcher: inner, sink: [] }).rungs).toEqual(["node", "curl"]);
  });

  it("records every read into the sink, with the rung", async () => {
    const sink = [];
    const inner = {
      rungs: ["node"],
      async fetch(url) { return { rawBody: "hello", status: 200, headers: {}, finalUrl: url, bytes: 5 }; },
    };
    await buildTeedFetcher({ fetcher: inner, sink }).fetch("https://example.com/a", "node");
    expect(sink).toHaveLength(1);
    expect(sink[0]).toMatchObject({ rung: "node", status: 200, rawBody: "hello" });
  });
});
```

**Additionally assert the construction is shared, not merely similar.** The default path must produce a fetcher whose `sec.gov` user agent is the declared identity. Use whatever seam `testimonium` exposes for that (`userAgentFor` if it is public in 0.5.0; otherwise a `requiresIdentity` host with a recording inner fetcher). Report which you used.

- [ ] **Step 2: Run and watch them fail**

Expected: module not found.

- [ ] **Step 3: Write `fetch-core.mjs`**

Move the tee and the `opts.fetcher ?? defaultFetcher({ hosts, identity })` construction out of `issue-check.mjs` verbatim. **The tee wrap is unconditional** — a supplied fetcher is wrapped too, or `reads[]` is empty when a caller passes a stub.

- [ ] **Step 4: Route `issue-check.mjs` through it**

Delete its local copies. Behaviour must not change.

- [ ] **Step 5: Prove `issue-check` is behaviourally unchanged**

Run project 2's fourteen-shape corpus: `npx vitest run scripts/lib/__tests__/issue-check.test.ts`
Expected: all green, unchanged.

This is necessary and **not sufficient** — see the note above. Both checks are required: the corpus for the mapping, the new test for the construction.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/fetch-core.mjs scripts/lib/issue-check.mjs scripts/lib/__tests__/fetch-core.test.ts
git commit -m "refactor(lib): one fetcher construction, shared by both gates"
```

---

### Task 2: The humain extraction decorator

**Files:**
- Create: `scripts/lib/humain-fetcher.mjs`
- Test: `scripts/lib/__tests__/humain-fetcher.test.ts` (create)

**Interfaces:**
- Produces: `withHumainExtraction(inner) -> Fetcher`.
- Consumes: `isHumain`, `humainBody` from `source-fetch.mjs` — **imported, not reimplemented.**

**This is a DECORATOR, and that is load-bearing.** `CheckOptions.fetcher` is a single slot, and this project has two claimants: humain extraction and the reconciliation's replay fetcher. Wired naively — replay in the slot, extraction forgotten — the replay serves raw humain chrome, testimonium reads 6,824 characters of it, every claim misses on a readable page, and **the reconciliation instrument manufactures a `supported`→`unsupported` movement on every humain row.** The failure would look exactly like a real regression.

Composition, both arms:

```
withHumainExtraction( buildTeedFetcher({ ... }) )        // live
withHumainExtraction( buildTeedFetcher({ fetcher: replay, ... }) )   // reconciliation
```

**Tee inside, extraction outside.** The tee records what the network or replay returned — raw bytes — and the extraction transforms them on the way to the classifier identically in both arms. Recording raw is correct: the replay path re-applies the same deterministic extraction, so a later run reproduces the classification exactly.

- [ ] **Step 1: Write the failing tests**

```ts
it("transforms a humain body and leaves other hosts untouched", async () => { /* … */ });

it("falls back to the original body when extraction yields nothing", async () => {
  // humainBody returns "" when no attribute parses; the origin then falls back
  // to toText. Returning the empty string instead would blank the page.
});

it("passes status, headers and finalUrl through unchanged", async () => {
  // These drive N1, N2 and documentGone. A decorator that rebuilds a
  // RawResponse and drops them disarms three vetoes silently.
});

it("delegates rungs to the inner fetcher", () => { /* … */ });

it("applies per rung - a node read and a curl read are both transformed", async () => {
  // check()'s cross-rung union must not see one transformed body and one raw.
});
```

- [ ] **Step 2: Run and watch them fail**

- [ ] **Step 3: Implement**

Gate on `isHumain(url)`. On a humain read, compute `humainBody(rawBody)`; if non-empty, return a `RawResponse` with `rawBody` replaced and **every other field copied through**; otherwise return the response untouched.

- [ ] **Step 4: Run and watch them pass**

- [ ] **Step 5: Prove the three silent failures**

Mutate each, confirm red, restore: (a) return `""` instead of falling back; (b) drop `headers` from the rebuilt response; (c) skip the `isHumain` gate so every host is transformed.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/humain-fetcher.mjs scripts/lib/__tests__/humain-fetcher.test.ts
git commit -m "feat(lib): humain extraction as a decorator, not a terminal fetcher"
```

---

### Task 3: The `post-check` adapter

**Files:**
- Create: `scripts/lib/post-check.mjs`
- Test: `scripts/lib/__tests__/post-check.test.ts` (create)

**Interfaces:**
- Produces: `checkPost(post, rows, opts) -> { footnotes[], tally }`. Each footnote carries its **intended patch** — `status`, `evidence`, `fetch_recipe`, `retrieved_at` — plus the pre-check outcome where one applies.
- **`checkPost` writes nothing.** The CLI owns the database.

**The branch order is part of the contract.** Read `citation-check.mjs:112-160` before writing anything:

1. **author-set `not_applicable`** (`:119-122`) — respected, no write.
2. **`moved`** (`:127-133`) — stored URL differs from the footnote's current URL. Pre-fetch, writes nothing, fails the run.
3. **internal link** (`:135-139`) — `parseFootnotes` returns `url: null`; **auto-writes** `{ status: "not_applicable", evidence: [] }`. **Omitting this regresses the gate**: the footnote would fall through to unclaimed, write `unverified`, and fail the run without `--allow-unclaimed`.
4. **unclaimed** (`:141-155`) — writes `unverified` with empty evidence. **Never skip the write**: skipping it let a partially-gated post report "6 of 6 sources supported" across nine footnotes on 2026-09-12, because the checklist rolls up rows that exist.
5. **check** — everything else.

- [ ] **Step 1: Write the failing tests, one per branch plus the mapping**

Cover each branch above in order, then:

```ts
it("maps unclaimed to the stored status `unverified`, not to `unclaimed`", () => { /* … */ });

it("omits evidence and retrieved_at on unreachable", () => {
  // merge-duplicates would keep a stale date while blanking excerpts, leaving
  // a reader "Read <date>" with no passage under a claim that was fine.
  // This is a PARTIAL patch: { status, fetch_recipe } only.
});

it("refuses a footnote whose stored claims fall below the claim floor", () => {
  // check() throws on ANY sub-floor claim, so refusal is whole-footnote.
  // Verifying the rest and skipping the short one would let the row read
  // `supported` while a claim went unverified.
  // Writes `unverified`, counted SEPARATELY from genuinely-unclaimed, with a
  // message that does NOT say "NO CLAIMS RECORDED" - that is false for these.
});

it("renames rung to method on evidence entries", () => {
  // CitationEvidence is { claims, excerpt, method }; Evidence is
  // { claims, excerpt, rung }. Structurally identical but for the name.
});
```

- [ ] **Step 2: Run and watch them fail**

- [ ] **Step 3: Implement**

Compose the fetcher as `withHumainExtraction(buildTeedFetcher({...}))`. Reconstruct `fetch_recipe` on `unreachable` from the last tee read attempted — `CitationResult` carries no winning-rung field.

- [ ] **Step 4: Run and watch them pass**

- [ ] **Step 5: Prove the partial patch and the branch order**

Mutate: (a) include `evidence` on `unreachable` → its test reddens; (b) move the unclaimed branch before the internal-link branch → the internal-link test reddens. Restore both.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/post-check.mjs scripts/lib/__tests__/post-check.test.ts
git commit -m "feat(lib): post-check adapter over testimonium check()"
```

---

### Task 4: The fixture corpus

**Files:** `scripts/fixtures/postcheck/`, `scripts/lib/__tests__/post-check.test.ts`

Cover each class in spec §11 that a fixture can express, plus every behaviour in §8 and §9, each with a **stated expectation**:

| # | shape | expectation |
| --- | --- | --- |
| 1 | sub-floor page, partial match | `unreachable` (11.1) |
| 2 | fetch failure | `unreachable`, warn surfaced (11.4) |
| 3 | challenge page | `unreachable`, `firedRule` set (11.5) |
| 4 | node shell + curl document | escalation, `supported` (11.6) |
| 5 | **non-2xx serving full text** | `supported` — the 11.7a gain the origin's own corpus pins as correct |
| 6 | **readable non-2xx missing its claims** | `unsupported` — 11.7b, the new accusation route |
| 7 | matcher drift (soft hyphen) | match where the origin missed (11.8) |
| 8 | Bloomberg wall | `unreachable` (11.9) |
| 9 | description-borne text | `supported` (11.10) |
| 10 | content-negotiated PDF | `supported` via the re-route (11.11) |
| 11 | sub-floor stored claim | refused, `unverified`, counted separately (11.12) |
| 12 | author-set `not_applicable` | skipped, no write |
| 13 | `moved` footnote | fails the run, no write |
| 14 | internal link (`url: null`) | auto-write `not_applicable` |
| 15 | no claims recorded | `unverified` written |
| 16 | humain page | `supported`, via the decorator |

**§11.6's legacy-non-determinism analogue is not a fixture** — it is the stability pass's job in Task 7.

- [ ] **Step 1: Write shapes 5 and 6 first, as a pair**

They are the two directions of the same rule change and must be written together — one is a gain the origin's tests call correct, the other is a new accusation route. Pinning one without the other is how a reviewer concludes the change is safe.

- [ ] **Step 2: Write the rest**

- [ ] **Step 3: Pin the count from the test names, not a hand-maintained list**

```ts
it("covers shapes 1 through 16, with none dropped", () => { /* derive Ns from the file's own test titles */ });
```

A list asserted to have length 16 still says 16 after someone deletes a fixture.

- [ ] **Step 4: Commit**

---

### Task 5: The thin CLI

**Files:** `scripts/citation-check.mjs` (rewrite), `scripts/lib/__tests__/citation-render.test.ts`

**Interfaces:** Consumes `checkPost`. Owns argv, the database, rendering, and the exit code.

- [ ] **Step 1: Preserve the exit contract exactly**

**Exit 1:** `unsupported > 0 || moved > 0 || (unclaimed > 0 && !allowUnclaimed)`. **`unreachable` does NOT fail** — "not a failure and is not shown to readers". Project 2's gate sets `failOn.unreachable: true`; **this one must not.**

**Exit 2:** missing post-id or env; **an unknown post id** (`:96-100`); a PostgREST read error; a failed write. Infrastructure, not an author defect.

Note that sub-floor refusals route through the existing unclaimed term, so a post passing today can exit 1 tomorrow — escapable via `--allow-unclaimed`, and adding no new term. That is intended; say so in the output.

- [ ] **Step 2: Preserve the write contract**

Upsert on `on_conflict=post_id,footnote_number` with `Prefer: resolution=merge-duplicates`, and **read the response** — an ignored 4xx drops the row while printing success.

**Bump `checker_version` to `"2"`.** A cutover is the definition of a new generation, and post-cutover drift measurement depends on telling them apart.

- [ ] **Step 3: Write the render tests**

`render` returns lines; test against them, not stdout.

- [ ] **Step 4: Prove the ladder is gone**

```bash
grep -nE 'fetchSourceText|phraseFound|curlWithStatus|excerptFor|dedupeEvidence' scripts/citation-check.mjs
```

Expected: no output.

- [ ] **Step 5: Commit**

---

### Task 6: The record/replay harness

**Files:** `scripts/citation-reconcile.mjs`, `scripts/citation-check.legacy.mjs`

- [ ] **Step 1: Take the legacy copy from git**

```bash
git show <commit-before-task-5>:scripts/citation-check.mjs > scripts/citation-check.legacy.mjs
```

From git, not from an edited buffer. Record the hash in its header.

- [ ] **Step 2: Instrument it to record, twice**

Record `(url, rung, rawBody, status, headers, finalUrl)` per fetch, plus its own per-footnote intended patch. **Run it twice over the same posts** — anything whose outcome differs between runs is **legacy-unstable** and is excluded from adjudication rather than counted as a difference. citation-check has the same curl-retry non-determinism srccheck does.

- [ ] **Step 3: Declare the comparison's mappings**

Without these the diff drowns in vocabulary noise and criterion 5 is unmeetable:

| legacy | testimonium |
| --- | --- |
| `fetch` | `node` |
| `curl` | `curl` |
| `pdftotext` | `pdftotext` |
| `humain-aem` | `node`, transformed by the decorator |
| `humain-aem-curl` | `curl`, transformed by the decorator |
| `bloomberg-json` | none — §11.9 |
| `challenge` | none — the package reports `firedRule` |

**Exclude `retrieved_at`, `checked_at`, `updated_at`** — they differ every run by construction.

**`curl` is overloaded** on the legacy side: it covers an ordinary curl read and a Bloomberg read via curl. Where §11.9 needs the distinction, resolve it from the URL's host, not the recipe name.

- [ ] **Step 4: A rung with no recorded bytes is bucketed, never adjudicated**

The new arm can request reads the legacy arm never made — the PDF re-route, and `/pdf/`-path URLs the origin's extension-only rule misses.

- [ ] **Step 5: Commit**

---

### Task 7: Run the reconciliation and adjudicate

**Files:** `docs/superpowers/worklogs/2026-09-17-citation-reconciliation.md`; delete `scripts/citation-check.legacy.mjs` at the end.

**No code.** This is the acceptance gate.

- [ ] **Step 1: Report the two counts the spec asks for BEFORE running**

How many posts have stored citation rows, and how many stored claims fall below the 16-character floor. The first sizes the run; the second sizes §11.12. **If either is unexpectedly large, stop and report.**

Also report **how many stored rows cite humain.com and their current statuses** — Task 2's acceptance turns on them.

- [ ] **Step 2: Record and replay, both arms dry-run**

- [ ] **Step 3: Adjudicate every difference in writing**

One row per difference: post, footnote, legacy patch, new patch, the §11 class, the ruling. **Every UNCLASSIFIED row is a defect** — fix it and re-run, do not reclassify until the table is clean.

Classify using spec §8.0's **ordering rule** — vetoes before the prose floor. A page both blocked and sub-floor is a challenge difference, never a floor difference; testing the floor first doubled project 2's headline.

- [ ] **Step 4: The two criteria that gate deletion**

**No `supported` gain goes unadjudicated.** Every row the new arm marks `supported` that the legacy arm did not must be assigned to a named class **and the claim confirmed present by hand.** Gains are expected — 11.7a, 11.10, 11.11 and 11.8 all produce them, and the origin's own corpus pins the first as correct. The criterion forbids *unexamined* gains, not gains.

**No humain row moves OUT of `supported`.** Movement in other directions is legitimate.

- [ ] **Step 5: Verify the untouched files**

```bash
git diff --stat master -- scripts/lib/source-fetch.mjs src/lib/citations/inject-evidence.ts
```

Expected: no output.

- [ ] **Step 6: Only now, remove the dead exports and the legacy arm**

```bash
git rm scripts/citation-check.legacy.mjs
```

Remove `source-fetch.mjs`'s now-unused exports in the same commit, and confirm nothing else imports them first.

---

## Ordering

| edge | why |
| --- | --- |
| 0.5.0 published before 2 | the decorator's behaviour depends on description extraction |
| 1 before 2 | the decorator wraps the shared core |
| 1, 2 before 3 | the adapter composes both |
| 3 before 4 | fixtures assert the adapter's returns |
| 3, 4 before 5 | the CLI renders what the adapter returns |
| 5 before 6 | the legacy copy comes from the commit *before* the rewrite |
| 6 before 7 | the reconciliation runs the harness |

Strictly sequential.
