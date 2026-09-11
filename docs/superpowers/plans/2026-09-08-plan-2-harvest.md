# testimonium Plan 2 (`harvest`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `testimonium harvest <doc.md>` fetches every URL the document cites and proposes, as candidate claims, the spans that appear verbatim in both the document's own prose and a readable read of the source - writing them to `<doc>.claims.draft.json`, never to the claims file - and the claim-length floor spec 7.3 licenses is refused at every entry, after a committed script has re-derived its number.

**Architecture:** Calibration first, before any harvest code: two committed scripts re-derive the two constants (`minClaimChars`, `harvestSeedChars`) from claims fixtures frozen into this repo, and an acceptance test binds the result the way `test/classify/acceptance.test.ts` binds the prose floor. The floor is then enforced at three sites through one message builder. The pipeline itself is four small modules - `src/harvest/sources.ts` (group by `normalizeUrl`, read through `readSource`, keep only readable reads), `src/harvest/spans.ts` (`commonSpans` over `foldWithMap` plus three self-validation assertions), `src/harvest/filters.ts` (floor, cross-source frequency, boilerplate rules, already-claimed), and `src/io/draft.ts` (the draft file and its overwrite rule) - composed by `src/harvest.ts`, the command beside `src/check.ts` and `src/reachability.ts`, and driven by `src/bin.ts`. No model. Phrase matching remains the sole arbiter, and every proposal is afterwards judged by `check` exactly as a hand-written claim is.

**Tech Stack:** TypeScript, Node >= 20, ESM, vitest. Unchanged. Zero runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-06-testimonium-design.md`. **Section 8.2 (lines 979-1108) is the authority for this plan**; 7.3:846-864 carries the claim floor, 6.6 the reader this builds on, 5.3 the sealed surface, 13 Q3 and Q5 the two resolutions, 10 the testing doctrine. Where 8.2 and any earlier paragraph disagree, 8.2 wins.

**Base:** `main` @ `ff71ec8` (plan 1.2 merged as PR #3). Branch `feat/plan-2-harvest` in the worktree `C:\Users\noaho\testimonium-plan2`. 281 tests green, `npx tsc --noEmit` clean, `dist/` present.

**Withheld 2026-09-10.** The four claims files this plan freezes are named `source-a-claims.json` through `source-d-claims.json` here, assigned in the alphabetical order the real filenames already had; two of those names disclosed what their draft was about. The origin repository's path and the commit Task 2 pinned are withheld with them, and Task 2 Step 1's copy commands are replaced by a single line, because the corpus they copied was deleted on 2026-09-10 and is not re-importable. Every one of these is a label for a label: no task, step, ruling, count, verdict or date in this plan changed.

## Global Constraints

- **THE KEYSTONE RULE (spec 2):** `unsupported` requires positive proof the real page was read. **Harvest never writes `<doc>.claims.json`; it writes the draft only.** A proposal becomes a claim when the author moves it, and not before.
- **Harvest proposes nothing from a read that would not license an accusation** (spec 6.6, "Harvest reads only what is readable"). The predicate is `isReadable` from `src/classify/verdict.ts` - never `!isBlocked`, which admits every paywall stub and 22 of the 25 challenge fixtures. Only readable reads propose, and only readable reads vote in the frequency filter.
- **Nothing new becomes public** (spec 5.3). `src/index.ts` keeps exactly the exports it has at `ff71ec8`, `package.json`'s `exports` map stays `.` and `./package.json`, and `test/exports.test.ts` pins both. Every new module is imported by path inside `src/` and by the test suite; none is re-exported.
- **All source and test files are pure ASCII.** Check with `LC_ALL=C tr -d '\000-\177' < FILE | wc -c` -> must print `0`. **CORRECTED 2026-09-09 (Task 10):** this said "the one standing exception is `src/text/excerpt.ts`", and that was false of this repository before plan 2 began. There are **three** standing exceptions, and every dispatch from Task 6 onward named all three: `src/text/excerpt.ts` (**57** non-ASCII bytes), `test/text/excerpt.test.ts` (**45**) and `test/text/extract.test.ts` (**3**), the latter two from plan 1.2's `3f74990`. All three still carry those counts (re-measured 2026-09-09 over every tracked file); every other tracked `.ts` under `src/` and `test/` prints `0`. The false single-exception form never surfaced because no task touched those two test files, so every implementer's "0 non-ASCII on the files I touched" was true and consistent with it - a premise no evidence the checks collect could contradict. Write non-ASCII in source as backslash-u escapes and in tests with `String.fromCharCode` / `String.fromCodePoint`. **The tooling that applies edits has stored a backslash-u escape as the raw character before, twice in this repository's history: after every edit that writes one, re-run the byte count.** Fixtures are not source: `fixtures/**` may hold non-ASCII, and the four claims fixtures this plan freezes happen to be pure ASCII (verified 2026-09-08) - record the count, do not require zero.
- **No NUL bytes anywhere.** `LC_ALL=C tr -cd '\000' < FILE | wc -c` must print `0`, and the instrument is proved first: `printf 'a\0b' | LC_ALL=C tr -cd '\000' | wc -c` prints `1`.
- **`npm test` green and `npx tsc --noEmit` clean at every commit.** Never commit with a red test.
- **Conventional commit prefixes with the scope in parentheses**, as `git log --oneline -30` shows: `feat(classify)`, `feat(fetch)`, `feat(harvest)`, `fix(text)`, `docs(spec)`, `docs(readme)`, `test:`, `chore:`.
- **Every number written into a doc comes from a command run that day, and the command is named beside it.** Numbers this plan quotes from the spec are marked **re-derive; do not copy** with the command that re-derives them. Write what the command printed on the day. **If a re-run moves the observed ceiling above the floor, that is a finding to stop on and report in the ledger, not a number to explain away.**
- **A doc-drift sweep is over the whole document, not over the diff.** A task that changes behaviour names every existing README, CHANGELOG or spec sentence it falsifies - including sentences it did not touch - and fixes them in the same task. This is the defect class this repository is worst at: plan 1.2's final review found a Critical in a spec paragraph that no task had edited.
- **No unit test touches the network.** Build bodies inline with a stub fetcher, as `test/check.test.ts` does. `test/classify/claim-floor.test.ts` reads `fixtures/`, which `test/classify/acceptance.test.ts` already does; no other new test may.
- The origin repository (private) is **read-only** from this work. Reading files and `git -C <path> show|log|rev-parse` are the only permitted operations against it; never write, checkout, stash, add or commit there. Task 2 is the only task that touches it at all, and only to copy four files out.
- **Worktree environment.** `core.autocrlf=true`: files are CRLF on disk and LF in the index - do not convert them. Commit with `git -c core.safecrlf=false commit ...`. The Node binary is `python`'s neighbour `node`; the Python binary on this machine is `python`, not `python3`. `grep -P` fails in this locale - use `grep -E`. Every Bash call starts in a fresh cwd, so begin every command with `cd C:/Users/noaho/testimonium-plan2 &&`.

---

## Why this plan exists, and what it inherits

Fable's review of the first harvest design (`.superpowers/sdd/2026-09-08-plan-2-harvest/fable-design-review.md`, F1-F18, four BLOCKING) forced every choice in spec 8.2. Plan 1.2 landed the reader those findings required. What remains is harvest itself, the claim floor, and one correction plan 1.2 parked.

Three things this plan must not re-litigate:

1. **The readable predicate.** F1: `!isBlocked` is not "readable". Settled in spec 6.6 and shipped in `isReadable`.
2. **The floor's licence.** F6: it is *a priori* - a bare number, a year, a token like "the report" attests nothing about a source - and the measurement is its sanity check, not its derivation. Task 2 measures it anyway, because a measurement that contradicted the argument would be a finding.
3. **The filter order.** 13 Q5: floor, cross-source frequency, author rules, already-claimed, in that order.

And one thing it must take first, before any harvest code, because plan 1.2's ledger hands it here:

**R13, the N3 twin.** Spec 6.3:456-460 and the decision-table row at :1298 say the signature list "can withhold an accusation, never supply one". That is false, and was false at `main` before plan 1.2: `check.ts`'s union loop excludes a vetoed read's matches, so a claim carried only by an N3-vetoed read is `missed` when a readable later rung is judged, and N3 is then the but-for cause of an `unsupported`. Measured against `dist` at `ff71ec8` on 2026-09-08, with the exact bodies Task 1 uses: with the signature phrase present the verdict is `unsupported` and `missed` is `["spending rose sharply"]`; with the same body minus the signature phrase it is `supported`. Plan 1.2 parked the correction because it deserved a reviewed dispatch rather than an unreviewed controller edit of the binding spec. This is that dispatch.

## Decisions this plan takes, and where they come from

- **Both new thresholds land in Task 2, the calibration task; Task 3 gives the floor teeth.** 8.2 requires the calibration task's acceptance test to assert `harvestSeedChars >= minClaimChars`, which cannot be written before both constants exist. A constant with no consumer is inert, so nothing moves until Task 3 wires it in.
- **The seed-noise script does not exist and must be written.** The numbers 8.2 quotes (24.8 at L=13, 5.0 at 16, 0.9 at 20, 0.2 at 25) came from a scratch script in Fable's review session that was never committed and is in no git history. `.superpowers/sdd/2026-09-08-plan-2-harvest/probe-floor.mjs` does not produce them - it counts real claims matching unrelated document fixtures, which is the *floor* measurement, a different quantity. Task 2 commits `scripts/calibrate-harvest-seed.mjs` implementing F7's measure - **distinct maximal common spans per unrelated fixture pair, as `commonSpans` would emit them** - and reports the mean *and* the max at each L, as F7 did. (8.2's wording, "the mean count of chance L-gram matches per pair", describes seeds rather than emitted spans; F7's measure is the one that decides `harvestSeedChars`, because it is what the author would have to review. The wording discrepancy is flagged for the reviewer and is not resolved by editing the spec.)
- **Self-validation failures drop the span and are reported as `BUG:`.** 8.2 calls each of the three assertions "a bug if it fails"; F3c says the count is a bug signal, not a filter statistic, and that the exit code stays 0. A span that fails the fold round trip is not provably what the source says, so it must not reach the author - it is dropped *and* reported, and the drop is not counted in any filter's tally.
- **`SignalResult` gains `finalUrl`.** 8.2 step 2 requires the report to say when a readable read's `finalUrl` differs in path from the URL asked for, and nothing on `Read` carries it today. It is reported, never gated - `check`'s behaviour is byte-identical after this plan.
- **A missing `<doc>.claims.json` is not an error.** Harvest's whole migration story is a document that has no claims file yet. A file that *exists* and the loader refuses is exit 2 with the loader's own message (8.2 filter 4).
- **`--json` prints the draft to stdout instead of writing it**, the convention `reachability --json` follows (`bin.ts:128`). Under `--json` no draft file is read or written, so the overwrite rule does not apply, **and stdout carries the JSON and nothing else** - the per-URL report goes to stderr, so `harvest doc.md --json > draft.json` produces a file `jq` and an editor can read (Fable F6). `reachability --json` already prints pure JSON; `check --json` mixes report and JSON on stdout, and that inconsistency is plan 1's and is not widened here.
- **A draft entry with no surviving claims is omitted from the file, not written as `[]`.** `harvest()` reports one proposal entry per readable URL whether or not anything survived the filters, and `parseClaimsFile` refuses an empty array - so writing `"url": []` would break the migration story on its ordinary case: the author renames the draft and `check` exits 2 naming a key she never wrote (Fable F1). `buildDraft` is the single place that drops them, and the per-URL report line has already said that URL proposed 0. **DISAMBIGUATED 2026-09-09 (Task 10):** Task 9 carried this citation forward as a miscitation, and it is not one - it is AMBIGUOUS. Two Fable documents in this plan's workspace each number their findings from F1: the design review's F1 is the `!isBlocked`-versus-`isReadable` predicate finding (cited at `src/harvest/sources.ts` and `test/harvest/sources.test.ts`), and the plan review's F1 is this one, "exclude zero-claim entries from the draft file". Every "Fable F1" in this plan and in `src/` resolves to the right finding in its own document; nothing was relabelled. What is worth naming is that both review files are git-ignored scratch, so every `Fable F*` citation in shipped source outlives the document it points at.
- **The parked astral-fold item is RE-PARKED, with the argument, on 2026-09-08.** Plan 1.2's ledger (Task 5 minor) parked it here: `foldWithMap` iterates per UTF-16 unit, so an astral character is never case-folded, and "harvest is the consumer". This plan does not fix it. Fixing it means making `foldWithMap` iterate by code point rather than by UTF-16 unit - a behaviour change to a primitive plan 1.2 stabilised and pinned, in a task whose own job is to consume it. Its consumer here fails only in the safe direction: a span whose only difference from the source is the case of an astral character never matches, so `commonSpans` misses a proposal it could have made. A false MISS, never a false proposal and never a false accusation - the direction this tool is allowed to fail in. Re-parked for a future plan with that argument on the record rather than dropped, and Task 10's ledger step writes the line.
- **The `_note` overwrite rule is read as "byte-identical outside the version and date fields".** 8.2 says an existing draft is overwritten "only when its `_note` is byte-identical to the marker harvest would write". Read literally, a draft written yesterday could never be overwritten today, because today's marker carries today's date - which would make `harvest` unusable on its second day. The rule's purpose is to detect an author's edit, and that purpose is served exactly as well by requiring every byte outside the version and the date to match. **This is a deliberate reading of an ambiguous sentence, recorded here and in the ledger.**
- **Proposals for a URL are the union over *all* its readable reads**, not the best one. 8.2 step 2 says "Only readable reads propose or vote", plural; a node read and a curl read of the same URL can carry different text, and both were read.
- **`harvest` proposes what the author copied, not what the author claims.** That is the exposure harvest adds on top of the checker's, and the draft's `_note` and the README both say so. Nothing in this plan tries to close it.
- **No version bump.** `CHANGELOG.md` is `## 0.1.0 (unreleased)` with a section per plan, each saying its changes "landed ... before this version was released, so they carry no deprecation path". The claim floor is a breaking change for `check` against an existing claims file and is meant to be - and it lands before 0.1.0 ships, so it carries no deprecation path either. Task 9 does settle F13's other half: `VERSION` gets one source, `src/version.ts`, because harvest stamps it into a file the author keeps.

## File Structure

**Create:**
- `scripts/calibrate-claim-floor.mjs` - the floor probe, committed and re-runnable (Task 2).
- `scripts/calibrate-harvest-seed.mjs` - the seed-noise sweep (Task 2).
- `fixtures/claims/{source-a,source-b,source-c,source-d}-claims.json` and `fixtures/claims/provenance.json` (Task 2).
- `test/classify/claim-floor.test.ts` - the acceptance test for the two new constants (Task 2).
- `src/harvest/spans.ts` - `commonSpans` and the three self-validation assertions. One responsibility: turn two texts into the spans they share (Task 5).
- `src/harvest/sources.ts` - one responsibility: turn a document's footnotes into per-URL readable reads plus a reachability report (Task 6).
- `src/harvest/filters.ts` - one responsibility: the four filters, in order, with per-URL drop counts (Task 7).
- `src/harvest.ts` - the command, beside `src/check.ts` and `src/reachability.ts` (Task 8).
- `src/io/draft.ts` - the draft file's shape, its `_note` marker and its overwrite rule, beside `src/io/claims.ts` and `src/io/evidence.ts` (Task 8).
- `src/rules/boilerplate.ts` - the bundled boilerplate list, shipping empty (Task 7).
- `src/version.ts` - the one version string (Task 9).
- Tests: `test/harvest/spans.test.ts`, `test/harvest/sources.test.ts`, `test/harvest/filters.test.ts`, `test/harvest.test.ts`, `test/io/draft.test.ts`.

**Modify:**
- `docs/superpowers/specs/2026-09-06-testimonium-design.md` - 6.3:456-460, the rot paragraph, 7.2's rule contract and the table row at :1298 (Task 1); 7.3's measurement, three sentences of 8.2 and 13 Q3's resolution, which carries 7.3's numbers a second time (Task 10).
- `src/rules/challenge.ts`, `src/rules/load.ts` - comments carrying the same false claim as spec 6.3 (Task 1).
- `test/check.test.ts` - the N3 twin pin (Task 1); below-floor claim literals (Task 3); `RuleSet.boilerplate` in one literal (Task 7).
- `test/agreement.test.ts` - below-floor claim literals (Task 3).
- `test/fetch/read-source.test.ts` - the `finalUrl` pin (Task 6).
- `scripts/calibrate-harvest-seed.mjs` - its replica is replaced by the shipped `commonSpans` (Task 5).
- `src/classify/thresholds.ts` - `minClaimChars`, `harvestSeedChars` (Task 2).
- `src/io/claims.ts` - the floor's predicate, its message builder, the loader site (Task 3).
- `src/check.ts` - the front-door site (Task 3).
- `test/io/claims.test.ts` - below-floor claim literals, floor tests (Task 3).
- `src/adapters/gfm-footnotes.ts`, `src/adapters/types.ts` - `Document.prose` (Task 4).
- `test/adapters/gfm-footnotes.test.ts` (Task 4).
- `src/classify/signals.ts` - `SignalResult.finalUrl` (Task 6).
- `src/rules/load.ts` - `RuleSet.boilerplate` (Task 7).
- `test/rules/load.test.ts` (Task 7).
- `src/bin.ts` - `draftPathFor`, the third command, the usage string (Task 9).
- `src/index.ts`, `test/exports.test.ts` - the version source (Task 9).
- `test/bin.test.ts` (Task 9).
- `README.md`, `CHANGELOG.md`, `docs/calibration-2026-09.md` (Tasks 2 and 10).

**Not touched, in any task:** `src/classify/verdict.ts`, `src/classify/signals.ts` beyond the one reported field, `src/check.ts` beyond its front-door guard, `src/reachability.ts`, `src/fetch/**`, `src/text/**`, `src/rules/hosts.ts`, `src/rules/challenge.ts` beyond one comment, every existing fixture, `example/**`, and `package.json`. **No verdict moves in this plan.** `check`'s behaviour after Task 10 is byte-identical to `ff71ec8` for every input except a claims file or a caller that supplies a claim under the floor, which is now refused. If a task finds it needs to change anything else here, stop and record a ruling before touching it.

**Task order:** 1 (R13, the spec correction plan 1.2 parked) -> 2 (calibration, before any harvest code) -> 3 (the floor at three sites) -> 4 (`Document.prose`) -> 5 (`commonSpans`) -> 6 (reading the sources) -> 7 (the filters) -> 8 (the command and the draft file) -> 9 (the CLI) -> 10 (the ledger).

**Expected test count:** 281 at start; **283, 289, 293, 297, 305, 313, 323, 336, 341, 341** at the end of Tasks 1-10. If your count differs, count the tests you added and reconcile *before* committing - a count that drifted is a test that did not run.

---

### Task 1: R13 - the N3 twin, corrected in read voice and pinned

**Files:**
- Modify: `docs/superpowers/specs/2026-09-06-testimonium-design.md` (6.3, the paragraph at 456-460; the rot paragraph at 462-470; 7.2's rule contract at 766-768; the decision-table row at 1298)
- Modify: `src/rules/challenge.ts` (the header comment's third paragraph, lines 18-24 - comment only; it is NOT the comment's last paragraph, the pattern-guidance one at 26 follows it)
- Modify: `src/rules/load.ts` (the `loadRules` doc comment, lines 56-62 - comment only)
- Test: `test/check.test.ts` (one new `describe` with two tests)

**Interfaces:**
- Consumes: `check` from `src/check.js`; `THRESHOLDS`, `proseVolume` from `src/classify/thresholds.js`; `toText` from `src/text/extract.js`; the file's own `stub` helper. All are already imported at the top of `test/check.test.ts` (lines 1-8). **Add no imports.**
- Produces: nothing code-facing. No executable line changes in this task; the two source edits are comments.

**Why this task exists, and why it is first.** Plan 1.2's ledger, ruling R13, parked a false sentence in the binding spec and made it "a MANDATORY first item into the next plan's pre-flight". Spec 6.3:456-460 says the signature list "stops being able to mint an accusation ... Every verdict it decides is a withheld accusation, never a supplied one", and the decision table at :1298 repeats it. Both are false, and were false at `main` before plan 1.2: `src/check.ts:126-136` excludes a vetoed read's matches from the cross-read union, so a claim that only an N3-vetoed read carried is `missed` when a readable later rung is judged, and the verdict computed from that readable read is `unsupported`. N3 is the but-for cause of an accusation. This is not harvest code, which is why it precedes the calibration task 8.2 calls "first": the spec is the authority every later task argues from, and it must be true before they argue from it.

- [ ] **Step 1: Write the pin**

This pin characterizes behaviour that already ships, so it will pass on first run. Step 2 is what makes it a test rather than a decoration.

In `test/check.test.ts`, insert a new `describe` block immediately BEFORE the line `describe("check with a local RuleSet (Task 15)", () => {` (anchor on that text, not on a line number):

```ts
describe("N3 through the cross-read union (spec 6.3; plan 1.2 ledger R13)", () => {
  // The spec said the signature list "can withhold an accusation, never
  // supply one". It supplies one here. check.ts's union loop skips a VETOED
  // read's matches (a match inside a wall is the wall's text), so a claim
  // that ONLY the vetoed read carried is named in `missed` when a readable
  // later rung is judged - and removing the signature phrase, changing
  // nothing else, turns the same pair of responses into `supported`. The
  // veto is the but-for cause of the accusation.
  //
  // Pre-existing at 3974d27: the union machinery is unchanged from it, and
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
    // read, which fired no rule, and an unsupported result carries no
    // renderable field at all (spec 7.4).
    expect(r).not.toHaveProperty("firedRule");
    expect(r).not.toHaveProperty("evidence");
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
```

- [ ] **Step 2: Prove each test can fail**

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/check.test.ts`
Expected: all pass, 2 more than before.

Now prove the discriminating power of each, one mutation at a time, restoring after each:

**(a)** In `src/check.ts`, comment out the line `if (isBlocked(r.computed.signals)) continue;` (line 134) inside the `locatedBy` loop.
Run: `npx vitest run test/check.test.ts -t "SUPPLIES an accusation"`
Expected: FAIL, `expected 'supported' to be 'unsupported'` - with the vetoed read's match admitted to the union, nothing is missed. Restore the line; `git diff --stat src/check.ts` must print nothing.

**(b)** In the test, temporarily change `NO_SIGNATURE`'s `<p>One moment please.</p>` to `<p>Just a moment.</p>`.
Run: `npx vitest run test/check.test.ts -t "without the signature phrase"`
Expected: FAIL, `expected 'unsupported' to be 'supported'`. Restore `One moment please.`

Both mutations are the mechanism the spec sentence denies. Record both failure messages in the ledger.

- [ ] **Step 3: Correct spec 6.3's paragraph, in read voice**

In `docs/superpowers/specs/2026-09-06-testimonium-design.md`, replace the whole paragraph at 456-460 - it begins `**The signature list stops being able to mint an accusation.**` and ends `never a supplied one.` - with:

```
**The signature list stops being able to mint an accusation from the read it
vetoes.** N3 vetoes when a signature matches AND the body is under the length
cap, and that veto stands even where the claims would otherwise have matched in
full: the vetoed read is never judged on its own, and no `unsupported` is ever
computed from a wall's signals. What the veto does not withhold is an accusation
supplied by a LATER read. A vetoed read's matches are excluded from the
cross-rung union (`src/check.ts`, `locatedBy`), so a claim that only the vetoed
read carried is named in `missed` when a readable later rung is judged - and the
veto is then the but-for cause of an `unsupported` that the readable read alone
would not have produced. Measured 2026-09-08 against the shipped build: a
signature-carrying body under the cap holding claim A, followed by a readable
body holding claim B and not A, returns `unsupported` with A missed; the same
body with the signature phrase removed returns `supported`. This paragraph said
"Every verdict it decides is a withheld accusation, never a supplied one" until
2026-09-08. That was false at 3974d27 and at every commit since - the union
machinery is unchanged from it - and it is the twin of the false status claim the
N4 paragraph below has now corrected twice. It is corrected here rather than left
standing, for the reason given there: this document is the authority every ruling
resolves against, so a sentence in it that has gone quietly false is worse than
one in the code. Pinned by `test/check.test.ts`, "N3 through the cross-read
union".
```

- [ ] **Step 4: Sweep the rest of 6.3 - the rot paragraph carries the same false claim**

This is the doc-drift sweep, and it is over the document, not the diff. The paragraph immediately following (462-470) ends:

```
and an over-broad entry costs an attestation rather than truth - a real document
that matches it and is short reads `unreachable` where it would have read
`supported`.
```

That is falsified by exactly the mechanism Step 3 records: an over-broad entry matching a short REAL read costs an accusation, not merely an attestation, whenever a later rung produced a readable read. Replace those three lines with:

```
and an over-broad entry costs an attestation where the vetoed read is the only
read - a real document that matches it and is short reads `unreachable` where it
would have read `supported`. Where a later rung produced a readable read the cost
is larger than an attestation: the vetoed read's matches leave the union, so a
claim only it carried is named in `missed` and the citation reads `unsupported`.
Corrected 2026-09-08 with the paragraph above; the same mechanism, stated where
the cost is claimed.
```

- [ ] **Step 5: Correct the decision table row**

Line 1298 reads:

```
| Burden-of-proof inversion; the signature list can withhold an accusation, never supply one | 6, 6.3 |
```

Replace with:

```
| Burden-of-proof inversion; the signature list withholds an accusation from the read it vetoes, and can supply one from a later readable read through the union | 6, 6.3 |
```

- [ ] **Step 6: Sweep 7.2 - a pre-existing false sentence of the same family**

7.2:766-768 says:

```
**A rule may add a fetch attempt. It may never subtract one, and it may never
decide a verdict.** The generic ladder always runs in full. Under that contract a
stale rule costs one wasted request - latency, not correctness.
```

The section covers host rules AND challenge signatures, and the second half is false for signatures and paths: N2 and N3 are rule-driven vetoes, which is why `src/rules/load.ts:56-62` already says the additive-only argument "is NOT complete for signature and path rules". This sentence was false before this plan; it is fixed here rather than parked, because it sits in the same family as the sentence Step 3 corrects and leaving a known-false sentence in the binding authority is the failure R13 exists to correct. Replace with:

```
**A HOST rule may add a fetch attempt. It may never subtract one, and it may
never decide a verdict.** The generic ladder always runs in full. Under that
contract a stale host rule costs one wasted request - latency, not correctness.
**Signature and path rules are not under that contract**: they feed N2 and N3,
which veto a read, so an over-broad entry can cost correctness - 6.3 says what
that cost is. `src/rules/load.ts`'s own comment has said so since plan 1's
ruling C13; this sentence had not. Corrected 2026-09-08: it generalised a host
rule's contract to all three lists, and was false for two of them.
```

**CORRECTED 2026-09-09 (Task 10):** the block above is the text Task 1 was told to write, and it is not the text that shipped. Task 1's review (Important 4) found the attribution wrong - `git log -S "signature and path rules" -- src/rules/load.ts` returns only `e4d9f46`, plan 1's final fix wave, fifteen commits after C13's `7a0cf6f` - so the shipped spec reads "since plan 1's final fix wave (`e4d9f46`)". Read this block as the instruction, not as the spec.

- [ ] **Step 7: Sweep the two source comments carrying the same claim**

`src/rules/challenge.ts`, in the `CHALLENGE_SIGNATURES` header comment: replace the run of lines that begins ` * It is NOT true that a match never decides a verdict, and this comment said` and ends ` * still change an outcome.` - **lines 18-24, seven lines**. It is the comment's THIRD paragraph, not its last: line 25 is ` *` and the pattern-guidance paragraph begins at line 26 and must survive untouched. Anchor on the two texts, not on the numbers, and check line 26 is still there afterwards. Replace with:

```
 * It is NOT true that a match never decides a verdict, and this comment said
 * so until 2026-09-07. A match on a body under THRESHOLDS.maxChallengeChars
 * is N3, which `isBlocked` ORs into the veto set. Since plan 1.2 that veto
 * ends the READ, not the citation: the ladder climbs past it, and the
 * citation reads `unreachable` only when no rung produced a readable read
 * and none matched in full (spec 6.6).
 *
 * The list ROTTING - failing to name a wall - changes no outcome a complete
 * list would have prevented: above maxChallengeChars N3 cannot fire at all,
 * and below it everything the list misses still has to clear the prose floor.
 * (Spec 6.3 scopes the rot argument the same way, and records that draft 1
 * stated it without the condition. Above the floor neither protection
 * applies - that is 6.3's known gap, and rot does not widen it.) An
 * OVER-BROAD entry can cost truth. A signature matching a short REAL read
 * takes that read's matches out of check()'s cross-rung union, so a claim
 * only it carried is named in `missed` when a readable later rung is judged -
 * a false accusation, not a lost attestation (spec 6.3, corrected 2026-09-08;
 * pinned by test/check.test.ts, "N3 through the cross-read union").
```

The first half of that replacement corrects a second, separate drift the sweep turns up: "forces `unreachable` on its own" was true when written and was falsified by plan 1.2's escalation, in exactly the way the spec's N4 paragraph records for N4.

The rot sentence is scoped rather than left unconditional, because the unconditional form is the exact sentence spec 6.3 records draft 1 getting wrong ("The rot argument survives, but only below the prose floor, and draft 1 stated it without that condition"). It survives under a marginal-cost reading - a complete list could not have vetoed an above-the-cap body either, so rot changes no outcome - but a comment that pattern-matches a recorded error should say which reading it means. **CORRECTED 2026-09-09 (Task 10):** the sentence quoted here is spec 6.3 as it stood before Task 1, and Task 1's own five fix rounds rewrote it. It now reads "The rot argument survives below the prose floor in the accusation direction only, and draft 1 stated it without either condition" - two conditions, direction as well as floor, which is the axis three of Task 1's sweeps missed. Read the quote as the state of the spec when this plan was written.

`src/rules/load.ts`, in the `loadRules` doc comment, the clause `can turn a real document into a false `unreachable`` (line 59) understates the same cost. Replace `can turn a real document into a false `unreachable`` with:

```
 * can turn a real document into a false `unreachable` - or, where a later rung
 * read a document, into a false `unsupported`, because the vetoed read's
 * matches leave the union (spec 6.3)
```

Both edits are comment-only. `git diff -w --stat src/` must show only these two files, and running the suite must not change a single count.

- [ ] **Step 8: Byte checks**

```bash
cd C:/Users/noaho/testimonium-plan2 && printf 'a\0b' | LC_ALL=C tr -cd '\000' | wc -c
```
Expected: `1` (the instrument can fail).

```bash
cd C:/Users/noaho/testimonium-plan2 && for f in docs/superpowers/specs/2026-09-06-testimonium-design.md src/rules/challenge.ts src/rules/load.ts test/check.test.ts; do printf "%s nonascii=" "$f"; LC_ALL=C tr -d '\000-\177' < "$f" | wc -c; printf "%s nul=" "$f"; LC_ALL=C tr -cd '\000' < "$f" | wc -c; done
```
Expected: `nonascii=0` and `nul=0` for all four. If the spec's count is not 0, an em-dash or a smart quote was introduced - find it and replace it with hyphen-minus or a straight quote.

- [ ] **Step 9: Full suite and typecheck**

```bash
cd C:/Users/noaho/testimonium-plan2 && npm test && npx tsc --noEmit
```
Expected: **283 passed**, typecheck silent.

- [ ] **Step 10: Commit**

```bash
cd C:/Users/noaho/testimonium-plan2 && git add docs/superpowers/specs/2026-09-06-testimonium-design.md src/rules/challenge.ts src/rules/load.ts test/check.test.ts && git -c core.safecrlf=false commit -m "docs(spec): the signature list can supply an accusation through the union (R13)"
```

---

### Task 2: Calibration, before any harvest code

**Files:**
- Create: `fixtures/claims/source-a-claims.json`, `fixtures/claims/source-b-claims.json`, `fixtures/claims/source-c-claims.json`, `fixtures/claims/source-d-claims.json`, `fixtures/claims/provenance.json`
- Create: `scripts/calibrate-claim-floor.mjs`, `scripts/calibrate-harvest-seed.mjs`
- Modify: `src/classify/thresholds.ts` (the file header comment; two new entries)
- Modify: `docs/calibration-2026-09.md` (the H1; a new section at the end)
- Test: `test/classify/claim-floor.test.ts`

**Interfaces:**
- Consumes: `toText` from `src/text/extract.js`; `norm`, `phraseFound` from `src/text/normalize.js`; `foldWithMap` from `src/text/excerpt.js`; `fixtures/corpus.json`'s `{ path, kind }` rows.
- Produces: `THRESHOLDS.minClaimChars: number` and `THRESHOLDS.harvestSeedChars: number`, both from `src/classify/thresholds.ts`. Task 3 consumes the first, Task 5 the second, Task 7 both.

**Why calibration comes before code (spec 8.2).** "Calibrating after the reducer and its tests exist is the single most expensive mistake available here" - spec 13 Q1, learned in plan 1. Two numbers decide what harvest proposes and what every entry point refuses, and both must be measured by a committed, re-runnable script against inputs frozen in this repo, so that a reader a year from now can reproduce them without the origin repo and without trusting this plan.

**READ-ONLY WARNING.** The origin repository (private) is another session's live working tree. In this task you may **only** read files under it and run `git -C <origin repo path withheld> show|log|rev-parse`. Never `cd` into it, never write, checkout, stash, add or commit there.

- [ ] **Step 1: Freeze the four claims files**

**Commands withheld 2026-09-10.** The four copies that imported the corpus out of the origin repository are removed: the corpus was deleted on 2026-09-10 and is not re-importable; what survives is `fixtures/claim-lengths.json`.

`source-c-claims.json` is NOT on the origin repository's `master`; it exists only on the branch `source-c-longform`, whose tip was the pinned commit (withheld). That ref is the fixture's provenance and must be recorded.

- [ ] **Step 2: Record provenance beside the fixtures**

Collect the inputs:

```bash
cd C:/Users/noaho/testimonium-plan2 && ls -l --time-style=long-iso <origin repo path withheld>/docs/drafts/source-a-claims.json <origin repo path withheld>/docs/drafts/source-b-claims.json <origin repo path withheld>/docs/drafts/source-d-claims.json && git -C <origin repo path withheld> rev-parse <pinned origin commit withheld> && date +%Y-%m-%d
```

Then write `fixtures/claims/provenance.json`, the way `fixtures/corpus.json` records the corpus - **substituting the mtimes and date the commands above printed, and the per-file claim counts the script in Step 3 prints**. The values below are what those commands printed on 2026-09-08; **re-derive, do not copy.**

```json
[
  {
    "file": "source-a-claims.json",
    "origin": "the origin repository (private)",
    "path": "docs/drafts/source-a-claims.json",
    "ref": "working tree",
    "mtime": "2026-09-06 21:14",
    "frozen": "2026-09-08",
    "claimStrings": 70
  },
  {
    "file": "source-b-claims.json",
    "origin": "the origin repository (private)",
    "path": "docs/drafts/source-b-claims.json",
    "ref": "working tree",
    "mtime": "2026-09-03 09:40",
    "frozen": "2026-09-08",
    "claimStrings": 20
  },
  {
    "file": "source-c-claims.json",
    "origin": "the origin repository (private)",
    "path": "docs/drafts/source-c-claims.json",
    "ref": "the pinned origin commit (withheld)",
    "note": "branch source-c-longform; not present on master",
    "frozen": "2026-09-08",
    "claimStrings": 89
  },
  {
    "file": "source-d-claims.json",
    "origin": "the origin repository (private)",
    "path": "docs/drafts/source-d-claims.json",
    "ref": "working tree",
    "mtime": "2026-09-05 22:08",
    "frozen": "2026-09-08",
    "claimStrings": 31
  }
]
```

A "working tree" ref is weaker provenance than a commit hash and is recorded as such: those three files are uncommitted in the origin repo, and the mtime is all there is. Say that in the calibration doc rather than dressing it up.

- [ ] **Step 3: Commit the floor probe as `scripts/calibrate-claim-floor.mjs`**

Create the file with exactly this content:

```js
/**
 * The claim floor's measurement, re-runnable. RUN BY HAND, after a build:
 *   npm run build && node scripts/calibrate-claim-floor.mjs
 * Record the output in docs/calibration-2026-09.md with this command beside
 * every number it produced.
 *
 * THE QUESTION: does a real, hand-authored claim ever match a page it was not
 * written about? Every claim in fixtures/claims/ is tested against every
 * `document` fixture in fixtures/corpus.json - all unrelated to all of them -
 * with the matcher check() itself uses. The longest claim that matches an
 * unrelated page is the CEILING. The floor must sit above it with margin.
 *
 * The floor's LICENCE is a priori (spec 7.3): a bare number, a year, or a
 * token like "the report" attests nothing about a source, and a match on one
 * is a coincidence the checker cannot tell from evidence. This script is the
 * sanity check, not the derivation. A run that puts the ceiling at or above
 * THRESHOLDS.minClaimChars is a finding to stop on and report, not a number
 * to explain away.
 *
 * Descended from the review-session probe kept in the git-ignored SDD
 * workspace, which imported dist through absolute file:/// URLs into another
 * checkout, read the claims out of the origin repo, and counted a
 * `notApplicable` reason string as a claim. All three are fixed here: the
 * imports are relative to dist/ the way scripts/sweep-floor.mjs's are, the
 * claims come from the frozen fixtures, and the walker skips notApplicable.
 */
import { readFileSync, readdirSync } from "node:fs";
import { toText } from "../dist/text/extract.js";
import { norm, phraseFound } from "../dist/text/normalize.js";
import { THRESHOLDS } from "../dist/classify/thresholds.js";

const CLAIMS_DIR = "fixtures/claims";

const corpus = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));
const docs = corpus
  .filter((f) => f.kind === "document")
  .map((f) => ({ path: f.path, text: toText(readFileSync(f.path, "utf8")) }));

/**
 * Every claim STRING in a claims file, whichever shape it has - keyed by
 * footnote number or keyed by URL - and nothing that is not a claim: a key
 * beginning with "_" is a note for a human reader, and a
 * {"notApplicable": "<reason>"} object's reason is prose about why a URL is
 * not checkable. Counting either as a claim would put non-claims into a
 * population that licenses a threshold.
 */
function walk(v, out) {
  if (typeof v === "string") {
    out.push(v);
    return;
  }
  if (Array.isArray(v)) {
    for (const x of v) walk(x, out);
    return;
  }
  if (v && typeof v === "object") {
    if (typeof v.notApplicable === "string") return;
    for (const [k, x] of Object.entries(v)) if (!k.startsWith("_")) walk(x, out);
  }
}

const files = readdirSync(CLAIMS_DIR).filter((f) => f.endsWith("-claims.json")).sort();
const all = [];
for (const f of files) {
  const before = all.length;
  walk(JSON.parse(readFileSync(`${CLAIMS_DIR}/${f}`, "utf8")), all);
  console.log(`  ${f}: ${all.length - before} claim strings`);
}
const claims = [...new Set(all)];

console.log(`document fixtures: ${docs.length}, ${docs.reduce((a, d) => a + d.text.length, 0)} chars`);
console.log(`claim strings: ${all.length}, distinct: ${claims.length}`);

const rows = claims.map((c) => ({
  c,
  n: norm(c).length,
  hits: docs.filter((d) => phraseFound(d.text, c)).length,
}));

for (const [lo, hi] of [[1, 10], [11, 20], [21, 30], [31, 40], [41, 60], [61, 1e9]]) {
  const band = rows.filter((r) => r.n >= lo && r.n <= hi);
  const bad = band.filter((r) => r.hits > 0);
  console.log(`norm length ${lo}-${hi === 1e9 ? "up" : hi}: ${band.length} claims, ${bad.length} matching an unrelated fixture`);
}

const spurious = rows.filter((r) => r.hits > 0).sort((a, b) => b.n - a.n);
console.log("spurious matches (claim | normalized length | unrelated fixtures hit):");
for (const r of spurious) console.log(`  ${JSON.stringify(r.c)} | ${r.n} | ${r.hits}`);

const ceiling = spurious.length === 0 ? 0 : spurious[0].n;
console.log(`CEILING (longest claim matching an unrelated fixture): ${ceiling}`);
console.log(`FLOOR (THRESHOLDS.minClaimChars): ${THRESHOLDS.minClaimChars}, margin ${THRESHOLDS.minClaimChars - ceiling}`);
console.log(`refused at F: ${[8, 12, 16, 20, 25, 30, 40].map((F) => `${F}:${rows.filter((r) => r.n < F).length}`).join("  ")}`);
if (ceiling >= THRESHOLDS.minClaimChars) {
  console.log("STOP: the observed ceiling has reached the floor. Report this; do not adjust the number to fit.");
}
```

It imports `THRESHOLDS.minClaimChars`, which Step 5 adds. Run it after Step 5, not before.

- [ ] **Step 4: Commit the seed sweep as `scripts/calibrate-harvest-seed.mjs`**

Create the file with exactly this content:

```js
/**
 * The harvest seed length's measurement, re-runnable. RUN BY HAND, after a
 * build:
 *   npm run build && node scripts/calibrate-harvest-seed.mjs [L-to-classify]
 *
 * THE QUESTION harvest's precision turns on: how many spans does
 * seed-and-extend emit between two texts that have nothing to do with each
 * other? Every unordered pair of the `document` fixtures is unrelated by
 * construction, so every span emitted from a pair is noise an author would
 * have to read and reject. The count per pair, at each candidate seed length,
 * is what harvestSeedChars is chosen from.
 *
 * It measures what commonSpans EMITS - after extension, word-boundary
 * snapping, whitespace collapse and containment dedupe - not raw L-gram
 * seeds. Emitted spans are what an author reviews; seeds are not.
 *
 * SELECTION RULE, stated before the run so the number is chosen by a rule
 * rather than by taste: harvestSeedChars is the SMALLEST L in 20..25 (spec
 * 8.2's band) whose MEAN count of emitted above-floor spans per unrelated
 * pair is below 1.0 - fewer than one chance proposal per unrelated source.
 * If no L in the band qualifies, take 25 and record that none did.
 *
 * No committed script ever produced the figures spec 8.2 quotes (24.8 / 5.0 /
 * 0.9 / 0.2 at L = 13 / 16 / 20 / 25). They came from a scratch script in the
 * design review, kept nowhere. This one replaces them; expect the shape to
 * agree and the digits to differ.
 */
import { readFileSync } from "node:fs";
import { toText } from "../dist/text/extract.js";
import { foldWithMap } from "../dist/text/excerpt.js";
import { norm } from "../dist/text/normalize.js";
import { THRESHOLDS } from "../dist/classify/thresholds.js";

const SWEEP = [13, 16, 20, 21, 22, 23, 24, 25, 30];

const corpus = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));
const docs = corpus
  .filter((f) => f.kind === "document")
  .map((f) => ({ path: f.path, text: toText(readFileSync(f.path, "utf8")) }));

/** First occurrence of every L-gram of the folded document. Built once per
 *  call so the source scan is a lookup per position rather than an indexOf
 *  over the whole document - what spec 8.2 means by "linear in the source". */
function seedIndex(folded, L) {
  const ix = new Map();
  for (let i = 0; i + L <= folded.length; i++) {
    const g = folded.slice(i, i + L);
    if (!ix.has(g)) ix.set(g, i);
  }
  return ix;
}

/** A word character in fold space; a token ends at punctuation too. */
const WORD = /[\p{L}\p{N}]/u;
const wordAt = (t, i) => i >= 0 && i < t.length && WORD.test(t[i]);

function dropContained(spans) {
  const kept = [];
  const normed = [];
  for (const span of spans) {
    const n = norm(span);
    if (!n) continue;
    if (normed.some((p) => p.includes(n))) continue;
    for (let k = normed.length - 1; k >= 0; k--) {
      if (n.includes(normed[k])) {
        normed.splice(k, 1);
        kept.splice(k, 1);
      }
    }
    normed.push(n);
    kept.push(span);
  }
  return kept;
}

/**
 * REPLICA of src/harvest/spans.ts's emit rules. Task 5 of plan 2 deletes this
 * function and imports the real `commonSpans` instead, then re-runs this
 * script to prove the numbers did not move. Until commonSpans exists this is
 * what there is, and the plan says so rather than pretending otherwise.
 */
function spansOf(docProse, sourceText, L) {
  const D = foldWithMap(docProse);
  const S = foldWithMap(sourceText);
  const ix = seedIndex(D.folded, L);
  const candidates = [];
  let i = 0;
  while (i + L <= S.folded.length) {
    const at = ix.get(S.folded.slice(i, i + L));
    if (at === undefined) {
      i++;
      continue;
    }
    let end = i + L;
    let d = at + L;
    while (end < S.folded.length && d < D.folded.length && S.folded[end] === D.folded[d]) {
      end++;
      d++;
    }
    let begin = i;
    let c = at;
    while (begin > 0 && c > 0 && S.folded[begin - 1] === D.folded[c - 1]) {
      begin--;
      c--;
    }
    i = Math.max(end, i + 1);
    let s = begin;
    let cs = c;
    let e = end;
    let de = d;
    while (e > s && (wordAt(S.folded, e) || wordAt(D.folded, de))) {
      e--;
      de--;
    }
    while (s < e && (wordAt(S.folded, s - 1) || wordAt(D.folded, cs - 1))) {
      s++;
      cs++;
    }
    while (s < e && S.folded[s] === " ") s++;
    while (e > s && S.folded[e - 1] === " ") e--;
    if (e <= s) continue;
    const span = sourceText.slice(S.map[s], S.map[e - 1] + 1).replace(/\s+/g, " ").trim();
    if (span) candidates.push(span);
  }
  return dropContained(candidates);
}

const pairs = [];
for (let a = 0; a < docs.length; a++) for (let b = a + 1; b < docs.length; b++) pairs.push([docs[a], docs[b]]);

const mean = (xs) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
console.log(`document fixtures: ${docs.length}, unrelated pairs: ${pairs.length}`);
console.log(`floor (THRESHOLDS.minClaimChars): ${THRESHOLDS.minClaimChars}`);
for (const L of SWEEP) {
  const emitted = [];
  const above = [];
  for (const [src, doc] of pairs) {
    const spans = spansOf(doc.text, src.text, L);
    emitted.push(spans.length);
    above.push(spans.filter((x) => norm(x).length >= THRESHOLDS.minClaimChars).length);
  }
  console.log(
    `L=${String(L).padStart(2)}  emitted mean ${mean(emitted)} max ${Math.max(...emitted)}` +
      `  |  above floor mean ${mean(above)} max ${Math.max(...above)}`,
  );
}

const CLASSIFY_L = Number(process.argv[2] ?? THRESHOLDS.harvestSeedChars);
const seen = new Map();
for (const [src, doc] of pairs) {
  for (const span of spansOf(doc.text, src.text, CLASSIFY_L)) {
    const k = norm(span);
    if (k.length < THRESHOLDS.minClaimChars) continue;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
}
console.log(`\ndistinct above-floor cross-fixture spans at L=${CLASSIFY_L}: ${seen.size} - the hand-classification population`);
for (const [k, n] of [...seen].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))) {
  console.log(`  ${String(n).padStart(2)} pairs | ${k.length} | ${JSON.stringify(k)}`);
}
```

- [ ] **Step 5: Add the two thresholds, and amend the file's own header**

`src/classify/thresholds.ts`'s header says "Every number that can change a verdict, in one place" and lists which entries are calibrated and which are not. Both statements go stale the moment `harvestSeedChars` lands, because it changes what harvest PROPOSES and can never change a verdict. Amend the header before adding the entries.

Replace the header's first paragraph:

```
/**
 * Every number that can change a verdict, in one place. See
 * docs/calibration-2026-09.md for the measured populations behind them.
```

with:

```
/**
 * Every number that decides what this tool reads, refuses or proposes, in one
 * place. See docs/calibration-2026-09.md for the measured populations behind
 * them. Four of the six can change a VERDICT; `minClaimChars` refuses an
 * input before any verdict exists, and `harvestSeedChars` changes only what
 * harvest proposes - everything it proposes is judged afterwards by check()
 * like any hand-written claim. Each entry's own docstring says which it is.
```

Then the paragraph immediately below it, which the two new entries also falsify - neither is a read-boundary, and neither is re-derived by `scripts/calibrate.mjs`. Replace

```
 * These are NOT tunable constants. They are the boundary between "we read a
 * document" and "we did not". Changing one without rerunning
 * scripts/calibrate.mjs against the corpus is a keystone violation.
```

with

```
 * These are NOT tunable constants. The four VERDICT entries are the boundary
 * between "we read a document" and "we did not"; `minClaimChars` refuses an
 * input before any verdict exists and `harvestSeedChars` only changes what
 * harvest proposes, so neither is that boundary. Changing any entry without
 * rerunning the script its own docstring names - scripts/calibrate.mjs for
 * the verdict entries, scripts/calibrate-claim-floor.mjs and
 * scripts/calibrate-harvest-seed.mjs for the two below them - against the
 * population that docstring names is a keystone violation.
```

**This edit is the point of the step as much as the entries are.** A task that adds two entries and leaves the header describing six as read-boundaries re-derived by one script has created doc drift inside the very file it was editing.

Then, in the paragraph beginning `**They are not all licensed the same way, and the difference matters.**`, replace the sentence

```
 * `maxChallengeChars`, `maxBinaryDensity` and `binarySampleCodePoints` are
 * NOT swept against anything - each one's own docstring says so, and says what
 * evidence there is instead.
```

with

```
 * `minClaimChars` is licensed a priori and CONFIRMED by measurement
 * (scripts/calibrate-claim-floor.mjs, bound by
 * test/classify/claim-floor.test.ts); `harvestSeedChars` is chosen by a rule
 * stated before its sweep was run (scripts/calibrate-harvest-seed.mjs).
 * `maxChallengeChars`, `maxBinaryDensity` and `binarySampleCodePoints` are
 * NOT swept against anything - each one's own docstring says so, and says what
 * evidence there is instead.
```

Now add the two entries after `binarySampleCodePoints: 65_536,` and before the closing `} as const;`. **Every bracketed number below is what the two scripts printed on 2026-09-08 - re-derive; do not copy.** Run the scripts (Steps 6 and 7), then write what they printed:

```ts
  /** The shortest claim that can attest anything about a source, applied to
   *  `norm(claim).length`. REFUSED, not warned about, at all three entries -
   *  the claims-file loader, `check()`'s front door and harvest's first
   *  filter - with one message naming the claim, its length, the floor and
   *  the remedy (spec 7.3; 13 Q3). A warning that a claim proves nothing
   *  leaves it proving nothing while the run still passes.
   *
   *  It does not change a verdict. It refuses an input before there is a
   *  verdict to change, which is why it is uniform across the three doors: a
   *  floor one door enforces and another does not is a floor with a way past
   *  it.
   *
   *  **Licensed a priori, confirmed by measurement.** A bare number, a year,
   *  or a token like "the report" attests nothing about a source, and a match
   *  on one is a coincidence this tool cannot tell from evidence. The
   *  measurement below is the sanity check, not the derivation - see Fable
   *  F6: "smallest F admitting zero spurious" would be a fit to two events.
   *
   *  Measured 2026-09-08 with `node scripts/calibrate-claim-floor.mjs` over
   *  the 208 distinct real claims frozen in `fixtures/claims/` against the 10
   *  unrelated `document` fixtures: 2 claims matched a page they were not
   *  written about ("169" at 3 normalized characters, "SAUDI ARABIA" at 12),
   *  none above 12, and this floor refuses 18 of 208 (8.7 percent), each a
   *  number, a name or a fragment that states no proposition. 16 is that
   *  ceiling plus margin. `test/classify/claim-floor.test.ts` binds it. A
   *  re-run that puts the ceiling at or above this number is a finding to act
   *  on. */
  minClaimChars: 16,
  /** Harvest's seed length: the L of the L-grams of the folded source that
   *  `commonSpans` looks for in the folded document (spec 8.2 step 3).
   *
   *  DISTINCT from `minClaimChars`, and the distinction is the point: the
   *  seed sets what extension can FIND, the floor sets what may be PROPOSED.
   *  A seed below the floor finds the same maximal spans plus shorter ones
   *  the floor then refuses, so it buys nothing and costs noise; a seed above
   *  the floor is the precision knob. `harvestSeedChars >= minClaimChars` is
   *  asserted by test/classify/claim-floor.test.ts.
   *
   *  It cannot change a verdict. It changes what harvest proposes, and every
   *  proposal is afterwards judged by check() exactly as a hand-written claim
   *  is. It lives here because spec 8.2 calls it a threshold and this file
   *  holds them, not because it gates anything.
   *
   *  Chosen 2026-09-08 by the rule stated in
   *  scripts/calibrate-harvest-seed.mjs - the smallest L in 20..25 whose mean
   *  count of emitted above-floor spans per unrelated fixture pair is below
   *  1.0 - from `node scripts/calibrate-harvest-seed.mjs` over the 45
   *  unrelated pairs of the 10 document fixtures. Emitted spans per pair,
   *  above the floor: mean 2.0 at L=13, 2.2 at 16, 1.2 at 20, 0.9 at 21, 0.3
   *  at 25. L=20 does not satisfy the rule and L=21 does. The longest
   *  cross-fixture span at any L is 27 normalized characters, "Terms of Use
   *  Privacy Policy" - boilerplate, which is filter 2's job, not this
   *  number's. */
  harvestSeedChars: 21,
```

**If the re-run's numbers do not satisfy the selection rule at 20, write the L the rule picks and rewrite the sentence to match. Never keep a number the rule did not pick.**

- [ ] **Step 6: Build and run the floor probe**

```bash
cd C:/Users/noaho/testimonium-plan2 && npm run build && node scripts/calibrate-claim-floor.mjs
```

Expected shape (2026-09-08 values - **re-derive**):

```
  source-a-claims.json: 70 claim strings
  source-b-claims.json: 20 claim strings
  source-c-claims.json: 89 claim strings
  source-d-claims.json: 31 claim strings
document fixtures: 10, 367390 chars
claim strings: 210, distinct: 208
norm length 1-10: 14 claims, 1 matching an unrelated fixture
norm length 11-20: 12 claims, 1 matching an unrelated fixture
norm length 21-30: 20 claims, 0 matching an unrelated fixture
norm length 31-40: 21 claims, 0 matching an unrelated fixture
norm length 41-60: 59 claims, 0 matching an unrelated fixture
norm length 61-up: 82 claims, 0 matching an unrelated fixture
spurious matches (claim | normalized length | unrelated fixtures hit):
  "SAUDI ARABIA" | 12 | 1
  "169" | 3 | 1
CEILING (longest claim matching an unrelated fixture): 12
FLOOR (THRESHOLDS.minClaimChars): 16, margin 4
refused at F: 8:7  12:15  16:18  20:26  25:34  30:46  40:65
```

Note for the ledger: spec 7.3 says "203 distinct real claims" and "18 of the 203". The population is 208 distinct today, because the three working-tree files have changed in the origin repo since that sentence was written. This is exactly why the fixtures are frozen. The refusal count at 16 is unchanged; the denominator is not.

- [ ] **Step 7: Run the seed sweep and apply the selection rule**

```bash
cd C:/Users/noaho/testimonium-plan2 && node scripts/calibrate-harvest-seed.mjs
```

Expected shape (2026-09-08 values - **re-derive**):

```
document fixtures: 10, unrelated pairs: 45
floor (THRESHOLDS.minClaimChars): 16
L=13  emitted mean 26.6 max 241  |  above floor mean 2.0 max 15
L=16  emitted mean 7.7 max 66  |  above floor mean 2.2 max 19
L=20  emitted mean 1.2 max 10  |  above floor mean 1.2 max 9
L=21  emitted mean 0.9 max 5  |  above floor mean 0.9 max 5
L=22  emitted mean 0.7 max 4  |  above floor mean 0.7 max 4
L=23  emitted mean 0.5 max 3  |  above floor mean 0.5 max 3
L=24  emitted mean 0.4 max 2  |  above floor mean 0.4 max 2
L=25  emitted mean 0.3 max 2  |  above floor mean 0.3 max 2
L=30  emitted mean 0.0 max 1  |  above floor mean 0.0 max 1
```

Apply the rule literally: the smallest L in 20..25 whose **above floor mean** is below 1.0. On the 2026-09-08 numbers L=20 is 1.2 and does **not** qualify; L=21 is 0.9 and does. **21** is the value to write into `harvestSeedChars` on those numbers - not 20, which the spec's band names first and which a reader skimming this plan would guess. Write the L the rule actually picks, rebuild, and re-run so the docstring's numbers and the shipped constant agree. Record the walk in the ledger: the L the rule rejected, and by how much, is part of the record.

- [ ] **Step 8: Hand-classify every cross-fixture common span**

```bash
cd C:/Users/noaho/testimonium-plan2 && node scripts/calibrate-harvest-seed.mjs | sed -n '/hand-classification population/,$p'
```

On 2026-09-08 that printed **32 distinct spans** at L=21 (43 at L=20). Classify **every** printed span into exactly one of two buckets, and record the verdict for each one in the calibration doc (Step 13) as a table of `span | pairs | class | why`:

- **boilerplate** - text that is on the page because of how the page is built, not because of what it says: navigation, legal and cookie text, a language switcher, a byline. Observed on 2026-09-08: "skip to main content" (6 pairs), "terms of use privacy policy" (3), "accessibility statement" (3), "all rights reserved.", "careers advertise with us", "report a problem with this", "your privacy choices", "website privacy notice", "this page was last", "the wikimedia foundation", "is available under the", and a language switcher whose text is not ASCII.
- **chance** - ordinary English that two unrelated documents happen to share: "the relationship between", "in addition to the", "of the united states", "for more information", "difference between", "associated with the".

The classification carries a consequence, and the doc must state it: **only `chance` spans bear on the floor and the seed length**; `boilerplate` spans are what filter 2 (cross-source frequency) and the author's own `boilerplate` rules exist for, and none of them earns a bundled rule, because a bundled rule needs a `lastConfirmed` date from a live observation and a fixture is not one. That is why `src/rules/boilerplate.ts` ships empty in Task 7.

If a span is genuinely ambiguous, record it as `chance` and say why in the `why` column - the conservative direction, because a chance span counted as boilerplate would flatter the seed length.

- [ ] **Step 9: Write the acceptance test**

Create `test/classify/claim-floor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { toText } from "../../src/text/extract.js";
import { norm } from "../../src/text/normalize.js";
import { THRESHOLDS } from "../../src/classify/thresholds.js";

// The discipline test/classify/acceptance.test.ts imposes on the prose floor,
// applied to the claim floor (spec 8.2: "bind the result with an acceptance
// test ... the discipline section 6.3 imposed on the prose floor"): the
// populations are read from the repo, the assertions NAME what failed rather
// than counting it, and a margin is demanded so a number that only just holds
// cannot ship.
//
// This is the only new test in plan 2 that reads fixtures. Every other one
// builds its bodies inline.

type Fixture = { path: string; kind: "challenge" | "document" | "known-gap" };
const corpus: Fixture[] = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));
// Normalized ONCE per document. `d.includes(norm(c))` is exactly
// phraseFound(text, c) with the haystack pre-normalized - the same saving
// harvest's filter 2 makes, for the same reason.
const documents = corpus
  .filter((f) => f.kind === "document")
  .map((f) => norm(toText(readFileSync(f.path, "utf8"))));

/** The walker scripts/calibrate-claim-floor.mjs uses, restated in TypeScript:
 *  claim strings only, no `_` notes, no notApplicable reason strings. */
function walk(v: unknown, out: string[]): void {
  if (typeof v === "string") {
    out.push(v);
    return;
  }
  if (Array.isArray(v)) {
    for (const x of v) walk(x, out);
    return;
  }
  if (v && typeof v === "object") {
    if (typeof (v as { notApplicable?: unknown }).notApplicable === "string") return;
    for (const [k, x] of Object.entries(v)) if (!k.startsWith("_")) walk(x, out);
  }
}

const raw: string[] = [];
for (const f of readdirSync("fixtures/claims").filter((n) => n.endsWith("-claims.json")).sort()) {
  walk(JSON.parse(readFileSync(`fixtures/claims/${f}`, "utf8")), raw);
}
const rows = [...new Set(raw)].map((c) => ({
  c,
  n: norm(c).length,
  hits: documents.filter((d) => d.includes(norm(c))).length,
}));
const spurious = rows.filter((r) => r.hits > 0);

describe("acceptance test - the claim floor (spec 7.3, 13 Q3)", () => {
  it("the populations are the ones the floor is licensed against", () => {
    // Without this every assertion below passes vacuously on an empty
    // fixtures/claims/ - an instrument that reports success without running,
    // which is this repository's most-repeated defect.
    expect(documents.length).toBeGreaterThanOrEqual(10);
    expect(rows.length).toBeGreaterThanOrEqual(200);
  });

  it("NO claim at or above the floor matches a page it was not written about", () => {
    const failures = spurious.filter((r) => r.n >= THRESHOLDS.minClaimChars).map((r) => r.c);
    expect(failures).toEqual([]);
  });

  it("the floor clears the observed ceiling with margin", () => {
    // A floor that only just clears the ceiling is one fixture away from not
    // clearing it. The prose floor demands 200 characters of air on a
    // 4,500-character threshold; 3 on a 16-character one is the same idea at
    // this scale.
    const ceiling = Math.max(0, ...spurious.map((r) => r.n));
    expect(ceiling).toBeLessThanOrEqual(THRESHOLDS.minClaimChars - 3);
  });

  it("names what it pins: every claim that demonstrably attests nothing is refused", () => {
    // Fable F6: the floor is NOT derived from these events - two of them is
    // not a derivation. What this pins is that on THIS corpus every claim
    // shown to match a page it was not written about is refused, and the
    // failure message names it.
    for (const r of spurious) {
      expect(r.n, JSON.stringify(r.c)).toBeLessThan(THRESHOLDS.minClaimChars);
    }
  });

  it("the cost of the floor stays a small minority of real claims", () => {
    // 18 of 208, 8.7 percent, on 2026-09-08. The bound is loose on purpose:
    // it exists to catch a floor raised until it refuses a quarter of an
    // author's file, not to pin today's ratio.
    const refused = rows.filter((r) => r.n < THRESHOLDS.minClaimChars).length;
    expect(refused / rows.length).toBeLessThan(0.15);
  });

  it("the seed length is at least the floor (spec 8.2, Thresholds)", () => {
    expect(THRESHOLDS.harvestSeedChars).toBeGreaterThanOrEqual(THRESHOLDS.minClaimChars);
  });
});
```

- [ ] **Step 10: Prove the acceptance test can fail**

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/classify/claim-floor.test.ts`
Expected: 6 passed.

Now mutate, one at a time, restoring after each:

**(a)** In `src/classify/thresholds.ts` set `minClaimChars: 12`.
Expected: "NO claim at or above the floor matches a page it was not written about" FAILS naming `"SAUDI ARABIA"`, and "the floor clears the observed ceiling with margin" FAILS with `expected 12 to be less than or equal to 9`.

**(b)** Set `minClaimChars: 60`.
Expected: "the cost of the floor stays a small minority of real claims" FAILS.

**(c)** Set `harvestSeedChars` to `minClaimChars - 1`.
Expected: "the seed length is at least the floor" FAILS.

Restore all three; `git diff --stat src/classify/thresholds.ts` must show only the intended additions.

- [ ] **Step 11: Byte and NUL checks**

```bash
cd C:/Users/noaho/testimonium-plan2 && printf 'a\0b' | LC_ALL=C tr -cd '\000' | wc -c && for f in fixtures/claims/*.json scripts/calibrate-claim-floor.mjs scripts/calibrate-harvest-seed.mjs src/classify/thresholds.ts test/classify/claim-floor.test.ts; do printf "%s nonascii=" "$f"; LC_ALL=C tr -d '\000-\177' < "$f" | wc -c; printf "%s nul=" "$f"; LC_ALL=C tr -cd '\000' < "$f" | wc -c; done
```
Expected: the self-test prints `1`; every `nul=` prints `0`; every `nonascii=` prints `0`, the four claims fixtures included (they were pure ASCII on 2026-09-08 - if one is not, record the count rather than editing the fixture, because a fixture is evidence and must not be doctored).

- [ ] **Step 12: Full suite, typecheck, and commit the measurement**

```bash
cd C:/Users/noaho/testimonium-plan2 && npm test && npx tsc --noEmit
```
Expected: **289 passed**, typecheck silent.

```bash
cd C:/Users/noaho/testimonium-plan2 && git add fixtures/claims scripts/calibrate-claim-floor.mjs scripts/calibrate-harvest-seed.mjs src/classify/thresholds.ts test/classify/claim-floor.test.ts && git -c core.safecrlf=false commit -m "feat(classify): the claim floor and the harvest seed length, measured and bound"
```

- [ ] **Step 13: Record it in `docs/calibration-2026-09.md`**

The file's H1 is `# Calibration of \`minProseChars\``, which this section makes false. Change it to `# Calibration` and add one line under it: `Three thresholds, three dated records. \`minProseChars\` (plan 1) is below; \`minClaimChars\` and \`harvestSeedChars\` (plan 2) are at the end.`

Then append a new top-level section at the END of the file. Every number in it is one the commands above printed **on the day you ran them**, and each is written with its command beside it:

```
## Calibration of `minClaimChars` and `harvestSeedChars` (plan 2, <DATE>)

### Populations

Four real claims files, frozen into `fixtures/claims/` so these numbers
reproduce without the origin repo. Three were copied from
the origin repository's WORKING TREE and are uncommitted there, so
their provenance is an mtime and nothing stronger; `source-c-claims.json` is not
on that repo's `master` at all and was taken from
a pinned commit (withheld), the tip of its `source-c-longform`
branch. `fixtures/claims/provenance.json` records all four.

<the per-file counts, the distinct total, and the document-fixture count and
character total, from `node scripts/calibrate-claim-floor.mjs`>

Spec 7.3 says "203 distinct real claims" and "18 of the 203". The frozen
population is <N> distinct: the three working-tree files moved in the origin
repo between that sentence and this freeze. The refusal count is what the
script printed; the denominator is not the spec's.

### The floor

<the band table, the spurious table, the ceiling, the margin, and the
refused-at-F line, from `node scripts/calibrate-claim-floor.mjs`>

The licence is a priori and the measurement is its sanity check, not its
derivation: two spurious events are not a derivation (Fable F6). What the
measurement establishes is that no claim this corpus holds at or above 16
normalized characters matches a page it was not written about, and that the
cost of the floor is <R> of <N> claims, each a number, a name or a fragment
that states no proposition. Bound by `test/classify/claim-floor.test.ts`.

### The seed length

<the sweep table from `node scripts/calibrate-harvest-seed.mjs`, and the walk
the selection rule took: which L it rejected and why>

The rule was stated in the script before the sweep was run. Spec 8.2 quotes
24.8 / 5.0 / 0.9 / 0.2 at L = 13 / 16 / 20 / 25 from a script that was never
committed and is in no git history; those figures are superseded by this
table, and the two measures are not the same quantity - 8.2 describes L-gram
seed matches, this counts what `commonSpans` emits after extension, snapping
and containment dedupe, which is what an author actually reviews.

### Every cross-fixture common span, hand-classified

<the table: span | pairs | class | why>

Only the `chance` rows bear on either number. The `boilerplate` rows are what
filter 2 (cross-source frequency) exists for, and none of them earns a bundled
`boilerplate` rule: a bundled rule needs a `lastConfirmed` date from a live
observation, and a fixture is not one. `src/rules/boilerplate.ts` ships empty.

### What was NOT done

The corpus has no host-same pairs at all - no two document fixtures come from
the same site - so the "same outlet, different page" population, which is where
an outlet's own recurring furniture would show up, is empty here and both
numbers are silent about it. That is the gap the author's own `boilerplate`
rules exist to cover, and it is disclosed rather than closed.

Filter 2's reprint cost was not measured either, and it is a second and
separate gap from the one above - that one is in filter 3's domain, this one
in filter 2's. Spec 8.2 filter 2 said "Plan 2's calibration counts how many
real claims appear in two cited sources of the same draft, so the reprint cost
is a number, not a guess". No such count was made. It needs readable reads of
these four drafts' OWN cited sources; `fixtures/` holds no readable read of
any of them, and only live network reads could supply one - a network
dependency inside the task whose whole purpose is that its numbers reproduce
from frozen fixtures. So how many REAL claims the cross-source frequency
filter would eat is a guess here, disclosed rather than closed, and spec 8.2's
sentence is amended in Task 10 to say so instead of promising a number.

No claim was dropped, reworded or reclassified to make a number come out. If
the ceiling had reached the floor, the plan says to stop and report.
```

**The second paragraph is an addition, not a replacement.** The host-same paragraph discloses a gap in filter 3's domain and stays exactly as it is; this discloses one in filter 2's. Both are written in the voice `src/classify/thresholds.ts` uses for a value that was never swept: say plainly what was not measured, and say what evidence there is instead.

Count the doc's non-ASCII bytes before and after this edit and record both in the ledger - the classification table may carry a span with non-ASCII characters, and a doc is allowed to (this one already holds 165), but the count must be a number somebody chose, not a surprise:

```bash
cd C:/Users/noaho/testimonium-plan2 && LC_ALL=C tr -d '\000-\177' < docs/calibration-2026-09.md | wc -c && LC_ALL=C tr -cd '\000' < docs/calibration-2026-09.md | wc -c
```
Expected: the second number is `0`.

- [ ] **Step 14: Commit the record**

```bash
cd C:/Users/noaho/testimonium-plan2 && git add docs/calibration-2026-09.md && git -c core.safecrlf=false commit -m "docs: record plan 2's calibration - the claim floor and the seed length"
```

---

### Task 3: The claim floor, refused at three sites

**Files:**
- Modify: `src/io/claims.ts` (a new import; two new exported functions; the loader's validation branch at 62-72)
- Modify: `src/check.ts` (the front-door guard at 47-66)
- Modify: `test/io/claims.test.ts` (below-floor literals; two new tests)
- Modify: `test/check.test.ts` (below-floor literals; two new tests)
- Modify: `test/agreement.test.ts` (below-floor literals)
- Modify: `CHANGELOG.md`, `README.md`

**Interfaces:**
- Consumes: `THRESHOLDS.minClaimChars` from `src/classify/thresholds.js` (Task 2); `norm` from `src/text/normalize.js`.
- Produces, both from `src/io/claims.ts`:
  - `export function belowClaimFloor(claim: string): boolean` - true iff `norm(claim).length < THRESHOLDS.minClaimChars`.
  - `export function claimFloorMessage(where: string, claim: string): string` - the one refusal message. `where` is the caller's own prefix: the authored key for the loader, `check(<url>): claim at index N` for the front door, the URL for harvest's filter.
  Task 7's filter 1 consumes both.

**The third site does not exist yet.** Spec 7.3 names three: the claims-file loader, `check()`'s front door, and harvest's first filter. This task builds the first two and the shared parts; Task 7 wires the third to the same two functions. Do not stub it here.

**What `check()` validates today.** `src/check.ts:61-66` rejects a claim that is not a string or that `norm()` folds to empty, with the message "is empty or whitespace-only once normalized". The floor **subsumes** the second half - a claim folding to "" is 0 characters, under any floor - and does **not** subsume the first: a non-string is still a type error, and it is checked first so that `norm()` is never called on one. The loader at `src/io/claims.ts:68-70` does both in one condition; this task splits them for the same reason.

**This is a breaking change and is meant to be** (spec 7.3): a claims file carrying a sub-floor claim asserted something the tool could never have verified, and it now fails to load. It lands before 0.1.0 is released, so it carries no deprecation path.

- [ ] **Step 1: Write the failing loader tests**

In `test/io/claims.test.ts`, add these two tests at the end of the `describe("parseClaimsFile", ...)` block, and add `THRESHOLDS` to the imports:

```ts
import { THRESHOLDS } from "../../src/classify/thresholds.js";
```

```ts
  it("REFUSES a claim under the floor, naming it, its length, the floor and the remedy", () => {
    // Spec 7.3: refuse, not warn. A warning that a claim proves nothing
    // leaves it proving nothing while the run still passes. The message has
    // to be actionable, so all four parts are asserted.
    // Built FROM the constant, not written out: Task 2 re-derives the floor,
    // and a boundary test that hard-codes 15 and 16 goes red for the wrong
    // reason the day the number moves.
    const short = "x".repeat(THRESHOLDS.minClaimChars - 1);
    expect(norm(short).length).toBe(THRESHOLDS.minClaimChars - 1);
    let message = "";
    try {
      parseClaimsFile(`{"https://e.com/a":[${JSON.stringify(short)}]}`);
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).toContain(JSON.stringify(short));
    expect(message).toContain(`${THRESHOLDS.minClaimChars - 1} characters once normalized`);
    expect(message).toContain(`${THRESHOLDS.minClaimChars}-character floor`);
    expect(message).toContain("extend it to take in the surrounding words");
  });

  it("accepts a claim exactly at the floor", () => {
    // The boundary is `>=`, and a test that only checks the refusing side
    // cannot tell a floor of 16 from a floor of 60.
    const atFloor = "y".repeat(THRESHOLDS.minClaimChars);
    expect(norm(atFloor).length).toBe(THRESHOLDS.minClaimChars);
    const c = parseClaimsFile(`{"https://e.com/a":[${JSON.stringify(atFloor)}]}`);
    expect(c.get("https://e.com/a")).toEqual([atFloor]);
  });
```

Add `norm` to the imports as well:

```ts
import { norm } from "../../src/text/normalize.js";
```

- [ ] **Step 2: Write the failing front-door tests**

In `test/check.test.ts`, inside the main `describe("check", ...)`, immediately after the test named `rejects a claim that survives trim() but NORMALIZES to empty`, add:

```ts
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
```

- [ ] **Step 3: Run them and watch them fail**

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/io/claims.test.ts test/check.test.ts`
Expected: the two refusal tests FAIL - the loader accepts `"under the floor"` and returns a Map, and `check` fetches and answers a verdict instead of throwing. The two boundary tests PASS already. Record the two failure messages.

- [ ] **Step 4: Add the predicate and the message builder**

In `src/io/claims.ts`, add to the imports at the top:

```ts
import { THRESHOLDS } from "../classify/thresholds.js";
```

and add these two exported functions immediately after `normalizeUrl` and before `parseClaimsFile`:

```ts
/**
 * The claim floor's predicate, applied to `norm(claim).length` because
 * `norm()` is what the MATCHER runs (spec 7.3).
 *
 * It SUBSUMES the "non-empty once normalized" check that stood inside
 * parseClaimsFile before: a claim norm() folds to "" is 0 characters, which
 * is under any floor, and "," and U+200B both fold to "" while surviving
 * trim(). Testing a weaker predicate than the matcher uses is how a false
 * attestation walked in from the CLI once already, so the predicate stays
 * norm-based and stays in one place.
 */
export function belowClaimFloor(claim: string): boolean {
  return norm(claim).length < THRESHOLDS.minClaimChars;
}

/**
 * The ONE message every door uses to refuse a short claim.
 *
 * Three doors ask this question - this loader, `check()`'s front door, and
 * harvest's first filter (spec 7.3; 13 Q3) - and a floor that one door
 * phrases differently from another is a floor the author has to learn twice.
 * It names the claim, its normalized length, the floor and the remedy,
 * because a refusal that does not say what to do instead is a wall.
 *
 * `where` is the caller's own prefix: the authored key for the loader,
 * `check(<url>): claim at index N` for the front door, the URL for harvest.
 */
export function claimFloorMessage(where: string, claim: string): string {
  return (
    `${where}: ${JSON.stringify(claim)} is ${norm(claim).length} characters once normalized, ` +
    `under the ${THRESHOLDS.minClaimChars}-character floor; ` +
    `extend it to take in the surrounding words`
  );
}
```

- [ ] **Step 5: Site 1 - the claims-file loader**

In `src/io/claims.ts`, replace the array branch of `parseClaimsFile` (lines 62-73, from `if (Array.isArray(value)) {` through its `continue;` and closing brace) with:

```ts
    if (Array.isArray(value)) {
      if (value.length === 0 || value.some((p) => typeof p !== "string")) {
        throw new Error(`${key}: claims must be a non-empty array of strings`);
      }
      // The floor, refused rather than warned about (spec 7.3). It subsumes
      // the "non-empty once normalized" check this branch used to make: a
      // phrase norm() folds to "" is 0 characters and cannot clear any floor.
      // The type check above stays and runs first, so norm() is never handed
      // a non-string.
      const short = (value as string[]).find(belowClaimFloor);
      if (short !== undefined) throw new Error(claimFloorMessage(key, short));
      out.set(url, value as string[]);
      continue;
    }
```

- [ ] **Step 6: Site 2 - `check()`'s front door**

In `src/check.ts`, replace the whole comment block and guard at lines 47-66 (from `// An empty or whitespace-only claim matches EVERYTHING` through the closing `}` of the `if (blank !== -1)` block) with:

```ts
  // Claims are validated at the door, before any IO, because a claim the tool
  // could never verify is a caller bug rather than a fetch failure. An empty
  // ARRAY is still fine and reads `unclaimed`.
  //
  // Two refusals, in this order. A non-string is a type error and is checked
  // first so that norm() is never handed one. Then the floor (spec 7.3),
  // which SUBSUMES the empty-claim guard that stood here: `""` matches every
  // document ("".includes("") is true) and would mint `supported` with a null
  // excerpt, and so do "," and "\u200B", which survive trim() while norm()
  // folds them away - the predicate has to be the MATCHER's. All three are 0
  // normalized characters and all three are under the floor.
  //
  // parseClaimsFile refuses the same two things with the same message
  // builder; check() is the exported front door and defends itself, because
  // a programmatic caller never passes through the loader.
  const notString = claims.findIndex((c) => typeof c !== "string");
  if (notString !== -1) {
    throw new TypeError(`check(${url}): claim at index ${notString} is not a string`);
  }
  const short = claims.findIndex(belowClaimFloor);
  if (short !== -1) {
    throw new TypeError(claimFloorMessage(`check(${url}): claim at index ${short}`, claims[short] as string));
  }
```

Replace the `norm` import on line 6 with the two new names (nothing else in `check.ts` uses `norm` - verify with `grep -n "norm(" src/check.ts` before removing it):

```ts
import { belowClaimFloor, claimFloorMessage } from "./io/claims.js";
```

- [ ] **Step 7: Update every existing test whose claim is now below the floor**

This is the breaking change landing on the suite, and it is enumerated rather than discovered. Apply these substitutions exactly; each replacement is above the floor and absent from the body the test serves, so no test's meaning changes.

In `test/check.test.ts`:

| current literal | occurrences | replacement |
|---|---|---|
| `"no such phrase"` | 4 | `"no such phrase appears here"` |
| `["anything"]` | 3 | `["anything at all on this page"]` |
| `["nope"]` | 1 | `["nope not a phrase here"]` |
| `"revenue fell"` | 2 | `"revenue fell in the fourth quarter"` |
| `["real claim", ""]` | 1 | `["a real claim that clears the floor", ""]` |

In `test/agreement.test.ts`:

| current literal | occurrences | replacement |
|---|---|---|
| `"revenue fell"` | 2 | `"revenue fell in the fourth quarter"` |

In `test/io/claims.test.ts`:

| current literal | occurrences | replacement |
|---|---|---|
| `["phrase"]` | 1 | `["a phrase from the source"]` |
| `["p"]` | 5 | `["a phrase from the source"]` |
| `["first"]` | 1 | `["the first claim phrase"]` |
| `["second"]` | 1 | `["the second claim phrase"]` |
| `["one"]` | 1 | `["the first claim phrase"]` |
| `["two"]` | 1 | `["the second claim phrase"]` |

Verify each count first, so a silent extra occurrence cannot ride along:

```bash
cd C:/Users/noaho/testimonium-plan2 && grep -c '"no such phrase"' test/check.test.ts && grep -c '\["anything"\]' test/check.test.ts && grep -c '\["nope"\]' test/check.test.ts && grep -c '"revenue fell"' test/check.test.ts && grep -c '"revenue fell"' test/agreement.test.ts && grep -c '\["p"\]' test/io/claims.test.ts && grep -c '\["phrase"\]' test/io/claims.test.ts
```
Expected, in order: `4`, `3`, `1`, `2`, `2`, `5`, `1` - the counts taken on 2026-09-08. A different count means the file moved under the table; reconcile before substituting.

Then rewrite the two message assertions the floor changes:

- `test/io/claims.test.ts`, in `rejects a phrase that survives trim() but NORMALIZES to empty`: change `.toThrow(/non-empty/)` to `.toThrow(/0 characters once normalized/)` and append to its comment: `Since the claim floor landed this is refused BY the floor - all three fold to 0 characters - and the message is the floor's. The predicate is unchanged: it is still norm(), not trim().`
- `test/check.test.ts`, in `rejects an empty or whitespace-only claim rather than attesting to it`: change both `.rejects.toThrow(/empty or whitespace-only/)` to `.rejects.toThrow(/0 characters once normalized/)`, rename the test to `rejects an empty or whitespace-only claim rather than attesting to it - now through the floor`, and append the same sentence to its comment. The `/index 1/` assertion keeps its regex; the first element is now above the floor so index 1 is still the one that fires.
- `test/check.test.ts`, in `rejects a claim that survives trim() but NORMALIZES to empty`: change `.rejects.toThrow(/empty or whitespace-only/)` to `.rejects.toThrow(/0 characters once normalized/)` and append the same sentence.

- [ ] **Step 8: Run the suite**

Run: `cd C:/Users/noaho/testimonium-plan2 && npm test && npx tsc --noEmit`
Expected: **293 passed**, typecheck silent. If a test you did not touch fails, it holds a below-floor claim the table above missed: add it to the table, fix it, and record it in the ledger - the table is meant to be complete, and a gap in it is a finding.

- [ ] **Step 9: Prove the floor is really at three doors, not two**

```bash
cd C:/Users/noaho/testimonium-plan2 && grep -n "belowClaimFloor\|claimFloorMessage" src/ -r
```
Expected: **seven lines** - the two definitions in `src/io/claims.ts`, one use of each in `parseClaimsFile`, the `import { belowClaimFloor, claimFloorMessage } from "./io/claims.js";` line Step 6 adds to `src/check.ts` (one line, both names), and one use of each in `src/check.ts`. The import line counts because `grep -n` prints lines, not matches: it is expected, not a stray. Harvest's filter joins them in Task 7 and the count becomes ten. Record the count in the ledger; a floor whose third door was never wired is the silent-no-op class this repository keeps finding.

- [ ] **Step 10: CHANGELOG**

In `CHANGELOG.md`, insert a new section immediately after the line `Initial implementation of plan 1 (\`check\`, \`reachability\`). See` block's closing blank line and BEFORE `### Plan 1.2 (reader) - changes since the plan-1.1 merge`:

```
### Plan 2 (harvest) - changes since the plan-1.2 merge

- **BREAKING, and meant to be: a claim shorter than `THRESHOLDS.minClaimChars`
  (16 characters once normalized) is refused.** It is refused by the
  claims-file loader, by `check()`'s front door and by `harvest`'s first
  filter, with one message naming the claim, its length, the floor and the
  remedy. An existing claims file carrying such a claim now fails to load and
  `check` exits 2 with the loader's message. That is the intended outcome: a
  bare number, a year, or a token like "the report" attests nothing about a
  source, and a match on one is a coincidence this tool cannot tell from
  evidence - the file asserted something the tool could never have verified.
  The remedy is to extend the phrase to take in the surrounding words, which
  `harvest` will also propose. Measured against 208 real claims frozen in
  `fixtures/claims/`: 18 of them are refused, and the two that matched a page
  they were not written about are both among them. Landed before 0.1.0 was
  released, so it carries no deprecation path. See
  `docs/calibration-2026-09.md` and spec 7.3.
```

**Re-derive `16`, `208` and `18` from Task 2's run before writing this.** Later tasks append their bullets to this same section.

- [ ] **Step 11: README**

In `README.md`, immediately after the closing fence of the `essay.claims.json` JSON example and before the line `Before you write a claims file at all, find out what your corpus can even`, insert:

```
Each phrase has a floor: **16 characters once normalized**. A shorter one is
refused, by name, with its length and the floor - by the claims file's own
loader and by `check()` alike. A bare number, a year, or a token like "the
report" is present on any page that happens to mention it, so a match on one
is a coincidence this tool cannot tell from evidence. Extend the phrase to
take in the surrounding words. The number and what licenses it are in
`docs/calibration-2026-09.md`.
```

- [ ] **Step 12: Byte checks, suite, and commit**

```bash
cd C:/Users/noaho/testimonium-plan2 && printf 'a\0b' | LC_ALL=C tr -cd '\000' | wc -c && for f in src/io/claims.ts src/check.ts test/io/claims.test.ts test/check.test.ts test/agreement.test.ts CHANGELOG.md README.md; do printf "%s nonascii=" "$f"; LC_ALL=C tr -d '\000-\177' < "$f" | wc -c; printf "%s nul=" "$f"; LC_ALL=C tr -cd '\000' < "$f" | wc -c; done && npm test && npx tsc --noEmit
```
Expected: self-test `1`; every `nul=0`; `nonascii=0` everywhere except `README.md`, which must still be **3**; 293 passed; typecheck silent.

```bash
cd C:/Users/noaho/testimonium-plan2 && git add src/io/claims.ts src/check.ts test/io/claims.test.ts test/check.test.ts test/agreement.test.ts CHANGELOG.md README.md && git -c core.safecrlf=false commit -m "feat(io): refuse a claim under the floor at the loader and the front door (spec 7.3)"
```

---

### Task 4: `Document.prose` - the document's own words, from the parser's own regexes

**Files:**
- Modify: `src/adapters/types.ts` (`Document`)
- Modify: `src/adapters/gfm-footnotes.ts` (`parseGfmFootnotes`)
- Test: `test/adapters/gfm-footnotes.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Document.prose: string` - the markdown with fenced code blanked and every footnote DEFINITION removed, line endings normalized to LF. Task 8 passes it to `commonSpans` as the first argument. `Document.body` is unchanged: the ORIGINAL markdown, line endings intact.

**Why the same regexes and not new ones (Fable F17).** `DEFINITION` is `/^\[\^([^\]]+)\]:[ \t]*(.*(?:\n[ \t]+\S.*)*)/gm` - it consumes indented continuation lines. A prose stripper that removed only a definition's first line would leak the continuation - source titles, URLs, quoted passages - into `prose`, and harvest would then "find" the source's own title inside the author's draft and propose it as a claim. Two views of one document that disagree about what a footnote is are the divergence this repository keeps paying for, so `prose` is derived from the same `text` the footnote loop reads, with the same regex and the same `blankFencedCode` pass. Neither is exported; the derivation happens where they live.

- [ ] **Step 1: Write the failing tests**

Append to `test/adapters/gfm-footnotes.test.ts`, inside the existing `describe`:

```ts
  it("prose drops a whole footnote definition, continuation lines included", () => {
    // Fable F17: DEFINITION consumes indented continuation lines. A stripper
    // that took only the first line would leave the source's own title and
    // URL in the document's prose, and harvest would propose them back to
    // the author as claims she had copied.
    const md = [
      "The committee reported a rise in spending.[^1]",
      "",
      '[^1]: Jane Roe, "The Committee Report", Example Gov, 12 May 2026.',
      "    https://example.gov/report",
      "    Quoted: spending rose sharply in the fourth quarter.",
      "",
    ].join("\n");
    const { prose } = parseGfmFootnotes(md);
    expect(prose).toContain("The committee reported a rise in spending.");
    expect(prose).not.toContain("Jane Roe");
    expect(prose).not.toContain("https://example.gov/report");
    expect(prose).not.toContain("spending rose sharply in the fourth quarter");
  });

  it("prose blanks fenced code, so a code sample is never proposed as a claim", () => {
    // Four-tick fence around a three-tick example: the shape the parser's own
    // blankFencedCode exists for. prose uses the same pass, so the two views
    // of the document cannot disagree about what is code.
    const md = [
      "Real prose the author wrote.",
      "",
      "````markdown",
      "```",
      "[^9]: Not a citation, https://example.com/not-cited",
      "```",
      "````",
      "",
    ].join("\n");
    const { prose } = parseGfmFootnotes(md);
    expect(prose).toContain("Real prose the author wrote.");
    expect(prose).not.toContain("https://example.com/not-cited");
  });

  it("prose keeps a footnote REFERENCE marker's sentence - only definitions go", () => {
    const { prose } = parseGfmFootnotes("Spending rose sharply.[^1]\n\n[^1]: https://example.gov/a\n");
    expect(prose).toContain("Spending rose sharply.");
    expect(prose).not.toContain("example.gov");
  });

  it("body stays the original markdown; prose is normalized to LF", () => {
    // `body` is the contract every existing caller has: the original bytes,
    // line endings intact. `prose` is derived from the LF-normalized copy the
    // footnote loop reads, because a JS regex `.` never matches \r and the
    // two views must be built from one text.
    const md = "Prose line one.\r\nProse line two.\r\n\r\n[^1]: https://example.gov/a\r\n";
    const d = parseGfmFootnotes(md);
    expect(d.body).toBe(md);
    expect(d.prose).toContain("\n");
    expect(d.prose).not.toContain("\r");
    expect(d.prose).not.toContain("example.gov");
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/adapters/gfm-footnotes.test.ts`
Expected: 4 FAIL, each with `expected undefined to contain ...` or a TypeError on `prose` - the field does not exist. Record the message.

- [ ] **Step 3: Add `prose` to the `Document` type**

In `src/adapters/types.ts`, replace the `Document` interface with:

```ts
export interface Document {
  readonly footnotes: Footnote[];
  /** The ORIGINAL markdown, line endings intact. */
  readonly body: string;
  /** The document's own words: `body` with fenced code blanked and every
   *  footnote DEFINITION removed, line endings normalized to LF.
   *
   *  This is what `harvest` compares against a source (spec 8.2 step 1). A
   *  definition's continuation lines carry the source's title, its URL and
   *  sometimes a quoted passage - text the author copied FROM the source,
   *  which harvest would otherwise propose back to her as a claim she had
   *  made. Fenced code is blanked for the same reason a code sample is not a
   *  citation. Both use the parser's own passes; a second regex would drift. */
  readonly prose: string;
}
```

- [ ] **Step 4: Derive it in the parser**

In `src/adapters/gfm-footnotes.ts`, replace the final two lines of `parseGfmFootnotes`:

```ts
  // `body` is the ORIGINAL markdown, line endings intact.
  return { footnotes, body: markdown };
```

with:

```ts
  // The document's own words (spec 8.2 step 1). Same `text`, same
  // `DEFINITION`, same `blankFencedCode` the loop above used, so the two
  // views of this document cannot disagree about what a footnote is.
  // Definitions are removed rather than blanked line by line: DEFINITION
  // already spans a definition's indented continuation lines, and it does
  // not consume the trailing newline, so every line outside a definition
  // keeps its position.
  //
  // Sharing the regex object is safe in both directions: String.replace with
  // a /g regex resets lastIndex before and after, and matchAll iterates a
  // clone and never touches it.
  const prose = text.replace(DEFINITION, "");

  // `body` is the ORIGINAL markdown, line endings intact.
  return { footnotes, body: markdown, prose };
```

- [ ] **Step 5: Run the tests and the suite**

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/adapters/gfm-footnotes.test.ts`
Expected: all pass.

Run: `cd C:/Users/noaho/testimonium-plan2 && npm test && npx tsc --noEmit`
Expected: **297 passed**, typecheck silent. `Document` gained a required field; if anything constructs a `Document` literal, typecheck names it. Nothing at `ff71ec8` does - `parseGfmFootnotes` is the only producer - but let the compiler say so rather than assuming it.

- [ ] **Step 6: Prove the continuation-line test discriminates**

In `src/adapters/gfm-footnotes.ts`, temporarily change the prose derivation to a first-line-only stripper: `const prose = text.replace(/^\[\^[^\]]+\]:.*$/gm, "");`
Run: `npx vitest run test/adapters/gfm-footnotes.test.ts -t "continuation lines included"`
Expected: FAIL, `expected ... not to contain "https://example.gov/report"`. This is F17 made visible. Restore the original line and re-run; `git diff --stat src/adapters/gfm-footnotes.ts` must show only the intended change.

- [ ] **Step 7: Byte checks and commit**

```bash
cd C:/Users/noaho/testimonium-plan2 && printf 'a\0b' | LC_ALL=C tr -cd '\000' | wc -c && for f in src/adapters/types.ts src/adapters/gfm-footnotes.ts test/adapters/gfm-footnotes.test.ts; do printf "%s nonascii=" "$f"; LC_ALL=C tr -d '\000-\177' < "$f" | wc -c; printf "%s nul=" "$f"; LC_ALL=C tr -cd '\000' < "$f" | wc -c; done
```
Expected: `1`, then `0` for all six counts.

```bash
cd C:/Users/noaho/testimonium-plan2 && git add src/adapters/types.ts src/adapters/gfm-footnotes.ts test/adapters/gfm-footnotes.test.ts && git -c core.safecrlf=false commit -m "feat(adapters): Document.prose - the document's own words, from the parser's own passes"
```

---

### Task 5: `commonSpans` - the spans two texts share, and the three assertions

**Files:**
- Create: `src/harvest/spans.ts`
- Create: `test/harvest/spans.test.ts`
- Modify: `scripts/calibrate-harvest-seed.mjs` (delete the replica, import the real function, re-run)

**Interfaces:**
- Consumes: `foldWithMap` from `src/text/excerpt.js` (exported by plan 1.2 for exactly this); `norm`, `phraseFound` from `src/text/normalize.js`; `THRESHOLDS.harvestSeedChars` from `src/classify/thresholds.js` (Task 2).
- Produces, from `src/harvest/spans.ts`:
  ```ts
  export interface SpanResult {
    readonly spans: string[];
    readonly bugs: string[];
  }
  export function commonSpans(
    docProse: string,
    sourceText: string,
    seedChars?: number,
  ): SpanResult;
  export function dropContained(spans: readonly string[]): string[];
  ```
  `dropContained` is the containment rule in ONE place: `commonSpans` applies it to its own candidates, and Task 8 applies the same function to the union across a URL's several readable reads. Two implementations of one rule is the drift this repository keeps paying for.
  `spans` are cut from the SOURCE's typography, in source order, each a whole-word run with its whitespace collapsed, none contained in another. `bugs` names every span dropped by a self-validation assertion, one line each. `seedChars` defaults to `THRESHOLDS.harvestSeedChars`; the third parameter exists so `scripts/calibrate-harvest-seed.mjs` can sweep it, and nothing in `src/` ever passes it. Task 7 consumes `spans`; Task 8 consumes both.

**Not exported from `src/index.ts`** (spec 5.3), like every other module under `src/harvest/`.

- [ ] **Step 1: Write the failing tests**

Create `test/harvest/spans.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { commonSpans } from "../../src/harvest/spans.js";
import { THRESHOLDS } from "../../src/classify/thresholds.js";

// Non-ASCII inputs are built with String.fromCodePoint so this file stays
// pure ASCII, as test/text/excerpt.test.ts does.
//
// Every exact value asserted below was measured on 2026-09-08 against the
// shipped foldWithMap, with the algorithm this plan's Task 5 specifies. If
// one of them is off by a word at either end, the word-boundary snap is
// asking only the SOURCE where it must ask both texts - see Step 4b.
const APOS = String.fromCodePoint(0x2019); // RIGHT SINGLE QUOTATION MARK
const DOTTED_I = String.fromCodePoint(0x130); // LATIN CAPITAL I WITH DOT ABOVE

const SHARED_DOC = "the committee's report said spending rose sharply in the fourth quarter";
const SHARED_SRC = `the committee${APOS}s report said spending rose sharply in the fourth quarter`;
const DOC = `Our draft: ${SHARED_DOC}, and more.`;
const SOURCE = `Nav Home About. ${SHARED_SRC}. Footer.`;

describe("commonSpans", () => {
  it("proposes a shared span in the SOURCE's typography, not the document's", () => {
    // Spec 7.3: a claim must be what the SOURCE says. The two texts agree in
    // fold space - foldWithMap folds the curly apostrophe to a straight one -
    // and the proposal is cut from the source through the offset map, so it
    // carries the source's own character.
    const r = commonSpans(DOC, SOURCE);
    expect(r.spans).toEqual([SHARED_SRC]);
    expect(r.spans[0]).toContain(APOS);
    expect(r.bugs).toEqual([]);
  });

  it("finds nothing when the longest shared run is shorter than the seed", () => {
    const shared = "rose sharply";
    const doc = `Our draft says spending ${shared} last year.`;
    const src = `Their page says revenue ${shared} elsewhere.`;
    expect(commonSpans(doc, src, 20).spans).toEqual([]);
  });

  it("snaps to word boundaries rather than emitting a fragment (Fable F7)", () => {
    // Extension stops where the texts diverge, which is mid-word far more
    // often than not - the review found "s the ability to" and
    // "communications w" among the emitted spans. Snapping is inward, so a
    // partial word at either end is dropped, never guessed at.
    const doc = "the quarterly report describes the committee proceedings clearly.";
    const src = "the quarterly report describes the committee proceedin. Nothing else.";
    const r = commonSpans(doc, src, 20);
    expect(r.spans).toEqual(["the quarterly report describes the committee"]);
    expect(r.bugs).toEqual([]);
  });

  it("snaps when it is the SOURCE that is mid-word, not the document", () => {
    // The mirror of the case above, and the reason the snap consults both
    // texts rather than the source alone. Here the source's next character
    // continues a word and the document's does not, so a source-only rule
    // would emit "proceedin" - a truncation, in the source's own typography,
    // proposed to the author as something the page says.
    const doc = "the quarterly report describes the committee proceedin. Nothing else.";
    const src = "the quarterly report describes the committee proceedings clearly.";
    const r = commonSpans(doc, src, 20);
    expect(r.spans).toEqual(["the quarterly report describes the committee"]);
    expect(r.bugs).toEqual([]);
  });

  it("collapses the whitespace runs the offset map would otherwise carry through", () => {
    // The map records the offset of the FIRST character of a whitespace run
    // (excerpt.ts), so an uncollapsed slice can carry a newline and an indent
    // into a claims file. Collapsing is norm-equivalent, so check() is
    // unaffected by it.
    const doc = "Draft: the committee reported that spending rose sharply last year.";
    const src = "Page. the committee reported\n   that spending rose sharply last year.";
    const r = commonSpans(doc, src, 20);
    expect(r.spans.length).toBe(1);
    expect(r.spans[0]).toContain("committee reported that spending rose sharply");
    expect(r.spans[0]).not.toMatch(/\s\s/);
    expect(r.spans[0]).not.toContain("\n");
  });

  it("emits a span once however often the source repeats it", () => {
    const src = `Header. ${SHARED_SRC}. Middle filler text. ${SHARED_SRC}. Footer.`;
    const r = commonSpans(DOC, src);
    expect(r.spans).toEqual([SHARED_SRC]);
  });

  it("a lengthening fold before the span does not shift the map (plan 1.2's repair)", () => {
    // U+0130 lowercases to TWO code units. Before plan 1.2 foldWithMap pushed
    // one map entry per INPUT unit, so every offset after such a character
    // was one late and the emitted slice was one character over - a slice the
    // source still CONTAINS, so phraseFound could not catch it. Assertion 3
    // is what catches it, and this fixture is where it would fire.
    const src = `${DOTTED_I}stanbul bureau. ${SHARED_SRC}. Footer.`;
    const r = commonSpans(DOC, src);
    expect(r.bugs).toEqual([]);
    expect(r.spans).toEqual([SHARED_SRC]);
  });

  it("defaults the seed to THRESHOLDS.harvestSeedChars, and a smaller seed never finds fewer", () => {
    // Fable's answer to Q3: extension is independent of seed length, so a
    // smaller seed finds the same maximal spans plus shorter ones - it buys
    // nothing and costs noise. The inequality is the property; the default is
    // the wiring.
    expect(commonSpans(DOC, SOURCE).spans).toEqual(commonSpans(DOC, SOURCE, THRESHOLDS.harvestSeedChars).spans);
    expect(commonSpans(DOC, SOURCE, THRESHOLDS.harvestSeedChars).spans.length).toBeLessThanOrEqual(
      commonSpans(DOC, SOURCE, THRESHOLDS.minClaimChars).spans.length,
    );
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/harvest/spans.test.ts`
Expected: the whole file FAILS to collect - `Failed to resolve import "../../src/harvest/spans.js"`. That is the correct first failure.

- [ ] **Step 3: Write `src/harvest/spans.ts`**

```ts
import { THRESHOLDS } from "../classify/thresholds.js";
import { foldWithMap } from "../text/excerpt.js";
import { norm, phraseFound } from "../text/normalize.js";

export interface SpanResult {
  /** Proposals, in source order, cut from the SOURCE's typography. Each is a
   *  whole-word run with its whitespace collapsed, and none is contained in
   *  another. */
  readonly spans: string[];
  /** Spans dropped by a self-validation assertion, one line each naming the
   *  assertion that failed. A non-zero count is a BUG SIGNAL, not a filter
   *  statistic (spec 8.2 step 4; Fable F3c): every one of the three
   *  assertions is a property the code should hold unconditionally. The
   *  caller reports these with a `BUG:` label and does not change its exit
   *  code, and the span is not proposed - a span that cannot be shown to be
   *  what the source says must not reach the author. */
  readonly bugs: string[];
}

/**
 * First occurrence of every seed-length gram of the folded document.
 *
 * Built once per call so that the scan over the source is a map lookup per
 * position instead of an `indexOf` over the whole document - which is what
 * spec 8.2 step 3 means by a pass "linear in the source". First occurrence
 * only: a later occurrence can extend no further left than the seed, and the
 * containment drop below removes what it would add.
 */
function seedIndex(folded: string, seedChars: number): Map<string, number> {
  const index = new Map<string, number>();
  for (let i = 0; i + seedChars <= folded.length; i++) {
    const gram = folded.slice(i, i + seedChars);
    if (!index.has(gram)) index.set(gram, i);
  }
  return index;
}

/** A word character in fold space. A token ends at punctuation as well as at
 *  a space, so "quarter." is a whole word and the snap must not treat the
 *  full stop as evidence that "quarter" was cut in half. */
const WORD = /[\p{L}\p{N}]/u;

const wordAt = (text: string, i: number): boolean =>
  i >= 0 && i < text.length && WORD.test(text[i] as string);

/**
 * The spans that appear verbatim in both texts, normalized - the candidate
 * claims of spec 8.2 step 3.
 *
 * Both texts are folded with `foldWithMap`, which returns the folded text and
 * one source offset per folded code unit. Seeds are the seed-length grams of
 * the folded source that occur in the folded document; each is extended left
 * and right while the two agree, snapped inward to word boundaries, cut from
 * the SOURCE through the offset map, and its whitespace collapsed. A span
 * contained in one already emitted is dropped, and the scan resumes past the
 * span just extended, so the pass is linear in the source.
 *
 * Proposals are cut from the source, not the document, because a claim must
 * be what the source SAYS (spec 7.3) - the author's draft may have retyped a
 * dash or a quote, and a claim in the draft's typography would be a claim the
 * source does not carry.
 *
 * `seedChars` exists for `scripts/calibrate-harvest-seed.mjs`, which sweeps
 * it. Nothing in `src/` passes it: the shipped value is the calibrated one.
 */
export function commonSpans(
  docProse: string,
  sourceText: string,
  seedChars: number = THRESHOLDS.harvestSeedChars,
): SpanResult {
  const candidates: string[] = [];
  const bugs: string[] = [];
  if (seedChars <= 0) return { spans: [], bugs };

  const doc = foldWithMap(docProse);
  const src = foldWithMap(sourceText);
  const index = seedIndex(doc.folded, seedChars);

  let i = 0;
  while (i + seedChars <= src.folded.length) {
    const at = index.get(src.folded.slice(i, i + seedChars));
    if (at === undefined) {
      i++;
      continue;
    }

    let end = i + seedChars;
    let d = at + seedChars;
    while (end < src.folded.length && d < doc.folded.length && src.folded[end] === doc.folded[d]) {
      end++;
      d++;
    }
    let begin = i;
    let c = at;
    while (begin > 0 && c > 0 && src.folded[begin - 1] === doc.folded[c - 1]) {
      begin--;
      c--;
    }

    // The scan resumes past the extended span whatever happens below. Every
    // seed inside it would extend to the same run, and the containment drop
    // would throw the result away after paying for it.
    i = Math.max(end, i + 1);

    // Snap INWARD to word boundaries, CONSULTING BOTH TEXTS. Extension stops
    // where the two diverge, and that is mid-token more often than not - the
    // review saw "s the ability to" and "communications w" proposed as
    // claims. The divergence point is a boundary only when NEITHER text
    // continues a word through it: "quarter." against "quarter," is a
    // boundary and keeps the word, while "proceedings" against "proceedin."
    // is not and loses the fragment. Asking only the source would cut
    // "quarter" off the first and keep "proceedin" on the second - measured
    // 2026-09-08, which is why both indices are carried.
    let s = begin;
    let cs = c;
    let e = end;
    let de = d;
    while (e > s && (wordAt(src.folded, e) || wordAt(doc.folded, de))) {
      e--;
      de--;
    }
    while (s < e && (wordAt(src.folded, s - 1) || wordAt(doc.folded, cs - 1))) {
      s++;
      cs++;
    }
    while (s < e && src.folded[s] === " ") s++;
    while (e > s && src.folded[e - 1] === " ") e--;
    if (e <= s) continue;

    // Cut from the SOURCE, through the map. The whitespace collapse is not
    // cosmetic: the map records the offset of the FIRST character of a
    // whitespace run (excerpt.ts), so an uncollapsed slice carries the
    // source's newlines and indentation into a claims file. Collapsing is
    // norm-equivalent, so it cannot change what check() finds.
    const span = sourceText
      .slice(src.map[s] as number, (src.map[e - 1] as number) + 1)
      .replace(/\s+/g, " ")
      .trim();
    if (!span) continue;

    // THE THREE ASSERTIONS (spec 8.2 step 4). Each is a bug if it fails.
    if (!phraseFound(sourceText, span)) {
      bugs.push(`not found in the source: ${JSON.stringify(span)}`);
      continue;
    }
    if (!phraseFound(docProse, span)) {
      bugs.push(`not found in the document: ${JSON.stringify(span)}`);
      continue;
    }
    // The one phraseFound cannot stand in for. phraseFound(text, slice) is
    // true for ANY contiguous slice of text, so a slice the map placed one
    // character over still passes it. Equality in FOLD space - the space the
    // match was made in - is what catches an offset map that has shifted.
    if (foldWithMap(span).folded !== src.folded.slice(s, e)) {
      bugs.push(`offset map round trip failed: ${JSON.stringify(span)}`);
      continue;
    }

    candidates.push(span);
  }

  return { spans: dropContained(candidates), bugs };
}

/**
 * Spans with every one contained in another removed, comparing in norm()
 * space because that is where `check()` will compare.
 *
 * ONE implementation of the containment rule, used twice: here over one
 * read's candidates, and in `harvest()` over the union of a URL's several
 * readable reads. A second copy of a rule this small is how the fold table
 * drifted from `norm()` three times.
 *
 * A later span that CONTAINS an earlier one replaces it, in place, so the
 * result keeps source order.
 */
export function dropContained(spans: readonly string[]): string[] {
  const kept: string[] = [];
  const normed: string[] = [];
  for (const span of spans) {
    const n = norm(span);
    if (!n) continue;
    if (normed.some((p) => p.includes(n))) continue;
    for (let k = normed.length - 1; k >= 0; k--) {
      if (n.includes(normed[k] as string)) {
        normed.splice(k, 1);
        kept.splice(k, 1);
      }
    }
    normed.push(n);
    kept.push(span);
  }
  return kept;
}
```

- [ ] **Step 4: Run the tests**

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/harvest/spans.test.ts`
Expected: 8 passed.

- [ ] **Step 4b: Prove the snap has to consult both texts**

The first version of this algorithm asked only the source whether the span ended at a word boundary. It is wrong in both directions, and each direction has a test here.

Temporarily change the end-snap condition to `while (e > s && wordAt(src.folded, e))` - dropping the document side.

Run: `npx vitest run test/harvest/spans.test.ts -t "snaps to word boundaries"`
Expected: FAIL, the emitted span carrying the fragment `proceedin` - the source's next character is a full stop, so the source alone sees a clean boundary while the document is mid-word.

Now restore it and instead drop the source side: `while (e > s && wordAt(doc.folded, de))`.

Run: `npx vitest run test/harvest/spans.test.ts -t "SOURCE that is mid-word"`
Expected: FAIL, the emitted span carrying `proceedin` - the mirror case, where the document's next character is a full stop and the source's continues a word.

Restore both. `git diff --stat src/harvest/spans.ts` must show only the intended file, and the eight tests must pass again.

- [ ] **Step 5: Prove assertion 3 is not decoration**

`phraseFound` cannot catch an off-by-one slice, which is the whole reason assertion 3 exists. Prove the assertion fires when the map is wrong:

In `src/text/excerpt.ts`, temporarily revert `foldWithMap`'s repair - replace

```ts
    const out = (FOLD[raw] ?? raw).toLowerCase();
    for (let k = 0; k < out.length; k++) map.push(i);
    chars.push(out);
```

with the pre-plan-1.2 form:

```ts
    const out = (FOLD[raw] ?? raw).toLowerCase();
    map.push(i);
    chars.push(out);
```

Run: `npx vitest run test/harvest/spans.test.ts -t "lengthening fold"`
Expected: FAIL. Record which assertion fired and the exact message - it must be the `offset map round trip failed` one, and `spans` must not contain the shifted slice. If instead the test fails on `spans` alone with `bugs` empty, assertion 3 is not doing the work this step claims and that is a finding to stop on.

**Restore `src/text/excerpt.ts` exactly**, re-run the whole suite, and confirm:

```bash
cd C:/Users/noaho/testimonium-plan2 && git diff --stat src/text/excerpt.ts && LC_ALL=C tr -d '\000-\177' < src/text/excerpt.ts | wc -c
```
Expected: no diff, and `57`.

- [ ] **Step 6: Point the calibration script at the real implementation**

The seed sweep in Task 2 measured a replica of these rules, because this function did not exist yet. Now it does, so the replica goes.

In `scripts/calibrate-harvest-seed.mjs`:
1. Add `import { commonSpans } from "../dist/harvest/spans.js";`
2. Delete `seedIndex` and `spansOf` entirely, along with the `foldWithMap` import they used.
3. Replace the two call sites `spansOf(doc.text, src.text, L)` and `spansOf(doc.text, src.text, CLASSIFY_L)` with `commonSpans(doc.text, src.text, L).spans` and `commonSpans(doc.text, src.text, CLASSIFY_L).spans`.
4. Replace the REPLICA comment block with:

```js
/**
 * The sweep calls the shipped `commonSpans` (src/harvest/spans.ts). Until
 * plan 2's Task 5 this file carried a replica of its emit rules, because the
 * seed length had to be chosen before the function that consumes it could be
 * written. The replica is gone; the numbers below come from the code that
 * ships.
 */
```

Then rebuild and re-run:

```bash
cd C:/Users/noaho/testimonium-plan2 && npm run build && node scripts/calibrate-harvest-seed.mjs
```

**Compare every line against the table recorded in `docs/calibration-2026-09.md` in Task 2.** Three outcomes, and only the first is silent:
- Identical: append one line to the calibration section saying the sweep was re-run against the shipped `commonSpans` on this date and reproduced the table exactly.
- Different but the selection rule still picks the same L: record BOTH tables in the calibration doc, dated, and say which is the shipped code's.
- Different and the rule picks a different L: **stop.** Change `harvestSeedChars` to the L the rule now picks, rebuild, re-run, update the docstring and the calibration doc, and record the whole sequence in the ledger. A constant chosen from a replica that disagrees with the implementation is exactly the class of number this project refuses to ship.

- [ ] **Step 7: Suite, byte checks, commit**

```bash
cd C:/Users/noaho/testimonium-plan2 && npm test && npx tsc --noEmit && printf 'a\0b' | LC_ALL=C tr -cd '\000' | wc -c && for f in src/harvest/spans.ts test/harvest/spans.test.ts scripts/calibrate-harvest-seed.mjs; do printf "%s nonascii=" "$f"; LC_ALL=C tr -d '\000-\177' < "$f" | wc -c; printf "%s nul=" "$f"; LC_ALL=C tr -cd '\000' < "$f" | wc -c; done
```
Expected: **305 passed**, typecheck silent, self-test `1`, and `0` for all six counts.

```bash
cd C:/Users/noaho/testimonium-plan2 && git add src/harvest/spans.ts test/harvest/spans.test.ts scripts/calibrate-harvest-seed.mjs docs/calibration-2026-09.md && git -c core.safecrlf=false commit -m "feat(harvest): commonSpans - shared spans in the source's typography, with the fold round trip asserted"
```

---

### Task 6: Reading the cited sources - grouped, readable-only, with the redirect reported

**Files:**
- Modify: `src/classify/signals.ts` (`SignalResult` gains `finalUrl`; one line in the return)
- Create: `src/harvest/sources.ts`
- Create: `test/harvest/sources.test.ts`
- Modify: `test/fetch/read-source.test.ts` (one test for the new field)

**Interfaces:**
- Consumes: `readSource` from `src/fetch/read-source.js`; `isReadable` from `src/classify/verdict.js`; `normalizeUrl` and `ClaimsFile` from `src/io/claims.js`; `norm` from `src/text/normalize.js`; `Footnote` from `src/adapters/types.js`; `Fetcher`, `RungId` from `src/fetch/types.js`; `RuleSet` from `src/rules/load.js`.
- Produces, from `src/harvest/sources.ts`:
  ```ts
  export interface HarvestRead {
    readonly rung: RungId;
    readonly text: string;
    readonly normText: string;
  }
  export interface HarvestSource {
    readonly url: string;
    readonly key: string;
    readonly reads: HarvestRead[];
    readonly rungsAttempted: RungId[];
    readonly redirectedTo: string | null;
  }
  export interface SourceScan {
    readonly sources: HarvestSource[];
    readonly unreachable: { url: string; rungsAttempted: RungId[] }[];
    readonly skipped: { url: string; reason: string }[];
  }
  export interface ScanOptions {
    readonly fetcher: Fetcher;
    readonly rules?: RuleSet;
    readonly claims?: ClaimsFile;
  }
  export function scanSources(footnotes: readonly Footnote[], opts: ScanOptions): Promise<SourceScan>;
  ```
  Also produces `SignalResult.finalUrl: string` from `src/classify/signals.ts`. Task 7 consumes `HarvestSource`; Task 8 consumes all of it.

**Why `finalUrl` has to surface.** Spec 8.2 step 2 requires the report to say when a readable read's `finalUrl` differs in path from the URL asked for, because a redirect to a homepage is the exposure the author has to look at (Fable F5, path 3). `RawResponse` carries it and `computeSignals` receives it, but `SignalResult` drops it, so no caller can see it. It is added as a REPORTED field and gates nothing: `check`'s behaviour must be byte-identical after this task, and the README's disclosure that the gate never compares a read's `finalUrl` with the URL it was asked for stays true of the gate (Task 10 scopes that sentence).

**Why readable-only, restated here because it is the keystone (Fable F1).** `isReadable`, never `!isBlocked`. 22 of the 25 challenge fixtures and every paywall stub pass all five vetoes and fail only the prose floor. Harvesting from one turns `check`'s accepted sub-floor-stub exposure into a generator: the stub carries the lede, the author quoted the lede, harvest proposes it, the author confirms it, and `check` attests `supported` against a wall.

- [ ] **Step 1: Write the failing test for `SignalResult.finalUrl`**

Append to `test/fetch/read-source.test.ts`, inside its existing `describe`:

```ts
  it("carries the finalUrl each read was classified under", async () => {
    // RawResponse has always carried it and computeSignals has always
    // received it; nothing could read it back. Harvest needs it to report a
    // redirect away from the cited path (spec 8.2 step 2). It is REPORTED
    // and gates nothing - test/check.test.ts's redirect pin asserts that the
    // verdict is unmoved by it.
    const body = `<html><body>${"The committee report states that spending rose sharply. ".repeat(120)}</body></html>`;
    const { reads } = await readSource("https://e.com/a", [], {
      fetcher: {
        rungs: ["node", "curl"] as RungId[],
        async fetch() {
          return {
            rawBody: body,
            status: 200,
            headers: {},
            finalUrl: "https://e.com/elsewhere",
            bytes: 0,
          };
        },
      },
    });
    expect(reads[0]!.computed.finalUrl).toBe("https://e.com/elsewhere");
  });
```

If `RungId` is not already imported in that file, add it to the existing `import type` line from `../../src/fetch/types.js`.

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/fetch/read-source.test.ts`
Expected: FAIL at typecheck-free runtime with `expected undefined to be 'https://e.com/elsewhere'`.

- [ ] **Step 2: Add the field**

In `src/classify/signals.ts`, add to `SignalResult` after `readonly text: string;`:

```ts
  /** The URL this read was actually classified under, after redirects - what
   *  the fetcher reported, or the URL asked for when it reported none.
   *
   *  REPORTED, NEVER GATING. `verdict()` does not see it and `check()` does
   *  not compare it with the citation, which is a gate left unbuilt and is
   *  disclosed as such in the README. `harvest` reports when a readable
   *  read's path differs from the cited path (spec 8.2 step 2), because a
   *  redirect to a homepage is the exposure an author has to look at before
   *  confirming a proposal. */
  readonly finalUrl: string;
```

and in the object `computeSignals` returns, immediately after `text,`:

```ts
    finalUrl: input.finalUrl,
```

Run the test again: expected PASS. Run `npm test`: expected 306 passed, everything else unchanged - **if any other test moves, stop**: this field is not allowed to change a verdict.

- [ ] **Step 3: Write the failing `scanSources` tests**

Create `test/harvest/sources.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scanSources } from "../../src/harvest/sources.js";
import { parseClaimsFile } from "../../src/io/claims.js";
import { THRESHOLDS, proseVolume } from "../../src/classify/thresholds.js";
import { toText } from "../../src/text/extract.js";
import type { Fetcher, RawResponse, RungId } from "../../src/fetch/types.js";
import type { Footnote } from "../../src/adapters/types.js";

// No fixture reads: bodies are built inline, as test/check.test.ts's are.
function stub(per: Partial<Record<RungId, Partial<RawResponse>>>, rungs: RungId[] = ["node", "curl"]): Fetcher {
  return {
    rungs,
    async fetch(url, rung) {
      return { rawBody: "", status: 0, headers: {}, finalUrl: url, bytes: 0, ...(per[rung] ?? {}) } as RawResponse;
    },
  };
}

const DOC_BODY = `<html><title>The Committee Report</title><body>${"The committee report states that spending rose sharply. ".repeat(120)}</body></html>`;
const STUB_BODY = "<html><body><p>The committee report states that spending rose sharply.</p></body></html>";
const WALL = "<html><body>Verifying you are human.</body></html>";
const fn = (n: number, url: string | null, label = "L"): Footnote => ({ n, url, label });

describe("scanSources", () => {
  it("reads a normalized URL once, keyed by the first citation spelling", async () => {
    // Spec 8.2 step 1: citations are grouped by normalizeUrl; a URL cited
    // under two spellings is read once and keyed by the first spelling seen.
    // Reading it twice would double the fetches and give the draft file two
    // keys parseClaimsFile then refuses as a collision (Fable F8).
    let fetches = 0;
    const fetcher: Fetcher = {
      rungs: ["node", "curl"] as RungId[],
      async fetch(url) {
        fetches += 1;
        return { rawBody: DOC_BODY, status: 200, headers: {}, finalUrl: url, bytes: 0 };
      },
    };
    const scan = await scanSources(
      [fn(1, "https://e.com/a?utm_source=news"), fn(2, "https://E.com/a")],
      { fetcher },
    );
    expect(scan.sources.map((s) => s.url)).toEqual(["https://e.com/a?utm_source=news"]);
    expect(scan.sources[0]!.key).toBe("https://e.com/a");
    expect(fetches).toBe(1);
  });

  it("keeps only READABLE reads: a sub-floor stub proposes nothing (Fable F1)", async () => {
    // The stub passes all five vetoes and fails only the prose floor. Under
    // `!isBlocked` it would be a harvest source, and harvest would propose
    // the lede that check() then attests against a paywall stub.
    expect(proseVolume(toText(STUB_BODY))).toBeLessThan(THRESHOLDS.minProseChars);
    const scan = await scanSources([fn(1, "https://e.com/a")], {
      fetcher: stub({ node: { rawBody: STUB_BODY, status: 200 }, curl: { rawBody: STUB_BODY, status: 200 } }),
    });
    expect(scan.sources).toEqual([]);
    expect(scan.unreachable).toEqual([{ url: "https://e.com/a", rungsAttempted: ["node", "curl"] }]);
  });

  it("reports an unreachable URL with every rung it attempted", async () => {
    const scan = await scanSources([fn(1, "https://e.com/a")], {
      fetcher: stub({ node: { rawBody: WALL, status: 202 }, curl: { rawBody: WALL, status: 202 } }),
    });
    expect(scan.sources).toEqual([]);
    expect(scan.unreachable[0]!.rungsAttempted).toEqual(["node", "curl"]);
  });

  it("skips a notApplicable URL, lists it with its reason, and never fetches it", async () => {
    // Spec 8.2 step 1. The author has declared the URL not checkable; a
    // proposal for it is a proposal she has already refused.
    let fetches = 0;
    const fetcher: Fetcher = {
      rungs: ["node"] as RungId[],
      async fetch(url) {
        fetches += 1;
        return { rawBody: DOC_BODY, status: 200, headers: {}, finalUrl: url, bytes: 0 };
      },
    };
    const claims = parseClaimsFile('{"https://e.com/a":{"notApplicable":"rests on the filing itself"}}');
    const scan = await scanSources([fn(1, "https://e.com/a")], { fetcher, claims });
    expect(scan.sources).toEqual([]);
    expect(scan.skipped).toEqual([{ url: "https://e.com/a", reason: "rests on the filing itself" }]);
    expect(fetches).toBe(0);
  });

  it("flags a readable read whose finalUrl path differs from the cited path", async () => {
    // Fable F5, path 3: a redirect to a homepage that shares a sentence with
    // the draft. Reported beside the proposals, never gating - the author is
    // the one who decides whether the page she got is the page she cited.
    const scan = await scanSources([fn(1, "https://e.com/2019/committee-report")], {
      fetcher: stub({ node: { rawBody: DOC_BODY, status: 200, finalUrl: "https://e.com/" } }),
    });
    expect(scan.sources[0]!.redirectedTo).toBe("https://e.com/");
  });

  it("does not flag a redirect that keeps the path", async () => {
    // A tracking-parameter or scheme redirect is not the exposure; only a
    // different PATH is (spec 8.2 step 2).
    const scan = await scanSources([fn(1, "http://e.com/committee-report")], {
      fetcher: stub({ node: { rawBody: DOC_BODY, status: 200, finalUrl: "https://e.com/committee-report?ref=x" } }),
    });
    expect(scan.sources[0]!.redirectedTo).toBeNull();
  });

  it("never fetches a footnote with no external source", async () => {
    let fetches = 0;
    const fetcher: Fetcher = {
      rungs: ["node"] as RungId[],
      async fetch(url) {
        fetches += 1;
        return { rawBody: DOC_BODY, status: 200, headers: {}, finalUrl: url, bytes: 0 };
      },
    };
    const scan = await scanSources([fn(1, null, "an internal cross-link")], { fetcher });
    expect(scan.sources).toEqual([]);
    expect(scan.unreachable).toEqual([]);
    expect(fetches).toBe(0);
  });
});
```

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/harvest/sources.test.ts`
Expected: the file fails to collect, `Failed to resolve import "../../src/harvest/sources.js"`.

- [ ] **Step 4: Write `src/harvest/sources.ts`**

```ts
import type { Footnote } from "../adapters/types.js";
import { isReadable } from "../classify/verdict.js";
import { readSource } from "../fetch/read-source.js";
import type { Fetcher, RungId } from "../fetch/types.js";
import { normalizeUrl, type ClaimsFile } from "../io/claims.js";
import type { RuleSet } from "../rules/load.js";
import { norm } from "../text/normalize.js";

/** One readable read of one URL, with the two forms of its text harvest
 *  needs. */
export interface HarvestRead {
  readonly rung: RungId;
  /** The extracted text, which proposals are cut from. */
  readonly text: string;
  /** `norm(text)`, computed ONCE per read (Fable F18). The frequency filter
   *  asks every other source's every read about every span; recomputing
   *  norm() inside that loop is O(spans x sources x |text|) over bodies that
   *  run to tens of thousands of characters. */
  readonly normText: string;
}

export interface HarvestSource {
  /** The FIRST citation spelling of this normalized URL. The draft file is
   *  keyed by it, so that a URL cited twice cannot produce two draft keys
   *  that `parseClaimsFile` then refuses as a collision (Fable F8). */
  readonly url: string;
  /** `normalizeUrl(url)`. Identity for the frequency filter and for the join
   *  against an existing claims file. */
  readonly key: string;
  /** READABLE reads only, in the order attempted. Only these propose, and
   *  only these vote (spec 6.6, "Harvest reads only what is readable").
   *
   *  With the shipped ladder this list holds AT MOST ONE read, because
   *  `nextAction` stops the moment a read is readable (fetch/ladder.ts). It
   *  is a list because spec 8.2 says "reads", plural, and because the shape
   *  is what keeps harvest correct if the stop rule ever changes - the same
   *  defensiveness `bestReadable` carries in read-source.ts. Task 8 pins the
   *  at-most-one property as a characterization, so a change to the ladder
   *  shows up as a red test rather than as a silent widening. */
  readonly reads: HarvestRead[];
  readonly rungsAttempted: RungId[];
  /** The final URL of the first readable read whose PATH differs from the
   *  path asked for, or null. Reported beside the proposals; gates nothing. */
  readonly redirectedTo: string | null;
}

export interface SourceScan {
  readonly sources: HarvestSource[];
  /** A URL with no readable read. Nothing is proposed for it, and the report
   *  says which rungs were tried (spec 8.2 step 2). */
  readonly unreachable: { url: string; rungsAttempted: RungId[] }[];
  /** A URL the author has declared not checkable. Never fetched. */
  readonly skipped: { url: string; reason: string }[];
}

export interface ScanOptions {
  readonly fetcher: Fetcher;
  readonly rules?: RuleSet;
  /** The existing `<doc>.claims.json`, when there is one. Used HERE only to
   *  skip `notApplicable` URLs; filter 4's already-claimed test reads it
   *  separately. */
  readonly claims?: ClaimsFile;
}

/** A URL's path, or the whole string when it does not parse - the same
 *  fallback `normalizeUrl` and `slugLabelOverlap` make, for the same reason:
 *  an unparseable citation is the author's to fix, not this function's to
 *  guess at. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Every cited URL, read once, reduced to the reads harvest may propose from.
 *
 * Grouping is by `normalizeUrl` and the group keeps the FIRST spelling seen
 * (spec 8.2 step 1). Reading is `readSource` - the one ladder loop, shared
 * with `check` and `reachability` (spec 6.6) - and the filter afterwards is
 * `isReadable`, NOT `!isBlocked`: 22 of the 25 challenge fixtures and every
 * paywall stub pass all five vetoes and fail only the prose floor, and
 * harvesting from one would turn the checker's accepted sub-floor-stub
 * exposure into a generator of it (Fable F1).
 *
 * No claims are passed to `readSource`: harvest has none to match, and the
 * signals it needs - the vetoes and the prose count - do not depend on them.
 */
export async function scanSources(
  footnotes: readonly Footnote[],
  opts: ScanOptions,
): Promise<SourceScan> {
  const sources: HarvestSource[] = [];
  const unreachable: SourceScan["unreachable"][number][] = [];
  const skipped: SourceScan["skipped"][number][] = [];
  const seen = new Set<string>();

  for (const footnote of footnotes) {
    if (!footnote.url) continue;
    const key = normalizeUrl(footnote.url);
    if (seen.has(key)) continue;
    seen.add(key);

    const entry = opts.claims?.get(key);
    if (entry !== undefined && !Array.isArray(entry)) {
      skipped.push({ url: footnote.url, reason: entry.notApplicable });
      continue;
    }

    const { reads, attempted } = await readSource(footnote.url, [], {
      fetcher: opts.fetcher,
      sourceLabel: footnote.label,
      ...(opts.rules ? { rules: opts.rules } : {}),
    });

    const readable = reads.filter((r) => isReadable(r.computed.signals));
    if (readable.length === 0) {
      unreachable.push({ url: footnote.url, rungsAttempted: attempted });
      continue;
    }

    const asked = pathOf(footnote.url);
    const moved = readable.find((r) => pathOf(r.computed.finalUrl) !== asked);
    sources.push({
      url: footnote.url,
      key,
      reads: readable.map((r) => ({
        rung: r.rung,
        text: r.computed.text,
        normText: norm(r.computed.text),
      })),
      rungsAttempted: attempted,
      redirectedTo: moved ? moved.computed.finalUrl : null,
    });
  }

  return { sources, unreachable, skipped };
}
```

- [ ] **Step 5: Run the tests**

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/harvest/sources.test.ts`
Expected: 7 passed.

- [ ] **Step 6: Prove the readable filter is the one that discriminates**

In `src/harvest/sources.ts`, temporarily change the filter to `reads.filter((r) => !isBlocked(r.computed.signals))` (adding the import).
Run: `npx vitest run test/harvest/sources.test.ts -t "sub-floor stub"`
Expected: FAIL, `expected [ { url: ..., reads: [...] } ] to deeply equal []` - the stub became a harvest source. This is F1 made visible. Restore the filter and the import; `git diff --stat src/harvest/sources.ts` must show only the intended file.

- [ ] **Step 7: Suite, byte checks, commit**

```bash
cd C:/Users/noaho/testimonium-plan2 && npm test && npx tsc --noEmit && printf 'a\0b' | LC_ALL=C tr -cd '\000' | wc -c && for f in src/classify/signals.ts src/harvest/sources.ts test/harvest/sources.test.ts test/fetch/read-source.test.ts; do printf "%s nonascii=" "$f"; LC_ALL=C tr -d '\000-\177' < "$f" | wc -c; printf "%s nul=" "$f"; LC_ALL=C tr -cd '\000' < "$f" | wc -c; done
```
Expected: **313 passed**, typecheck silent, self-test `1`, and `0` for all eight counts.

```bash
cd C:/Users/noaho/testimonium-plan2 && git add src/classify/signals.ts src/harvest/sources.ts test/harvest/sources.test.ts test/fetch/read-source.test.ts && git -c core.safecrlf=false commit -m "feat(harvest): scanSources - one read per normalized URL, readable reads only"
```

---

### Task 7: The four filters, in order, and `RuleSet.boilerplate`

**Files:**
- Create: `src/rules/boilerplate.ts`
- Modify: `src/rules/load.ts` (`RuleSet` gains a field; `loadRules` merges a local list)
- Create: `src/harvest/filters.ts`
- Create: `test/harvest/filters.test.ts`
- Modify: `test/rules/load.test.ts`

**Interfaces:**
- Consumes: `belowClaimFloor`, `claimFloorMessage` from `src/io/claims.js` (Task 3); `HarvestSource` from `src/harvest/sources.js` (Task 6); `Rule` from `src/rules/challenge.js`; `norm` from `src/text/normalize.js`.
- Produces:
  ```ts
  // src/rules/boilerplate.ts
  export const BOILERPLATE_RULES: readonly Rule[];   // empty
  // src/rules/load.ts
  export interface RuleSet {
    readonly signatures: readonly Rule[];
    readonly paths: readonly Rule[];
    readonly hosts: readonly HostRule[];
    readonly boilerplate: readonly Rule[];           // NEW
  }
  // src/harvest/filters.ts
  export interface FilterDrops {
    readonly floor: number;
    readonly frequency: number;
    readonly rules: number;
    readonly claimed: number;
  }
  export interface FilterResult {
    readonly kept: string[];
    readonly drops: FilterDrops;
    readonly floorMessages: string[];
  }
  export interface FilterInput {
    readonly source: HarvestSource;
    readonly spans: readonly string[];
    readonly others: readonly HarvestSource[];
    readonly existing: readonly string[];
    readonly boilerplate: readonly Rule[];
  }
  export function applyFilters(input: FilterInput): FilterResult;
  ```
  Task 8 consumes `applyFilters` and `FilterDrops`.

**On the public surface.** `RuleSet` is already exported from `src/index.ts`; spec 8.2 filter 3 requires it to gain `boilerplate`. That is an additive change to an existing public TYPE, not a new public NAME - `BOILERPLATE_RULES`, `applyFilters` and every other name in this task stay module-internal, and `test/exports.test.ts`'s pins are untouched. Say so in the ledger so a reviewer does not have to work it out.

**The order is the spec's and is not negotiable** (spec 8.2 step 5; 13 Q5): floor, cross-source frequency, boilerplate rules, already-claimed. Each reports how many spans it dropped, per URL, so an author who suspects a filter took something real can see which one.

**Why the bundled list is empty.** A bundled rule carries a `lastConfirmed` date, and a date means somebody saw the phrase on a live page on that day. The cross-fixture boilerplate Task 2 classified was seen in a fixture, which is not a live observation, and Task 2's calibration section says so. The author's own rules are the only cure for a phrase that recurs across one outlet's pages when the draft cites that outlet once, and filter 2 cannot see that case at all.

- [ ] **Step 1: Write the failing `loadRules` tests**

Append to `test/rules/load.test.ts`, inside its `describe`:

```ts
  it("ships an empty boilerplate list, and a local file adds to it", () => {
    // Spec 8.2 filter 3. Bundled-empty is deliberate: a bundled rule needs a
    // lastConfirmed date from a live page, and the phrases plan 2's
    // calibration found were seen in fixtures.
    expect(loadRules().boilerplate).toEqual([]);
    const p = withFile(
      JSON.stringify({
        boilerplate: [{ pattern: "all rights reserved", lastConfirmed: "2026-09-08", note: "site footer" }],
      }),
    );
    const r = loadRules(p);
    expect(r.boilerplate.length).toBe(1);
    expect(r.boilerplate[0]!.note).toBe("site footer");
    expect(r.boilerplate[0]!.pattern.test("all rights reserved")).toBe(true);
  });

  it("holds a local boilerplate rule to the same dated discipline as every other rule", () => {
    // Fable F9: the draft proposed a bare string[] for these. A rule with no
    // date and no note is the rot the discipline exists to make visible, and
    // loadRules already refuses it for signatures, paths and hosts.
    expect(() => loadRules(withFile(JSON.stringify({ boilerplate: [{ pattern: "x" }] })))).toThrow(/lastConfirmed/);
    expect(() =>
      loadRules(withFile(JSON.stringify({ boilerplate: [{ pattern: "x", lastConfirmed: "2026-09-08" }] }))),
    ).toThrow(/note/);
  });
```

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/rules/load.test.ts`
Expected: FAIL - `expected undefined to deeply equal []`.

- [ ] **Step 2: Create the bundled list**

Create `src/rules/boilerplate.ts`:

```ts
import type { Rule } from "./challenge.js";

/**
 * Phrases harvest must never propose as a claim, tested as regexes against
 * `norm(span)` in filter 3 (spec 8.2 step 5.3).
 *
 * IT SHIPS EMPTY, AND THAT IS THE DESIGN, NOT AN OMISSION. A rule in this
 * repository carries a `lastConfirmed` date, and a date asserts that somebody
 * saw the phrase on a live page that day. Plan 2's calibration found the
 * usual furniture - "Terms of Use Privacy Policy", "All Rights Reserved.",
 * "Accessibility Statement" - in the fixture corpus, which is a recording,
 * not an observation, so none of it earns a dated entry here.
 *
 * The primary mechanism is filter 2, cross-source frequency, which needs no
 * list at all (spec 13 Q5). This list exists for the case frequency cannot
 * see: a phrase that recurs across ONE outlet's pages when the draft cites
 * that outlet once. The author writing her own `--rules` file is the only
 * cure for that, and additive-only means her file can add to this list and
 * never delete from it.
 *
 * A rule is a SUBSTRING test on normalized text once it is compiled, so a
 * rule `all rights reserved` will also delete a real claim quoting a
 * copyright dispute. That makes the list a recall risk, not a correctness
 * one: a span it removes is a span the author does not see, and nothing it
 * removes can produce a false verdict.
 */
export const BOILERPLATE_RULES: readonly Rule[] = [];
```

- [ ] **Step 3: Wire it through `loadRules`**

In `src/rules/load.ts`:

Add to the imports:

```ts
import { BOILERPLATE_RULES } from "./boilerplate.js";
```

Add to `RuleSet`, after `hosts`:

```ts
  /** Phrases harvest refuses to propose (spec 8.2 filter 3). Same dated
   *  `Rule` shape as signatures and paths, because a rule nobody can date is
   *  a rule nobody can review. Ships empty - see boilerplate.ts. Consulted
   *  by harvest only; it can never change a verdict. */
  readonly boilerplate: readonly Rule[];
```

Add to the local-file type:

```ts
    boilerplate?: LocalRule[];
```

and to BOTH returns:

```ts
  if (!path) return { signatures: CHALLENGE_SIGNATURES, paths: CHALLENGE_PATHS, hosts: HOST_RULES, boilerplate: BOILERPLATE_RULES };
```

```ts
    boilerplate: [...BOILERPLATE_RULES, ...(local.boilerplate ?? []).map((r, i) => toRule(r, `boilerplate[${i}]`))],
```

`toRule` already demands `pattern`, `lastConfirmed` and `note` and compiles the pattern with no flags, so `.test()` carries no `lastIndex` state - the same property `matchesChallengeSignature` relies on.

Run: `npx vitest run test/rules/load.test.ts` - expected all pass. Run `npx tsc --noEmit`: **it will fail** anywhere a `RuleSet` literal is constructed without the new field. At `ff71ec8` that is `test/check.test.ts`'s `RULES_WITH_LOCAL_SIGNATURE`. Add `boilerplate: [],` to it, with the comment `// harvest's list; no bearing on check()`.

- [ ] **Step 4: Write the failing filter tests**

Create `test/harvest/filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyFilters } from "../../src/harvest/filters.js";
import type { HarvestSource } from "../../src/harvest/sources.js";
import { norm } from "../../src/text/normalize.js";
import { THRESHOLDS } from "../../src/classify/thresholds.js";
import type { Rule } from "../../src/rules/challenge.js";

const source = (url: string, ...texts: string[]): HarvestSource => ({
  url,
  key: url,
  reads: texts.map((text, i) => ({ rung: i === 0 ? "node" : "curl", text, normText: norm(text) })),
  rungsAttempted: ["node"],
  redirectedTo: null,
});

const ONE = "the committee reported that spending rose sharply";
const TWO = "the review of procurement practices is still ongoing";
/** Built FROM the constant so Task 2 re-deriving the floor cannot turn these
 *  tests red for the wrong reason. */
const SHORT = "x".repeat(THRESHOLDS.minClaimChars - 1);
const base = {
  others: [] as HarvestSource[],
  existing: [] as string[],
  boilerplate: [] as Rule[],
};

describe("applyFilters", () => {
  it("keeps a span that survives every filter, in the source's own typography", () => {
    const r = applyFilters({ ...base, source: source("https://e.com/a", ONE), spans: [ONE] });
    expect(r.kept).toEqual([ONE]);
    expect(r.drops).toEqual({ floor: 0, frequency: 0, rules: 0, claimed: 0 });
  });

  it("filter 1 refuses a span under the floor, with the loader's own message", () => {
    // Spec 7.3's third site. The same builder the claims-file loader and
    // check()'s front door use, so an author meets one wording.
    const r = applyFilters({ ...base, source: source("https://e.com/a", SHORT), spans: [SHORT, ONE] });
    expect(r.kept).toEqual([ONE]);
    expect(r.drops.floor).toBe(1);
    expect(r.floorMessages[0]).toContain("https://e.com/a");
    expect(r.floorMessages[0]).toContain("characters once normalized");
    expect(r.floorMessages[0]).toContain("extend it to take in the surrounding words");
  });

  it("filter 2 drops a span another cited source also carries", () => {
    // Spec 8.2 filter 5.2 and 13 Q5: text in two of the draft's own sources
    // is the outlet's name, a cookie notice, a shared byline or a wire story
    // reprinted twice - not something the author learned from either page.
    const other = source("https://f.com/b", `Nav. ${ONE}. Footer.`);
    const r = applyFilters({ ...base, source: source("https://e.com/a", ONE), spans: [ONE], others: [other] });
    expect(r.kept).toEqual([]);
    expect(r.drops.frequency).toBe(1);
  });

  it("filter 2 never lets a URL's OWN other reads vote against it", () => {
    // A node read and a curl read of one URL carry the same text by
    // construction. Letting them vote would drop every proposal the tool
    // makes (Fable F10b), and `others` is the caller's contract for it.
    const r = applyFilters({
      ...base,
      source: source("https://e.com/a", `Node copy: ${ONE}.`, `Curl copy: ${ONE}.`),
      spans: [ONE],
    });
    expect(r.kept).toEqual([ONE]);
    expect(r.drops.frequency).toBe(0);
  });

  it("filter 2 is vacuous with nothing to compare against", () => {
    const r = applyFilters({ ...base, source: source("https://e.com/a", ONE), spans: [ONE, TWO], others: [] });
    expect(r.kept).toEqual([ONE, TWO]);
    expect(r.drops.frequency).toBe(0);
  });

  it("filter 3 tests a boilerplate rule against norm(span), not the raw span", () => {
    // Patterns are written against normalized text - the discipline
    // matchesChallengeSignature already follows - so case, smart quotes and
    // zero-width characters cannot dodge them.
    const RESERVED = "All Rights Reserved, by the publisher";
    const rule: Rule = { pattern: /all rights reserved/, lastConfirmed: "2026-09-08", note: "site footer" };
    const r = applyFilters({
      ...base,
      source: source("https://e.com/a", RESERVED),
      spans: [RESERVED, ONE],
      boilerplate: [rule],
    });
    expect(r.kept).toEqual([ONE]);
    expect(r.drops.rules).toBe(1);
  });

  it("filter 4 drops a span contained in an existing claim, and one containing it", () => {
    const inside = "spending rose sharply";
    const outside = `the committee reported that ${inside} in the fourth quarter`;
    const r = applyFilters({
      ...base,
      source: source("https://e.com/a", outside),
      spans: [inside, outside, TWO],
      existing: [ONE],
    });
    expect(r.kept).toEqual([TWO]);
    expect(r.drops.claimed).toBe(2);
  });

  it("runs the filters in the spec's order, so each drop is attributed once", () => {
    // A single span that would trip filters 1, 2, 3 and 4 is counted by the
    // FIRST one only. Order matters to the author reading the counts: a span
    // reported as boilerplate when it was really below the floor sends her
    // to write a rule she does not need.
    const rule: Rule = { pattern: new RegExp(SHORT), lastConfirmed: "2026-09-08", note: "matches the short span" };
    const r = applyFilters({
      source: source("https://e.com/a", SHORT),
      spans: [SHORT],
      others: [source("https://f.com/b", SHORT)],
      existing: [SHORT],
      boilerplate: [rule],
    });
    expect(r.drops).toEqual({ floor: 1, frequency: 0, rules: 0, claimed: 0 });
  });
});
```

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/harvest/filters.test.ts`
Expected: the file fails to collect, `Failed to resolve import "../../src/harvest/filters.js"`.

- [ ] **Step 5: Write `src/harvest/filters.ts`**

```ts
import { belowClaimFloor, claimFloorMessage } from "../io/claims.js";
import type { Rule } from "../rules/challenge.js";
import { norm } from "../text/normalize.js";
import type { HarvestSource } from "./sources.js";

/** How many spans each filter removed, for THIS URL. Reported per URL so an
 *  author who suspects a filter took something real can see which one (spec
 *  8.2 step 5). */
export interface FilterDrops {
  readonly floor: number;
  readonly frequency: number;
  readonly rules: number;
  readonly claimed: number;
}

export interface FilterResult {
  readonly kept: string[];
  readonly drops: FilterDrops;
  /** One message per span filter 1 refused, from the same builder the
   *  claims-file loader and `check()`'s front door use (spec 7.3's third
   *  site). Harvest DROPS rather than errors - a span is a proposal, not an
   *  authored claim - but the author who wants to know why sees the same
   *  wording she would have seen from the other two doors. */
  readonly floorMessages: string[];
}

export interface FilterInput {
  readonly source: HarvestSource;
  readonly spans: readonly string[];
  /** Every OTHER source holding at least one readable read. The caller
   *  excludes `source` itself: a URL's own reads never vote against its own
   *  spans, and two citations that normalize alike are ONE source, so they
   *  cannot vote against each other either (Fable F10). */
  readonly others: readonly HarvestSource[];
  /** The claims `<doc>.claims.json` already records for this URL. */
  readonly existing: readonly string[];
  readonly boilerplate: readonly Rule[];
}

/**
 * The four filters, in the order spec 8.2 step 5 fixes: floor, cross-source
 * frequency, boilerplate rules, already-claimed. A span is attributed to the
 * FIRST filter that drops it, which is what makes the counts readable.
 *
 * `norm(span)` is computed once per span, and every read's `normText` was
 * computed once when it was read (Fable F18): the frequency filter is a
 * substring test between two already-normalized strings, never a
 * `phraseFound` that re-normalizes a source body per span.
 */
export function applyFilters(input: FilterInput): FilterResult {
  const kept: string[] = [];
  const floorMessages: string[] = [];
  let floor = 0;
  let frequency = 0;
  let rules = 0;
  let claimed = 0;
  const existing = input.existing.map(norm);

  for (const span of input.spans) {
    // 1. Floor (spec 7.3). Refused for the same reason the other two doors
    //    refuse: a phrase this short attests nothing about a source.
    if (belowClaimFloor(span)) {
      floor += 1;
      floorMessages.push(claimFloorMessage(input.source.url, span));
      continue;
    }

    const n = norm(span);

    // 2. Cross-source frequency (13 Q5, primary). `normText.includes(n)` is
    //    exactly phraseFound(read.text, span) with the haystack normalized
    //    once, at read time.
    if (input.others.some((other) => other.reads.some((read) => read.normText.includes(n)))) {
      frequency += 1;
      continue;
    }

    // 3. The author's boilerplate rules. Compiled with no flags by
    //    `toRule`, so `.test()` carries no lastIndex state between spans.
    if (input.boilerplate.some((rule) => rule.pattern.test(n))) {
      rules += 1;
      continue;
    }

    // 4. Already claimed. Containment either way: a proposal inside an
    //    existing claim adds nothing, and one that contains it is the same
    //    claim with more context, which the author can widen by hand if she
    //    wants it.
    if (existing.some((e) => e.includes(n) || n.includes(e))) {
      claimed += 1;
      continue;
    }

    kept.push(span);
  }

  return { kept, drops: { floor, frequency, rules, claimed }, floorMessages };
}
```

- [ ] **Step 6: Run the tests**

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/harvest/filters.test.ts test/rules/load.test.ts`
Expected: 8 + 11 passed.

- [ ] **Step 7: Prove the order test discriminates**

In `src/harvest/filters.ts`, temporarily move the floor block below the frequency block.
Run: `npx vitest run test/harvest/filters.test.ts -t "in the spec's order"`
Expected: FAIL, `expected { floor: 0, frequency: 1, ... } to deeply equal { floor: 1, frequency: 0, ... }`. Restore the order.

- [ ] **Step 8: The floor now has its third door**

```bash
cd C:/Users/noaho/testimonium-plan2 && grep -rn "belowClaimFloor\|claimFloorMessage" src/
```
Expected: **ten CODE lines** - two definitions, one use of each in `src/io/claims.ts`, `src/check.ts` and `src/harvest/filters.ts`, and the import line in each of the latter two (one line apiece, both names; `grep -n` prints lines, not matches, so they are expected). Task 3 recorded seven. Spec 7.3's "three sites" is now literally true; record the count in the ledger. **CORRECTED 2026-09-09 (Task 10):** this said "ten lines" flat, and the command prints **twelve**, at Task 7's own HEAD and still today. The extra two are PROSE, not code: Task 7's own docstring fix named both functions in `src/classify/thresholds.ts`, and Task 10 kept them there deliberately, because "every door calls these two" is the invariant that docstring now asserts and a grep is how a reader checks it. Ten code lines is still right; the number printed is twelve. Task 7's report was corrected at the time and this step was not - a doc-drift sweep covers the verification transcript too.

- [ ] **Step 9: Suite, byte checks, commit**

```bash
cd C:/Users/noaho/testimonium-plan2 && npm test && npx tsc --noEmit && printf 'a\0b' | LC_ALL=C tr -cd '\000' | wc -c && for f in src/rules/boilerplate.ts src/rules/load.ts src/harvest/filters.ts test/harvest/filters.test.ts test/rules/load.test.ts test/check.test.ts; do printf "%s nonascii=" "$f"; LC_ALL=C tr -d '\000-\177' < "$f" | wc -c; printf "%s nul=" "$f"; LC_ALL=C tr -cd '\000' < "$f" | wc -c; done
```
Expected: **323 passed**, typecheck silent, self-test `1`, and `0` for all twelve counts.

```bash
cd C:/Users/noaho/testimonium-plan2 && git add src/rules/boilerplate.ts src/rules/load.ts src/harvest/filters.ts test/harvest/filters.test.ts test/rules/load.test.ts test/check.test.ts && git -c core.safecrlf=false commit -m "feat(harvest): the four filters in the spec's order, and RuleSet.boilerplate"
```

---

### Task 8: `harvest()` and the draft file

**Files:**
- Create: `src/io/draft.ts`
- Create: `src/harvest.ts`
- Create: `test/io/draft.test.ts`
- Create: `test/harvest.test.ts`

**Interfaces:**
- Consumes: `Document` from `src/adapters/types.js` (Task 4); `scanSources`/`HarvestSource` from `src/harvest/sources.js` (Task 6); `commonSpans`, `dropContained` from `src/harvest/spans.js` (Task 5); `applyFilters`, `FilterDrops` from `src/harvest/filters.js` (Task 7); `defaultFetcher`; `ClaimsFile` from `src/io/claims.js`; `RuleSet` from `src/rules/load.js`.
- Produces:
  ```ts
  // src/io/draft.ts
  export const DRAFT_SENTENCE: string;
  export function draftNote(version: string, date: string): string;
  export function isHarvestNote(note: unknown): boolean;
  export function buildDraft(input: {
    entries: readonly { url: string; claims: readonly string[] }[];
    version: string;
    date: string;
  }): Record<string, unknown>;
  export function draftInTheWay(path: string): string | null;
  export function writeDraftFile(path: string, draft: Record<string, unknown>): void;
  // src/harvest.ts
  export interface HarvestOptions {
    readonly fetcher?: Fetcher;
    readonly rules?: RuleSet;
    readonly claims?: ClaimsFile;
  }
  export interface HarvestProposal {
    readonly url: string;
    readonly key: string;
    readonly claims: string[];
    readonly rungs: RungId[];
    readonly drops: FilterDrops;
    readonly floorMessages: string[];
    readonly bugs: string[];
    readonly redirectedTo: string | null;
  }
  export interface HarvestReport {
    readonly proposals: HarvestProposal[];
    readonly unreachable: { url: string; rungsAttempted: RungId[] }[];
    readonly skipped: { url: string; reason: string }[];
    readonly frequencyVacuous: boolean;
  }
  export function harvest(doc: Document, opts?: HarvestOptions): Promise<HarvestReport>;
  ```
  Task 9 consumes all of it. **Neither module is added to `src/index.ts`.** `harvest` is reached through the CLI only in this plan, the way `check` and `reachability` reached the CLI in plan 1 before anything imported them programmatically; adding it to the public surface is a separate decision nothing here needs.

**The overwrite rule, and how it is read.** Spec 8.2 step 6: an existing draft is overwritten "only when its `_note` is byte-identical to the marker harvest would write". Read literally that makes a draft written yesterday un-overwritable today, because today's marker carries today's date - harvest would be unusable on its second day. The rule's purpose is to detect the author's own edits, and that is served exactly as well by requiring every byte OUTSIDE the version and the date to match. `isHarvestNote` implements that reading, and this plan records it as a deliberate reading of an ambiguous sentence rather than an implementation detail.

- [ ] **Step 1: Write the failing draft tests**

Create `test/io/draft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDraft, draftInTheWay, draftNote, isHarvestNote, DRAFT_SENTENCE } from "../../src/io/draft.js";
import { parseClaimsFile } from "../../src/io/claims.js";

const withFile = (contents: string): string => {
  const p = join(mkdtempSync(join(tmpdir(), "tstm-")), "doc.claims.draft.json");
  writeFileSync(p, contents, "utf8");
  return p;
};

const CLAIM = "the committee reported that spending rose sharply";

describe("the harvest draft file", () => {
  it("is keyed by the citation spelling, and carries the marker as _note", () => {
    const d = buildDraft({
      entries: [{ url: "https://e.com/a?utm_source=x", claims: [CLAIM] }],
      version: "0.1.0",
      date: "2026-09-08",
    });
    expect(Object.keys(d)).toEqual(["_note", "https://e.com/a?utm_source=x"]);
    expect(d["https://e.com/a?utm_source=x"]).toEqual([CLAIM]);
  });

  it("the marker names the version, the date and the sentence, in that order", () => {
    // Spec 8.2 step 6. The sentence is the whole point of the file: the
    // author is being shown what she COPIED, which is not always what she
    // CLAIMS, and only her confirmation turns a proposal into a claim.
    const note = draftNote("0.1.0", "2026-09-08");
    expect(note).toBe(`testimonium 0.1.0 harvest draft, 2026-09-08. ${DRAFT_SENTENCE}`);
    expect(DRAFT_SENTENCE).toBe(
      "every claim below is unconfirmed; harvest proposes what was copied, not what was meant",
    );
  });

  it("recognizes its own marker whatever version or date it carries", () => {
    // The deliberate reading of "byte-identical": every byte OUTSIDE the
    // version and the date must match. A literal reading would make
    // yesterday's draft un-overwritable today, which would make the command
    // unusable on its second day.
    expect(isHarvestNote(draftNote("0.1.0", "2026-09-08"))).toBe(true);
    expect(isHarvestNote(draftNote("0.9.3", "2027-01-02"))).toBe(true);
    expect(isHarvestNote(`${draftNote("0.1.0", "2026-09-08")} - reviewed by me`)).toBe(false);
    expect(isHarvestNote("my own notes about this file")).toBe(false);
    expect(isHarvestNote(undefined)).toBe(false);
  });

  it("lets harvest overwrite its own untouched draft", () => {
    const p = withFile(JSON.stringify({ _note: draftNote("0.1.0", "2026-09-07"), "https://e.com/a": [CLAIM] }));
    expect(draftInTheWay(p)).toBeNull();
  });

  it("refuses a draft the author has touched, naming the path and the remedy", () => {
    // "Never destroy author work" with no new flag (Fable Q6). A missing or
    // edited _note means she has been in this file.
    const edited = withFile(JSON.stringify({ _note: "mine now", "https://e.com/a": [CLAIM] }));
    const message = draftInTheWay(edited);
    expect(message).toContain(edited);
    expect(message).toContain("rename or delete");
    const missing = withFile(JSON.stringify({ "https://e.com/a": [CLAIM] }));
    expect(draftInTheWay(missing)).toContain("rename or delete");
    const garbage = withFile("not json at all");
    expect(draftInTheWay(garbage)).toContain("rename or delete");
    expect(draftInTheWay(join(tmpdir(), "tstm-no-such-file.claims.draft.json"))).toBeNull();
  });

  it("is a claims file the loader accepts once the author renames it, zero-claim URLs omitted", () => {
    // The draft's whole purpose is to be folded into <doc>.claims.json. If
    // parseClaimsFile refused its shape - the _note, the URL keys, the arrays
    // - the migration path would not exist (Fable F8).
    //
    // A readable source that shares nothing with the draft proposes zero, and
    // harvest() still reports it. Written as `"url": []` it would break the
    // migration on the ORDINARY case: parseClaimsFile refuses an empty array
    // ("claims must be a non-empty array"), so the rename would exit 2 naming
    // a key the author never wrote (Fable F1). buildDraft omits the key.
    const d = buildDraft({
      entries: [
        { url: "https://e.com/a", claims: [CLAIM] },
        { url: "https://e.com/empty", claims: [] },
      ],
      version: "0.1.0",
      date: "2026-09-08",
    });
    expect(Object.keys(d)).not.toContain("https://e.com/empty");
    const parsed = parseClaimsFile(JSON.stringify(d));
    expect([...parsed.keys()]).toEqual(["https://e.com/a"]);
    expect(parsed.get("https://e.com/a")).toEqual([CLAIM]);
  });
});
```

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/io/draft.test.ts`
Expected: fails to collect, `Failed to resolve import "../../src/io/draft.js"`.

- [ ] **Step 2: Write `src/io/draft.ts`**

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * The sentence every harvest draft carries, verbatim.
 *
 * It is the file's reason for existing. Harvest proposes what the author
 * COPIED from a source; that is not always what she CLAIMS the source shows,
 * and a span lifted from a page is evidence that a sentence was lifted, not
 * evidence that the sentence is the point of the citation (spec 8.2, "What it
 * is not"). Her confirmation is the step that turns a proposal into a claim,
 * and this sentence is what asks for it.
 */
export const DRAFT_SENTENCE =
  "every claim below is unconfirmed; harvest proposes what was copied, not what was meant";

/** The `_note` marker harvest writes: version, date, sentence. */
export function draftNote(version: string, date: string): string {
  return `testimonium ${version} harvest draft, ${date}. ${DRAFT_SENTENCE}`;
}

/**
 * Is this `_note` one harvest wrote and nobody has edited?
 *
 * Spec 8.2 says "byte-identical to the marker harvest would write". Read
 * strictly that would mean the marker for TODAY, so a draft written yesterday
 * could never be overwritten and the command would be unusable on its second
 * day. The rule exists to detect the author's edits, and every byte outside
 * the version and the date is what carries that signal, so those two fields
 * are the only ones allowed to differ. Recorded as a deliberate reading in
 * docs/superpowers/plans/2026-09-08-plan-2-harvest.md.
 */
export function isHarvestNote(note: unknown): boolean {
  if (typeof note !== "string") return false;
  const m = /^testimonium (\S+) harvest draft, (\d{4}-\d{2}-\d{2})\. ([\s\S]*)$/.exec(note);
  return m !== null && m[3] === DRAFT_SENTENCE;
}

export interface DraftInput {
  /** One entry per normalized URL, keyed by the FIRST citation spelling -
   *  two keys that normalize alike would be a collision `parseClaimsFile`
   *  refuses, on the very file the author is about to rename (Fable F8). An
   *  entry with no surviving claims is OMITTED rather than written as `[]`;
   *  see `buildDraft`. */
  readonly entries: readonly { url: string; claims: readonly string[] }[];
  readonly version: string;
  readonly date: string;
}

/**
 * The draft, in the claims-file shape, with `_note` first.
 *
 * An entry with no surviving claims is OMITTED. `harvest()` reports one
 * proposal per readable URL whether or not anything survived the filters -
 * a readable source that shares nothing with the draft, or whose every span
 * was filtered, is the ordinary case - and `parseClaimsFile` refuses `[]`
 * ("claims must be a non-empty array"). Writing one would hand the author a
 * file the tool's own loader rejects the moment she renames it, naming a key
 * she never wrote, and `[]` is not a value the claims-file shape admits at
 * all (7.3: a non-empty array of strings, or `notApplicable`). Nothing is
 * lost: the per-URL report line has already told her that URL proposed 0.
 */
export function buildDraft(input: DraftInput): Record<string, unknown> {
  const draft: Record<string, unknown> = { _note: draftNote(input.version, input.date) };
  for (const entry of input.entries) {
    if (entry.claims.length === 0) continue;
    draft[entry.url] = [...entry.claims];
  }
  return draft;
}

/**
 * Why harvest must not write over the file at `path`, or null when it may.
 *
 * Neither always-overwrite nor always-refuse (Fable Q6): overwrite only what
 * harvest itself wrote and nobody has touched. A file that is not JSON, or
 * whose `_note` is missing or edited, is the author's - the message names the
 * path and asks for a rename or a delete, and the caller exits 2.
 */
export function draftInTheWay(path: string): string | null {
  if (!existsSync(path)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return `${path} exists and is not a harvest draft (it is not JSON); rename or delete it and run again`;
  }
  const note = parsed && typeof parsed === "object" ? (parsed as { _note?: unknown })._note : undefined;
  if (isHarvestNote(note)) return null;
  return `${path} exists and its "_note" is missing or edited, so it is yours and not harvest's; rename or delete it and run again`;
}

export function writeDraftFile(path: string, draft: Record<string, unknown>): void {
  writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
}
```

Run: `npx vitest run test/io/draft.test.ts` - expected 6 passed.

- [ ] **Step 3: Write the failing `harvest()` tests**

Create `test/harvest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { harvest } from "../src/harvest.js";
import { parseGfmFootnotes } from "../src/adapters/gfm-footnotes.js";
import { parseClaimsFile } from "../src/io/claims.js";
import { THRESHOLDS, proseVolume } from "../src/classify/thresholds.js";
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
    expect(r.unreachable).toEqual([{ url: "https://f.com/story", rungsAttempted: ["node", "curl"] }]);
  });

  it("CHARACTERIZATION: a URL has at most one readable read, because the ladder stops on it", async () => {
    // fetch/ladder.ts stops the moment a read is readable, so "the union over
    // a URL's readable reads" is a union over ONE read today. Harvest is
    // written for a list because spec 8.2 says reads, plural, and because
    // bestReadable in read-source.ts is defensive in the same way. If a
    // future ladder change makes two reads readable, this test turns red and
    // the union stops being theoretical.
    const doc = parseGfmFootnotes(MD);
    const r = await harvest(doc, {
      fetcher: stub({
        "https://e.com/report": { rawBody: page(`${SHARED}.`), status: 200 },
        "https://f.com/story": { rawBody: page(`${OTHER_SHARED}.`), status: 200 },
      }),
    });
    for (const p of r.proposals) expect(p.rungs).toEqual(["node"]);
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
  });

  it("never proposes for a notApplicable URL, and never fetches it", async () => {
    let fetched: string[] = [];
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
});
```

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/harvest.test.ts`
Expected: fails to collect, `Failed to resolve import "../src/harvest.js"`.

- [ ] **Step 4: Write `src/harvest.ts`**

```ts
import type { Document } from "./adapters/types.js";
import { defaultFetcher } from "./fetch/default-fetcher.js";
import type { Fetcher, RungId } from "./fetch/types.js";
import { applyFilters, type FilterDrops } from "./harvest/filters.js";
import { commonSpans, dropContained } from "./harvest/spans.js";
import { scanSources } from "./harvest/sources.js";
import type { ClaimsFile } from "./io/claims.js";
import type { RuleSet } from "./rules/load.js";

export interface HarvestOptions {
  /** Bring your own reader, exactly as CheckOptions does. */
  readonly fetcher?: Fetcher;
  readonly rules?: RuleSet;
  /** The existing `<doc>.claims.json`, when the author has one. Absent is
   *  the ordinary case for a document harvest is being run on for the first
   *  time, and is NOT an error. */
  readonly claims?: ClaimsFile;
}

export interface HarvestProposal {
  /** The first citation spelling of this normalized URL; the draft's key. */
  readonly url: string;
  readonly key: string;
  /** Candidate claims, in the SOURCE's typography, after all four filters. */
  readonly claims: string[];
  /** The rungs whose reads proposed. */
  readonly rungs: RungId[];
  readonly drops: FilterDrops;
  readonly floorMessages: string[];
  /** Self-validation failures, reported with a BUG label and never counted
   *  as a filter's work (spec 8.2 step 4). */
  readonly bugs: string[];
  readonly redirectedTo: string | null;
}

export interface HarvestReport {
  readonly proposals: HarvestProposal[];
  readonly unreachable: { url: string; rungsAttempted: RungId[] }[];
  readonly skipped: { url: string; reason: string }[];
  // ^ CORRECTED 2026-09-09 (Task 10). Two things in the block above are stale
  //   against the shipped code, both because a later decision moved past this
  //   text rather than because the text was wrong when written.
  //   (1) `unreachable` ships as
  //       `{ url: string; rungsAttempted: RungId[]; pdfUrl: boolean }[]`.
  //       Controller ruling T6-R4 added `pdfUrl` to `SourceScan.unreachable`
  //       FOR this report, after this block was written: "we could not read
  //       it" and "this machine cannot read PDFs" are different messages to
  //       an author. Narrowing it back would orphan the field.
  //   (2) `bugs` is NOT "reported with a BUG label". Task 8's fix round split
  //       the field into a real map-integrity defect and a benign
  //       `norm()`-boundary drop whose own message begins "NOT A BUG", so a
  //       blanket label would relabel every benign line as a defect. See the
  //       shipped `HarvestProposal.bugs` docstring, and the correction to
  //       Task 9's display snippet further down.
  /** Fewer than two URLs held a readable read, so the cross-source frequency
   *  filter had nothing to compare against. Vacuous, not wrong (13 Q5) - and
   *  the report says so in words rather than leaving the author to infer it
   *  from a zero. */
  readonly frequencyVacuous: boolean;
}

/**
 * Propose candidate claims for every URL a document cites.
 *
 * IT NEVER WRITES `<doc>.claims.json`, and it has no code path that could:
 * it returns a report, and the caller writes `<doc>.claims.draft.json` from
 * it. Every proposal is afterwards judged by `check()` exactly as a
 * hand-written claim is (spec 8.2).
 *
 * HARVEST IS NOT SAFE BY CONSTRUCTION, and the README says so. A span common
 * to the draft and a source is by definition a span `check` will find in that
 * source, so harvest carries the checker's exposures unreduced - an
 * above-floor un-vetoed wall, and a redirect to a homepage that shares a
 * sentence with the draft. It adds one of its own: it proposes what the
 * author COPIED, which is not always what she CLAIMS. The draft's `_note`
 * says so, and her confirmation is what makes a proposal a claim.
 */
export async function harvest(doc: Document, opts: HarvestOptions = {}): Promise<HarvestReport> {
  const fetcher = opts.fetcher ?? defaultFetcher(opts.rules ? { hosts: opts.rules.hosts } : {});
  const scan = await scanSources(doc.footnotes, {
    fetcher,
    ...(opts.rules ? { rules: opts.rules } : {}),
    ...(opts.claims ? { claims: opts.claims } : {}),
  });

  const proposals: HarvestProposal[] = [];
  for (const source of scan.sources) {
    // The union over this URL's readable reads, containment-deduped by the
    // same function commonSpans uses on one read's candidates.
    const candidates: string[] = [];
    const bugs: string[] = [];
    for (const read of source.reads) {
      const found = commonSpans(doc.prose, read.text);
      bugs.push(...found.bugs);
      candidates.push(...found.spans);
    }

    const entry = opts.claims?.get(source.key);
    const filtered = applyFilters({
      source,
      spans: dropContained(candidates),
      // A URL's own reads never vote against its own spans, and two
      // citations that normalize alike are ONE source (Fable F10).
      others: scan.sources.filter((other) => other.key !== source.key),
      existing: Array.isArray(entry) ? entry : [],
      boilerplate: opts.rules?.boilerplate ?? [],
    });

    proposals.push({
      url: source.url,
      key: source.key,
      claims: filtered.kept,
      rungs: source.reads.map((read) => read.rung),
      drops: filtered.drops,
      floorMessages: filtered.floorMessages,
      bugs,
      redirectedTo: source.redirectedTo,
    });
  }

  return {
    proposals,
    unreachable: scan.unreachable,
    skipped: scan.skipped,
    frequencyVacuous: scan.sources.length < 2,
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/harvest.test.ts`
Expected: 7 passed. If "proposes a span the draft and a readable source share" returns more than `[SHARED]`, print `r.proposals[0].claims` and read them: the fixture's filler or its `<title>` is agreeing with the draft somewhere, and the fixture - not the code - is what to change.

- [ ] **Step 6: Prove harvest cannot write the claims file**

```bash
cd C:/Users/noaho/testimonium-plan2 && grep -rn "writeFileSync\|claimsPathFor" src/harvest.ts src/harvest/
```
Expected: **no output.** `harvest()` and everything under `src/harvest/` are pure but for the fetcher; the only writer in the whole feature is `writeDraftFile`, and the only path it is ever handed is `draftPathFor`'s (Task 9). Record the empty result in the ledger - it is the mechanical form of the keystone constraint "harvest never writes `<doc>.claims.json`".

- [ ] **Step 7: Suite, byte checks, commit**

```bash
cd C:/Users/noaho/testimonium-plan2 && npm test && npx tsc --noEmit && printf 'a\0b' | LC_ALL=C tr -cd '\000' | wc -c && for f in src/io/draft.ts src/harvest.ts test/io/draft.test.ts test/harvest.test.ts; do printf "%s nonascii=" "$f"; LC_ALL=C tr -d '\000-\177' < "$f" | wc -c; printf "%s nul=" "$f"; LC_ALL=C tr -cd '\000' < "$f" | wc -c; done
```
Expected: **336 passed**, typecheck silent, self-test `1`, and `0` for all eight counts.

```bash
cd C:/Users/noaho/testimonium-plan2 && git add src/io/draft.ts src/harvest.ts test/io/draft.test.ts test/harvest.test.ts && git -c core.safecrlf=false commit -m "feat(harvest): the command and its draft file, which is never the claims file"
```

---

### Task 9: The CLI - `draftPathFor`, the third command, `--json`, exit codes 0 and 2

**Files:**
- Create: `src/version.ts`
- Modify: `src/index.ts` (one line)
- Modify: `src/bin.ts` (imports; `USAGE`; `draftPathFor`; the `harvest` branch)
- Modify: `test/bin.test.ts`
- Modify: `test/exports.test.ts` (one test's name and comment)

**Interfaces:**
- Consumes: `harvest`, `HarvestReport` from `src/harvest.js`; `buildDraft`, `draftInTheWay`, `writeDraftFile` from `src/io/draft.js`; `parseClaimsFile` from `src/io/claims.js`.
- Produces, from `src/bin.ts`: `export const USAGE: string`, `export function draftPathFor(doc: string): string`, and `claimsPathFor` / `evidencePathFor` become exported beside it. From `src/version.ts`: `export const VERSION: string`. Nothing here reaches the package's `exports` map: `./dist/bin.js` is not a subpath export and `test/exports.test.ts` pins that.

**Exit codes (spec 8.2).** `0` when the draft was written or printed, **including a draft that proposes nothing**; `2` for a refused input, a refused existing claims file, or an edited draft in the way. **There is no exit 1: harvest has no verdict to fail on.** A harvest that proposes nothing is a fact about the draft and its sources, not a defect in either.

**One version string (Fable F13).** Harvest stamps a version into a file the author keeps, so the two hand-maintained copies - `src/index.ts`'s `VERSION` and `package.json`'s `version` - need a single source inside `src/`. It becomes `src/version.ts`; `src/index.ts` re-exports the same name, so the public surface is unchanged, and `test/exports.test.ts`'s existing pin keeps it equal to `package.json`. **No version bump.** `CHANGELOG.md` is `## 0.1.0 (unreleased)` and every section in it says its changes landed "before this version was released, so they carry no deprecation path"; plan 2's breaking claim floor lands the same way.

**The `validateFlags` gap gets one command wider, and stays parked.** `test/bin.test.ts` records that `validateFlags` is command-agnostic - `check doc.md -j` and `reachability doc.md --fail-on-unreachable` are both accepted and ignored - and parks per-command flag tables "for plan 2". Harvest adds no flag of its own (`--json` and `--rules` are global), so the gap does not deepen, but it now covers a third command. Per-command tables are a CLI design decision that would change `check` and `reachability` too, and spec 8.2 does not license one. It stays parked, with the widening pinned by a characterization test so that closing it later is an edit to a red test rather than a silent change.

- [ ] **Step 1: Write the failing CLI tests**

Append to `test/bin.test.ts`, changing its import line to:

```ts
import { classifyRun, claimsPathFor, draftPathFor, evidencePathFor, USAGE, validateFlags } from "../src/bin.js";
```

```ts
describe("draftPathFor", () => {
  it("names <doc>.claims.draft.json beside the document, like its two siblings", () => {
    // Spec 8.2, "CLI": bin.ts gains draftPathFor beside claimsPathFor and
    // evidencePathFor. All three replace the document's extension, so the
    // three files sit together and a versioned prose directory stays
    // readable.
    expect(draftPathFor("essay.md").endsWith("essay.claims.draft.json")).toBe(true);
    expect(claimsPathFor("essay.md").endsWith("essay.claims.json")).toBe(true);
    expect(evidencePathFor("essay.md").endsWith("essay.evidence.json")).toBe(true);
    // The draft is NOT the claims file, and the names must not collide.
    expect(draftPathFor("essay.md")).not.toBe(claimsPathFor("essay.md"));
  });

  it("keeps the document's directory", () => {
    expect(draftPathFor("docs/drafts/essay.markdown")).toContain("drafts");
    expect(draftPathFor("docs/drafts/essay.markdown").endsWith("essay.claims.draft.json")).toBe(true);
  });
});

describe("the usage string", () => {
  it("names all three commands", () => {
    // A command the usage line does not name is a command nobody finds.
    for (const command of ["check", "harvest", "reachability"]) {
      expect(USAGE, command).toContain(command);
    }
  });
});

describe("validateFlags and harvest", () => {
  it("accepts a harvest run with the global flags", () => {
    expect(validateFlags(["harvest", "doc.md", "--json", "--rules", "local.json"])).toBeNull();
  });

  it("CHARACTERIZATION: the command-agnostic gap now covers a third command", () => {
    // `harvest doc.md --fail-on-unreachable` is accepted and ignored, exactly
    // as `reachability doc.md --fail-on-unreachable` is. Per-command flag
    // tables stay parked - they would change check and reachability too, and
    // spec 8.2 licenses no such change - and this test is what makes closing
    // the gap later a deliberate edit to a red test.
    expect(validateFlags(["harvest", "doc.md", "--fail-on-unreachable"])).toBeNull();
    expect(validateFlags(["harvest", "doc.md", "--explain-fetch"])).toBeNull();
  });
});
```

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/bin.test.ts`
Expected: the file fails to collect - `USAGE` and `draftPathFor` are not exported.

- [ ] **Step 2: One version string**

Create `src/version.ts`:

```ts
/**
 * The tool's version, in ONE place inside `src/`.
 *
 * It used to live as a literal in src/index.ts, hand-kept equal to
 * package.json's `version` by a test. Harvest stamps it into
 * `<doc>.claims.draft.json`, a file the author keeps and reads later, so a
 * second copy that could drift is a version stamped on a file that means
 * something slightly untrue. `test/exports.test.ts` still holds this equal to
 * package.json - two files are still two files, and the test is the join.
 */
export const VERSION = "0.1.0";
```

In `src/index.ts`, replace `export const VERSION = "0.1.0";` with:

```ts
export { VERSION } from "./version.js";
```

In `test/exports.test.ts`, rename the last test from `VERSION agrees with package.json - two copies of one number until plan 2 picks a source` to:

```ts
  it("VERSION agrees with package.json - src/version.ts is the source, this test is the join", async () => {
```

and add inside it, above the assertion:

```ts
    // Plan 2 picked the source (Fable F13): src/version.ts. package.json's
    // own `version` is npm's and cannot be removed, so the two files stay
    // two files and this test is what keeps them equal. `harvest` stamps
    // VERSION into every draft it writes.
```

- [ ] **Step 3: `bin.ts` - imports, usage, path helper**

In `src/bin.ts`, extend the imports:

```ts
import { existsSync, readFileSync } from "node:fs";
```

and add:

```ts
import { harvest } from "./harvest.js";
import { buildDraft, draftInTheWay, writeDraftFile } from "./io/draft.js";
import { VERSION } from "./version.js";
```

Add `USAGE` beside `KNOWN_FLAGS`:

```ts
/** Exported so a test can assert it names every command this build has. A
 *  command the usage line does not name is a command nobody finds. */
export const USAGE =
  "usage: testimonium <check|harvest|reachability> <doc.md> " +
  "[--json] [--rules <path>] " +
  "(check only: [--fail-on-unreachable] [--allow-unclaimed] [--explain-fetch])";
```

and use it where the literal stands today:

```ts
  if (!command || !doc) {
    console.error(USAGE);
    return 2;
  }
```

Export the three path helpers, and add the new one:

```ts
// Exported for the test suite, the way validateFlags is - not for consumers:
// `./dist/bin.js` is not a subpath export and test/exports.test.ts pins that.
export function claimsPathFor(doc: string): string {
  return join(dirname(doc), `${basename(doc).replace(/\.[^.]+$/, "")}.claims.json`);
}

export function evidencePathFor(doc: string): string {
  return join(dirname(doc), `${basename(doc).replace(/\.[^.]+$/, "")}.evidence.json`);
}

/** `<doc>.claims.draft.json` - harvest's output, and never the claims file
 *  (spec 8.2 step 6). The author edits its proposals into the claims file
 *  and deletes it. */
export function draftPathFor(doc: string): string {
  return join(dirname(doc), `${basename(doc).replace(/\.[^.]+$/, "")}.claims.draft.json`);
}
```

- [ ] **Step 4: `bin.ts` - the harvest branch**

Insert this block immediately after the `if (command === "reachability") { ... }` block and before `if (command !== "check") {`:

```ts
  if (command === "harvest") {
    // The existing claims file, when there is one. A document with none is
    // the ordinary case - it is what harvest exists to help write. A file
    // that EXISTS and the loader refuses is exit 2 with the loader's own
    // message and no lenient variant: uniform refusal means harvest does not
    // get a parser `check` does not have. The README's migration note is
    // written from this: fix the claims `check` names first, then harvest.
    const claimsPath = claimsPathFor(doc);
    let claims;
    if (existsSync(claimsPath)) {
      try {
        claims = parseClaimsFile(readFileSync(claimsPath, "utf8"));
      } catch (e) {
        console.error(`cannot read claims: ${e instanceof Error ? e.message : String(e)}`);
        return 2;
      }
    }

    const draftPath = draftPathFor(doc);
    const asJson = flags.has("--json");
    // Checked BEFORE any fetching: refusing after twenty requests wastes the
    // author's time and the hosts'. Under --json nothing is read or written
    // on disk, so there is nothing to overwrite and the rule does not apply.
    if (!asJson) {
      const blocked = draftInTheWay(draftPath);
      if (blocked) {
        console.error(blocked);
        return 2;
      }
    }

    const report = await harvest(document, { rules, ...(claims ? { claims } : {}) });

    // Under --json, stdout carries the draft and NOTHING else, so
    // `harvest doc.md --json > draft.json` produces a file `jq` and the
    // author's editor can both read. The per-URL report is still written -
    // she needs to know what each filter took - on stderr, where it does not
    // corrupt the document. (`check --json` mixes the two on stdout; that
    // inconsistency is plan 1's, and it is left where it is rather than
    // widened to a third command. Fable F6.)
    const say = asJson ? console.error : console.log;

    for (const p of report.proposals) {
      say(
        `  ${p.url} - ${p.claims.length} proposed via ${p.rungs.join(", ")} ` +
          `(dropped: ${p.drops.floor} below the floor, ${p.drops.frequency} also in another cited source, ` +
          `${p.drops.rules} by a boilerplate rule, ${p.drops.claimed} already claimed)`,
      );
      if (p.redirectedTo !== null) {
        say(
          `        REDIRECTED to ${p.redirectedTo} - a different path from the one you cited. ` +
            "Read these proposals against the page you actually got.",
        );
      }
      // CORRECTED 2026-09-09 (Task 10). This block said "a self-validation
      // failure is a BUG in this tool ... so it is labelled", and prescribed
      // `say(`        BUG: ${bug}`)`. Both were true when written and were
      // falsified by Task 8's fix round, which split `p.bugs` into a real
      // map-integrity defect and a benign `norm()`-boundary drop whose own
      // message begins "NOT A BUG". The prescribed snippet would have printed
      // "BUG: NOT A BUG, a norm() boundary: ..." and buried the real
      // map-integrity line among the benign ones. The shipped code prints
      // each line unprefixed, and Task 9's implementer refused the snippet and
      // flagged the conflict rather than following it. What remains true is
      // the second half: none of these lines changes the exit code (spec 8.2
      // step 4).
      for (const bug of p.bugs) say(`        ${bug}`);
    }
    for (const u of report.unreachable) {
      say(`  ${u.url} - UNREADABLE, nothing proposed (tried: ${u.rungsAttempted.join(", ")})`);
    }
    for (const s of report.skipped) {
      say(`  ${s.url} - not applicable, skipped: ${s.reason}`);
    }
    if (report.frequencyVacuous) {
      say(
        "Fewer than two of your sources were readable, so the cross-source boilerplate filter " +
          "had nothing to compare against and dropped nothing.",
      );
    }

    // Every readable URL is handed over, including the ones that proposed
    // nothing; `buildDraft` is the single place that decides an empty entry
    // is omitted rather than written as `[]`, which is what keeps the draft a
    // file `parseClaimsFile` accepts on rename (Fable F1). The report line
    // above already told the author which URLs proposed 0.
    const draft = buildDraft({
      entries: report.proposals.map((p) => ({ url: p.url, claims: p.claims })),
      version: VERSION,
      date: new Date().toISOString().slice(0, 10),
    });

    // --json prints instead of writing, the convention `reachability --json`
    // follows - and, like it, stdout is pure JSON: the report went to stderr
    // above. `check --json` prints IN ADDITION on stdout, and that
    // inconsistency is plan 1's, recorded in spec 8.2 rather than resolved
    // here.
    if (asJson) {
      console.log(JSON.stringify(draft, null, 2));
    } else {
      writeDraftFile(draftPath, draft);
      const total = report.proposals.reduce((n, p) => n + p.claims.length, 0);
      console.log(`\nwrote ${draftPath} - ${total} proposals across ${report.proposals.length} URLs`);
      console.log(
        "Every claim in it is unconfirmed: harvest proposes what you COPIED, which is not always " +
          "what you CLAIM. Read each one against its source, move what you mean into the claims " +
          "file, and delete the draft.",
      );
    }
    // 0 whether or not anything was proposed. Harvest has no verdict to fail
    // on, so it has no exit 1 (spec 8.2, "Exit codes").
    return 0;
  }
```

- [ ] **Step 5: Run the tests**

Run: `cd C:/Users/noaho/testimonium-plan2 && npx vitest run test/bin.test.ts test/exports.test.ts`
Expected: all pass, **5** more than before in `bin.test.ts` - Step 1's three `describe`s hold 2 + 1 + 2 `it`s. Count them; the ladder above says 341 at this task and a ladder that disagrees with the file is a test that did not run.

- [ ] **Step 6: Run the command against the repo's own example, end to end**

A module-load check is not a test (spec 10): run the thing. The example document cites four live URLs, so this touches the network - it is a manual smoke run, not part of the suite.

```bash
cd C:/Users/noaho/testimonium-plan2 && npm run build && node dist/bin.js harvest example/sample.md --json 2>/dev/null | head -40
```
Expected: a JSON object whose first key is `_note` and whose value matches `draftNote(VERSION, today)`, and one key per readable cited URL **that proposed at least one claim** - a readable URL whose spans were all filtered has no key at all (Fable F1). The per-URL report lines go to stderr, so `2>/dev/null` above removes them and leaves the JSON alone; run it once without the redirect to see them. That stdout is pure JSON is the point, and it is worth proving rather than eyeballing:

```bash
cd C:/Users/noaho/testimonium-plan2 && node dist/bin.js harvest example/sample.md --json 2>/dev/null | node -e "let s = ''; process.stdin.on('data', (d) => (s += d)).on('end', () => { const o = JSON.parse(s); console.log(Object.keys(o)[0], Object.keys(o).length); });"
```
Expected: `_note` and a key count - `JSON.parse` over the whole of stdout, with nothing stripped. If it throws, a report line is still on stdout.

`--json` must leave no file behind:

```bash
cd C:/Users/noaho/testimonium-plan2 && git status --short
```
Expected: **empty**. If `example/sample.claims.draft.json` appears, `--json` wrote when it should have printed - fix that before going on. (Plan 1's smoke run once rewrote `example/sample.evidence.json` and needed a `chore:` commit to restore it; do not repeat it.)

Then the writing path, into a scratch copy so the repo is untouched:

```bash
cd C:/Users/noaho/testimonium-plan2 && mkdir -p .superpowers/sdd/2026-09-08-plan-2-harvest/smoke && cp example/sample.md .superpowers/sdd/2026-09-08-plan-2-harvest/smoke/ && node dist/bin.js harvest .superpowers/sdd/2026-09-08-plan-2-harvest/smoke/sample.md; echo "exit $?"
```
Expected: `exit 0`, a `sample.claims.draft.json` beside the copy, and a summary line naming it. Run it a second time: expected `exit 0` again, the draft overwritten silently. Then edit that file's `_note` by hand and run a third time: expected `exit 2` and the message naming the path and asking for a rename or delete. Record all three in the ledger; the workspace directory is git-ignored, so nothing here is committed.

- [ ] **Step 7: Suite, byte checks, commit**

```bash
cd C:/Users/noaho/testimonium-plan2 && npm test && npx tsc --noEmit && git status --short && printf 'a\0b' | LC_ALL=C tr -cd '\000' | wc -c && for f in src/version.ts src/index.ts src/bin.ts test/bin.test.ts test/exports.test.ts; do printf "%s nonascii=" "$f"; LC_ALL=C tr -d '\000-\177' < "$f" | wc -c; printf "%s nul=" "$f"; LC_ALL=C tr -cd '\000' < "$f" | wc -c; done
```
Expected: **341 passed**, typecheck silent, `git status --short` showing only the five files, self-test `1`, and `0` for all ten counts.

```bash
cd C:/Users/noaho/testimonium-plan2 && git add src/version.ts src/index.ts src/bin.ts test/bin.test.ts test/exports.test.ts && git -c core.safecrlf=false commit -m "feat(bin): the harvest command, draftPathFor, and one version string"
```

---

### Task 10: The ledger - README, CHANGELOG, and the spec amendments this plan forces

**Files:**
- Modify: `README.md` (the Commands block; a new `## Harvest` section; the migration note; the `finalUrl` clause at ~240; `## What's not here`; `## The real cost`)
- Modify: `CHANGELOG.md` (the plan 2 section, appended to)
- Modify: `docs/superpowers/specs/2026-09-06-testimonium-design.md` (7.3's measurement sentence; 8.2's "Thresholds" paragraph; 8.2's overwrite sentence; 8.2 filter 2's reprint-calibration sentence; 13 Q3's resolution, which carries 7.3's numbers a second time)
- Modify: `docs/calibration-2026-09.md` if any number moved after Task 2

**Interfaces:**
- Consumes: everything Tasks 1-9 landed. **Every sentence written here describes behaviour a test from those tasks pins; if you cannot name the test, do not write the sentence.**
- Produces: nothing code-facing.

**Why this task exists.** Documentation drift is this repository's worst defect class, and the record says so: plan 1.1 found twelve false statements across two rounds, two of them in the spec; plan 1.2's final review found a Critical in a spec paragraph no task had touched, and its lesson was written down as "a doc-drift sweep is over the document, not over the diff". This task sweeps the whole of the README and the whole of the spec for sentences plan 2 falsified, whether or not plan 2 edited them.

- [ ] **Step 1: The drift sweep, run before anything is written**

Read `README.md` end to end and `docs/superpowers/specs/2026-09-06-testimonium-design.md` end to end, looking for sentences that plan 2 has made false - or, in the last case, has failed to make true. The **nine** below were found on 2026-09-08 and are fixed in Steps 2-6. **Finding a tenth is the expected outcome, not a failure - add it, fix it, and record it in the ledger.** The count in this sentence is part of the instrument: a sweep instruction whose own list is miscounted teaches the executor to stop looking early.

1. `README.md`, `## What's not here`: "This is plan 1 of three. `harvest` (propose candidate claims ...) and `recheck` ... are separate plans, not missing features of this one." Harvest ships in this plan.
2. `README.md`, `## Commands`: the code block lists `check` and `reachability` only.
3. `README.md` ~:240: "it also never compares a read's `finalUrl` with the URL it was asked for, so a redirect away from the citation is observable and, today, unobserved - a gate left unbuilt, not a limit of the signals". Harvest compares it and reports it. The sentence is true of the GATE and must say so.
4. `README.md`, `## The real cost`: "There is no shortcut in this plan" - written of plan 1, and now read as a claim about the tool.
5. Spec 7.3:858-860: "the 203 distinct real claims in the origin repo's four claims files ... it refuses 18 of the 203 (9 percent)". The frozen population is a different size, and the paragraph's own last sentence says it is amended when the calibration re-derives.
6. Spec 8.2, "Thresholds": the 24.8 / 5.0 / 0.9 / 0.2 figures and "that script's re-run" - there was no such script.
7. Spec 8.2, step 6: "byte-identical to the marker harvest would write", read in Task 8 as "byte-identical outside the version and the date".
8. Spec 13, Q3's resolution (the sentence spans :1262-1264; the numbers are on :1263-1264): "Section 7.3 carries the licence and the measurement: 203 real claims, chance matches at 3 and 12 characters and none above, 18 of 203 refused." **The twin of item 5, in a second place**, and the reason it is enumerated here rather than left to the grep: this repository has shipped the same falsified number in two places three times (R13; the plan-1.2 review's 6.3 finding). Fix the pair together or the spec disagrees with itself about its own calibration population.
9. Spec 8.2, filter 2 (:1052-1054): "Plan 2's calibration counts how many real claims appear in two cited sources of the same draft, so the reprint cost is a number, not a guess." Plan 2 does **not** perform that count - Task 2 measures the floor against unrelated fixtures and the seed noise across unrelated fixture pairs, and the frozen corpus holds no readable reads of the drafts' own cited sources. This is the one item the sweep finds false because plan 2 failed to make it true, not because plan 2 falsified it, and it is amended rather than left to ship as a promise nobody kept (Step 6(e), and the disclosure Task 2 Step 13 adds).

Run this to be sure nothing else names the old shape:

```bash
cd C:/Users/noaho/testimonium-plan2 && grep -n "plan 1 of three\|separate plans\|no shortcut\|never compares\|203\|24.8\|reprint" README.md docs/superpowers/specs/2026-09-06-testimonium-design.md
```

- [ ] **Step 2: README - the Commands block and the agreement paragraph**

Replace the `## Commands` code block:

```
testimonium check <doc.md>          the gate. exit 0 clean, 1 author-fixable, 2 infra
testimonium reachability <doc.md>   preflight. no claims file needed
```

with:

```
testimonium check <doc.md>          the gate. exit 0 clean, 1 author-fixable, 2 infra
testimonium harvest <doc.md>        propose claims. writes a draft, never the claims file
testimonium reachability <doc.md>   preflight. no claims file needed
```

Then, in the paragraph that begins `Both read \`<doc>\` as GitHub-Flavored Markdown footnotes`, change **that opening** `Both read` to `All three read` - it is not the paragraph's only `Both`, see below - and append one sentence after `\`reachability\` needs neither.`:

```
`harvest` reads `<doc>.claims.json` if it is there - to skip what you have
marked not applicable and to leave what you have already claimed alone - and
writes `<doc>.claims.draft.json`, which is not the claims file and never
becomes one without you.
```

Every clause is pinned: the notApplicable skip and the already-claimed drop by `test/harvest.test.ts` and `test/harvest/filters.test.ts`, the draft path by `test/bin.test.ts`'s `draftPathFor`.

**The agreement claim is in the SAME paragraph, not the following one** (README 318-325 is one paragraph), and the sentence the insertion lands directly in front of begins `Both read a URL through the same fetch ladder`. That claim is genuinely two-command and must NOT be widened to three - `harvest` is not in `test/agreement.test.ts` and nothing pins an agreement property for it - but after the insertion its `Both` follows a sentence about `harvest`, and reads as though it named `check` and `harvest`. Name the two, in the same edit. Replace

```
Both read a URL through the same fetch ladder, under the same rules,
```

with

```
`check` and `reachability` read a URL through the same fetch ladder, under the
same rules,
```

and leave the rest of that sentence exactly as it is. Two `Both`s in one paragraph, one widened to three and one narrowed to two: the diff must show exactly those two changed openings and nothing else in the paragraph.

- [ ] **Step 3: README - the `## Harvest` section**

Insert a new section between `## Commands` and `## What's not here`. It is written in the README's own voice: the argument first, the limit next to it, never a limit hidden below a feature.

The block below is fenced with FOUR backticks in this plan because the section itself contains a three-backtick code block. Write the section into the README with that inner block as an ordinary three-backtick fence, and do not carry the four-backtick fence across.

````
## Harvest: proposing claims, without proposing to trust them

The claims file is the cost. `harvest` reads your draft and every source it
cites, and proposes as candidate claims the phrases that appear verbatim in
both - the sentences you copied out while writing. It writes them to
`<doc>.claims.draft.json`. It never writes `<doc>.claims.json`.

```
node dist/bin.js harvest essay.md
node dist/bin.js harvest essay.md --json   # print the draft instead of writing it
```

There is no model in it. It fetches through the same ladder `check` uses,
proposes only from a read that cleared the same prose floor `check` demands
before it will accuse anything, and every proposal is afterwards judged by
`check` exactly as a phrase you typed by hand would be.

**What it proposes is what you COPIED, and that is not the same as what you
CLAIM.** A phrase found in both your draft and a source is evidence that a
sentence was lifted from that page. It is not evidence that the sentence is
the point of the citation. The draft file says so in its own `_note`, and
moving a proposal into your claims file is the step that makes it a claim.
Read every one against its source first.

**Harvest is not safe by construction, and inherits every exposure `check`
has.** A span common to your draft and a source is, by definition, a span
`check` will find in that source - so a page that fools the gate fools
harvest identically. The two that matter are in Measured limits above: a
heavy-chrome error page served at HTTP 200, and a page reached after a
redirect. For the second, harvest tells you: a proposal from a read whose
final path differs from the path you cited is reported as `REDIRECTED`, with
the URL it actually got. Nothing gates on it. You decide.

**Four filters, in order, and the report says what each one took.** A phrase
below the claim floor; a phrase that also appears in another source this
document cites, which is how an outlet's name, a cookie notice or a wire
story reprinted twice gets removed; a phrase matching a `boilerplate` rule in
your own `--rules` file (none ship - a bundled rule would need a date from a
live page); and a phrase you have already claimed for that URL. If your
document has fewer than two readable sources the second filter has nothing to
compare against, and the report says so in words rather than printing a zero.

**Migration.** If `check` is already refusing your claims file - for a phrase
under the floor, say - fix what it names first, then run `harvest`. Harvest
reads the existing file through the same loader with no lenient variant, so a
file `check` refuses is a file harvest refuses, with the same message and
exit 2.

Exit codes are 0 and 2 only: 0 when the draft was written or printed,
including a draft that proposes nothing, and 2 for an input it could not read
or a draft in the way that you had edited. There is no exit 1, because
harvest has no verdict to fail on.
````

- [ ] **Step 4: README - the three sentences the sweep found**

**(a)** In the `## Measured limits` bullet about a gone document, replace

```
  it also never compares
  a read's `finalUrl` with the URL it was asked for, so a redirect away from
  the citation is observable and, today, unobserved - a gate left unbuilt,
  not a limit of the signals
```

with

```
  the GATE also never compares a read's
  `finalUrl` with the URL it was asked for, so a redirect away from the
  citation is observable and, in `check`, unobserved - a gate left unbuilt,
  not a limit of the signals. `harvest` does compare it, and reports a
  proposal from a read whose final path differs from the cited path; it
  gates on nothing either
```

Pinned by `test/check.test.ts`'s redirect test (the gate is unmoved by `finalUrl`) and `test/harvest/sources.test.ts`'s two redirect tests.

**(b)** Replace the `## What's not here` first paragraph:

```
This is plan 1 of three. `harvest` (propose candidate claims by finding
verbatim overlap between your draft and the source, still no model) and
`recheck` (re-run the claims against the live source and an archived copy, to
tell real drift from a pipeline regression) are separate plans, not missing
features of this one. There is also no renderer and no GitHub Action bundled
here - `check`'s exit code is the integration point.
```

with:

```
`check`, `reachability` and `harvest` are here. `recheck` - re-running the
claims against the live source and an archived copy, to tell real drift from
a pipeline regression - is a separate plan, not a missing feature of this
one. There is also no renderer and no GitHub Action bundled here - `check`'s
exit code is the integration point.
```

**(c)** In `## The real cost`, replace

```
There is no shortcut in this plan - paraphrase does not match by design, because
a phrase that matches loosely is a phrase that matches something the source
didn't actually say.
```

with:

```
`harvest` shortens the copy-out and shortens nothing else: paraphrase does
not match by design, because a phrase that matches loosely is a phrase that
matches something the source didn't actually say, and a proposal is not a
claim until you have read it against its source and moved it yourself.
```

- [ ] **Step 5: CHANGELOG - the rest of the plan 2 section**

Append to the `### Plan 2 (harvest)` section Task 3 opened, after the claim-floor bullet:

```
- **New command: `testimonium harvest <doc.md>`.** It fetches every URL the
  document cites and proposes, as candidate claims, the spans that appear
  verbatim in both the document's own prose and a readable read of the
  source, normalized. It writes `<doc>.claims.draft.json` and **never**
  `<doc>.claims.json`. No model; phrase matching remains the sole arbiter,
  and every proposal is afterwards judged by `check` exactly as a
  hand-written claim is. Exit 0 when the draft was written or printed,
  including a draft proposing nothing; exit 2 for a refused input, a refused
  existing claims file, or a draft in the way that the author has edited.
  There is no exit 1. `--json` prints the draft instead of writing it, the
  convention `reachability --json` follows.
- **`RuleSet` gains `boilerplate: readonly Rule[]`,** the same dated
  `{ pattern, lastConfirmed, note }` shape as `signatures` and `paths`, and a
  local `--rules` file may add to it. It ships EMPTY and is consulted by
  `harvest` only: it can never change a verdict. Integrators constructing a
  `RuleSet` literal must add the field; `loadRules()` callers need no change.
- **`Document` gains `prose`** - the markdown with fenced code blanked and
  every footnote definition removed, from the parser's own passes. `body` is
  unchanged.
- **`harvest` inherits every exposure `check` has, unreduced, and adds one of
  its own.** A span common to the draft and a source is by definition one
  `check` will find in that source, so the heavy-chrome-at-200 route and the
  redirect route in the README's Measured limits apply to harvest identically.
  Its own addition is that it proposes what the author COPIED, which is not
  always what she CLAIMS; the draft's `_note` says so and her confirmation is
  what makes a proposal a claim. Harvest does report a proposal drawn from a
  read whose final path differs from the cited path, which `check` does not.
- **`VERSION` now has one source, `src/version.ts`**, re-exported unchanged
  from `src/index.ts`. `harvest` stamps it into every draft, so two copies
  that could drift would put a slightly untrue version on a file the author
  keeps. No public name changed.
```

- [ ] **Step 6: The spec amendments this plan forces**

**Five**, each dated and each saying what it replaced - the discipline every earlier amendment in this document follows. (a) and (d) are one falsified population in two places and are written as a pair: fixing one and not the other leaves the spec disagreeing with itself, which is the defect class this repository has shipped three times.

**(a) 7.3, the measurement sentence** (~858-860). It currently reads `Measured on 2026-09-07 against the 203 distinct real claims in the origin repo's four claims files, chance matches against unrelated fixtures occurred at 3 and 12 normalized characters and never above 12; 16 is that ceiling plus margin, and it refuses 18 of the 203 (9 percent), each a number, a name or a fragment that states no proposition.` Replace with the sentence Task 2's run supports, **using that run's numbers**:

```
Re-derived on <DATE> by `node scripts/calibrate-claim-floor.mjs` against the
<N> distinct real claims frozen in `fixtures/claims/` - the origin repo's
four files, three from its working tree and one from
a pinned commit (withheld), copied in so the number
reproduces without it. Chance matches against unrelated fixtures occurred at
3 and 12 normalized characters and never above 12; 16 is that ceiling plus
margin, and it refuses <R> of <N>, each a number, a name or a fragment that
states no proposition. (This paragraph said "203 distinct real claims" and
"18 of the 203" until <DATE>: the ceiling has not moved, the population has -
the origin repo's working-tree files changed between the two measurements,
which is why plan 2 froze them.)
```

**(b) 8.2, the "Thresholds" paragraph.** Replace the sentence `Measured across unrelated fixture pairs, the mean count of chance L-gram matches per pair was 24.8 at L = 13, 5.0 at 16, 0.9 at 20 and 0.2 at 25; the value is chosen in plan 2's calibration task from that script's re-run, in 20 to 25, and recorded in \`docs/calibration-2026-09.md\` with the command that produced it.` with:

```
Measured across the unrelated pairs of the document fixtures by
`scripts/calibrate-harvest-seed.mjs`, committed in plan 2: <the sweep's
numbers>. Those figures count what `commonSpans` EMITS - after extension,
word-boundary snapping and containment dedupe - because that is what an
author reviews. (This paragraph previously quoted 24.8 / 5.0 / 0.9 / 0.2 at
L = 13 / 16 / 20 / 25 and called them "chance L-gram matches per pair". Those
came from a script written during the design review that was never committed
and is in no git history, so nothing could reproduce them, and they counted
seeds rather than emitted spans. Corrected <DATE> against the committed
script's own run.) The value is chosen by the selection rule that script
states, in 20 to 25, and recorded in `docs/calibration-2026-09.md` with the
command that produced it.
```

**(c) 8.2, step 6's overwrite sentence.** Replace `An existing draft is overwritten only when its \`_note\` is byte-identical to the marker harvest would write` with:

```
An existing draft is overwritten only when its `_note` is byte-identical to a
marker harvest could have written - every byte outside the version and the
date must match. (Amended <DATE>: this said "the marker harvest would write",
under which a draft written yesterday could never be overwritten today,
because the marker carries the date. The rule exists to detect the author's
edits, and every byte outside those two fields carries that signal.)
```

**(d) 13, Q3's resolution** (the sentence at ~1262-1264) - **(a)'s twin, written in the same sitting and from the same run's numbers.** It reads `Section 7.3 carries the licence and the measurement: 203 real claims, chance matches at 3 and 12 characters and none above, 18 of 203 refused.` Replace with:

```
Section 7.3 carries the licence and the measurement: <N> real claims, chance
matches at 3 and 12 normalized characters and none above, <R> of <N> refused,
re-derived <DATE> against the population frozen in `fixtures/claims/`. This
line said "203 real claims" and "18 of 203" until then; 7.3 says why the
population moved.
```

`<N>`, `<R>` and `<DATE>` are the same three values (a) uses. If the two amendments do not carry identical numbers, one of them is wrong - check both against the run before committing.

**(e) 8.2, filter 2's calibration promise** (~1052-1054). It promises a measurement this plan does not make: `Plan 2's calibration counts how many real claims appear in two cited sources of the same draft, so the reprint cost is a number, not a guess.` The count is **not** performed and the sentence is amended to say so - the ruling, taken before this task and not re-opened in it. Replace with:

```
Plan 2's calibration did NOT count how many real claims appear in two cited
sources of the same draft: the reprint cost - how many REAL claims this
filter would eat - is a disclosed gap, not a number. Recorded <DATE>, where
this sentence previously said the count would be made. The measurement needs
readable reads of the frozen drafts' OWN cited sources, which the frozen
corpus does not hold and which only live network reads could supply - a
network dependency inside the one task whose purpose is that its numbers
reproduce from frozen fixtures. What was measured instead is in
`docs/calibration-2026-09.md`: the floor against unrelated document fixtures,
and the seed noise across unrelated fixture pairs. That document's "What was
NOT done" section carries this gap beside the host-same gap.
```

This is the disclosure voice `src/classify/thresholds.ts` already uses for the entries that were never swept - say plainly that it was not measured, and say what evidence there is instead. **Do not add the count.** A scripted live probe is out of scope for a task whose numbers must reproduce from frozen fixtures, and it would be the first network read in the suite's history. The matching disclosure in the calibration doc is Task 2 Step 13's, and it is a SECOND entry there: the existing one discloses filter 3's domain (no host-same pairs) and must not be overwritten.

- [ ] **Step 7: Name every sentence's pin, then check the whole branch**

For each sentence written in Steps 2-6, write the test that pins it into the ledger. Any sentence you cannot name a test for must be deleted or turned into one you can.

Then write the ledger line plan 1.2 addressed to this plan, so the parked item does not evaporate from the record - the ruling is in "Decisions this plan takes", above, and the ledger is where a parked item is answered:

```
Plan 1.2 ledger, Task 5 minor (astral fold, "Park for plan 2 - harvest is the
consumer"): RE-PARKED 2026-09-08, not fixed. Fixing it means making
foldWithMap iterate by code point rather than by UTF-16 unit - a behaviour
change to a primitive plan 1.2 stabilised and pinned - and harvest, its
consumer, fails only in the safe direction: a span differing from the source
only in the case of an astral character never matches, so the cost is a false
MISS, never a false proposal and never a false accusation. Carried to a future
plan with that argument on the record.
```

Then the whole-branch checks:

```bash
cd C:/Users/noaho/testimonium-plan2 && npm test && npx tsc --noEmit && npm run build && git status --short
```
Expected: **341 passed**, typecheck silent, build clean, and `git status --short` showing only `README.md`, `CHANGELOG.md` and the two docs (`dist/` is git-ignored).

**CORRECTED 2026-09-09 (Task 10), and this is the step correcting itself.** Two numbers here were wrong before this task ran, and both would have produced a failure that looks like a defect rather than like a stale expectation.

*The count.* **361, not 341.** The header ladder was written before any fix round existed and cannot account for tests those rounds add (controller ruling T6-R1 retired it as the authority after Task 6). The rule that replaced it is: the task's own specified `it()` count added to the current actual total. Task 10 specifies **zero** new `it()` blocks, so 361 in and 361 out.

*The file list.* Task 10 also touches `src/check.ts`, `src/harvest/spans.ts` and `src/classify/thresholds.ts` (comment-only - no executable line changes), this plan file, and the new `docs/superpowers/plans/2026-09-08-plan-2-harvest-ledger.md`. `docs/calibration-2026-09.md` is NOT touched: both calibration scripts were re-run on 2026-09-09 and every number in that document reproduced, so nothing moved.

```bash
cd C:/Users/noaho/testimonium-plan2 && printf 'a\0b' | LC_ALL=C tr -cd '\000' | wc -c && for f in $(git diff --name-only ff71ec8..HEAD; echo README.md CHANGELOG.md) ; do printf "%s nonascii=" "$f"; LC_ALL=C tr -d '\000-\177' < "$f" | wc -c; printf "%s nul=" "$f"; LC_ALL=C tr -cd '\000' < "$f" | wc -c; done
```
Expected: self-test `1`; `nul=0` for every file without exception; `nonascii=0` for everything except `src/text/excerpt.ts` (**57**), `README.md` (**3** unless a step above deliberately added one, in which case record the new number and why) and `docs/calibration-2026-09.md` (the number Task 2 recorded).

**CORRECTED 2026-09-09 (Task 10), and the correction is narrower than it was routed here as.** Task 6's reviewer routed this step forward as one that "would FAIL as written". Run on 2026-09-09, it does not: the loop iterates `git diff --name-only ff71ec8..HEAD` plus two files, and the two test files that break the stated exception set are not in that range, because no plan-2 task touched them. What IS wrong is the expectation's own wording - "`nonascii=0` for everything except" these three is a claim about the REPOSITORY, and it is false of the repository, inheriting the false single-exception premise from the Global Constraint at the top of this plan (corrected there too). A false universal that this particular file list happens never to exercise is the same defect as one that fails: it is true only by the accident of what the loop reaches. The true expectation, re-measured 2026-09-09 over every tracked file:

- `src/text/excerpt.ts` **57**
- `test/text/excerpt.test.ts` **45**
- `test/text/extract.test.ts` **3**
- `docs/calibration-2026-09.md` **185** (165 at `main`; Task 2's two fix rounds added an n-tilde and a c-cedilla, then two more, and the doc records why)
- `README.md` **3** (a single U+2265, predating plan 2)
- every other tracked file **0**, `fixtures/**` excepted - a fixture is a recording and may hold anything, including the NULs in `fixtures/challenge/pdf-binary-served-at-200.bin`, which is the only tracked file with any.

The loop's own file list reaches only two of these: `README.md` at 3 and `docs/calibration-2026-09.md` at 185, both as expected. Widen the check to every tracked file if you want the expectation tested rather than merely stated - `for f in $(git ls-files); do ...; done`, with `fixtures/**` allowed to be non-zero.

```bash
cd C:/Users/noaho/testimonium-plan2 && git diff -w --stat ff71ec8..HEAD && git diff --stat ff71ec8..HEAD
```
The two must agree on the file list. A file that appears only in the second is a whitespace-only change nobody intended - most likely a line-ending conversion, which this worktree's `core.autocrlf=true` makes easy to cause and hard to see.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/noaho/testimonium-plan2 && git add README.md CHANGELOG.md docs/superpowers/specs/2026-09-06-testimonium-design.md docs/calibration-2026-09.md && git -c core.safecrlf=false commit -m "docs: plan 2's ledger - the harvest section, the CHANGELOG, and three spec amendments"
```

---

## Self-review

Run against the spec with fresh eyes, after the plan was written.

**1. Spec coverage.** Every requirement of 8.2 and of 7.3, mapped to the task that implements it:

| Spec | Task |
|---|---|
| 8.2 step 1, `Document.prose` from the same `DEFINITION` and `blankFencedCode` | 4 |
| 8.2 step 1, group by `normalizeUrl`, key by the first spelling, skip `notApplicable` | 6 |
| 8.2 step 2, `readSource`, readable reads only, unreachable with `rungsAttempted`, `finalUrl` path difference | 6 |
| 8.2 step 3, `commonSpans` over `foldWithMap`: seeds, extension, word-boundary snap, whitespace collapse, containment drop, linear scan, source typography, `norm` once per read | 5 (spans), 6 (`normText`) |
| 8.2 step 4, the three self-validation assertions | 5 |
| 8.2 step 5, the four filters in order with per-URL drop counts, and the vacuous-frequency sentence in words | 7 (filters), 8 (the flag), 9 (the sentence) |
| 8.2 step 5.3, `RuleSet.boilerplate` in the dated `LocalRule` shape, shipping empty | 7 |
| 8.2 step 6, the draft file, `_note`, the byte-identical overwrite rule, `--json` | 8 (shape and rule), 9 (`--json`) |
| 8.2 exit codes 0 and 2, no 1 | 9 |
| 8.2 thresholds, `harvestSeedChars` in 20-25 with `harvestSeedChars >= minClaimChars` asserted | 2 |
| 8.2 "Plan 2's first task is calibration", the probe committed, fixtures frozen, spans hand-classified, acceptance test | 2 |
| 8.2 CLI, `draftPathFor` and the usage string | 9 |
| 7.3, `minClaimChars` = 16 as the fifth `THRESHOLDS` entry with a docstring | 2 |
| 7.3, refused at three sites with one message | 3 (two sites), 7 (the third) |
| 7.3 / 13 Q3, the breaking-change disclosure | 3 |
| 6.6, harvest reads only what is readable | 6 |
| 5.3, nothing new becomes public | 6, 7, 8, 9 (each task's own step), 10 |
| 10, no unit test touches the network; the one fixture-reading test is named | 2 |
| plan 1.2 ledger R13 | 1 |

Gaps found and closed while reviewing: 8.2's "linear in the source" needed the seed index, not `indexOf` (Task 5, `seedIndex`); the vacuous-frequency requirement is "the report says so in words", which is a CLI string and would have been lost had only the flag been implemented (Task 9); 7.3's third site would have been a constant with two consumers and a spec sentence that was not literally true (Task 7, Step 8's grep).

**2. Placeholder scan.** No step says "handle errors", "add validation", "similar to Task N" or "write tests for the above". Every code step carries the code. The bracketed values that remain - `<DATE>`, `<N>`, `<R>`, and the sweep's numbers in Task 10 Step 6 - are deliberate and are the plan's central discipline: they are numbers no one may copy from this document, and each is named beside the command that produces it. Everywhere a number could honestly be written, this plan's 2026-09-08 measurement is written and marked **re-derive**.

**3. Type consistency.** Checked name by name across tasks: `belowClaimFloor` / `claimFloorMessage` (Task 3 defines, 7 consumes); `Document.prose` (4 defines, 8 consumes); `SpanResult` / `commonSpans` / `dropContained` (5 defines, 8 consumes); `SignalResult.finalUrl` (6 defines, 6 consumes); `HarvestSource` / `HarvestRead` / `SourceScan` / `scanSources` (6 defines, 7 and 8 consume); `FilterDrops` / `FilterResult` / `FilterInput` / `applyFilters` (7 defines, 8 consumes); `HarvestReport` / `HarvestProposal` / `harvest` (8 defines, 9 consumes); `DRAFT_SENTENCE` / `draftNote` / `isHarvestNote` / `buildDraft` / `draftInTheWay` / `writeDraftFile` (8 defines, 9 consumes); `USAGE` / `draftPathFor` / `VERSION` (9). The one inconsistency found and fixed: Task 8 originally re-implemented the containment drop that Task 5 already had, which is why `dropContained` is exported.

**Two things a reviewer should look at first**, because they are where this plan is most likely wrong:

1. **Task 2's selection rule for `harvestSeedChars`.** The rule ("smallest L in 20..25 whose mean above-floor spans per unrelated pair is below 1.0") was stated before the sweep so the number would not be chosen by taste. On the 2026-09-08 numbers it picks **21**, not the 20 that spec 8.2's band names first: L=20 is 1.2 and L=21 is 0.9. The threshold 1.0 is a preference about review burden - fewer than one chance proposal per unrelated source - not a correctness boundary, and nothing in the spec licenses that particular number. If the reviewer wants a different rule it has to be stated before the run, not chosen off the table afterwards.
2. **Task 8's reading of "byte-identical".** The plan deliberately reads spec 8.2's overwrite sentence as "byte-identical outside the version and the date", and Task 10 amends the spec to say so. If the reviewer reads it strictly, harvest becomes unusable on its second day and the plan needs a different mechanism, not a different sentence.









