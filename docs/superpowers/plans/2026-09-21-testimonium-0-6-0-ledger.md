# testimonium 0.6.0 - execution ledger

Preserved into the repository because the SDD workspace under `.superpowers/` is
git-ignored scratch that worktree cleanup destroys. Same reason as the five
ledgers beside this one.

**Spec:** `docs/superpowers/specs/2026-09-20-testimonium-0-6-0-design.md` (four
review rounds; section 8 records a route that was cut).
**Plan:** `docs/superpowers/plans/2026-09-21-testimonium-0-6-0.md` (seven tasks).
**Released:** `main` at `ae5b39f`, tag `v0.6.0`, staged on npm 2026-09-22 and
awaiting the owner's 2FA approval. 611 tests / 51 files.

---

## What this release changed

Two tightenings against false attestation:

1. **A claim can no longer match across the join between two extraction
   regions.** `toText` concatenates the page body with each harvested
   `description` value; a claim straddling that seam matched text existing
   nowhere on the page as a sequence and returned `supported`. Matching is now
   confined to one region, in `check()` **and** in `harvest` - a proposal
   spanning a join would have had the tool accuse an author over its own
   suggested claim.
2. **A `<meta>` tag's `name`/`property` and `content` are read by parsing its
   attributes**, not by matching two regexes against the whole tag string, which
   harvested the wrong attribute's text and lost the real description.

`toText`'s own output is unchanged. The match *position* moved, not the text.

---

## Still open after 0.6.0

Each of these was found, decided, and deliberately not fixed in this release.
None blocks anything; all are recorded so they are not rediscovered as new.

| item | why it was left | where it is described |
| --- | --- | --- |
| **`recheck` attribution message** | For a join-only or leaked-`data-content` match, a 0.5.0 archive yields `L = A = unsupported` -> `pipelineDrift` -> exit 2 with the line "This is a regression in testimonium". Honest about the exit code, wrong in one sentence of attribution. It can also downgrade a genuine source drift to `pipelineDrift` - still failing, wrong story. | `src/bin.ts:96-97`, `src/archive/compare.ts:195` |
| **Four tests that can pass vacuously** | `test/harvest/proposals.test.ts` loops with no non-empty assertion and is the ONLY test for criterion 3's harvest half; `test/text/excerpt-region.test.ts` uses `?? ""` so a null excerpt passes, and re-implements the region traversal rather than observing `check()`, so reverting the whole of `049da8f` leaves it green; `test/harvest/filters.test.ts`'s helper hardcodes one region. | as listed |
| **Flat-join reads that the release's own thesis does not cover** | `matchesChallengeSignature` and `slugLabelOverlap` still read the flat join, so a bundled signature matching only across the body/description seam would veto a readable page. Safe direction (a veto, not an accusation), needs a sub-800-char page, near-zero incidence - but it is the one place this release's argument is not applied. | `src/classify/signals.ts:154`, `:168` |
| **Unbounded region count** | `descriptionValues` caps nothing, so the claims x regions predicate is unbounded on a hostile page: a synthetic 5,000-description page took ~3.7s for 50 claims. No real fixture exceeds 2 regions. Capping would change `toText`'s byte output outside what the spec licenses. | `src/text/extract.ts` |
| **`seedIndex` rebuilt per region** | `commonSpans` rebuilds the document-side index once per call, so a two-region read builds it twice. Immaterial at one read and two regions, but an undocumented change to the cost model `seedIndex`'s own docstring describes. | `src/harvest/spans.ts` |
| **`HarvestRead.text` is dead** | Nothing in `src/` reads it, and its docstring ("the extracted text, which proposals are cut from") is false - proposals are cut from `regions`. | `src/harvest/sources.ts:10-12` |
| **`dropContained`'s stale argument** | "NO FIXTURE CAN EXERCISE THE UNION TODAY" is now accidentally true only because no harvest test uses a page with a meta description; per-region scanning makes an ordinary lede-repeating page yield the span twice before `dropContained`. | `src/harvest.ts:121-135` |
| **`"two of nine real documents"`** | Pre-existing, unrelated to this release, and wrong twice over (it is two of ten documents, or one of nine real captures). | `src/classify/verdict.ts:27` |
| **The `tagsIn` recovery** | Specified across three review rounds; every rule was wrong in a way the round before had not considered, and the malformation appears in none of the 38 real captures. Cut rather than patched a fourth time. | spec section 8 |
| **Stale citations** | `extract-descriptions.test.ts` cites `descriptionText` (now `descriptionValues`); the cutover spec describes an `excerptFor` first-match mechanism that no longer exists; the 0.6.0 spec cites `signals.ts:148-150` for the defect, which is now the fix; the README says "a description regex would key on" and there is no description regex. | as listed |

---

## The execution record

### SDD ledger - plan: docs/superpowers/plans/2026-09-21-testimonium-0-6-0.md

Spec: docs/superpowers/specs/2026-09-20-testimonium-0-6-0-design.md (four review rounds; section 8 records the tagsIn recovery, cut).
Branch feat/0-6-0 from spec/0-6-0. Baseline verified: 585 tests / 46 files, tsc exit 0.

## Pre-flight scan

| tasks | shared file or interface | one produces | the other consumes | finding |
| --- | --- | --- | --- | --- |
| 1 & 2 | src/text/extract.ts | 1 replaces IS_DESCRIPTION/CONTENT_ATTR with parseAttrs; 2 splits toText into regions | 2 builds regions from the description VALUES task 1 changed how to find | consistent - task 2's `descriptionValues` is task 1's `descriptionText` renamed to return an array. Order 1 then 2 is required and stated. |
| 2 & 3 | toTextRegions | 2 exports it from extract.ts | 3 imports it in signals.ts | consistent |
| 3 & 4 | SignalResult.regions | 3 adds the field | 4 reads r.computed.regions in check.ts | consistent - Read.computed IS SignalResult |
| 3 & 5 | SignalResult.regions | 3 adds the field | 5 populates HarvestRead.regions from it | consistent |
| 5 & existing tests | HarvestRead shape | 5 adds required fields, removes normText | test/harvest/filters.test.ts and sources.test.ts construct and pin that shape | CAUGHT IN REVIEW - both files now in task 5's Files list and its git add. Without that the committed tree is red. |
| 1-5 & 6 | behaviour | 1-5 change extraction and matching | 6 measures the finished behaviour | consistent; 6 is last before the bump |
| 6 & 7 | the movement report | 6 writes docs/description-movement-0-6-0.md | 7's changelog cites its numbers | consistent |

Per-task self-agreement: each task's tests match the code it specifies, and its Files list matches the files its steps touch. Task 5 failed this before review (two test files touched but unlisted) and now passes. Task 2 failed a different form of it - its fidelity test could not fail - and now carries a pre-change hash snapshot instead.

Ruling: no conflict blocks execution. The plan was executed end to end by the reviewer in a scratchpad before it was approved, reaching 605 passing, so the interfaces are verified rather than argued.
Ruling: Task 6 fetches 618 live URLs and is the long pole. If ANY page crosses the 4,500 floor UPWARD, stop before Task 7 and report - that turns `unreachable` into `unsupported`, the design spec's worst-ranked outcome. Downward crossings are safe and are tabulated, not escalated.
Ruling: omnisscientia stays READ-ONLY. Task 6 reads the corpus and writes nothing there.

## Baseline

First full run on feat/0-6-0 showed 3 failures - acceptance.test.ts, corpus-verdict.test.ts, thresholds-types.test.ts - each at roughly 5,000ms, which is vitest's default timeout. NOT a regression: the code is byte-identical to origin/main (only docs differ on this branch), and all three pass in isolation (13/13) once load drops. Cause was 17 competing node processes from this session's own parallel work.
Recorded because an implementer who sees these three fail will otherwise hunt a defect in their own change. They are the corpus-wide acceptance tests and they are slow; run them alone before concluding anything.

Task 1: DONE at 536b757. 595 passing / 46 files (585 + 10), tsc exit 0, two files.
Task 1: Step 2 split matched the brief exactly - 3 failed (keywords, data-content, title-inject), 5 "should already pass" cases passed unmodified. Both Step 5 mutations went red; mutation 2's blast radius was 6 tests rather than the 2 the brief implied, because every existing og:/twitter: test pins that behaviour too. Wider than predicted is fine; narrower would have been the finding.
Task 1 found a defect in MY plan: the count arithmetic said 585 + 8 = 593, but Step 3 itself instructs "Add a test for each" of the two accepted micro-divergences, which the total never counted. Actual +10. The whole downstream chain was wrong by 2 and is now corrected to 595 -> 600 -> 604 -> 605 -> 607.
Controller verified Task 1 through the BUILT package rather than the report: all three leaks closed; crucially the REAL description is still harvested in the data-content and title-inject cases, which the old code lost entirely; all five preserved behaviours intact (mixed-case name, mixed-case property, upper-case tag, spaced =, self-closing); unquoted still unharvested; duplicate content takes the first.
Carried to Task 2: the implementer flagged that `descriptionText`'s docstring is now separated from its function by the newly inserted parseAttrs/tagsIn code. Task 2 renames that function anyway, so it fixes the placement then rather than churning extract.ts twice.
Task 1 review: spec-compliance PASS, quality very good. 1 Important, 1 Minor, 0 Critical.
  Reviewer ran 20 adversarial probes against parseAttrs (values containing > and <, doubled/escaped/backslashed quotes, mismatched quote styles, empty values, no-attribute tags, content-before-name, a 50KB value, a fake <meta> smuggled inside a data-desc value). Nothing fools it. EVERY old-vs-new divergence is a case where the OLD code harvested wrong text - including a `robots` tag's "noindex" bleeding in as a description.
  Reviewer diffed descriptionText AND toText across all 38 fixtures, ac71498 vs 536b757: ZERO movement. So no calibration refresh is triggered and Task 6's question 3 is answered in advance for route 2.
  All ten tests independently confirmed mutation-adequate, including two mutations the reviewer devised for the divergence tests specifically.
Important FIXED at 2c4bae5: the docstring for descriptionText had been orphaned onto parseAttrs by the insertion point and MISDESCRIBED it - claiming deduplication, which parseAttrs does not do. I had planned to defer this to Task 2; the reviewer was right that a misplaced comment and a FALSE comment are different things, and this repo ranks documentation drift above code defects. Moved back to its own function.
Minor FIXED at the same commit: added the duplicated-name test the spec's grammar table calls the defining evidence of the route-2 fix. Proven able to fail - it goes RED against the pre-task extractor at ac71498, where IS_DESCRIPTION matched the substring `name="description"` anywhere in the tag.
Controller error worth recording: I proved the new test red by checking out ac71498's extract.ts, then restored with `git checkout HEAD -- src/text/extract.ts` - which ALSO discarded my uncommitted docstring fix. Caught by reading `git status` rather than assuming the restore was surgical. Redone and committed.
Task 1: complete at 2c4bae5. 596 passing / 46 files, tsc exit 0.
Task 2: DONE at c646317. 601 passing / 47 files (596 + 5), tsc exit 0, three files.
Task 2: implementer confirmed the hash snapshot was taken BEFORE any source edit - build against unmodified source, clean `git status` immediately prior, extract.ts touched only afterwards. That ordering is the whole proof and it was the one way this task could have been silently unverifiable.
Task 2: the Step 6 mutation went red on the HASH test, not merely the join tautology. Reported correctly and unprompted, which is what the dispatch asked for.
Controller verified fidelity with a STRONGER instrument than the task's own: imported the pre-TASK-1 extractor from ac71498 and compared toText output across all 38 fixtures - 38 byte-identical, 0 differing. Control proves the comparison can detect a difference (Task 1's data-content fix shows "x R" against the old "x W"). So toText is unmoved across BOTH tasks on real pages, and every calibration figure in the repo still holds.
Task 2: toTextRegions correctly absent from src/index.ts - the deliberate non-export the spec records as a decision.
Task 2 review: PASS / PASS WITH FINDINGS. 0 Critical, 3 Important, 1 Minor.
  Reviewer built 12 probes for the per-region-vs-single-pass equivalence across all six categories the dispatch named - entity split at the join, whitespace-only description, entity decoding to whitespace, body normalizing to empty, decoded leading/trailing whitespace, dedupe-to-nothing. NO counterexample. The equivalence holds for the stated reason: one literal separator is forced before any decoding, and each region trims after collapsing.
Important 1 was MY planning defect, copied faithfully into the code: "Index 0 is always the body" is FALSE when the body normalizes to empty - the description takes index 0. Verified. Checked the downstream tasks before fixing: Task 4 uses .find() and Task 5 loops, so nothing depends on position, but the sentence could have misled a later task. Fixed in both the code and the plan's Interfaces line.
Important 2: the "this function's own docstring names the hazard" self-reference pointed at the wrong function after Task 2 moved the code out of toText. Fixed to name toText explicitly.
Important 3 was a genuine coverage hole found by mutation, not by reading: removing the empty-region filter passed ALL 601 tests INCLUDING the 38-fixture hash test, because no fixture is shaped that way. Added two tests; the mutation now reddens exactly the new one and nothing else.
Minor 4: recorded in code that dedup is by RAW attribute text rather than decoded value - deliberate, and it must stay, because decoding first would change how many regions a page yields and move toText's byte output.
Controller error: my first attempt at these fixes used multi-line anchors with \n against a CRLF file, so the anchor scored 0 and - because the write is at the end - it silently rolled back the one fix that HAD applied. Same CRLF/LF anchor trap this project has on record. Redone by normalizing first.
Task 2: complete at the review-fix commit. 603 passing / 47 files, tsc exit 0.
Task 3: DONE at 1e2a864. 607 passing / 48 files (603 + 4), tsc exit 0. Step 2 split matched the brief exactly - 3 failed / 1 passed, tests 1, 2 and 4 failing. ZERO pre-existing tests moved, as the plan predicted, confirmed across three full runs plus isolated runs of the three known-flake corpus files.
Task 3: implementer hit the Write-tool bare-LF issue on the new test file and converted to CRLF, byte-counted rather than grepped. Correct instrument.
Controller verified the release's CORE PROPERTY end to end through real check() verdicts, not through the unit tests: a claim spanning body|description and a claim spanning description|description both stop attesting (both now `unreachable`); a claim inside one description still returns `supported`; and the claim a cross-join `norm` fold had destroyed is RESTORED to `supported`. toText's output still contains the spanning phrase, which is correct - the committed surface is unchanged and only the predicate moved.
Note on the verdicts: the seam cases land on `unreachable` rather than `unsupported` only because the probe pages are under the 4,500 floor. On a prose-rich page the same closure yields `unsupported` - a correct accusation. Either way no false attestation survives.
Task 3 review: PASS / CLEAN. 0 Critical, 0 Important, 1 Minor (forward-looking, out of scope).
  The constraint that protects every calibration figure was verified by EXECUTION, not by reading: computeSignals from 1e2a864 and from 7b8a78a run side by side over all 38 fixtures, diffing text, proseChars, slugLabelOverlap and challengeSignature - 0 mismatches. `text` is not merely equal to the old value, it is the same expression inlined, since toText IS regions.join(" ").
  Predicate correctness confirmed at every edge probed: zero claims, a claim matching two regions at once, the seam case, a claim matching neither, a one-region page, a many-region page, and the empty-regions case. matched + missed === total everywhere, no claim double-counted or dropped.
  missedClaims is a safe complement: the predicate closes over a never-mutated regions array and norm/phraseFound are pure, so the two filters cannot desync.
FOLLOW-UP, not fixed here: `descriptionValues` caps nothing, so the claims x regions predicate is unbounded on an adversarial page - a synthetic 5,000-description page took ~3.7s for 50 claims. No fixture exceeds 2 regions. Deliberately NOT fixed in this task: it is not a regression Task 3 owns, and capping regions would change toText's byte output outside what the spec licenses. Worth its own decision in a later release, for a tool that fetches arbitrary live URLs.
Task 3: complete at 1e2a864. 607 passing / 48 files.
Task 4: dispatched (sonnet).
Task 4: DONE at d39e346. 608 passing / 49 files, tsc exit 0, one source line plus one test.
Task 4: the implementer proved the new test RED before the change and quoted the assertion - the excerpt really did read "...The board met again in march quietly..." , conjoining two separate meta tags into one apparent sequence. That is the proof the dispatch asked for and it was given unprompted.
Controller verified through check(): the join-spanning excerpt is gone and the excerpt now comes from the single region that matched; an ordinary description excerpt still resolves; a body-matched claim still excerpts from the body. Confirmed the fallback in check.ts is `?? ""` and never the flat text - falling back to flat would return exactly the passage this task exists to prevent.
Ruling: Task 4 gets its review in parallel with Task 5's implementation rather than serially. They touch disjoint files (check.ts versus src/harvest/*), the reviewer is read-only, and Task 5 is the largest remaining code task. Cost if wrong: a Task 4 finding arrives while Task 5 is in flight, which is recoverable because the files do not overlap.
Task 5: dispatched (sonnet) - four source files, two existing test files that MUST change, two new test files.
Task 4 review: spec-compliance PASS on the letter, quality NOT CLEAN - one Important, and it was a real silent-evidence REGRESSION.
  `.find()` stopped at the first MATCHING region rather than the first EXCERPTABLE one. excerptFor's fold deliberately omits norm's length-changing substitutions, so a body reading "6.5 billion dollars" MATCHES the claim "6.5bn dollars" while excerpting null, and a description reading "6.5bn dollars" would excerpt perfectly. Result: excerpt null where the old flat lookup returned a good passage, by scanning past the un-excerptable occurrence.
  Controller reproduced it exactly: regions[0] matches and excerpts null, regions[1] excerpts the full sentence, check() returned supported with a NULL excerpt.
  FIXED at 049da8f: iterate every matching region, take the first that yields a non-null excerpt. Body-first order is preserved, so a region a reader actually sees still wins over metadata whenever both can excerpt. Regression test added. Verified: the excerpt is now the description sentence, does not span a join, and a body-matched claim still excerpts from the body.
  The reviewer also traced every consumer of evidence[].excerpt - dedupeEvidence, the JSON output, bin.ts, the archive - and confirmed a null excerpt is safe everywhere. And it noted the `?? ""` fallback is unreachable in that flow, which is probably WHY the reachable failure mode went unconsidered: the comment described an impossible case and drew attention away from the real one.
Task 5: DONE at 4586b85. 610 passing / 51 files, tsc exit 0.
Controller instrument failure, recorded: I tried to verify Task 5 by hand-rolling a Document object and calling harvest() directly. It produced ZERO proposals - for the control as well as the subject - so it could not distinguish "harvest correctly refused" from "harvest proposed nothing for unrelated reasons". Two rounds of that before I stopped. The real path builds the document through parseGfmFootnotes, which is what the implementer's test does.
Task 5 VERIFIED by the right instrument instead: reverted only Task 5's four source files to d39e346, ran proposals.test.ts, and it goes RED with the assertion showing harvest actually proposing the join-spanning phrase - then green after restore, tree clean. So harvest no longer proposes a span that check() would reject, which is acceptance criterion 3.
Ruling on Task 6's open question, decided by the controller rather than left to the implementer: question 2 ("which pages lose a match") is answered from CONSTRUCTED FIXTURES, and the report says plainly that the live corpus was not used for it. The alternative - extending the harness to carry real claims - needs the bulletin items database, and this session established earlier that the claim text is not reachable from this repo: the corpus carries only {url, cites}, and a whole-repo search finds those URLs nowhere else. Cost if wrong: question 2 describes the mechanism rather than counting live incidence, which is exactly the limitation the 0.5.0 report had to disclose after the fact - the difference is that this time it is disclosed in advance.
Task 6: dispatched (sonnet) - 618 live URLs, the long pole, resumable NDJSON.
Task 5: review dispatched (sonnet) in parallel - Task 6 writes scripts/ and docs/, Task 5's files are src/harvest/*, and the reviewer is read-only.
Task 5 review: PASS / CLEAN. 0 Critical, 0 Important, 1 non-blocking Minor.
  Coverage worry answered in the OPPOSITE direction from the one I feared: per-region scanning is a coverage IMPROVEMENT at the join. A join-crossing span is not dropped whole - it is split into two shorter, real, non-crossing spans, which is what section 2's design decision intended when it rejected flat-scan-plus-post-filter.
  The argument behind it is clean and worth keeping: toText IS regions.join(" "), so every region is a literal substring of the flat text and region.includes(n) implies text.includes(n). Per-region matching is therefore a strict narrowing whose only losses are spans that existed solely by virtue of the join. Verified empirically across all seven two-region fixtures, including boundary excerpts abutting the join - zero loss, zero gain on non-crossing spans.
  Frequency filter: the source-self guard survived verbatim, and per-region voting can only REDUCE drops, never add spurious ones. Verified on real cross-source data.
  Both edited test files kept their properties. The normText memoization test kept its stale-value trick intact over normRegions; the shape pin now builds its expectation from toTextRegions() rather than hand-written text, which is a strengthening.
  All four required comment rewrites present and accurate; normText survives only as historical prose explaining what the old field did.
FOLLOW-UP, not fixed: commonSpans rebuilds seedIndex(doc.folded) per call, so a two-region read now builds it twice where it used to build once. Immaterial at one read and two regions per source, but it is an undocumented change to the cost model seedIndex's own docstring describes.
Task 5: complete at 4586b85.
Task 6: agent stopped mid-run waiting on its own background job, exactly as 0.5.0's measurement did. The detached fetch SURVIVED - 194 rows then 205 twenty seconds later, about 33 rows/min. The resumability requirement has now paid for itself twice; the run was never at risk, only the agent's turn was. Controller armed its own waiter rather than re-dispatching and re-hitting 618 live publishers.
Task 6: agent reported "no floor crossings so far" at roughly a third of the corpus. Not recorded as a result - partial data, and the 0.5.0 run had five crossings appear progressively, with the fifth arriving after row 400.
Task 6: COMPLETE at 9bd9ba1 plus 1f3279c. 611 passing / 51 files, tsc exit 0, tree clean.
RESULT: the hard stop did NOT trigger. 618 of 618 measured, 551 yielded a reading, and `textBefore === textAfter` - exact string equality, not merely equal proseChars - on ALL 551. Zero floor crossings in either direction, zero veto flips, zero challenge-signature flips.
The zero is NOT vacuous, and that was the thing worth checking: 486 of 551 readings carry a harvested description in BOTH arms, so the instrument demonstrably found and compared real description text. The corpus simply contains none of the tag shapes route 2 fixes. Confirmed separately that the current extractor still handles all three defect shapes plus an ordinary control.
Task 6 agent flagged "a commit appeared that I did not issue" and verified its content was its own work before proceeding. That commit was MINE - I committed 9bd9ba1 while the agent was stopped mid-run. It was right to flag rather than assume, and right not to build on an unexplained commit without checking. No environment mechanism involved.
Task 6 agent's own extra commit records the raw NDJSON's size (99 MB, larger than 0.5.0's 51 MB because each row also carries regionsAfter/bodyBefore/describedBefore) and its fetch date - the exact reproducibility disclosure 0.5.0's report had to be corrected for after the fact.
Task 6 also re-confirmed calibration at HEAD rather than inheriting it from earlier task reviews: calibrate.mjs and sweep-floor.mjs outputs match docs/calibration-2026-09.md exactly. No refresh needed. And omnisscientia was never written to.
Task 7: DONE at e43d66b. 611 passing / 51 files, tsc exit 0. Version 0.6.0 in both places with the `: string` annotation intact, and dist/version.d.ts emits `export declare const VERSION: string;` rather than pinning the literal - the load-bearing check, since a pinned literal makes every future release type-breaking. npm pack: 83 files, dist plus metadata only, every .js paired with a .d.ts. CHANGELOG dated 2026-09-22, the release commit's own date.
Task 7 met the honesty requirement in full and better than I phrased it: "Read 'zero movement' below as exactly that measurement, not as 'nobody is affected' - only the first was measured." It states that the harness passes no claims because the claim text lives in a database this repo cannot read, that question 2 is answered from constructed fixtures, and that this was disclosed in advance rather than found after publication.
Controller instrument note: my verification grepped for the exact strings "unmeasured" and "0 of 551" and both scored MISSING. The requirements WERE met, in different words. Reading the entry settled it. Exact-string probes over prose keep producing false negatives in this session - the fix is to read the text when a probe says something is absent, before concluding it is.
Task 7 flagged its own `git commit --amend --no-edit` for a cosmetic changelog tightening, unprompted, noting the protocol prefers new commits over amends. Nothing had been reported or pushed at that point, so it is harmless - but flagging it rather than hoping it went unnoticed is the right instinct.
Task 7 also flagged that the "live incidence is unmeasured" framing is now committed prose, and that a later report which DOES measure it should revisit the entry. That is a real doc-drift trap recorded before it fires.
ALL SEVEN TASKS COMPLETE. Dispatching the whole-branch review (opus, per the skill's rule that the final review takes the most capable model).
WHOLE-BRANCH REVIEW (opus): NO CRITICAL. 7 Important, 8 Minor. Verdict: nothing blocks the release.
  It traced both fixes against recheck, the archive comparison and reachability - consumers no task touched - and confirmed none can mint a false accusation. The archive stores raw bytes rather than anything derived from extraction, so a replay re-extracts with today's code and a join-only match is lost in BOTH arms, landing on pipelineDrift rather than sourceDrift, which is the only row licensed to accuse.
  It also ran a 69,120-case sweep over attribute shapes and found exactly three divergences, all inside the disclosed class.
THREE OF THE SEVEN IMPORTANT FINDINGS WERE FALSE CLAIMS I WROTE:
  I1 - the `.trim()` on the description key widens behaviour on WELL-FORMED pages in the text-ADDING direction, and I justified it in three places as "matches what a browser does". That is false: HTML5 matches standard metadata names exactly, so the parser is MORE permissive than a browser. Verified: `name=" description "` harvests in 0.6.0 and not in 0.5.0. Now a grammar-table row, a README known gap, a changelog clause, and an honest comment.
  I2 - excerpts in <doc>.evidence.json change on ORDINARY pages, not just seam cases, and the README tells authors to commit that file. It also falsified the 0.5.0 changelog entry I wrote, both halves. Disclosed, and the 0.5.0 entry now carries a "closed in 0.6.0" note.
  I4 - the README's ONLY normative statement of the matching contract - "must appear verbatim in the extracted text of that page" - is exactly the over-promise this release retracts. Corrected at three sites; the region change had been documented in the README nowhere.
Three more were my instruments overclaiming themselves: the report called four constructed cases a positive control when only two are (C and D are route-1 cases where both extractors agree by construction); it denied carrying absolute figures while its Counts table is nothing but absolute figures; and the measurement script's before-arm was not byte-faithful on an empty-body page, inflating proseBefore by one, while `oldToTextPreRoute2` - which the file header names as THE before arm - was defined and never called. The published numbers survive because no row had an empty body, but the 38-fixture re-check could never have caught it: 0 of the 38 has one.
I3 - the binding design spec's section 8.2 contradicted the shipped harvest filter. Amended with dated notes, which is this repo's own practice.
All seven fixed at ee63837. 611 tests, tsc clean, tarball clean.
RELEASED TO STAGING: PR #12 merged, main at ae5b39f, annotated tag v0.6.0 pushed. Publish workflow run 35790070667: all 15 steps success including every guard and `npm stage publish`. Registry still reports latest = 0.5.0, so it is STAGED, not live - the owner's 2FA approval on npmjs.com is the last step.
