# Plan 1.1 (extraction fidelity) - execution ledger

Preserved from `.superpowers/sdd/2026-09-07-plan-1-1-extraction/progress.md`, which is
git-ignored scratch and does not survive worktree cleanup. Plan 1 lost a reviewer
finding that way; this file exists so plan 1.1's rulings, mutation evidence and
parked items stay readable after the branch is gone. It is the record of what was
decided and why, alongside `2026-09-06-plan-1-core-ledger.md`.

---

# SDD ledger — plan: docs/superpowers/plans/2026-09-07-plan-1-1-extraction.md

Spec: docs/superpowers/specs/2026-09-06-testimonium-design.md (binding; this plan amends section 6.2 by adding N5)
Worktree: C:\users\noaho\testimonium-plan11 on fix/plan-1-1-extraction, from main @ dbaa030
Plan reviewed by Fable twice: 6 blockers in draft 1, F1-F5 in draft 2, approved at draft 3 (728a5c2).
Baseline: 199 tests green, tsc clean, build clean.
4 tasks.

## Pre-flight conflict scan

### Cross-task: shared files and interfaces

| Producer | Consumer | Produces / consumes | Finding |
|---|---|---|---|
| T1 `extract.ts` | T2, T3 | `toText` output changes for named entities | OK — T1 precedes both; T2's sweep baseline is the whole dbaa030 pipeline, so it absorbs T1's change correctly |
| T2 `verdict.ts` | T3 | `Signals.notText`, `isBlocked` | OK — T3's acceptance-test amendment needs N5 to exist |
| T2 `signals.ts` | T3 | `computeSignals(...).signals.notText` | OK — T3 derives the term through it rather than duplicating `looksBinary` |
| T2 `reachability.ts` | — | N5 reason branch | OK — self-contained |
| T3 fixtures + counts | T4 | corpus totals, largest non-vetoed challenge | OK — plan explicitly orders the `thresholds.ts` docstring re-scope AFTER T3 so the numbers are real |
| T4 `isPdf` widening | T3 | `/pdf/` path segments | OK — T3 requires the PDF fixture's url to carry neither `.pdf` nor `/pdf/`, and says why |
| T1 `entityChar` | — | already exists in `extract.ts` | OK |

### Per-task: does each task's text agree with itself?

| Task | Finding |
|---|---|
| 1 | OK — test block defines CP/EM/EN/EACUTE/HELLIP/LDQUO/RDQUO before use; plan states `phraseFound` must be imported; `entityChar` survives the rewrite |
| 2 | OK — `SignalInput` already carries `status` and `headers` from plan 1; `sourceLabel` is optional so the new test's omission typechecks |
| 3 | **CONFLICT — see C1** (the new PDF assertion needs imports the file does not have) |
| 4 | OK — `exports.test.ts` pins only package.json exports, so exporting `validateFlags` and a pdftotext predicate is free |

### Rulings (made before execution)

- **C1. Ruling: Task 3's implementer must add three imports to `test/classify/corpus-verdict.test.ts`.** The plan's new fixture-size assertion calls `proseVolume` and `THRESHOLDS`, and the file today imports only `readFileSync`, `computeSignals`, `verdict` and `toText` (verified by reading its header). Left implicit, a literal executor hits an unresolved-name error and may "solve" it by dropping the assertion — which is the pinning the F1 fix exists to add. Add to the dispatch: import `proseVolume` and `THRESHOLDS` from `../../src/classify/thresholds.js`; `readFileSync` and `toText` are already there. *Cost if wrong:* none — a missing import fails loudly at typecheck.

---

## Progress

Task 1: implemented 6932e5e (code-point entity map; 204 tests, tsc clean). Sweep 0/34 verdicts moved against a REAL dbaa030 checkout built fresh — and sanity-checked non-vacuous: 9/34 fixtures show genuinely different extracted text between builds while no verdict changed.
Task 1: byte-check — src/text/extract.ts fully ASCII, 0 NULs. test/text/extract.test.ts has 3 non-ASCII bytes = one pre-existing curly apostrophe (U+2019) at line 18 in an untouched test predating this task. Flagged, not silently changed.
Task 1: review dispatched (sonnet), package review-728a5c2..6932e5e.diff
Task 1: review returned spec ✅, quality Approved, 1 Important (inherited from my brief). Entity table verified programmatically against Python's html.entities.html5: 95 rows, 0 mismatches, 0 duplicates. Ordering probes all pass, including attribute-entities (vanish with the stripped tag by construction) and bare & without semicolon. All four em-dash and all four en-dash spellings converge to one output; phraseFound matches end to end.
Task 1: sweep INDEPENDENTLY reproduced with the reviewer's own script against a fresh dbaa030 worktree — 0/34 verdicts moved AND 9/34 fixtures with genuinely different extracted text, byte-for-byte matching deltas. Fixtures confirmed identical between builds, so the sweep measured the code and not the corpus.
Task 1: 3 of 5 new tests confirmed to FAIL against pre-patch toText; the other 2 are anti-regression guards for behaviour the brief said was already correct.
Task 1: byte-check independently confirmed — extract.ts fully ASCII; the single U+2019 in the test file verified against dbaa030 as pre-existing, not introduced.
Task 1 IMPORTANT: the entity table has completeness gaps and a case-asymmetry — le/ge/ne absent (quantitative claims), most Greek letters beyond eight absent (scientific citations), iexcl/iquest absent, and lowercase present without uppercase for the circumflex family plus Iuml, OElig, Oslash, Aring. So "fenetre" works and "Ecole" does not. Each gap is the same false-miss-above-the-floor route the task exists to close. Mine, not the implementer's — it transcribed my table exactly.
Task 1: fix round 1/5 dispatched (resumed original implementer). FIX_BASE=6932e5e
Task 1: fix round 1/5 implemented 4e47996. 130 rows verified against html.entities.html5 — 0 mismatches, 0 duplicates, no remaining case asymmetries. Szlig correctly left absent (not an HTML5 entity), which shows the symmetry rule was applied with judgment rather than mechanically. 205/205, tsc + build clean, byte-check clean.
Task 1: implementer flagged an honest limitation — none of the 35 new rows appear in the corpus, so the sweep (0/34 moved, same 9/34 differing, identical deltas to round 1) does not validate them; the WHATWG cross-check and the new unit test do.
Task 1: fix round 1/5 (1 addressed, 0 open; commits 6932e5e..4e47996). Re-review independently verified 130 rows / 0 mismatches / 0 duplicates / 0 remaining case asymmetries; confirmed the Szlig claim correct (HTML5 genuinely has no uppercase form); confirmed all four new test cases would fail against the round-1 table; no entity-name prefix or superstring conflicts; &amp; still decodes last.
Task 1: complete (commits 728a5c2..4e47996, review clean after 1 fix round)
Task 2: dispatched (sonnet — N5, the veto that asks whether the body is text), BASE=4e47996
Task 2: implemented 78881e3 (N5 on Signals + isBlocked; isTextualContentType and looksBinary in signals.ts; reachability reason branch between gone and challenged, pinned by a test). 213/213, tsc + build clean, byte-check clean across all 6 files.
Task 2: sweep 0/34 verdicts moved, N5 fired on 0/34 (max binary density across the corpus measured 0 against a 0.01 threshold), companion figure 9/34 differing text — the baseline was real, not vacuous.
Task 2: escalation divergence noted per instruction, not fixed — check.ts stays on inline N1||N2||N3.
Task 2: review dispatched (sonnet), package review-4e47996..78881e3.diff
Task 2: review returned spec ✅, quality Approved, 2 Important (both for Task 4 disclosure), 1 Minor. THE ROUTE IS CLOSED, proven with live arxiv bytes: before 4e47996 `unsupported` with the claim in missed; after, `unreachable` with no evidence and no missed field.
Task 2: false-positive probe found NONE — CJK, emoji, mathematical notation, Arabic and Hebrew RTL, and application/rss+xml, text/markdown, application/ld+json, atom+xml, vnd.api+json, mixed-case and irregularly-spaced charset params all pass notText:false. No lost capability.
Task 2: branch placement proven load-bearing BY MUTATION — reviewer swapped it after `challenged` in a throwaway copy and the pinning test failed exactly as predicted.
Task 2: "absent content-type is forced" VERIFIED, not assumed — real pdftotext output of the arxiv paper through computeSignals with headers:{} gives notText:false and `supported`. Flipping the default would veto every PDF the tool can read.
Task 2: looksBinary-on-raw-body proven load-bearing by construction — binary wrapped in tag-shaped spans measures 0.316 density raw and 0 after toText.
Task 2: sweep independently reproduced with the reviewer's own script — 0/34 moved, N5 fired 0/34, 9/34 differing text, max density exactly 0. Discrimination: 8/8 new assertions fail against 4e47996.
Task 2 IMPORTANT (known, planned): base64 / ASCII85 / PostScript under a lying textual content-type evade both probes and can reach `unsupported`. This is the plan's own disclosed deferral; Task 4 must write it into docs/calibration-2026-09.md, which currently does not contain it.
Task 2 IMPORTANT (NEW, not in the plan): a body with MORE THAN 64KB of clean text followed by a binary tail evades — the sample window never reaches the binary. Rated Important not Critical: it needs an unrealistic document shape, and the real arxiv PDF's first 64KB is already ~59% binary. Ruling: document in Task 4 alongside the base64 gap rather than changing the sampling, which would be an unreviewed behaviour change to a veto. *Cost if wrong:* a narrow accusation route stays open, disclosed rather than closed.
Task 2: complete (commits 4e47996..78881e3, review clean)
Task 3: dispatched (sonnet — fixtures for body shapes the corpus has never held), BASE=78881e3
Task 3: implemented 7a01b1d. 216/216, tsc clean. PDF fixture proseVolume 6,221 (1,721 clear of the 4,500 floor, so N5 rejects it and the floor does not — pinned by assertion). Entity fixture 6,394. Corpus 34 -> 36 (25 challenge / 10 document / 1 known-gap). Test files pure ASCII; corpus.json's 6 non-ASCII bytes confirmed pre-existing.
Task 3: review dispatched (sonnet), package review-78881e3..7a01b1d.diff
Task 3: review returned spec ✅, quality Issues — 1 Important, 1 Minor. Central checks all verified by measurement and mutation:
  - N5-DISABLED TEST: with notText forced false, the PDF fixture becomes `unsupported` — reachable and accusable. So N5 alone rejects it; nothing else does. The fixture pins what it was built to pin.
  - SHRINK TEST: truncations to 50/35/25/15/10/5% all fall below the floor, so the pinning assertion is a real guard, not tautological.
  - ENTITY TEST DISCRIMINATES: through the real pre-Task-1 extractor it yields `unsupported` (the false accusation this plan exists to remove); post-Task-1 `supported`. Cause verified: &eacute;/&Eacute;/&hellip; passed through raw and &mdash; decoded to "--" so "panel--chaired" never matched.
  - Acceptance amendment correct, notText derived through the real computeSignals with no duplicated probe, and 0 divergences across all 36 fixtures between the test helper and the production path.
  - Corpus totals independently counted: 36 (25/10/1), every path resolves. PDF fixture url carries neither .pdf nor /pdf/, so Task 4's widening will not accidentally retire it.

Task 3 IMPORTANT: docs/calibration-2026-09.md now contradicts itself. The entity fixture (6,394) is the corpus's new smallest document, replacing 6,858 — confirmed by re-running scripts/calibrate.mjs. So "smallest real document | 6,858", "clear air above the floor | 2,358", and "every fixture now provides at least 2,358" are all false; the true figures are 6,394 and 1,894. The new Task-3 section states 1,894 independently without flagging that it revises the earlier number. Minor alongside: population counts n=24/n=9 should be 25/10, and the "43 to 1,180" challenge range is N5-blind (a third fixture is un-vetoed by N4 but vetoed by N5) — that blindness predates Task 3.
Task 3: cannot-verify — the doc's "5,279 satisfying floors, range [1,380, 6,658]" came from a one-off script not in the repo; since the document minimum dropped from 6,858 to 6,394 the upper bound almost certainly shrank. Task 4 should recompute or date-scope it.

**Ruling: fold Task 3's Important into Task 4 rather than opening a fix round.** Task 4 is already scheduled to re-scope thresholds.ts's calibration docstring AFTER Task 3 precisely because the numbers move; the calibration doc is the same work in the same file family, and a separate round would touch the same lines twice. *Cost if wrong:* if Task 4 misses it, the doc ships self-contradictory — mitigated by naming every stale figure explicitly in Task 4's dispatch.
Task 3: complete (commits 78881e3..7a01b1d, 1 Important carried into Task 4)
Task 4: dispatched (sonnet — the documentation task, carrying findings from Tasks 2 and 3), BASE=7a01b1d
Task 4: implemented e4d9f46. 231/231 (+10 pdf.test.ts, +5 validateFlags), tsc + build clean, manual live `check example/sample.md` exit 0, evidence file restored.
Task 4: recomputed calibration — smallest document 6,394 (was 6,858), gap 5,214, clear air 1,894 (was 2,358), challenge max 13,216 (recorded as 13,221; drift from the entity fix, predates Task 3), floor sweep 4,815 satisfying values range [1,380, 6,194] (was an unreproducible 5,279 / [1,380, 6,658]).
Task 4: committed scripts/sweep-floor.mjs rather than date-scoping the stale figure — the prior version's defect was literally "a script not in the repo". Right instinct.
Task 4: found TWO MORE false comments of the same class beyond the three named — verdict.ts calls isBlocked's five checks "the four vetoes" (twice), and the README's "no model" section said five unreachable inputs and never mentioned N5 at all. That README line was itself corrected during plan 1's FINAL fix wave and went stale within a day. Documentation drift is this codebase's most persistent defect class.
Task 4: also corrected 7 per-fixture prose counts in the calibration data table that had drifted from the entity fix independently of Task 3.
Task 4: review dispatched (sonnet), package review-7a01b1d..e4d9f46.diff
Task 4: review returned spec ✅, quality Approved — 0 Critical, 0 Important, 1 Minor. Every calibration figure INDEPENDENTLY RECOMPUTED by the reviewer running build + calibrate.mjs + sweep-floor.mjs itself: challenge [43, 13,216] n=25, document [6,394, 108,248] n=10, largest un-vetoed challenge 1,180, gap 5,214, clear air 1,894 above / 3,320 below, sweep 4,815 satisfying floors range [1,380, 6,194]. All match. sweep-floor.mjs confirmed to replicate acceptance.test.ts's four assertions line-by-line.
Task 4: the two disclosed known gaps were RECONSTRUCTED, not taken on trust — a 26,668-char pure-base64 body gives notText:false; a 72,000-char clean-ASCII head with a 16,000-char control-byte tail gives notText:false (sample window never reaches it). Both figures exact. The HTML-comment leak was likewise built and run: SECRET_CLAIM_PHRASE inside `<!-- -->` reaches extracted prose.
Task 4: isPdf widening verified safe by tracing the failure route, not by reading the regex — /pdfstore/, /nonpdfword/, /apdf/ do not match; and a /pdf/ URL serving HTML was reproduced with real pdftotext: exit 1 -> EMPTY_RESPONSE -> `unreachable`, never `unsupported`. The keystone holds on the widened path.
Task 4: README read end-to-end against src/ rather than against the report. "Six inputs" vs "five vetoes" confirmed NOT a contradiction (N3 consumes two inputs). The corrections confirmed real via `git show 7a01b1d:` — the base genuinely said "four vetoes" and omitted N5.
Task 4: live-network corroboration the brief did not ask for — reviewer fetched the real arxiv PDF and replicated looksBinary's sampling: 38,579 of 65,517 sampled code points bad (58.9%), exact match to the implementer's independently-claimed figure.
Task 4 MINOR (parked): test/bin.test.ts's last validateFlags case is byte-identical to the first — same input, same assertion, a documentation label with no discriminating power. Not a defect; wasted test surface. *Ruling:* leave it. Removing it is a test-file edit with no behavioural gain, and the whole-branch review is the better place to decide whether the block reads well as a whole. *Cost if wrong:* one redundant test ships.
Task 4: complete (commits 7a01b1d..e4d9f46, review clean, 1 Minor parked)
All four tasks complete. Dispatching whole-branch review (opus, dbaa030..e4d9f46).

## Whole-branch review (opus, dbaa030..e4d9f46) - verdict: approve with fixes

PURPOSE PROVEN LIVE, not read off the diff: the reviewer fetched the real arxiv PDF (2,215,244 B, content-type application/pdf), decoded it exactly as nodeFetch/curlFetch do, and ran a dbaa030 build and the branch build side by side. dbaa030 -> `unsupported`, naming "Attention Is All You Need" and "The dominant sequence transduction models" as missed. Branch -> `unreachable`, no missed, no evidence. Prose measured 1,037,512 - the plan's figure to the character. Same result with the content-type absent. And the recovery works: check() on the /pdf/ URL -> `supported` via the pdftotext rung with real excerpts from the paper.
Independent sweep against a fresh dbaa030 build from `git archive`: 36 fixtures, 108 comparisons, 0 verdicts moved on the 34 that existed at dbaa030; the only 2 moves are the new PDF fixture, which is the point. 10/36 extract genuinely different text, so the baseline was real. Every calibration figure reproduced exactly. Floor licence intact: 4,500 lies in [1,380, 6,194]. 23 mutations run, 21 killed.

Findings, itemised with disposition (a count is not a list):
- IMPORTANT 1 header-key casing - FIX. Demonstrated false accusation: a caller-supplied fetcher returning `CF-Mitigated: challenge` yields `unsupported` with the claim in missed, where the lowercase spelling yields `unreachable`. Critical in kind, Important in reach (no plugin exists yet). Pre-existing for N1; N5 extends the same undocumented requirement. Spec section 12 names bring-your-own-reader as the mitigation for hostile corpora - exactly the users who meet walls.
- IMPORTANT 2 a third N5 evasion - DISCLOSE, do not close. Uncompressed PDF, 55,668 chars, entirely inside the 64KB window and carrying real control bytes, density 0.00898 -> notText false -> `unsupported`. Neither disclosed gap covers it. Closing it means moving a threshold by guess.
- IMPORTANT 3 the spec was never amended - FIX. The plan's own header promises it amends section 6.2; `git log dbaa030..e4d9f46 -- docs/superpowers/specs/` is EMPTY. The binding authority still says "the four vetoes" and never contains "N5". Plan 1's ledger already recorded one spec/ship divergence; this would be the second.
- IMPORTANT 4 README omits N5's content-type trigger - FIX. Zero hits for "content-type" in README or calibration doc. Demonstrated capability loss: the real Verge fixture served as application/octet-stream flips from readable to `unreachable` with nothing user-facing explaining why.
- IMPORTANT 5 three cross-rung tests do not discriminate `proven` - FIX. `proven` deleted, suite stays 231/231 green. Cause: every shipped test vetoes a body SMALLER than the 9-char stub, and `proven` only matters when the largest read is the vetoed one. Plan-1 code, but THIS branch enlarges the untested surface: N5 is a fifth way for the biggest read to be vetoed, and one discriminating case the reviewer built uses this branch's own new fixture.
- IMPORTANT 6 N5's two constants sit outside THRESHOLDS - FIX by relocating and pinning, do NOT retune. 0.01 -> 0.5 kills 0 tests; 65536 -> 1024 kills 0 tests. thresholds.ts's own docstring ("every number that can change a verdict is in one place under one doctrine") is now false.
- MINOR isPdf matches the whole URL, not the path - FIX. MINOR soft-hyphen false-MISS - DISCLOSE only, fix parked to plan 2. MINOR verdict.ts says "two callers" where three exist - FIX. MINOR extract.ts overstates the Greek rule (Gamma, Xi, Psi all differ visibly and are absent) - FIX. MINOR bin.test.ts duplicate - REPLACE with the real gap (single-dash args pass silently as positionals). MINOR CHANGELOG untouched despite 4 integrator-visible changes including a BREAKING CLI change - FIX. MINOR README uses the label "N5" without defining it - FIX. MINOR the entity fixture is authored yet sets the sweep's upper bound while the doc calls it "real-shaped" - FIX. MINOR default-fetcher wiring untested - ATTEMPT, park if it needs restructuring. MINOR validateFlags is command-agnostic - PARK to plan 2 (per-command flag tables is a design decision, not a fix round).
- The reviewer also found a code-point/UTF-16-unit mismatch in looksBinary (the loop counts code points, the denominator counts units, so astral content halves the measured density) and could not construct an exploit. FIX anyway: it UNDER-vetoes, which is the accusation direction, and the correction is trivially safe.

**Ruling: the ledger's own escalation justification was wrong, though its conclusion holds.** It called the check.ts N1||N2||N3 divergence "harmless (curl returns the same bytes)". That reasoning is unsound - node and curl send different Accept headers, and this repo's own curl.ts comment documents that this changes what a host returns. The parking stands, but on the correct reason: safety comes from the verdict floor (a non-escalating N5 read yields `unreachable`, never an accusation), not from the rungs agreeing. Recorded so plan 2 does not inherit a false premise. *Cost if wrong:* none to shipped behaviour; this is a correction to the record.

**Ruling: one fix dispatch on opus, not sonnet.** The skill says least-powerful-that-suffices, and sonnet has carried every task on this plan. Overridden here: it is the last code change before merge and item A is a demonstrated false accusation on the keystone path. *Cost if wrong:* one dispatch at a higher tier than needed.

Final fix round: brief at final-fix-brief.md, dispatched (opus), BASE=e4d9f46

## Final fix round (opus, e4d9f46..5969f0a) - all fourteen items closed, nothing parked

246 tests (from 231), tsc clean, build clean, tree clean. Commits: 7a9df2e (A), afb1632 (B+C), b79040d (D), 238432a (E+F+N), 92230de (G+H), 921ff9b (I+J+K+L+M), a207bfc (a correction to its own -j comment), 5969f0a (restore example/sample.evidence.json, rewritten by a smoke run).

Test count counted, not estimated: 217 literal `it()` blocks + 6 `it.each` tables expanding to 29 = 246, reconciled file-by-file against vitest's per-file output.

MUTATIONS - the whole point of items C, E and N was that the previous tests killed nothing:
- C: before, `0.01 -> 0.5` and `65536 -> 1024` each killed ZERO tests. After: `0.5` kills 3, `0.001` kills 1, `1024` kills 1. The implementer re-shaped the density bodies on a second pass so control bytes spread evenly, so each mutant dies to the test whose title names it rather than to whichever test happened to trip. Neither value was changed.
- E: `proven` removed with tests as shipped -> 242/242 GREEN, reproducing the finding exactly. With the repaired test -> 1 failed, `expected 'unreachable' to be 'supported'`. One repaired test sufficed.
- N: not parked after all. `pdfRungAvailable()` -> `pdftotextAvailable()` now fails with `expected ['node','pdftotext'] to equal ['node']`, and it took no restructuring of default-fetcher.ts - the new test stubs the two leaf probes and delegates to the real predicate.

DEVIATION (item E), accepted: the implementer built the large N4-vetoed body INLINE instead of reading the ECB fixture as the brief specified. Reason given: check.test.ts states it holds no fixture reads (a missing corpus crashes collection), and a test whose discriminating power depends on a captured file's SIZE degrades silently when that file is re-captured. *Ruling: accept.* The reasoning is better than the brief's - it makes the test's power intrinsic rather than borrowed from a file that can change under it. Flagged to the re-reviewer to judge independently rather than taken on the implementer's word. *Cost if wrong:* an inline body that does not actually discriminate, which the re-review's own mutation check would catch.

BEYOND THE BRIEF, kept: `src/rules/challenge.ts` claimed the signature list "never decides a verdict" - false, N3 vetoes on it alone. Same defect class as item G and on the keystone path.

**Controller corrections, committed as 75c4c19** - two things the implementer surfaced honestly and left open, both the exact class this branch exists to punish:
1. Spec section 6.3 still said the scheme "consults no status". N4 falsified that when it landed during PLAN 1 - so the binding authority has carried a false sentence for a full plan cycle, in the document that is supposed to be the authority. Corrected to state what N4 does: a status can WITHHOLD an accusation, never supply one, and the origin conclusion survives in the direction that protects the author. The worked example below it was adjusted too - the 404 error shell is now vetoed by N4 before prose volume is consulted, not by P2 as the text claimed.
2. The arxiv density figure disagreed with its own raw counts (0.5887 vs 38,579/65,517 = 0.5888). Both are correct on their own denominator: 0.5887 is the 65,536-UNIT window that shipped before this round, 0.5888 is the same counts over CODE POINTS, the unit the scan uses now. *Ruling: record the discrepancy rather than smooth it.* It is the item-B unit mismatch made visible on a real body, and it shows the direction of the old error - the unit denominator understated every density it measured, which is the direction that withholds a veto.

The implementer reported exactly one item it found and did not fix - spec section 6.3's "consults no status" contradicting N4 - because the brief told it not to restructure the spec and item H's grep did not reach that section. That is now closed by 75c4c19. No spec item remains open.

MY OWN INSTRUMENT WAS BROKEN AGAIN, caught before it mattered: my first NUL check used `grep -P`, which errored out on this locale ("supports only unibyte and UTF-8 locales"); the `else` branch then printed "clean" for all three files without any check having run. Redone with byte counts (`tr -d` against `wc -c`): 0 NULs in all three, thresholds.ts and the spec pure ASCII, and the calibration doc's 165 non-ASCII bytes all pre-existing typography (em dash, en dash, double dagger). This is the SECOND time on this project a verification instrument has silently reported success without running - see the printf `\uXXXX` false negatives in plan 1. *Standing lesson: a check that cannot fail is not a check; make the instrument fail once on purpose before trusting it.*

Scoped re-review dispatched (sonnet), package review-e4d9f46..75c4c19.diff, 9 commits. Asked to re-run every mutation independently, judge the item-E deviation on its merits, and check documentation against src/ rather than against the report.

## Scoped re-review (sonnet, e4d9f46..75c4c19) - all fourteen closed, one blocker found

Every item A-N confirmed closed BY RUNNING, not by reading. The re-reviewer independently reproduced: item A's false accusation failing against e4d9f46 with the new test (`expected 'unsupported' to be 'unreachable'`); all three item-C mutations killing exactly 3, 1 and 1 named tests with both values unchanged at 0.01 and 65_536; item E's `proven` deletion breaking exactly the repaired test; item N's revert breaking exactly the new test; item J's 55,668-char body reproducing notText:false at density 0.00898; item K's soft-hyphen false-miss on both "cooperation" and "co-operation"; item I's Verge capability loss at 16,449 chars; and every calibration figure from its own build. Test count independently recounted: 246 = 217 literal `it()` + 6 `it.each` tables expanding to 29, reconciled per file.

Item E deviation independently upheld: the re-reviewer confirmed the real ECB fixture extracts to exactly 13,216 characters - the same figure the inline body's comment cites - and that check.test.ts genuinely holds no other fixture reads. The implementer's reasoning was sound and the inline test does discriminate.

Item F verified against the BUILT CLI rather than the unit test: `check doc.md -j` exits 0 silently; `check -j doc.md` dies `cannot read -j: ENOENT` exit 2. The characterization comment is true of the shipped binary.

BLOCKER (documentation, in the binding authority): spec section 6.3 still said the signature list "demotes to an optimization... It may rot freely; the cost is latency and reach, never truth." FALSE - N3 vetoes on a signature match with a body under the cap, and the veto stands even where the claims match in full. Demonstrated: a body containing both a bundled signature and the claim phrase verbatim returns `unreachable`, not `supported`. THE SAME false claim this round had already found and corrected in src/rules/challenge.ts's own comment - left standing in the spec a few dozen lines above my own 6.3 correction, which I made without reading up the section. It survived item H because that audit grepped "veto", "four vetoes", "N4" and this paragraph is written in terms of "verdict". *The wrong grep for the right defect.*

Closed as e5bdbc3. Then swept the spec, README, calibration doc and classifier for the same SHAPE of claim rather than the same words ("never truth", "may rot", "an optimization", "never decides", "no status", "reporting-only"). One hit needed checking - section 6.3's "C2 is now reporting-only" - and it is TRUE: verdict.ts still carries C2 as "REPORTED, NEVER LICENSING". No other instance.

**I then introduced a false claim while fixing one, and caught it by checking rather than asserting.** e5bdbc3 said a missing signature "costs reach - the wall falls through to P2 and lands on `unreachable` anyway", unconditionally. Verified against the code instead of reasoning from the prose: N3 fires only where `proseVolume(text) < maxChallengeChars` (800) and the accusation floor is `minProseChars` (4,500) ON THE SAME QUANTITY, so below the floor the fall-through is structurally guaranteed - but a wall padded past ~4,500 extracted chars is vetoed by NEITHER the signature (only applies below 800) nor the floor (only blocks short bodies), and can mint an accusation. That exposure is already disclosed in signals.ts, carried as the known-gap fixture, and measured in the calibration doc; the spec was the one place still implying it away. Corrected as 551e8da with the condition attached. *This is the third time on this plan that a document about a mechanism was easier to get wrong than the mechanism itself.*

**Adjudication of residuals - the SDD loop's one fix dispatch and one scoped re-review are spent, so these are ruled, not re-dispatched:**
- The re-reviewer's two cannot-verifies are both accepted as-is. (a) It spot-checked the PDF fixture's density exactly but did not re-scan all 34 non-binary fixture rows for the "0.0000 maximum" claim; the earlier whole-branch review DID re-measure that population independently and got 0.0000, so the claim has two independent measurements behind it even though neither reviewer ran the full scan twice. (b) It did not re-fetch the two live URLs behind spec 6.3's meta.com/skhynix byte counts; those are pre-existing plan-1 spec content, untouched by this branch, and the spec already labels the figures as measured on a specific date. *Cost if wrong:* two stale byte counts in an illustrative example that decides nothing.
- No code or test defect was found in the fix round by either reviewer. Both remaining items are documentation, and both are now closed.

FINAL STATE: 18 commits on dbaa030..551e8da, 246 tests, tsc clean, build clean, tree clean, zero NULs, all source pure ASCII. Plan 1.1 is complete. Push/PR/merge NOT authorised for this branch - the user's earlier "push and pr, then good to merge and clean up" was given for plan 1's branch specifically. Ask.
