# Plan 2 (harvest) - execution ledger

Preserved from `.superpowers/sdd/2026-09-08-plan-2-harvest/progress.md`, which is
git-ignored scratch and does not survive worktree cleanup, as plans 1, 1.1 and
1.2 preserved theirs. It is the record of what was decided and why: the
pre-flight conflict scan, rulings P1-P3 and T1-R1 through T9-R1 each with its
cost-if-wrong, every task's review and fix rounds, and what was parked. Read it
alongside `2026-09-06-plan-1-core-ledger.md`,
`2026-09-07-plan-1-1-extraction-ledger.md` and
`2026-09-07-plan-1-2-reader-ledger.md` before touching this repository.

**What plan 2 shipped.** `testimonium harvest <doc.md>`, which proposes as
candidate claims the spans a document and a readable read of a source share
verbatim, and writes them to `<doc>.claims.draft.json` - never to
`<doc>.claims.json`. With it: the claim floor refused at all three of the doors
spec 7.3 names; `Document.prose`; `commonSpans` over the repaired offset map;
the four filters in the spec's order; `RuleSet.boilerplate`, shipping empty;
the draft file and its `_note`; and one source for `VERSION`. 281 tests at
`main` to 361 here. **No verdict moved**: `harvest` is a second consumer of the
reader plan 1.2 built, and the only new behaviour `check` has is the claim
floor's refusal, which is disclosed in `CHANGELOG.md` as a breaking change.

**Parked for a future plan**, each carried with its argument rather than
dropped:

- **The astral fold** (plan 1.2's Task 5 minor, re-parked here by ruling P3 and
  by Task 10's ledger line below). `foldWithMap` iterates by UTF-16 unit, so an
  astral character is never case-folded. Fixing it changes a primitive plan 1.2
  stabilised and pinned; harvest, its consumer, fails only in the safe
  direction.
- **The harvest CLI branch has no automated coverage** (ruling T9-R1): 140
  lines inside a non-exported `main()`. Not a regression - the `check` and
  `reachability` branches carry identical exposure and have since plan 1 - and
  the behaviour is verified by two independent manual runs across 13 exit
  paths. Extracting `runHarvest` would be a CLI design change spec 8.2 does not
  license.
- **`dropContained`'s `if (!n) continue`** drops a norm-empty span with no
  `bugs` line. Pre-existing; `dropContained` has no bug channel.
- **Filter 2's reprint cost was not measured.** Spec 8.2 promised the count and
  is amended in Task 10 to say plainly that it was not made, because it needs
  live reads of the frozen drafts' own cited sources. Disclosed in
  `docs/calibration-2026-09.md` under "What was NOT done", beside the host-same
  gap.
- **Spec 6.3's "Below the floor, an accusation stops depending on the list
  naming a wall" headline** (ruling T1-R5): false read standalone, qualified by
  its own paragraph two sentences later, handed to the final whole-branch
  review to triage.
- **`docs/superpowers/plans/2026-09-06-plan-1-core.md`'s measurably false
  sentence** (ruling T1-R7): superseded plan documents are records of what was
  planned on a date, not live claims about the shipped tool, and are left as
  records.
- **Commit `b31d436`'s bare `docs:` prefix** (ruling T2-R2), where the plan's
  own constraint asks for a scope. The message was prescribed by the brief.
- **Per-command flag tables.** `validateFlags` is command-agnostic, so
  `harvest doc.md --fail-on-unreachable` is accepted and ignored exactly as
  `reachability doc.md --fail-on-unreachable` is. Closing it would change all
  three commands and spec 8.2 licenses no such change; it is characterized by a
  test in `test/bin.test.ts` instead, so closing it later is a deliberate edit
  to a red test.

**Two notes on this file as an artifact.** The source ledger below ends with
Task 9's round-1 re-review *dispatched*; its return is not recorded there. Task
10 was dispatched from `3f9a378` with the suite at 361 green, `tsc` clean and
the tree clean, and re-verified all three. And the source's thirteen em dashes
are written here as hyphens, so this file is pure ASCII; nothing else in the
text below is altered.

---

# SDD ledger - plan: docs/superpowers/plans/2026-09-08-plan-2-harvest.md

Worktree `C:/Users/noaho/testimonium-plan2`, branch `feat/plan-2-harvest`,
base `main @ ff71ec8`, plan committed `aa7dc2c` + corrections `ed3cfce`.
Spec: `docs/superpowers/specs/2026-09-06-testimonium-design.md`, section 8.2
is the authority. Plan drafted by Opus, reviewed by Fable (APPROVE WITH
CORRECTIONS, 0 blocking / 3 major / 9 minor), corrections 1-10 applied at
`ed3cfce`. User approved execution 2026-09-08.

Expected test ladder from the plan header: 281 at start; 283, 289, 293, 297,
305, 313, 323, 336, 341, 341 at the end of Tasks 1-10.

## Pre-flight scan

Every pair of tasks sharing a file or an interface, and every task against
itself.

| # | Pair / task | Produced vs consumed | Found |
|---|---|---|---|
| 1 | T2 -> T3 | `THRESHOLDS.minClaimChars` | agrees; T3's `belowClaimFloor` reads it |
| 2 | T2 -> T5 | `THRESHOLDS.harvestSeedChars` | agrees; T5's `seedChars` defaults to it |
| 3 | T2 -> T7 | both constants, via T3's two functions | agrees |
| 4 | T3 -> T7 | `belowClaimFloor`, `claimFloorMessage` | agrees; T3 says explicitly not to stub the third site, T7 wires it |
| 5 | T4 -> T8 | `Document.prose: string` | agrees; T8 passes it as `commonSpans` arg 1 |
| 6 | T5 -> T7 | `SpanResult.spans: string[]` vs `FilterInput.spans: readonly string[]` | agrees (mutable assignable to readonly) |
| 7 | T5 -> T8 | `commonSpans`, `dropContained` | agrees; `dropContained` is deliberately one rule at two call sites |
| 8 | T6 -> T7 | `HarvestSource` as `source` and `others[]` | agrees |
| 9 | T6 -> T8 | `scanSources`, `SourceScan`, `HarvestRead` | agrees |
| 10 | T7 -> T8 | `applyFilters`, `FilterDrops` | agrees; `HarvestProposal.drops` is `FilterDrops` |
| 11 | T8 -> T9 | `harvest`, `HarvestReport`, `buildDraft`, `draftInTheWay`, `writeDraftFile` | agrees |
| 12 | **T2 -> T5, `scripts/calibrate-harvest-seed.mjs`** | T2 writes a REPLICA of `commonSpans` and calibrates `harvestSeedChars` = 21 from it; T5 deletes the replica and imports the shipped function | **FINDING - see Ruling P1** |
| 13 | **T1 -> T10, the spec file** | T1 rewrites 6.3:456-460, the rot paragraph, 7.2:766-768 and the row at :1298; T10 cites 7.3:858-860, 8.2:1052-1054, 13 Q3:1262-1264 by line | **FINDING - see Ruling P2** |
| 14 | T1 -> T3, `test/check.test.ts` | T1 adds the N3 pin using claim "spending rose sharply"; T3 substitutes below-floor literals in the same file | no conflict: norm("spending rose sharply") is 21 chars, over the floor of 16 |
| 15 | T1 -> T7, `src/rules/load.ts` | T1 edits a comment; T7 adds `RuleSet.boilerplate` | different regions, sequential, no conflict |
| 16 | T6 vs "Not touched" list | T6 modifies `src/classify/signals.ts` | licensed: the list says "beyond the one reported field", which is exactly `finalUrl` |
| 17 | T3 vs "Not touched" list | T3 modifies `src/check.ts` | licensed: "beyond its front-door guard" |
| 18 | T9 vs `test/exports.test.ts` | `src/version.ts` re-exported from `src/index.ts` | no new public NAME; existing pin still holds |
| 19 | T7 vs "nothing new becomes public" | `RuleSet` gains `boilerplate` | additive change to an already-exported TYPE, not a new name; plan says so and asks for a ledger line |
| 20 | Each task against itself | tests specified vs code specified; files created vs later touched | consistent in all ten; the test ladder sums correctly (281 -> 341) |

Nothing in the plan mandates something the review rubric treats as a defect:
no test asserting nothing, no verbatim-duplicated logic block (the one
candidate, the containment rule, is explicitly extracted to `dropContained`
for that reason).

Ruling: P1 - Task 5's dispatch carries an explicit acceptance criterion for
the replica swap, which Task 5's own step text lacks - after deleting the
replica and importing the shipped `commonSpans`, re-run
`scripts/calibrate-harvest-seed.mjs` and compare every L's mean and max
against the table Task 2 committed to `docs/calibration-2026-09.md`; if any
cell moves, STOP and report rather than adjusting either number - because
`harvestSeedChars` = 21 was chosen from the replica's output, so a divergence
means the shipped function and the calibrated one are not the same function
and the constant is calibrated against code that never runs. Task 2's script
docstring already states the intent ("re-runs this script to prove the numbers
did not move"), but a Task 5 implementer reads only Task 5's brief. - Cost if
wrong: a needless stop on a benign formatting difference in the table, which
costs one round-trip; the converse, shipping 21 uncalibrated, would not
surface until an author drowned in noise.

Ruling: P2 - Task 10's dispatch instructs the implementer to locate every
spec target by its QUOTED SENTENCE (the plan gives the quote for all nine
items) and to treat the line numbers as stale hints, re-deriving them with
grep - because Task 1 rewrites four spec passages ahead of every line Task 10
cites, so :858-860, :1052-1054 and :1262-1264 will all have shifted by the
time Task 10 runs. - Cost if wrong: none if the numbers happen not to move;
if they do and the implementer trusts them, it edits an unrelated paragraph
of the binding spec or reports the target missing.

Ruling: P3 - the astral-fold item plan 1.2 parked "for plan 2" stays
re-parked exactly as the plan's Decisions section records it, and Task 10
writes the ledger line; no implementer may fix `foldWithMap` - because the
fix changes a primitive plan 1.2 stabilised and pinned, and harvest's only
exposure is a false MISS (a case-differing astral span never matches), never
a false proposal or a false accusation. - Cost if wrong: harvest silently
fails to propose a span whose only difference from the source is the case of
an astral character; no wrong output, one missing suggestion.

## Task log

Task 1: dispatched (sonnet) at BASE ed3cfce; DONE at 6e65c4d, 283 tests
(+2 as the ladder predicts), tsc clean, 0 non-ASCII / 0 NUL on all four
touched files, both mutants reproduced the brief's predicted failures.
Diff: spec 6.3 + the :1298 row + 7.2's rule contract, src/rules/challenge.ts
and src/rules/load.ts comments, and the N3 pin in test/check.test.ts.
Implementer's whole-document sweep reported four further mentions of the
phrasing family (src/rules/hosts.ts, two README passages, one further spec
paragraph) judged already true or correctly scoped and left alone, plus
historical plan/ledger docs deliberately untouched as records. Task review
dispatched (opus) with that judgement called out for verification.

Task 2 pre-check (read-only, 2026-09-08): origin-repository HEAD has moved twice
during this session (5f5f765 -> 8f05ab39 -> 7505dc2; another session
committing, never this one). The three working-tree claims files remain
byte-stable at 5684 / 1839 / 3165 bytes, matching what the planner recorded,
and <pinned origin commit withheld> still resolves for
source-c-claims.json. Task 2's freeze reproduces as planned.

Task 1: review (opus) spec X / quality NOT approved. 2 Critical, 3 Important,
2 Minor, all measured by compiling src/ to a scratch dir and driving check().
C1: challenge.ts:25-27, a falsehood this diff NEWLY introduced (verdict.ts:102
returns supported on matched===total BEFORE the floor at :111, and check.ts:134
skips only vetoed reads, so an unnamed wall's match enters the union - measured
supported quoting the wall's own sentence). C2: spec :482-483, same falsehood,
in the paragraph Step 4 only half-rewrote. I3: :465-466 counterfactual wrong
(the readable read ALONE does produce that unsupported). I4: :792 misattributes
the load.ts comment to C13; git log -S puts it in e4d9f46, plan 1's final fix
wave, C14. I5: the mechanism is isBlocked-wide, not N3's. Minor: :460 "never
judged on its own" (a vetoed read can win via largest); load.ts re-wrap ragged.
Sweep items the implementer judged already-true were independently confirmed.

Ruling: T1-R1 - Important 5 is fixed veto-wide rather than left N3-scoped, and
the N4 paragraph at :535-541 and the decision row at :1323 are widened with it
- because R13 exists to kill a false universal ("the list can never supply an
accusation"), and replacing it with a narrower claim that is still incomplete
("N3 can supply one") lets a reader conclude N1/N2/N4/N5 cannot, which the
reviewer measured false. Same defect class, one paragraph later. The wider fix
costs one sentence in text already being rewritten; the reviewer supplied
positive measured evidence for the wider claim (404 read carrying A + readable
read carrying B -> unsupported, A missed; same body at 200 -> supported). -
Cost if wrong: the spec asserts something broader than R13 asked for, and if
the veto-wide claim were itself false we would have shipped a fourth
falsehood - mitigated by it being measured, not reasoned.

Ruling: T1-R2 - Minor 6 (spec :460 "the vetoed read is never judged on its
own", plus its twin at README:122) is PROMOTED into fix round 1 instead of
being deferred to the ledger as SDD's minor policy would have it - because it
is a false sentence inside the exact paragraph under repair in a task whose
whole purpose is correcting false spec sentences, and the doc-drift rule this
repo learned the hard way says twins are fixed as a pair. - Cost if wrong: one
extra clause in a fix round that was happening anyway; deferring it would have
shipped a known-false sentence out of a doc-correction task.

Task 1: fix round 1/5 dispatched (resumed implementer) with 6 findings.
Deferred minor: src/rules/load.ts:58-60 re-wrap left a ragged short line
(cosmetic; welcome if that hunk is touched for I4, not worth its own commit).

Task 1: fix round 1/5 complete (6 findings addressed by the implementer;
commits 6e65c4d..cb59cbe). 283 tests unchanged (comment/prose-only), tsc
clean, spec + challenge.ts 0 non-ASCII / 0 NUL, excerpt.ts still exactly 57,
tree clean. Implementer flagged README's 3 pre-existing non-ASCII bytes (a
U+2265 at :203) as unrelated to its edit and did not touch them - correct:
the ASCII constraint binds source and test files, and that byte predates
plan 2. Controller independently confirmed the I4 attribution before the
round ran: `git log -S "signature and path rules" -- src/rules/load.ts`
returns only e4d9f46 ("close false comments"), 15 commits after C13's
7a0cf6f ("thread local host rules into the fetcher"), and the plan-1 ledger
:303 names C14 as the fix wave that closed false comments - so C14 is right.
Scoped re-review dispatched (opus) over 6e65c4d..cb59cbe with both controller
rulings called out as things a fix must not quietly narrow.

Task 1: re-review (opus) over 6e65c4d..cb59cbe - all SIX findings ADDRESSED,
each verified by compiling src/ to a scratch dir and driving check(): I5's
veto-wide statement measured across all five vetoes (N1 cf-mitigated, N2
/cdn-cgi/challenge-platform/, N3, N4 404, N5 content-type) each giving
unsupported/A-missed and supported with the veto removed; Minor 6's pair
landed at spec :460 + README:122. No new breakage: 283 green, tsc 0, src/
diff comment-only, byte checks self-proven.
VERDICT findings remain open - two Important whole-document consistency
defects, sentences the NEW text contradicts: (A) spec :485 "The rot argument
survives, but only below the prose floor", falsified by its own paragraph 3
lines later and by :513's definition; (B) src/rules/challenge.ts:13-16
"COMPLETENESS is not what protects a citation", contradicting the new :29-33
in the same comment. Both one clause, wording supplied.

Ruling: T1-R3 - the plan file's own :284 carries the same "ruling C13"
misattribution that Important 4 corrected in the spec; it is DEFERRED to
Task 10 rather than fixed here - because the plan is the artifact every task
brief is extracted from, and editing it mid-execution desynchronises briefs
already extracted from those against the file; Task 10 is the ledger task and
already amends documents. - Cost if wrong: a false attribution sits in the
plan text for the remaining nine tasks, read by nobody who acts on it, and is
corrected before the branch is offered for merge.

Task 1: fix round 2/5 dispatched (resumed implementer) with 2 findings, plus
an instruction to re-sweep 6.3, challenge.ts's header and README 120-125 /
209-250 for sentences its own two rounds falsified - round 1 found one, round
2 found two, so the sweep is now the deliverable rather than the edits.

Task 1: fix round 2/5 complete (2 findings addressed; commits cb59cbe..
7c90321, 9 insertions / 7 deletions across the spec and challenge.ts). 283
green, tsc 0, src/ diff verified comment-only by the controller (0 non-comment
changed lines), both files 0 non-ASCII / 0 NUL. Implementer re-swept spec 6.3
whole, challenge.ts's header whole and README 120-125 / 209-250 and reports
nothing further falsified - that claim, not the two clauses, is what the round
2 re-review (opus) was dispatched to verify independently.

Task 1: round 2 re-review (opus) - Important A and B both ADDRESSED and
measured (sub-floor unnamed wall + readable read -> supported; same wall named
-> unsupported/A missed; padded wall over the floor carrying a signature ->
unsupported, so "below the floor" is load-bearing). No new breakage from the
two-clause diff. But the implementer's "sweep found nothing further" claim was
NOT VERIFIED: one real miss at spec :521-525 ("An accusation stops depending
on the completeness of a list that provably cannot be completed ... listed or
not, English or not, inflected or padded"), falsified by this task's OWN text
at :466-468 and :504-507, and introduced by 6e65c4d - so in scope. Reviewer's
diagnosis of why all three sweeps missed something: "the check ran in one
direction only".

Task 1: fix round 3/5 dispatched (resumed implementer, still sonnet) with 1
finding plus a stated method - for every claim of the form "X does not cause
Y", test X->Y, not-X->Y, and X->not-Y, and give every sentence in this family
its scope on BOTH axes that have bitten (direction: accusation vs attestation;
floor: above vs below). Held at resume rather than escalated to a fresh
implementer because the diagnosed failure is a method blind spot with the
method now named and the replacement wording supplied, not a knowledge gap;
if round 3's re-review still finds a falsified sentence, round 4 escalates to
a fresh opus implementer per the skill.
Deferred minors: challenge.ts:35-36 stale "the"/"either" (one word); plan file
:284 and :315 quote superseded text (routed to Task 10 with T1-R3);
src/rules/load.ts:58-60 ragged wrap.

Task 1: fix round 3/5 complete (commits 7c90321..fcd053a). The stated
bidirectional method WORKED and is worth carrying: run over 15 claims, it
found 2 failures - the reviewer's named :521-525 AND one the sweep found on
its own, challenge.ts:12-16's parallel unscoped "holds for walls nobody has
written down", contradicted by the same above-floor gap. Both fixed with
explicit direction+floor scoping. 283 green, tsc 0, both files 0 non-ASCII /
0 NUL.

REPO HAZARD, recorded for every later task: running
`fixtures/challenge-battery.mjs` has a WRITE side effect - it rewrote 22
tracked fixture files with LF against their checked-out CRLF. The implementer
caught it and reverted with `git checkout -- fixtures/challenge/`. Controller
verified independently: tree clean, no fixture in any plan-2 commit,
`git diff main..HEAD -- fixtures/` empty. Any task measuring against that file
must re-check `git status` before staging.

Task 1: round 3 re-review (opus) - both named fixes ADDRESSED and measured
(spec :521-528 with the battery's 23 cases re-derived WITHOUT running the
write-side-effect script: longest 982 raw chars, largest proseVolume 982, none
>= 4500; challenge.ts:12-16 confirmed a genuine falsehood - an unlisted German
wall padded to ~9000 prose chars, sole read, claims missing -> unsupported).
VERDICT findings remain open: the round's own deliverable, the bidirectional
sweep, returned TWO FALSE PASSES on live user-facing README sentences.
:194-195 "a document under ~4500 prose chars can never read as unsupported" -
false at the CITATION level (302-char notice at node with the claim missing +
any readable curl page -> unsupported; ladder.ts:49 climbs on ANY sub-floor
read, and the disclosed relocation route at :234-243 is scoped to "after a
VETOED one" so it does not cover this). :200-202 "a short page whose claims
are all present still reports supported" - false with an N3 signature or an N1
header (verdict.ts checks isBlocked BEFORE matched===total); the spec twin at
:492 carries the missing word "unvetoed", the README sentence does not.
Reviewer audited 6 of the 15 table rows; 4 confirmed, 2 false. So "exactly two
failures" is understated - at least four.

Ruling: T1-R4 - ESCALATE at round 4 per the skill: fresh implementer on opus
rather than a fourth resume of sonnet - because the diagnosis is no longer a
knowledge gap the method statement could close (round 3 proved the method
works when applied: it found challenge.ts:12-16 unprompted) but a failure to
APPLY it uniformly - two of six audited rows were tested at the verdict()
unit level instead of the check() citation level, which is precisely where
both false passes hid. Three resumes is the skill's own signal that the
implementer cannot see its own problem. - Cost if wrong: a fresh agent
re-derives context the report file already holds, costing tokens and one
round; the report carries three rounds of transcripts, so the loss is bounded.

Task 1: fix round 4/5 dispatched (FRESH implementer, opus) with 2 findings +
a three-axis check (direction, floor, VETO - the axis that produced both false
passes) to be run at the check() level over all 15 table rows, and an explicit
warning not to run the battery script.

Task 1: fix round 4/5 complete (FRESH opus implementer; commits fcd053a..
966e0c3, README.md only, 22+/15-). The escalation worked: 56 check()-level
experiments across direction/floor/veto, all 15 table rows re-run plus 7
sentences the table omitted, NO row resisted a check()-level experiment.
Four failures found and fixed - rows 12 and 13 (round 3's false passes), the
relocation sentence at :234, and :242-243, which the ordered widening itself
falsified (a sub-floor read's matches DO enter the union and drop a claim from
missed, so it is not trace-free the way a vetoed wall is). 283 green, tsc 0,
tree clean, no fixture touched, battery not run, README still exactly 3
non-ASCII (the >= now at :207) and 0 NUL.
Concern 1 (bold markers in the findings file read as literal): resolved by the
controller with no change - README bolds bullet HEADLINES (11 instances) and
the implementer inserted the words unbolded mid-sentence, which is house style.

Ruling: T1-R5 - spec :521-522's headline ("Below the floor, an accusation
stops depending on the list naming a wall") is PARKED, not fixed, and handed
to the final whole-branch review to triage - because it is false read
standalone (measured C1 vs C2: two sub-100-char bodies differing only in
whether the list names the wall give unsupported vs supported) but its own
paragraph states the converse two sentences later, adjacently rather than
buried; two independent reviewers reached the same "scoped, not silent"
judgement; and round 5 is the last available round, which is better spent on a
falsehood nobody has qualified than on re-opening a thesis-then-qualification
paragraph that four reviewers have read. - Cost if wrong: the spec's most
prominent sentence in that paragraph misleads a reader who stops at the bold
text, in a document whose whole defect history is sentences that read true and
are not.

Ruling: T1-R6 - :242-243 was fixed although it appeared in no findings list,
and that is CORRECT rather than scope creep - the doc-drift rule this plan
carries says a change names and fixes every sentence it falsifies, and this
one was falsified by the widening the same round introduced. - Cost if wrong:
one sentence changed outside a findings list, visible in the diff and reviewed
by the round's own re-review.

Ruling: T1-R7 - docs/superpowers/plans/2026-09-06-plan-1-core.md:4148 ("a
one-paragraph official notice will not produce a supported") is measurably
false but stays untouched - because superseded plan documents are records of
what was planned on a date, not live claims about the shipped tool, and round
1 already applied that same rule to the historical ledgers. - Cost if wrong: a
reader mines an old plan for current behaviour and is misled; mitigated by the
document's own header dating it and by plan 2's plan superseding it.

Task 1: round 4 re-review dispatched (opus) over fcd053a..966e0c3.

Task 1: round 4 re-review (opus) - Important 1 and 2 ADDRESSED, independently
reproduced (302-char notice at node + 5200-char readable curl missing the
claim -> unsupported, missed=[spending rose sharply]; 299-char page both
claims present no veto -> supported, byte-twin with a listed signature ->
unreachable). Both self-initiated edits verdicted genuine falsehoods correctly
fixed. Five PASS rows re-tested adversarially, four confirmed, plus an
800-combination enumeration of verdict() yielding zero sub-floor or vetoed
unsupported. New breakage: none Critical/Important.
VERDICT findings remain open - ONE false PASS, row 7: spec :506-507 "There the
list's completeness does bear on truth" is measurably FALSE. signals.ts:169
gates N3 as sigRule !== null && proseVolume(text) < 800, so ABOVE the floor no
list entry can fire; a 5000-char padded wall carrying a listed signature and
its unlisted twin both give unsupported, identical. challenge.ts:37-38 already
says the opposite, so spec and code comment contradict. The implementer's own
row-7 evidence (E1 vs E4) IS the falsifying pair, recorded as confirmatory -
the experiment-set-up-to-agree failure.
Minors in new text, both measurably false universals with wording supplied:
README :248-249 "a sub-floor read leaves one" (false when it matched nothing);
README :199-200 "the ladder climbs on any sub-floor read" (false for a PDF
URL - ladder.ts:44-47, rungsAttempted ["pdftotext"] only).

Ruling: T1-R8 - the spec is UNFROZEN for :506-507 and its dependents only,
overriding round 4's brief which froze it - because the sentence is measurably
false in the binding authority, and worse, round 3 cited it as justification
when rewriting :521-528, so a clause of that paragraph inherits the falsehood.
Leaving it would ship a false spec sentence AND a second sentence whose stated
reason is that false one. - Cost if wrong: a fifth round of edits to a
paragraph four reviewers have read, in the last available round, with the risk
that the fix falsifies a neighbour the way rounds 1-4 each did; mitigated by
requiring the fix as a SET via a grep for the claim in any wording.

Ruling: T1-R9 - the two README Minors are PROMOTED into round 5 rather than
deferred, on the same reasoning as T1-R2 - they are measurably false universal
sentences in text this task itself added, one clause each, wording supplied,
and this is the last round, so deferring means they ship. - Cost if wrong: two
extra clauses in a round that was happening regardless.

Task 1: fix round 5/5 dispatched (resumed opus implementer) - 1 Important + a
dependency trace + 2 Minors. Breaker trips after this round's re-review:
whatever remains open, the controller adjudicates and the task closes.

Task 1: fix round 5/5 complete (commits 966e0c3..6047ffe, spec + README).
All three findings reproduced by measurement, none disputed. Row 7 confirmed
and NARROWED by the implementer's own grid: varying list membership across a
2x3 grid changes the verdict in exactly one of six cells (below the cap,
claims present), boundary exact - 799 extracted chars gives unreachable
listed vs supported unlisted, 800 gives supported for both. Fixed :506-507,
its false "never truth" attribution at :509-510, and round 3's citing clause
at :528. :521-522's headline untouched, its self-qualification intact.
283 green, tsc 0, tree clean, README still exactly 3 non-ASCII, spec 0.
Two pieces of self-correction worth recording: the implementer REFUSED part
of the reviewer's suggested wording ("nothing the LIST says") because N2's
path list has no length gate and the flat universal would have shipped a NEW
false universal into the sentence that exists to remove one - controller
verified independently (signals.ts:156 challengePath: pathRule !== null,
ungated; :169 challengeSignature gated on proseVolume < maxChallengeChars) and
the narrowing to "the SIGNATURE list" is correct. And it found its own first
boundary probe defective - it padded in 75-char units so all three targets
landed on 825 and never straddled 800 - and redid it. That is the
instrument-cannot-express-its-input failure this repo already has a name for,
caught by the agent that ran it.

Ruling: T1-R10 - src/check.ts:93-94 carries Minor B's identical false
universal ("the ladder escalates on ANY sub-floor read", false for a PDF URL
per ladder.ts:44-47). Controller confirmed it by reading the comment. It is
NOT fixed in a sixth round and NOT left silent: it is carried into Task 10 as
an explicit item, because Task 10 is this plan's doc-truth sweep and a code
comment is documentation, and because the fix-loop cap is a process guard that
should not be spent on one word. - Cost if wrong: a false comment sits in
check.ts for eight more tasks, read by implementers of those tasks who might
rely on it; mitigated by it being one word, ledgered, and routed to a task
that must touch the truth of documents anyway.

Task 1: round 5 (final) re-review dispatched (opus) over 966e0c3..6047ffe.
Breaker trips on its return - whatever remains open, the controller
adjudicates and the task closes.

Task 1: round 5 (final) re-review (opus) - Important (:506-510) ADDRESSED,
both traced dependents (:517-520, :545) ADDRESSED, Minor B ADDRESSED. The
narrowing audit came back "correct, necessary, and true as written", with a
knife-edge worth recording: signals.ts:148 sets firedRule ungated and
io/evidence.ts:93 emits it on EVERY verdict, so list membership DOES change
the RESULT above the floor (listed 5005-char wall returns unsupported WITH
firedRule, unlisted twin without) - the sentence is true only because it says
"bear on the VERDICT". The boundary probe was re-derived at 1-char granularity
and is sound: 796-799 flip, 800-804 both supported, strict <, straddles 800.
BREAKER TRIPPED at round 5. Two findings remain open, both new text from the
round-5 diff, plus one flagged residual.

Ruling: T1-R11 - spec :513-515 (the boundary sentence switches claim direction
silently: its antecedent two sentences earlier is a claims-MISSING pair, which
measures unreachable/unreachable at 798-801 and never reads supported, while
the stated flip holds only for a claims-PRESENT pair) is PARKED and routed to
Task 10 with the reviewer's concrete fix - real, measured, not disputed, but
nothing in Tasks 2-9 argues from this paragraph's boundary sentence, and the
fix-loop cap is spent. - Cost if wrong: a false sentence sits in the binding
spec for eight tasks; mitigated by it being routed with its replacement text
already written and by the final whole-branch review seeing this line.

Ruling: T1-R12 - README :248-249 is PARKED and routed to Task 10 with the
corrected condition. This one is MY error to own: the condition I supplied in
the round-5 findings file ("whenever it matched a claim") is itself
insufficient - measured, a sub-floor read matching A followed by a readable
read that ALSO matches A is byte-identical to its vetoed twin in verdict,
missed, rungsAttempted and evidence, so it leaves no trace despite having
matched. The true condition is "whenever it matched a claim NO READABLE READ
CARRIED". - Cost if wrong: a weaker over-claim ships in the README; the
correct wording is already measured and recorded here.

Ruling: T1-R13 - spec :545's "no list entry could have prevented" gets the
same one-word narrowing as :506-510 ("no SIGNATURE-list entry"), routed to
Task 10 - because a CHALLENGE_PATHS entry does prevent exactly that accusation
above the floor (measured: same wall, /captcha/ finalUrl -> unreachable), so
the clause over-generalises the very support it cites. Same asymmetry the
implementer diagnosed and did not carry across to the clause it was fixing. -
Cost if wrong: one word wrong in a sentence that is true existentially.

Task 1: complete (commits ed3cfce..6047ffe, 3 parked). Five fix rounds, 15
findings closed, 0 executable lines changed, 283 tests throughout, tsc clean,
tree clean, README exactly 3 non-ASCII / spec 0 / no NULs. Carried into Task
10: T1-R11, T1-R12, T1-R13 and T1-R10 (check.ts:93-94's "ANY sub-floor read").

Task 2: dispatched (opus) at BASE 6047ffe; DONE_WITH_CONCERNS at f196986 +
b31d436. 289 tests (+6, ladder predicted 289), tsc clean, tree clean. All four
new scripts/source/test files 0 non-ASCII / 0 NUL; all five fixtures 0
non-ASCII (recorded, not required). Constants: minClaimChars 16 (observed
ceiling 12, margin 4, refuses 18/208 = 8.7%) and harvestSeedChars 21 (rule
rejected L=20 at mean 1.2 emitted spans per unrelated pair, accepted L=21 at
0.9; maxima 9 vs 5). THE CEILING DID NOT REACH THE FLOOR - the stop-condition
did not fire - and every re-derived number matched the brief digit for digit.
All three acceptance-test mutations watched to fail with predicted messages
before restore.
Controller verified the freeze reproduces exactly: the source-c blob is
e03e28ff6bf3727810ce52b9fdb05898a13e6171 at the pinned ref
<pinned origin commit withheld>, at that branch's CURRENT tip 78d3aa9
(now 10 commits on), and in fixtures/claims/ - all three identical. Pinning the
ref rather than the branch name is what made this checkable.
Read-only boundary held: origin-repository carries 2 dirty files
(docs/bulletin-process.md and a 2026-09-09 worklog) which are that session's
own bulletin work, no claims file dirty, our worktree clean, and our `git show`
reads left no trace.
Concern (implementer): two classification rows differ from the brief's
illustrative lists - "the wikimedia foundation" moved to chance (furniture on
Wikipedia, article prose on The Verge, per the brief's own conservative
tie-break) and "freedom of information" added as boilerplate; split still
12/20. Handed to the reviewer to judge on the evidence.
Task 2 review dispatched (opus) with instructions to re-derive every number by
running both committed scripts and to audit the measurement itself, not only
its output.

Task 2: review (opus) - spec compliance PASS (all 14 steps, exact file set,
both scripts byte-identical to the brief, nothing new public, scripts import
../dist relatively). Quality NOT approved pending 4 doc fixes; NO number
changes. The reviewer re-derived EVERY figure from the committed scripts on a
fresh build and all reproduce: 210/208 claims, 70/20/89/31 per file, ceiling
12, floor 16, margin 4, 18/208=8.7%, the full mean/max table (2.0/2.2/1.2/0.9/
0.3, max 15/19/9/5/2), L=21 population 32 vs L=20's 43, longest span 27 at all
9 swept L, the 32-row table, doc non-ASCII 181. It also audited the
MEASUREMENT empirically rather than by reading: fed the walker a probe with
_note / {notApplicable} / nested _why (3 strings, 0 spurious) plus a negative
control with the keys de-underscored (6 strings, 3 spurious, ceiling 66, STOP
branch fires); confirmed raw L-gram counts are 12.7/10.1 against the script's
1.2/0.9, so it genuinely measures emitted spans and not seeds; confirmed the
selection rule is stated at line 17 and the first console.log is at line 132,
so the rule precedes its output. Both changed classification rows judged right,
and the split shown not to be an input to either constant.

Important 1, and it is a real surprise: docs/calibration-2026-09.md:~654 "Only
the chance rows bear on either number" is FALSE and materially so. The rule
counts every emitted above-floor span; re-running the sweep with the 12
boilerplate rows excluded drops L=20 to 0.7 and the rule picks 20, NOT 21. So
harvestSeedChars=21 exists BECAUSE boilerplate was counted, while that same doc
and thresholds.ts:162 say boilerplate is "filter 2's job, not this number's".
The number stands (an author must read boilerplate too, so counting it is
right); the description of its dependency was wrong.
Important 2: the doc claims the acceptance test's "six assertions were each
shown to fail" - only FIVE were. Assertion 1, the VACUITY GUARD, was never
exercised: the guard against this repo's most-repeated defect (a check that
passes because it never ran) was itself untested.

Ruling: T2-R1 - Minors 3 and 4 (thresholds.ts:112-115's present-tense claim
that the floor is refused at three entries when no src/ consumer exists yet;
provenance.json recording no size for the three working-tree files) are
PROMOTED into fix round 1 rather than deferred - because Minor 3 is a false
present-tense sentence in NEW source text, which is the exact class this plan
keeps paying for, and Minor 4 is three integers the reviewer already verified
that turn an unverifiable provenance record into a checkable one. - Cost if
wrong: two extra one-clause edits in a round that was happening anyway.

Ruling: T2-R2 - commit b31d436's missing scope ("docs:" not "docs(calibration):"
against the plan's own conventional-prefix constraint) is PARKED, not rewritten
- because the message was prescribed by the brief the implementer was given,
the commit is already in history, and rewriting it to fix a prefix would
rewrite a commit whose content four checks have validated. - Cost if wrong: one
commit in this branch's history has a bare docs: prefix; visible, harmless,
and noted for the final review.

Carried forward, NOT a Task 2 defect: scripts/calibrate-harvest-seed.mjs:44-51
keeps only the FIRST occurrence of each L-gram in seedIndex. If Task 5's
shipped commonSpans indexes ALL occurrences, the sweep numbers move and 21 may
not be the L the rule picks. This goes into the Task 5 brief beside ruling P1's
replica-swap acceptance criterion - two reasons the same re-run can diverge.
Carried to Task 9: the reviewer's warning that test/exports.test.ts asserts
only that six named internals are ABSENT - it does not pin the full export
list, so the plan's "nothing new becomes public" constraint rests on a weaker
pin than it assumes. Task 9 touches that file.

Task 2: fix round 1/5 dispatched (resumed implementer) with 4 fixes.

Task 2: fix round 1/5 complete (commit b31d436..8fd3936; doc + provenance +
thresholds docstring, 50+/11-). Constants unchanged: 16 and 21. Three results
worth keeping:
(a) The implementer re-derived Important 1 BEFORE rewording and confirmed it -
boilerplate-excluded sweep gives L=20 mean 0.7, L=21 0.5, rule picks 20. Doc
and docstring now say the rule counted every emitted span and that this is
load-bearing; the excluded table and its recipe are recorded and labelled as
not the shipped measurement.
(b) It found a THIRD instance of the same falsehood that neither the review nor
my findings file cited - "a chance span counted as boilerplate would flatter
the seed length" presupposed exactly what was disproved. The twin rule working
without being told.
(c) Important 2 took the harder route: with the four claims fixtures moved
aside, assertion 1 fails `expected 0 to be greater than or equal to 200` - and
THREE of the other five assertions PASS VACUOUSLY on an empty population, now
stated in the doc. That is the acceptance test being weaker than it looked, and
it vindicates the design: assertion 1 is the guard that makes the other three's
vacuity unreachable. Restored, with git status / diff / diff --cached all
verified empty before staging.
Minor 4 closed a trap the controller verified independently: git stores two of
the three fixtures LF, so `git cat-file -s` reports 5591 / 1789 / 3165 where
the worktree reports 5684 / 1839 / 3165. A reader checking the recorded size
with git plumbing would have concluded the fixture diverged. The doc now names
both and keeps "a size is weaker evidence than a commit".
Task 2: round 1 re-review dispatched (sonnet - the heavy re-derivation is done
and the scope is four named fixes) with instructions to re-derive the
boilerplate-excluded table and to re-verify the vacuity claim and the restore.

Task 2: round 1 re-review (sonnet) - all FOUR findings ADDRESSED, every number
re-derived independently (boilerplate-excluded L=20 0.7 / L=21 0.5 matching the
doc; the vacuity transcript reproduced exactly, including which three
assertions pass vacuously, that the cost assertion fails on NaN and the
seed-length one is data-independent; restore verified by hash-object against
HEAD blobs on all four fixtures; grep confirming no src/ consumer of either
constant). Third-instance rewrite confirmed a genuine falsehood correctly
fixed. Constraints all pass: 289 green, tsc clean, exactly three files touched,
index.ts and exports.test.ts untouched, doc non-ASCII 181, no NULs, instrument
self-proved.
VERDICT findings remain open - ONE new doc-precision gap, found by the reviewer
following the doc's recipe LITERALLY rather than trusting it: :711-712 says
"the 12 spans above removed" but the actual exclusion was
`BOILER_ASCII.has(k) || /[^\x00-\x7f]/.test(k)` - 11 named ASCII strings plus
ANY non-ASCII span. Literal recipe reproduces 8 of 9 values but gives 1.8 at
L=16 against the doc's printed 1.7, because "espanol francais" (1 pair) exists
at L=16 and only the broader rule removes it. Under the true rule all 9
reproduce. Load-bearing L=20/21 claim unaffected and true.
This is the plan's first-order constraint failing in miniature: every number
comes from a command run that day and the command is named beside it - here the
named command and the printed number disagree. Worth noting the cheaper
reviewer caught it precisely BY following the recipe instead of re-deriving
from the code.

Task 2: fix round 2/5 dispatched (resumed implementer) - one reword of the
recipe to the true rule, plus a re-run confirming all nine values reproduce
from the recipe AS WRITTEN.

Task 2: fix round 2/5 complete (commit 8fd3936..185abf9, doc only, 15+/5-).
The implementer re-derived the finding before accepting it: enumerated
non-ASCII spans at every swept L and found "espanol francais" (1 pair, 16
chars) exists at L=13 and L=16 only, while the doc's table is taken at L=21 -
which is exactly why it never appears among the 12 listed. Running both recipes
side by side reproduces the reviewer's number: table-12 gives 1.8 at L=16, the
true rule 1.7, all eight other values identical. The doc now states the real
rule and additionally names the span and the 1.8/1.7 divergence, so the rule's
necessity is legible rather than asserted.
Two process details worth keeping: it built the reproduction check WITH A
NEGATIVE CONTROL (the old table-12 rule must fail it), which is the
pipe-masked-exit-codes lesson applied without being told; and its first
comparison returned a false MISMATCH on identical values because the doc line's
trailing " at" glued onto 0.0 - caught and fixed rather than waved off. It also
deliberately did NOT touch the harvestSeedChars docstring, which names only
L=20 where both recipes give 0.7, so the sentence is true under either reading.
Controller verified: doc non-ASCII 181 -> 185, the 4 bytes accounted for by the
n-tilde and c-cedilla now in the text; tree clean; no throwaway scripts left
behind (5 in scripts/, the 2 committed plus the 3 pre-existing).
Task 2: round 2 re-review dispatched (sonnet) - re-derive the nine values from
the recipe AS WRITTEN, confirm the negative control actually fails, and account
for the byte delta.

Task 2: round 2 re-review (sonnet) - ALL FINDINGS ADDRESSED. Every point
independently re-derived with the reviewer's OWN twin script rather than from
the transcript: the recipe as written reproduces all nine values
(1.5/1.7/0.7/0.5/0.3/0.2/0.1/0.1/0.0 at L=13..30, exact match); the negative
control genuinely fails (old table-12 rule gives 1.8 at L=16, and the
programmatic string comparison returns True for the true rule and False for
table-12 on the same instrument, so it is non-vacuous in both directions); the
4-byte delta is exactly the n-tilde and c-cedilla on the single added line
carrying any non-ASCII; only the doc changed; both constants unchanged; and the
docstring's L=20 sentence is true under either recipe because the two diverge
only at L=16, which it never mentions. No new breakage.
The reviewer itself hit the escape-round-trip hazard while building scratch
tooling (JS \x00 in a heredoc-embedded literal became a real NUL at parse
time), rebuilt with char-code comparison, verified 0 NULs and deleted the
scratch. Not a repo defect - but it is that memory's hazard reproducing in a
third independent session, which is worth noting.

Task 2: complete (commits 6047ffe..185abf9, review clean). 289 tests, tsc
clean, tree clean. Constants shipped: minClaimChars 16, harvestSeedChars 21.
Carried forward to Task 5: seedIndex keeps only the first occurrence of each
L-gram (two independent reasons the re-run can diverge, with ruling P1's
replica swap). Carried to Task 9: exports.test.ts pins only six absent names.
Carried to Task 10: spec 8.2's "chance L-gram matches" wording and its
24.8/5.0/0.9/0.2 figures still need an owner.

Task 3: dispatched (sonnet) at BASE 185abf9; DONE at 315e13b. 293 tests (+4,
ladder predicted 293), tsc clean, tree clean. Diff: src/io/claims.ts (the two
new functions + loader site), src/check.ts (front door), the 16 literal
substitutions across three test files, plus README and CHANGELOG. Controller
verified: src/index.ts and test/exports.test.ts NOT in the diff, all touched
files 0 non-ASCII except README at its pre-existing 3, excerpt.ts still exactly
57, no NULs, instrument self-proved.
Implementer judgement worth keeping: it wrote "U+200B" as literal text in a
src/check.ts comment rather than embedding the character, because embedding it
tripped an escape-round-trip corruption that its own byte-check caught - and it
then had to restore CRLF after the fix. That is the escape-roundtrip-hazard
memory reproducing for the FOURTH time in this project, now inside a task that
was warned about it.
Its doc-drift sweep found spec 7.3's "203 vs 208" population drift to be
pre-existing and already parked for Task 10, and left it alone rather than
widening scope - handed to the reviewer to verify rather than accept.
Task 3 review dispatched (sonnet) with instructions to compute norm(x).length
for every claim literal rather than eyeballing the substitutions, and to mutate
the floor predicate at both sites to prove the new tests discriminate.

Task 3: review (sonnet) - spec PASS, quality APPROVED, ZERO findings. First
task to pass its first review. Mutations all behaved: check("...", [123]) with
a fetcher that throws if called returned TypeError "claim at index 0 is not a
string" with zero fetches, so norm() is never reached on a non-string; flipping
< to <= in belowClaimFloor failed exactly the two at-the-floor tests and no
others; norm(x).length computed in Node for all 9 distinct replacement literals
came out 21-34, no borderline case, and "spending rose sharply" correctly left
alone. Doc-drift sweep verified rather than accepted: the spec 7.3 203-vs-208
drift is confirmed pre-existing (present in task-2 artifacts before Task 3
touched anything) and correctly parked; the CHANGELOG's claim that the two
spurious matches are both among the 18 refused checks out ("SAUDI ARABIA" 12
chars, "169" 3 chars, both under 16); and a grep for the old "empty or
whitespace-only" validation language across all .md found no stale twin.
Reviewer's note worth carrying: the new boundary tests build both the refused
and the accepted literal FROM THRESHOLDS.minClaimChars rather than hardcoding
15/16, so they cannot go stale if Task 2's calibrated number ever moves. That
is the pattern later tasks should copy for anything keyed to a constant.

Task 3: complete (commits 185abf9..315e13b, review clean). 293 tests.

Task 4: dispatched (sonnet) at BASE 315e13b; DONE at 7ed80c4. 297 tests (+4,
ladder predicted 297), tsc clean, tree clean, 3 files touched (adapters source,
types, adapter test), all 0 non-ASCII / 0 NUL, excerpt.ts still 57, neither
index.ts nor exports.test.ts in the diff. Document gains `prose` additively -
an existing exported TYPE gaining a field, not a new exported name.
The F17 discriminator was watched to fail with its predicted message and then
restored, with git diff --stat confirming only the intended change survived -
so the continuation-leak hazard is demonstrated reachable rather than argued.
Doc-drift sweep found nothing falsified; spec 8.2 step 1 had already described
this behaviour correctly, which is the first task in this plan where the spec
was ahead of the code rather than behind it.
Task 4 review dispatched (sonnet) with instructions to verify the shared-regex
requirement IN THE CODE rather than from the report (a second regex, a copied
literal or a reordered pass all count as divergence even with tests green), to
reproduce the discriminator itself, and to probe four edge cases the tests may
have missed: a definition at EOF with no trailing newline, an unclosed fence, a
continuation containing what looks like another definition, and CRLF input.

Task 4: review (sonnet) - spec PASS, quality APPROVED with one Minor. The
shared-regex requirement was verified IN THE CODE as instructed: prose is
`text.replace(DEFINITION, "")` on literally the same `text` variable
(post CRLF-normalize + blankFencedCode) and the same DEFINITION regex OBJECT
the footnote loop reads - not a copy, not a second regex. Reviewer reproduced
the F17 discriminator independently (exact predicted message, restored, diff
empty), mutation-checked two further tests (both discriminate), and probed all
four edge cases I asked for - EOF without trailing newline, unclosed fence, a
continuation containing a look-alike [^2]: line, and CRLF input - finding no
divergence between prose and the footnote loop in any of them.

Ruling: T4-R1 - the Minor is PROMOTED into a fix round rather than deferred to
the ledger, on the same reasoning as T1-R2 / T2-R1. The test at
test/adapters/gfm-footnotes.test.ts:143-159 names blankFencedCode but does not
discriminate it: the reviewer removed blankFencedCode from the derivation
ENTIRELY and the test still passed, because its fixture puts a [^9]:-shaped
line inside the fence and DEFINITION is ^-anchored, so it strips that line with
or without fence blanking. Both assertions hold by coincidence. The
implementation is correct - only the guard is broken. - Cost if wrong: one
extra round for a single fixture; the converse ships a test that will not fire
when someone later edits the derivation, which is this repo's named worst
failure class (a check that reports success without running).

Task 4: fix round 1/5 dispatched (resumed implementer) - add a fence fixture
with non-DEFINITION-shaped content, then run the same mutation and watch the
amended test fail before restoring.

Task 4: fix round 1/5 complete + re-review (sonnet) ADDRESSED. The reviewer
re-ran the mutation itself: bypassing blankFencedCode makes the amended test
fail at the NEW assertion with `expected '...' not to contain
'https://example.com/leaked-if-not-blanked'`, and the received output shows the
raw fenced block leaking into prose. The new fixture line starts with `//` so
it cannot match DEFINITION - the failure is attributable to fence-blanking
alone. Point 3 matters most: the old [^9]:-shaped line is still in the fixture
and its assertion STILL passes under the mutation (DEFINITION strips it
regardless), but the test now fails anyway, on the new assertion,
independently. The coincidence is present but no longer load-bearing.
Task 4: complete (commits 315e13b..1938ffa, review clean after 1 fix round).
297 tests.

Halfway state: 4 tasks closed, 13 commits over main, 281 -> 297 tests, the
ladder hit its predicted count at every task (283/289/293/297), no verdict
moved, public surface untouched, every calibration number reproducing from a
named command.

Task 5: dispatched (opus) at BASE 1938ffa; DONE_WITH_CONCERNS at 2842762. 305
tests (+8, ladder predicted 305), tsc clean, tree clean, 5 files, all 0
non-ASCII / 0 NUL (calibration doc legitimately 185), excerpt.ts still 57,
public surface untouched, replica gone from the sweep script and the shipped
commonSpans imported.

RULING P1 SATISFIED - THE CALIBRATION TABLE DID NOT MOVE. Every cell
byte-identical against the committed block, the comparison itself given a
negative control that correctly reported a moved cell, and the 32 above-floor
spans at L=21 and 43 at L=20 reproduce span-for-span with pair counts. So
harvestSeedChars=21 is now calibrated against the code that ships rather than
against a replica of it, which is the entire reason the swap was scheduled.
Controller verified the doc's table CELLS are untouched - the 24-line change is
the swap record plus the seedIndex measurement, nothing numeric.

Three results worth keeping:
(a) THE PLAN'S OWN FIXTURE WAS WRONG. The brief's Step 5 fixture cannot pin
self-validation assertion 3: under a reverted offset map it fails on assertion
2 ("not found in the document"), so the test would have passed with assertion 3
DELETED. The implementer caught it, replaced the fixture with one whose shared
tail makes assertions 1 and 2 both pass so assertion 3 fires alone, and kept
the count at 8. A defect in the plan, found by the implementer executing it.
(b) The first-occurrence seedIndex was kept DELIBERATELY after measuring both
variants on the same 45 pairs: identical at L = 20,21,22,23,24,25,30 - the
whole band the rule ranges over - and differing only at L=13 (2.2 vs 2.0, max
20 vs 15) and L=16 (2.3 vs 2.2, max 21 vs 19), where indexing every occurrence
finds MORE. So the choice cannot move harvestSeedChars, and its exposure is a
miss at seed lengths this tool does not ship. The brief's justification for it
("the containment drop removes what it would add") is measurably FALSE and the
shipped docstring now says so.
(c) CROSS-TASK DRIFT THAT TASK 3'S SWEEP MISSED: src/classify/thresholds.ts
still claimed "no src/ consumer" after Task 3 wired src/io/claims.ts as one,
and mis-attributed harvest's floor filter to Task 5 rather than Task 7. Task 5
fixed both under the whole-document rule. Evidence that a per-task sweep can
miss a sentence its OWN task falsified - the reviewer is checking for further
standing twins.

Forward note for Task 7: phraseFound(sourceText, span) re-normalizes the whole
source per candidate (sweep 34s vs ~11s assertion-free). Negligible at L=21,
but spec 8.2's "norm once per read" is a requirement on the FILTERS - carry it
into the Task 7 brief.
Task 5 review dispatched (opus).

Task 5: review (opus) - spec PASS, quality approved with fixes. No Critical.
Independent re-derivation confirmed everything load-bearing: all 9 calibration
rows byte-identical (negative control perturbing 0.9->0.8 correctly reported a
difference); the doc's 32-row hand-classification table SET-EQUAL to the
script's spans with no pair count moved (negative control flagged a planted
3-vs-4); whole sweep 1724 spans, 0 bugs; and the seedIndex comparison
reproduced cell for cell after the reviewer reimplemented BOTH variants against
the shipped primitives and checked its first-occurrence column against the
shipped output as a control. Assertion 3 verified BOTH ways: the brief's
original fixture fails on assertion 2 ("not found in the document") one check
early, and the committed fixture under the same reverted map produces the sole
bug "offset map round trip failed" - and with assertion 3 short-circuited, the
shifted span IS emitted. Five mutation probes confirm snap, collapse,
containment and source-typography all discriminate.

Ruling: T5-R1 - Important 3: spec 8.2 step 3's "norm(text) ... is not
recomputed per span" is falsified by phraseFound re-normalizing the whole
source and document per candidate. FIX THE CODE, NOT THE SPEC - the spec is the
authority, the hoist is behaviour-identical, and amending an authority because
the implementation disagreed with it is backwards when the implementation is
the cheaper thing to move. The task report had argued the sentence is "scoped
to the filters"; it sits in step 3 (commonSpans), not step 5, and its final
clause is unconditional - the citation resolves, the reading does not, which is
[[spec-claims-vs-citations]] exactly. - Cost if wrong: a behaviour-identical
edit to hot code late in the task; mitigated by re-running the calibration
sweep afterwards, where any behavioural change shows up as a moved cell.

Ruling: T5-R2 - HOW to fix Important 3: hoist normSource/normDoc and inline the
includes, but PIN the equivalence (assert the hoisted form and phraseFound
agree over cases including case-folding and U+00AD, which norm deletes) -
because the obvious hoist inlines phraseFound's body, which is a memoization of
one rule if pinned and a second definition of it if not, and a second copy of
the matching rule is the drift this repo keeps paying for. src/text/normalize.ts
stays untouched: src/text/** is on the plan's not-touched list and this fix does
not need it. - Cost if wrong: one extra test; without it, a later change to
phraseFound or norm diverges silently from spans.ts.

Ruling: T5-R3 - Important 1 (a lone high surrogate reaching the author with
bugs: [], when two texts diverge between the halves of an astral character) is
FIXED IN spans.ts, which does NOT reopen the parked foldWithMap item (P3) -
because the defect is in this task's own end-snap, not in the fold, and the fix
is two trim loops in new code. It is a latent false MISS with zero corpus
occurrences, but an undiagnosable one: the span round-trips to a replacement
character, so a claim confirmed from it can never match the page. - Cost if
wrong: two loops in a hot path, covered by the calibration re-run.

Ruling: T5-R4 - Minors 4, 5 and 6 all PROMOTED into round 1 (the seed-default
test passes for any default in 1..72 so it pins nothing; assertion 3's
discrimination is proven only in a report, not the repo; and the empty-slice
path drops a span SILENTLY, violating this task's own dropped-AND-reported
contract) - same reasoning as every promotion in this plan: a guard that cannot
fire is not a minor blemish. - Cost if wrong: three small edits in a round that
was happening anyway.

Task 5: fix round 1/5 dispatched (resumed implementer) with 6 findings.

Task 5: fix round 1/5 complete (commits 2842762..b3a5c12, +256/-18 across
spans.ts and its test). 313 tests (305 + 8: one each for Important 1, 3 and
Minor 4, five for Important 2), tsc clean, tree clean, both files 0 non-ASCII /
0 NUL re-checked after writing the surrogate escapes, excerpt.ts still 57,
index.ts and exports.test.ts untouched, src/text/normalize.ts untouched.
CALIBRATION STILL IDENTICAL after the Important 3 hoist - diff -u reports
IDENTICAL against the committed rows, the 32-span set and pair counts still
set-equal, 1724 spans / 0 bugs, each check given a negative control shown to
fail. Sweep time 33.9s -> 14.5s, so the spec's performance sentence is now true
AND cheaper. T5-R1/R2 landed as ruled: controller verified phraseFound's six
remaining mentions in spans.ts are all comments documenting the memoization and
pointing at the equivalence test - zero executable calls.
Every new guard was watched to fail: deleting the surrogate loops fails the
astral test with the replacement character; neutering dropContained's
replacement branch fails two new tests; seedChars=5 fails the new
seed-from-below test while the OLD seed test stays green (confirming Minor 4's
diagnosis that the old one pinned nothing); de-normalizing the hoisted haystack
fails the equivalence test; and the Minor 6 guard now reports "offset map
shorter than the span: folded [18, 108) of 108, map length 107" where it was
silent.
The implementer accepted the T5-R1 ruling explicitly and recorded in its report
that its "scoped to the filters" reading was wrong.

TWO SELF-CATCHES worth carrying beyond this task:
(a) A MUTATION THAT REPORTED A FALSE PASS. A sed pattern containing a
backslash-u escape matched nothing, so the mutation never applied and the test
"passed" against UNMUTATED code. Redone in Python with a delete-count
assertion. This is the escape-roundtrip hazard and the
check-that-reports-success-without-running defect in one event - the sixth
escape incident in this project, and the first where it corrupted a
VERIFICATION rather than a file. Mutation testing needs its own negative
control: assert the mutation actually applied before trusting the result.
(b) A false claim it nearly shipped in the new bugs docstring ("every continue
pushes a line first" - the e <= s branch legitimately does not). Caught by
checking rather than asserting; the docstring now states the exception.
Task 5: round 1 re-review dispatched (opus).

Task 5: round 1 re-review (opus) - ALL SIX FINDINGS ADDRESSED, each verified by
construction rather than from the report. Highlights: the reviewer built the
astral divergence itself and additionally found a real case for the SECOND trim
loop (U+1F4C8 vs U+1F8C8, shared trail unit -> bare low surrogate at the
start), confirming both loops earn their place and that a complete pair inside
a span is untouched; neutering dropContained's replacement branch fails exactly
the two new tests and leaves the other 311 green, confirming the branch was
dead to the suite before; and drifting phraseFound itself to a wrong definition
fails ONLY the equivalence test, which proves that pin is a genuine memoization
guard rather than collateral coverage. Its own calibration re-run: all 11 lines
byte-identical, 32-span set and pair counts set-equal, 1724 spans / 0 bugs,
runtime 13.1s, negative controls firing on both checks.

CORRECTION TO MY OWN EARLIER LEDGER ENTRY: I wrote that each mutation in the
fix round was "given a negative control shown to fail". The re-reviewer
re-applied all five mutations itself with count assertions and git-diff proof
and found every one genuinely applied - the substance holds - BUT the report's
table carries no counts while its prose claims it does. My entry inherited that
over-claim. The mutations are sound; the artifact does not show what it says it
shows.

Deferred minors (to the final whole-branch review):
- src/harvest/spans.ts:26-30 attributes the `e <= s` branch solely to "the
  word-boundary snap consumes the whole match", but this round's two surrogate
  trims and the pre-existing space trims also feed it. Incomplete, not false;
  one clause. Reviewer confirmed there is no stale-index bug behind it.
- dropContained's `if (!n) continue` drops a norm-empty span with no bugs line.
  Pre-existing, unchanged by this diff, and dropContained has no bug channel.
- Task 5's report over-claims that its mutation table carries change counts.

Task 5: complete (commits 1938ffa..b3a5c12, review clean after 1 fix round,
3 deferred minors). 313 tests. harvestSeedChars=21 now calibrated against the
shipped commonSpans, proven by an independent re-run.

Task 6: dispatched (sonnet) at BASE b3a5c12; DONE at 9e35141. 321 tests, tsc
clean, tree clean. check() confirmed byte-identical: signals.ts shows only the
additive finalUrl field and its return line, and test/check.test.ts is 36/36
with its pre-existing redirect pin unmoved. The F1 mutation
(isReadable -> !isBlocked) was proven APPLIED via a count-asserted Python edit
before the resulting red test was trusted - the lesson from Task 5's false-PASS
sed carried forward by the implementer without being told twice.

TWO CONTROLLER ERRORS, both caught by the implementer:
(1) I dispatched Task 6 pointing at task-6-brief.md, which I had never
extracted - I ran the extractor for tasks 1-5 only. The implementer worked
directly from the plan's Task 6 section (:2073-2470), spec 8.2 and Fable's
review, cross-verifying every interface it consumed, and flagged the gap rather
than improvising silently. Brief now extracted (399 lines) so the reviewer has
the requirements.
(2) I told it to expect 323 tests. Wrong: I misread the header ladder by one
position. The ladder's Task 6 value is 313, not 323 - and the suite was ALREADY
at 313 because Task 5's FIX ROUND added 8 tests the ladder never anticipated.
313 + Task 6's 8 specified tests = 321, exactly what it produced. Verified
independently: the plan's Task 6 section contains exactly 8 it() blocks and no
it.each/test( forms, and the commit added exactly 8. The implementer refused to
pad to my number and counted from the plan's own code instead, which is the
correct behaviour and the reason the discrepancy surfaced at all.

Ruling: T6-R1 - the header ladder is NOT the authority for expected test counts
from here on; the task's own specified it() count added to the current actual
total is. The ladder was written before any fix round existed and cannot
account for tests those rounds add - it is now +8 behind reality and will drift
further with every promoted finding. Forward counts by that rule: T7 321+10=331,
T8 +13=344, T9 +6=350, T10 +0=350, each before its own fix rounds. - Cost if
wrong: an implementer reconciles against a number that is merely stale rather
than investigating a real missing test; mitigated by requiring the it()-count
derivation in each remaining dispatch.

Task 6: review (opus) - spec PASS, quality APPROVED. THE KEYSTONE HOLDS,
verified three ways: sources.ts:118 filters on isReadable with isBlocked
appearing only in a doc comment; the F1 mutation was proven applied by
count-asserted Python AND git diff --unified=0 before its red was trusted; and
the reviewer built a construction probe beyond the tests - a body passing all
five vetoes at 4000 < proseVolume < 4500 gave sources: [] and an unreachable
entry, with a POSITIVE control at 50x producing 1 source, so the probe could
have failed. check() byte-identical: corrupting finalUrl moved exactly 2 tests,
neither in check.test.ts, which is 36/36 in isolation. Seven discrimination
probes all red as named, each mutation proven applied.

Ruling: T6-R2 - Important 1 (four mutations to the HarvestSource payload leave
the suite fully green, including replacing norm(r.computed.text) with
unnormalized text) enters the fix round even though it is a PLAN-level gap
rather than an implementer omission - because the seam is live: Task 7's
frequency filter reads normText (spec 8.2 step 3 names it), so an unnormalized
normText silently under-drops boilerplate and puts a wrong proposal in front of
the author with nothing going red. [[review-seams-not-modules]] is the memory
this instantiates. - Cost if wrong: one test pinning a payload that was already
correct.

Ruling: T6-R3 - Important 2 (the F1 test asserts only that its stub is
sub-floor, so if that fixture ever gains a veto the test passes vacuously under
EITHER predicate) enters the round - because a test that can silently stop
testing the plan's single most dangerous failure is worth more than the one
line it costs. - Cost if wrong: one redundant assertion.

Ruling: T6-R4 - Minor 3 (unreachable drops the pdfUrl signal, so a PDF citation
on a machine without pdftotext is indistinguishable from a wall) is fixed NOW
rather than deferred - spec 8.2 step 2 requires only rungsAttempted so the code
is compliant, but Task 8 renders this report and "we could not read it" versus
"this machine cannot read PDFs" are different messages to an author. Cheaper
here than for Task 8 to discover it missing. - Cost if wrong: one field on an
internal type.

CONTROLLER ERROR 3, and a PLAN DEFECT it uncovered. My review brief listed the
at-most-one-readable-read characterization as a Task 6 requirement; it is
Task 8's (plan :3220, inside Task 8's section, and Fable's plan-review ruling 4
assigns it there). Not a gap - a brief error, and the reviewer caught it.
More seriously, the reviewer found that the plan's Global Constraint at :20 -
"All source and test files are pure ASCII ... The one standing exception is
src/text/excerpt.ts" - IS ALREADY FALSE OF THE REPO and was false before plan 2
began: test/text/excerpt.test.ts carries 45 non-ASCII bytes and
test/text/extract.test.ts carries 3, both from plan 1.2's 3f74990 (soft-hyphen
work, on main). Controller verified by enumerating every tracked .ts in src/
and test/. I have been repeating that false constraint in EVERY dispatch; it
never surfaced because no task touched those two files, so every implementer's
"0 non-ASCII on the files I touched" was true and consistent with a false
premise. Worse, Task 10's own final byte-check step at plan :4112 expects
nonascii=0 "for everything except src/text/excerpt.ts (57), README.md (3) and
docs/calibration-2026-09.md" - it would FAIL as written.
Routed to Task 10: correct the Global Constraint at :20 and the step at :4112
to name all three exceptions (excerpt.ts 57, test/text/excerpt.test.ts 45,
test/text/extract.test.ts 3). Every remaining dispatch names three exceptions,
not one.

Task 6: fix round 1/5 dispatched (resumed implementer) with 3 findings.

Task 6: fix round 1/5 complete (commits 9e35141..c73d4dd, +50/-5). 323 tests
(321 + 2, reconciled by counting rather than by matching a target), tsc clean,
tree clean, both files 0 non-ASCII / 0 NUL, public surface untouched. All three
fixed: the payload-shape pin (rung/text/normText, built from toText/norm
themselves), the F1 premise assertion (isBlocked === false on its own fixture),
and pdfUrl carried on unreachable with its own test.
Design detail worth copying: the implementer routed the payload pin's readable
read through CURL deliberately, so the hardcoded-"node" mutation cannot pass
vacuously - designing the fixture to resist the specific mutation it must
catch, rather than merely asserting the current value. All four listed
mutations reproduced as failures, each application AND reversion count-asserted,
then confirmed reverted via git diff against HEAD.
It also re-verified check() independently rather than trusting the review:
re-corrupted finalUrl, exactly 2 tests moved (both new to this task),
check.test.ts stayed 36/36.
Its remaining concern - that task-6-brief.md does not exist - is STALE; the
controller extracted it (399 lines) between rounds.
Task 6: round 1 re-review dispatched (sonnet).

Task 6: round 1 re-review (sonnet) - ALL FINDINGS ADDRESSED. All four payload
mutations re-applied with count assertions and git-diff proof, each now failing
the new pin: the hardcoded-"node" mutation fails with `expected rung "node",
received "curl"`, confirming the deliberate curl-routing defeats the vacuous
pass it was designed against. The F1 premise assertion was proven non-vacuous
by giving the fixture a real veto (cf-mitigated header) and watching
`expected true to be false` fire at line 82. pdfUrl populated from readSource's
unconditionally-computed isPdf(url) and covered; hardcoding it false fails the
test. check() re-verified by corrupting finalUrl: exactly 2 tests moved, both
new to this task, check.test.ts 36/36 in isolation.
The reviewer also caught its OWN instrument mid-check: its first pass on
excerpt.ts read 19 non-ASCII, and rather than concluding the file had changed
it diagnosed the instrument (decoded-char count vs raw-byte count) and re-ran
for 57. That is the discipline applied reflexively rather than on instruction.
Task 6: complete (commits b3a5c12..c73d4dd, review clean after 1 fix round).
323 tests. The keystone (isReadable, never !isBlocked) is shipped and defended
by a test that discriminates and now asserts its own premise.

Task 7: dispatched (sonnet) at BASE c73d4dd; DONE at 067d691. 333 tests (323 +
8 filter + 2 loadRules, matching the it()-derived count exactly), tsc clean,
tree clean, 7 files, all 0 non-ASCII / 0 NUL, public surface untouched.
Three implementer notes, all good:
(a) It fixed a src/classify/thresholds.ts docstring its OWN code falsified (the
minClaimChars docstring said harvest's floor filter "does not exist yet"),
outside the brief's file list, and FLAGGED the scope call rather than either
skipping it or burying it. That is the third correction needed in that one file
- Task 3 left it stale, Task 5 fixed one sentence, this is another. The file is
becoming a drift hotspot worth naming to the final review.
(b) It proved the filter ORDER is load-bearing by actually swapping the floor
and frequency blocks, and verified the mutation applied via a unique-marker
grep because the file was UNTRACKED so git diff could not show it. Adapting the
prove-the-mutation-applied discipline to a case where the usual instrument does
not work is exactly the right instinct.
(c) It found the write tool emits LF-only files against this worktree's
CRLF-on-disk convention and converted them with a count-asserted Python pass.
CONTROLLER FINDING, not a defect: Task 7's new files are CRLF on disk while
Task 6's src/harvest/sources.ts is LF - an inconsistency BETWEEN tasks. But
every committed blob is LF (autocrlf=true normalizes on commit; verified with
git cat-file -p on five files, all 0 CR), so what ships is identical either way
and the difference is invisible to the repo. Matches the standing memory note
that LF-on-disk here is harmless. Told the reviewer not to chase it.
Task 7 review dispatched (opus) - the seam Task 6's payload pin was promoted to
protect (filters reading normText) is live in this task.

Task 7: review (opus) - spec PASS, quality APPROVED with findings. 15
mutations, each count-asserted and confirmed applied via git diff --numstat
before running, all restored. Six discriminate correctly (self-votes, one-way
containment, rule-on-raw-span, floor removal, wrong `where` prefix, and all
three loadRules mutations). The floor's message tails proven byte-identical at
all three doors; normText consumed and never recomputed.

THE FINDING OF THE ROUND, and the sharpest in this plan: deleting filter 2
OUTRIGHT leaves 7 of 8 tests green - including BOTH tests named for it, "is
vacuous with nothing to compare against" and "never lets a URL's OWN other
reads vote". The vacuity test reports frequency: 0 for a filter that could not
run in exactly the way it would for a filter that ran and dropped nothing. That
is the defect Task 2's vacuity guard exists to prevent, reproduced INSIDE the
test meant to embody it. (The own-reads test does fail under M4, so it is a
real check against the defect it names - it just cannot tell "ran and kept"
from "never ran".)
Also unpinned: substituting norm(read.text) for read.normText passes - Task
5's exact defect has no guard; and the "source's own typography" test passes
under kept.push(n) because every fixture span is norm-invariant.

Ruling: T7-R1 - the self-exclusion guard (other.key !== input.source.key) is
added in filters.ts rather than left wholly to Task 8 as the caller - because
probe C3 shows that if `others` contains the source itself, 100% of proposals
drop, silently and totally, and "harvest proposed nothing" is indistinguishable
to an author from "the sources shared nothing". sources.ts:28 already documents
`key` as "identity for the frequency filter", so the identity exists and the
filter simply declines to use it. Failure is in the safe direction (a false
miss) but total. Task 8 still pins its side. - Cost if wrong: one comparison
that is redundant when the caller is correct, and could in principle mask a
Task 8 bug - mitigated by requiring Task 8 to pin self-exclusion independently.

Ruling: T7-R2 - Important 4 (the report's own grep transcript asserts 10 where
HEAD gives 12, because this commit's own docstring fix added two prose
mentions) is fixed in the REPORT, and the identical stale expectation in the
plan's Task 7 Step 8 is routed to Task 10 - because the report is this task's
own verification record and a false transcript in it is a false claim, while
the plan's step is historical text Task 10 owns. The generalisable point,
recorded: A DOC-DRIFT SWEEP COVERS THE VERIFICATION TRANSCRIPT TOO. - Cost if
wrong: a stale grep count in a scratch file nobody reads after the workspace is
deleted; the plan text is corrected either way.

Task 7: fix round 1/5 dispatched (resumed implementer) with 6 findings.

Task 7: fix round 1/5 complete (commits 067d691..f658b89, +136/-31). 335 tests
(333 + 2: the normText pin and the self-exclusion test), tsc clean, tree clean,
all three files 0 non-ASCII / 0 NUL, public surface untouched. Self-exclusion
guard confirmed present at filters.ts:84 with a comment naming it defensive.
Important 2 closed properly: deleting filter 2 outright now fails 5 of 10 tests
where it previously left BOTH of its own named tests green. The fix was the
right shape - each of the two tests now carries a companion span the filter
genuinely drops, so a survivor's survival is attributable rather than assumed.
Important 3 closed all three blind spots, including a hand-built HarvestSource
with deliberately-wrong normText that makes substituting norm(read.text)
visible - Task 5's exact defect now has a guard.
It APPENDED the report correction rather than silently editing the false
transcript, which is the right record-keeping instinct: the wrong number and
its correction are both visible.
Task 7: round 1 re-review dispatched (sonnet), with the specific claim to check
being WHICH tests fail when filter 2 is deleted, not the count.

Task 7: round 1 re-review (sonnet) - ALL SIX ADDRESSED, each re-verified by
mutation proven applied via git diff --numstat, reverted and confirmed clean.
Important 2 confirmed on the SPECIFIC claim rather than the count: deleting
filter 2 (9 lines, numstat-confirmed) fails exactly 5/10 and BOTH named tests
are among them. Important 3's three mutations each fail exactly one named test
- including read.normText -> norm(read.text) failing the test that names Task
5's defect, so the hand-built stale-normText HarvestSource does make the
substitution visible. Removing the self-exclusion guard fails exactly its own
test. Important 4 confirmed APPENDED, not silently rewritten - the original
"exactly 10 lines" transcript is untouched at :55-59 and the correction sits
after a rule at :398.
The reviewer also noted, correctly, that char-level decode undercounts
multi-byte UTF-8 and that the 57/45/3 exceptions are byte-level counts - the
same instrument distinction the Task 6 reviewer caught itself on.
Task 7: complete (commits c73d4dd..f658b89, review clean after 1 fix round).
335 tests. The claim floor now has all three spec-7.3 doors behind one
implementation, proven byte-identical in message at each.

Task 8: dispatched (opus) at BASE f658b89; DONE_WITH_CONCERNS at 1abd0f8. 350
tests (335 + 15 it()), tsc clean, build clean, tree clean, four new files all 0
non-ASCII / 0 NUL, no existing file modified, public surface untouched.
KEYSTONE VERIFIED INDEPENDENTLY BY THE CONTROLLER: only two writers exist in
all of src/ - io/draft.ts and io/evidence.ts - and neither addresses
<doc>.claims.json. bin.ts:70's claimsPathFor is a read path helper. Harvest
cannot write the claims file.

Two deviations, both reasoned rather than drifted:
(1) 350 not 348 - two tests beyond the plan's 13: the caller-side
self-exclusion pin I asked for in T7-R1, and a seam test for the
existing-claims join by normalized key (two plausible mutations ship silently
without it). Counted, not padded.
(2) HarvestReport.unreachable carries pdfUrl. MY OWN RULING T6-R4 created this
divergence - it added the field to SourceScan.unreachable FOR this report,
after the plan's Task 8 block was written, so a straight pass-through would
have failed the brief's toEqual and narrowing it back would orphan the field
and falsify sources.ts:52. The implementer resolved it in the direction that
keeps the field useful and flagged it rather than silently matching the stale
plan text.

A THIRD PLAN-SUPPLIED TEST FOUND UNABLE TO TEST WHAT IT NAMED: the brief's
at-most-one-readable-read characterization asserted ["node"] over an all-node
fixture, so a hardcoded rungs: ["node"] passed it - the same vacuous shape as
Task 6's rung pin and Task 5's assertion-3 fixture. Strengthened so one URL is
readable only at curl. Three separate plan-authored tests have now been found
unable to discriminate, each by the implementer executing them.
It also found and fixed THREE false claims in its own draft report before
committing, including a "the README says so" that was actually spec 8.2 and a
misattributed "(Fable F1)".

FLAGGED FOR THE REVIEWER: 13 mutations run, 11 RED, but TWO stayed GREEN - the
cross-read union's dropContained call and the bugs push - defended as
"unpinnable by fixture by construction" and verified by injection with negative
controls instead. That defence is exactly the shape that can excuse a real
coverage gap, so the reviewer was told to attempt fixtures rather than accept
it, and to treat a success as a finding.
Open for Task 10: plan doc :3320ff still shows the narrow `unreachable` type
(not retro-edited, consistent with how Task 6's drift was handled).
Open for Task 9: loading claims via parseClaimsFile with no lenient variant,
and supplying version/date from one source (Fable F13).
Task 8 review dispatched (opus).

Task 8: review (opus) - spec PASS, quality APPROVED with findings. Both
deviations adjudicated in the implementer's favour (the two extra tests earn
their place - the existing-claims seam test discriminates, .get(source.key) ->
.get(source.url) turns it red and nothing else covers that join; and the
pdfUrl widening is right because narrowing would orphan T6-R4 and falsify
sources.ts:49-54). All four carried decisions verified END-TO-END by
construction. Keystone confirmed mechanically.

THE "UNPINNABLE BY CONSTRUCTION" DEFENCE SPLIT, which is why it was tested
rather than accepted. M12 STANDS: the reviewer reproduced the injection
independently and agrees the union's dropContained call cannot be pinned by
fixture, because nextAction stops at the first readable read so `readable`
holds at most one, already dropContained-ed by commonSpans. M13 REFUTED: a
fixture exists - document "7 billion", source "6 billion" - giving
bugs: ['not found in the source: "billion dollars on procurement..."'] and
claims: [], passing on HEAD and RED under the mutation. One of two hid a real
gap, which is exactly the base rate that argues for testing the claim.

AND BUILDING THAT FIXTURE SURFACED A REAL CROSS-TASK DEFECT (Important 2,
spans.ts:223, Task 5's code): norm() rewrites (digit)\s*billion -> (digit)bn
while foldWithMap deliberately omits length-changing folds, so ANY span whose
left boundary snaps past a differing digit onto billion/million fails assertion
1 - and the author gets a BUG: line on a page that is working perfectly. That
is the noise spans.ts:20-30 says must not fill the list. Not exotic, and it was
invisible to every earlier review because nobody built a fixture straddling a
context-sensitive norm rule. [[review-seams-not-modules]] again: found by a
review of Task 8 in Task 5's code, via a fixture built to test a coverage claim.

Ruling: T8-R1 - the DROP is correct and stays; only the LABEL is wrong.
Assertion 1 asks whether phraseFound will locate the span, and check() uses
that same predicate - so a span failing it could never be verified later, and
proposing it would set the author up for a false accusation against their own
citation. Dropping is right; conflating "the offset map is broken" with "norm
and foldWithMap disagree at this boundary" in one channel is not, because the
first becomes invisible inside the second. Fix the message to distinguish them;
do not change behaviour this late. - Cost if wrong: two bug classes stay
distinguishable but the underlying fold gap remains, which is the parked P3
territory and fails safe.

Ruling: T8-R2 - spec 8.2 step 4's "three assertions, each a bug if it fails" is
FALSE for assertion 1 given T8-R1, and is routed to Task 10 with the
measurement rather than amended here - because the spec is the authority and a
correction to it deserves the doc-truth task that owns spec text, not a
side-edit inside an implementation task. - Cost if wrong: one more false spec
sentence carried three tasks longer; mitigated by it being ledgered with its
counterexample.

Ruling: T8-R3 - Minor 5 OVERRULES the implementer's judgement to leave
thresholds.ts:174-175 alone. "Suppressing boilerplate from what harvest
PROPOSES is filter 2's job" now reads as denying filter 3 exists, and THIS
commit is what first wires opts.rules?.boilerplate in. Fourth correction needed
in that one file across four tasks, each sentence true when written. Routed to
Task 10 as a candidate for rewording into something that cannot go stale. -
Cost if wrong: one clause changed in a docstring nobody disputes is incomplete.

Task 8: fix round 1/5 dispatched (resumed implementer) with 5 findings.

Task 8: fix round 1/5 complete (commits 1abd0f8..3e3f959, +220/-30). 353 tests
(350 + 3, reconciled by counting: harvest.test 9->11, draft.test 6->7), tsc
clean, build clean, all six files 0 non-ASCII / 0 NUL, three exceptions still
57/45/3, public surface untouched, committed blobs cr=0.
All five fixed. Three things in this round are worth more than the fixes:

(a) IT DIAGNOSED WHY ITS OWN DEFENCE FAILED, precisely: "My M13 defence failed
because I reasoned from a docstring's definition instead of testing whether it
held; M12 stands on a checkable control-flow property, which is the
difference." That is the distinction between an argument from documentation and
an argument from verifiable control flow, and it is the same error shape as
[[spec-claims-vs-citations]] - a citation that resolves is not a claim that is
true. It then noticed Minor 5 was the SAME shape ("I checked whether the
sentence was defensible when written rather than whether it was still complete
after this commit wired filter 3") and said so.

(b) IT MEASURED THE LABELLING CLAIM RATHER THAN ASSERTING IT: shifting
foldWithMap's map by one, assertion 1 did NOT fire and assertion 2 caught the
shift - so assertion 1 can only fail on a norm() boundary, which is what
licenses the new normBoundaryNote wording.

(c) IT FOUND THE TWIN UNPROMPTED: assertion 2 carries the same exposure on the
DOCUMENT's side (source "seven billion" vs draft "7 billion" reproduces it), so
documentMismatchNote honestly names BOTH readings - bug or boundary - because
there it genuinely can be either. Both pinned. The twin rule firing without
being told, for the second time in this plan.

A NEW INSTRUMENT-FAILURE VARIANT, recorded: mutation N6 first reported ANCHOR
MISS because its two-line anchor used bare LF against a CRLF tracked file.
Caught and re-run with the detected line ending. That is the fourth distinct
way a verification instrument has silently failed in this plan (sed escape,
wrong byte metric, untracked-file git diff, now LF-vs-CRLF anchors).
Open for Task 9 (implementer's own forward concern): it must NOT print a
blanket "BUG:" prefix over proposal.bugs, since after this round the field
carries two distinguishable causes and only one is a defect. The constraint is
on the field but unenforced.
Task 8: round 1 re-review dispatched (sonnet).

Task 8: round 1 re-review (sonnet) - ALL FINDINGS ADDRESSED. The map-shift
reproduction was performed DIRECTLY rather than accepted: mutating
foldWithMap's map.push(i) -> map.push(i+1) against a fixture with no magnitude
words gave claims: [] with assertion 2's documentMismatchNote firing and
assertion 1 silent - exactly the claim the new labelling rests on. The twin is
real and pinned (documentMismatchNote literally carries both "a BUG if" and
"NOT a bug if", because there it genuinely can be either). Drop behaviour
proven unchanged: the assertion block's diff shows only the pushed string
argument changing, same if/continue structure, same order, no branch added or
removed. Breaking writeDraftFile's trailing newline turns its new round-trip
test red. Keystone re-verified. No new breakage.
Task 8: complete (commits f658b89..3e3f959, review clean after 1 fix round).
353 tests. harvest() and the draft file are shipped; the draft's _note tells
the author in the file itself that its proposals are unconfirmed.

Task 9: dispatched (sonnet) at BASE 3e3f959; DONE_WITH_CONCERNS at 19508c4.
359 tests (353 + 6), tsc clean, build clean, five files all 0 non-ASCII / 0
NUL. THE SMOKE RUN RAN AND LEFT NO TRACE - controller verified independently:
example/ has 0 files changed vs main across the WHOLE branch, tree clean, no
smoke or draft artefact tracked. Exit codes proven live rather than argued:
0 (write), 0 (silent overwrite), 2 (hand-edited _note). That is the first
end-to-end evidence in this plan that the tool does what it says.

Two deviations, both correct:
(1) It refused the brief's literal say(`BUG: ${bug}`) snippet and printed each
bugs line unprefixed, per my carried instruction and harvest.ts's newer
docstring - AND FLAGGED THE CONFLICT rather than silently choosing. The plan
text is stale here, not the code: Task 8's fix split proposal.bugs into a real
map-integrity defect and a benign norm()-boundary drop whose own message says
"NOT A BUG", so a blanket prefix would have relabelled every benign one as a
defect and buried the real ones. A display layer written without knowing why
the field beneath it has structure. Routed to Task 10 with the other plan-text
corrections.
(2) It strengthened test/exports.test.ts from a six-name ABSENCE check into a
full 8-name allowlist pin - the open question carried since Task 2's reviewer
noted the plan's "nothing new becomes public" constraint rested on a guard that
could not detect an ADDITION. Counted as one test beyond the plan, argued, not
padded. The reviewer is checking the allowlist is correct and complete and
fails on add/remove/rename.
It correctly left README's "harvest is a separate plan" and its two-command
block alone as Task 10's scope rather than doing that task partially.
Task 9 review dispatched (opus - last implementation task, user-facing exit
codes and --json purity, plus a strengthened constraint guard).

Task 9: review (opus) - spec PASS, quality APPROVED. EXIT CODES PROVEN BY
RUNNING THE BUILT BINARY across 13 paths against a local stub server: no args
2, missing doc 2, doc citing no URLs 0 (the "proposes nothing" path, draft
written with only _note), normal write 0, silent overwrite 0, hand-edited _note
2, non-JSON draft in the way 2, malformed claims file 2 (also 2 under --json,
stdout 0 bytes), every span already-claimed 0, --rules missing file 2, unknown
flag 2, unknown command 2, and harvest doc.md --fail-on-unreachable 0 accepted
and ignored - so the validateFlags characterization is true of the BINARY, not
just of the function. NO ROUTE RETURNS 1; awk over the branch finds exactly
three returns: 2, 2, 0.
--json purity confirmed with a hand-edited draft deliberately left in place:
exit 0, the draft's md5 IDENTICAL before and after (nothing read or written),
out.json parsing standalone, both report lines only in err.txt.
Version single-sourced: package.json 0.1.0 = src/version.ts 0.1.0 = runtime
VERSION 0.1.0, and the written draft's _note stamps that value.
Export pin mutation-tested three ways - add, remove, rename - all red now, and
in ALL THREE the old six-name form still passed, proving it could see none of
them. Its one documented blind spot: type-only exports are erased, so the
constraint is pinned for runtime values only.
The BUG: deviation upheld: the brief's snippet would have printed "BUG: NOT A
BUG, a norm() boundary: ..." - self-contradicting - and buried the real
map-integrity line. The reviewer noted the implementer verified the actual
strings in spans.ts before overriding the brief rather than trusting either
document, which is precisely the failure mode the stale snippet was set to
cause. Stale text at plan :3674 routed to Task 10.

Ruling: T9-R1 - the harvest branch's ZERO automated coverage (140 lines inside
non-exported main(); the 6 new tests reach only USAGE, draftPathFor and
validateFlags) is PARKED and surfaced to the final whole-branch review, not
fixed here - because it is not a regression (the check and reachability
branches carry identical exposure and have since plan 1), the behaviour is
verified by two independent manual runs across 13 paths, and extracting
`runHarvest` with an injected fetcher would be a CLI design change spec 8.2
does not license - done for harvest alone it creates an inconsistency, done for
all three it is a separate plan. - Cost if wrong: the largest untested surface
in the repo has no regression guard, so a future edit could break an exit code
silently; mitigated by 13 documented manual paths and by the final review
seeing this ruling.

Task 9: fix round 1/5 dispatched (resumed implementer) - ONE line, bin.ts:271:
"1 proposals across 2 URLs" is both ungrammatical and factually misleading,
counting READABLE URLs while the draft it just wrote has one key. The brief's
literal wording is wrong.
CARRIED INTO TASK 10 (now nine items): the wrong three ASCII exceptions in its
own brief at :344 (it names calibration doc, which measures 185 at HEAD, not
test/text/excerpt.test.ts 45 and test/text/extract.test.ts 3) - that step FAILS
as written; the stale BUG: snippet at plan :3674; plan :56's (Fable F1)
miscitation; plan :3320ff's narrow unreachable type; Global Constraint :20's
single ASCII exception; spec 8.2 step 4's "each a bug if it fails"; thresholds.ts
as a four-time drift hotspot; README's two false sentences at :326 and :345;
and Task 7 Step 8's stale grep expectation.

Task 9: fix round 1/5 complete (commits 19508c4..3f9a378). 361 tests (359 + 2),
tsc clean. Rather than patch the string in place, the implementer extracted it
into an exported harvestSummaryLine(draftPath, totalProposals,
readableUrlCount) so the wording is PINNED rather than left to the next edit -
singular at exactly one, and "N readable URLs" instead of the misdescribing
"N URLs". Both new tests proven RED against the old wording (count-asserted
byte-level revert, CRLF-correct) before being proven GREEN restored, and the
result verified against the BUILT BINARY on the smoke copy: "wrote ... - 1
proposal across 4 readable URLs", exit 0, git status identical before and after.
Controller verified the public surface is unchanged: harvestSummaryLine is
exported from bin.ts for testing but absent from src/index.ts, and the
strengthened 8-name allowlist pin still passes 6/6. src/bin.ts is not a subpath
export, so exporting from it does not widen the package surface.
Task 9: round 1 re-review dispatched (sonnet).

Task 10: dispatched (opus) at BASE 3f9a378, with the plan's own nine sweep
items and seventeen further items routed here during execution. Zero new
`it()` blocks by the plan's own instruction; 361 tests in, 361 out; `tsc`
clean; no executable line changed anywhere.

TWO OF THIS TASK'S OWN VERIFICATION STEPS WERE WRONG BEFORE IT RAN, and both
were corrected in the plan file before being run. The expected test count was
341, from a header ladder controller ruling T6-R1 retired after Task 6 (it
cannot account for tests fix rounds add; it is +20 behind by the end). And the
byte-check step's exception set was false of the repository, inheriting the
false single-exception premise from Global Constraint :20.

Ruling: T10-R1 - carried item A3 is REJECTED on its own evidence and the plan
text is DISAMBIGUATED rather than relabelled. The item said plan :54's "(Fable
F1)" miscites the design review's F1 (the `!isBlocked` finding) for the
empty-array argument. Checked: `fable-plan-review.md` numbers its own
corrections from F1, and its F1 IS "exclude zero-claim entries from the draft
file". Two Fable documents, each with an F1; every citation in this plan and in
`src/` resolves correctly within its own document. Relabelling would have
introduced a falsehood to fix one that was not there. - Cost if wrong: an
ambiguous citation stays ambiguous in three places; mitigated by the plan now
naming both F1s, and by the note that both review files are git-ignored scratch
and outlive nothing.

Ruling: T10-R2 - carried item A2's premise is NARROWED. It said Task 10's
byte-check step "FAILS as written". Run 2026-09-09 it does not: the loop
iterates `git diff --name-only ff71ec8..HEAD` plus two files, and the two test
files that break the stated exception set are not in that range, because no
plan-2 task touched them. What is wrong is the expectation's wording -
"`nonascii=0` for everything except" these three is a claim about the
REPOSITORY and is false of it. A false universal that a particular file list
happens never to exercise is the same defect as one that fails; it is true only
by the accident of what the loop reaches. The step now carries the true
exception set and a wider loop. - Cost if wrong: the correction describes the
defect more precisely than the routing did, and a reader who wanted "it fails"
gets "it cannot fail here, and that is the problem".

Ruling: T10-R3 - carried item 14 (`src/classify/thresholds.ts`, four
corrections across four tasks, each sentence true when written) is fixed by
REWRITING the `minClaimChars` docstring to name no task and no plan, not by
patching it a fifth time. The stale sentences all described the state of OTHER
code ("all three doors are shut as of Task 7", "harvest's first filter enforces
it from Task 7", "Task 5's `commonSpans` applies no floor of its own - that gap
is what Task 7 closes"), which is why each went stale the next time that code
moved. The replacement states the invariant instead - every door calls
`belowClaimFloor` and `claimFloorMessage` from `src/io/claims.ts`, and neither
is restated anywhere - and names the command that checks it. A docstring whose
truth condition is a grep cannot go stale silently. - Cost if wrong: the
paragraph loses the narrative of how the third door arrived, which the ledger
and the CHANGELOG both carry anyway.

Plan 1.2 ledger, Task 5 minor (astral fold, "Park for plan 2 - harvest is the
consumer"): RE-PARKED 2026-09-08, not fixed. Fixing it means making
foldWithMap iterate by code point rather than by UTF-16 unit - a behaviour
change to a primitive plan 1.2 stabilised and pinned - and harvest, its
consumer, fails only in the safe direction: a span differing from the source
only in the case of an astral character never matches, so the cost is a false
MISS, never a false proposal and never a false accusation. Carried to a future
plan with that argument on the record.

Task 10: numbers re-derived 2026-09-09, none copied from an earlier document.
`node scripts/calibrate-claim-floor.mjs`: 210 claim strings, **208 distinct**,
ceiling **12** ("SAUDI ARABIA" at 12 and "169" at 3, nothing above), floor 16
with margin 4, **18 of 208 refused** (8.7 percent). `node
scripts/calibrate-harvest-seed.mjs`: 45 unrelated pairs, above-floor emitted
means 2.0 / 2.2 / 1.2 / 0.9 / 0.3 at L = 13 / 16 / 20 / 21 / 25, so the
selection rule still picks 21; every cell reproduces the committed table
exactly, so `docs/calibration-2026-09.md` was NOT edited - nothing moved. Two
verdict measurements against the shipped `dist/`, driving `check()` with an
in-memory stub: the signature-membership boundary flips at exactly 800
extracted characters on a claims-PRESENT pair (796-799 listed `unreachable` /
unlisted `supported`; 800-802 both `supported`) and NEVER flips on a
claims-MISSING pair (`unreachable` on both sides at 798-801); and a
5,005-character padded wall over the prose floor returns `unsupported` whether
or not the signature list names it, but `unreachable` when its `finalUrl`
lands on a `CHALLENGE_PATHS` path - so the accusation above the floor is one no
SIGNATURE-list entry could have prevented, which is the narrowing T1-R13
asked for.

Task 10: TEN sentences found by the sweep beyond the twenty-six routed to it,
most of them in the "already true, now misleading" class the plan warned is
where its findings come from. Five are the class the plan did not name at all:
a promise made TO this task, which this task then discharged, leaving the
promise false.
(1) README's Global flags paragraph said `--explain-fetch` "is not global:
`reachability` never consults it" - written when there were two commands.
`harvest` also accepts and ignores it, and `test/bin.test.ts` pins exactly
that as a characterization. Widened to name the gap rather than one command.
(2) README's Quickstart said the claim floor is enforced "by the claims file's
own loader and by `check()` alike" - true when Task 3 wrote it, and Task 7
added the third door. Widened; pinned by `test/harvest/filters.test.ts`, which
asserts harvest's message is the loader's.
(3) README's "the CLI prints 'ladder truncated'" was unambiguous with two
commands and is not with three - only `check` prints it. Narrowed to `check`.
(4) Spec 13 Q3 said plan 2's calibration task "re-derives the number before any
code depends on it", in the present tense of a promise. It did; past tense.
(5) The plan's own Task 8 type block says `HarvestProposal.bugs` is "reported
with a BUG label" - the twin of the stale "BUG: " prefix snippet routed
here as item A5, in the same block, and falsified by the same fix round. Found
by fixing the pair rather than the item.

Then five of a class nobody named: A PROMISE MADE TO TASK 10, DISCHARGED BY
TASK 10, LEFT STANDING. Every one was true when written and is false the
moment this task lands, and no routed item covered any of them - the routing
files list what Task 10 must FIX, not what Task 10 makes false by fixing it.
(6) `src/harvest/spans.ts`: "The spec sentence is routed to Task 10 and is not
amended here." (7) `src/harvest.ts`, the `bugs` docstring: "The spec sentence
is routed to Task 10." Both now say the spec was amended to agree, and on what
date. (8) `src/harvest.ts`, the `harvest()` header: "The README carries no
harvest section yet; Task 10 writes one, and until it lands the spec is the
only place this is written down." It lands in this commit. (9)
`test/bin.test.ts`: the per-command flag tables are "parked for plan 2" - plan
2 is over and did not close them; it re-parked them and added a third command
to the same gap, which its own neighbouring characterization test pins.
(10) README's HTML-comment bullet: "it is plan 2 work". Plan 2 did not do it,
and the exposure is open. Rewritten to state what is, not what a plan will do -
the discipline plan 1.2's ruling R9 imposed on this same README.

That class is worth naming for the next plan: **a task that discharges a
promise must sweep for the promise.** A grep for its own name (`Task 10`,
`routed to`, `parked for plan 2`) across `src/`, `test/` and the docs found all
five in one pass, and no review in nine tasks would have caught them, because
each was true in every diff that any reviewer saw.

Task 10: every sentence written, with the test that pins it.
- README Commands block, three commands - `test/bin.test.ts`, "names all three
  commands".
- README `harvest` reads the claims file / writes the draft -
  `test/harvest.test.ts` ("joins the existing claims file by the NORMALIZED
  key", "never proposes for a notApplicable URL"), `test/bin.test.ts`
  (`draftPathFor`, which also asserts the draft path is not the claims path).
- README `check` and `reachability` agree on the fetch ladder, narrowed from
  "Both" - `test/agreement.test.ts`, which contains no harvest case.
- README Harvest section, the proposal mechanism - `test/harvest.test.ts`
  ("proposes a span the draft and a readable source share"),
  `test/harvest/spans.test.ts` (source typography, word-boundary snap,
  containment, seed length).
- README Harvest, readable reads only - `test/harvest/sources.test.ts`, "keeps
  only READABLE reads: a sub-floor stub proposes nothing (Fable F1)".
- README Harvest, the REDIRECTED report - `test/harvest/sources.test.ts`
  ("flags a readable read whose finalUrl path differs", "does not flag a
  redirect that keeps the path") and `test/harvest.test.ts` ("carries a
  readable read's redirect away from the cited path into the report").
- README Harvest, four filters in order with per-filter counts -
  `test/harvest/filters.test.ts`, "runs the filters in the spec's order, so
  each drop is attributed once", plus one test per filter.
- README Harvest, no bundled boilerplate rules - `test/rules/load.test.ts`,
  "ships an empty boilerplate list, and a local file adds to it".
- README Harvest, the vacuous frequency filter said in words -
  `test/harvest.test.ts`, "says the frequency filter was vacuous when fewer
  than two sources were readable".
- README Harvest, the draft's `_note` - `test/io/draft.test.ts`, "the marker
  names the version, the date and the sentence, in that order".
- README Measured limits, the GATE never compares `finalUrl` -
  `test/check.test.ts`, "a redirect to another host or path is not observed:
  finalUrl never gates".
- README Measured limits, a sub-floor read leaves a trace only for a claim no
  readable read carried - `test/check.test.ts`, "assembles a full match across
  rungs rather than accusing from one of them".
- README Quickstart, the floor at every door - `test/classify/
  claim-floor.test.ts`, `test/check.test.ts` ("REFUSES a claim under the floor
  at the front door, before any fetch"), `test/harvest/filters.test.ts`
  ("filter 1 refuses a span under the floor, with the loader's own message").
- README Global flags, the command-agnostic gap - `test/bin.test.ts`,
  "CHARACTERIZATION: the command-agnostic gap now covers a third command".
- CHANGELOG `RuleSet.boilerplate` - `test/rules/load.test.ts` (two tests, one
  for the empty ship and the local add, one for the dated discipline).
- CHANGELOG `Document.prose` - `test/adapters/gfm-footnotes.test.ts`, the
  fence-blanking discriminator Task 4's fix round strengthened.
- CHANGELOG one source for `VERSION` - `test/exports.test.ts`, "VERSION agrees
  with package.json" and the 8-name allowlist pin.
- Spec 8.2 step 4's amendment, both readings of the `norm()` boundary -
  `test/harvest.test.ts`, "carries a norm() boundary line from the SOURCE
  side" and "carries the same boundary from the DOCUMENT side, named as the
  two things it can be".
- Spec 8.2 step 6's overwrite rule - `test/io/draft.test.ts`, "recognizes its
  own marker whatever version or date it carries", "lets harvest overwrite its
  own untouched draft", "refuses a draft the author has touched".
- `src/check.ts`'s HTML-ladder narrowing - `test/fetch/ladder.test.ts`, "falls
  through to curl when the node rung did not read the document"; the PDF
  branch's early return is cited to `fetch/ladder.ts` as structure, not
  asserted as measured behaviour, because no test pins
  `nextAction(history, ALL, true)` for a non-empty history.
- `src/harvest/spans.ts`'s `e <= s` attribution - `test/harvest/spans.test.ts`,
  the snap tests, "never proposes half of an astral character (lone
  surrogate)", and the whitespace-collapse test.
- `src/classify/thresholds.ts`'s rewritten floor docstring -
  `test/harvest/filters.test.ts` for the shared message, and
  `grep -rnE "belowClaimFloor|claimFloorMessage" src/` for the single
  implementation: 12 lines, 10 of them code and 2 of them that docstring's own
  prose.

THREE SENTENCES REST ON MANUAL VERIFICATION AND NOT ON A TEST, and are written
anyway because the spec requires them and the plan forbids new tests here: the
README's and the CHANGELOG's "exit 0 / exit 2, and there is no exit 1", and the
README's migration note that a claims file `check` refuses gets the same
message and exit 2 from `harvest`. All three are inside ruling T9-R1's parked
gap - the harvest CLI branch has no automated coverage - and were proven by
Task 9's review against the BUILT binary across 13 exit paths, plus an `awk`
over the branch finding exactly three returns (2, 2, 0). The claims-loader
wording is byte-identical at both call sites by inspection (`cannot read
claims: ` in `src/bin.ts`, twice). Recorded here rather than left implicit,
because a doc sentence whose only evidence is a manual run should say so
somewhere.

Task 10: complete. 26 of 26 routed items closed or recorded (A3 rejected on its
own evidence with T10-R1, A2 narrowed with T10-R2, the three E items recorded
rather than fixed as instructed), plus ten further sentences the sweep found.
Nine files: `README.md`, `CHANGELOG.md`, the spec, the plan, this ledger, and
comment-only edits to `src/check.ts`, `src/classify/thresholds.ts`,
`src/harvest/spans.ts`, `src/harvest.ts` and `test/bin.test.ts` - proven
comment-only by filtering the `src/` and `test/` diff for any changed line that
is not a comment or blank, which returned nothing.
361 tests, `tsc` clean, `npm run build` clean, byte counts re-taken after every
edit that wrote an escape: `src/text/excerpt.ts` 57, `test/text/excerpt.test.ts`
45, `test/text/extract.test.ts` 3, `docs/calibration-2026-09.md` 185,
`README.md` 3, everything else 0, NULs only in
`fixtures/challenge/pdf-binary-served-at-200.bin` (63, by design), with the
instrument proved able to report non-zero first.
`fixtures/challenge-battery.mjs` was NOT run.

---

## Final whole-branch review, fix wave, and close-out

Final whole-branch review (opus) over ff71ec8..f6efbe7, 26 commits:
**READY WITH FIXES - no Critical.** The keystone is clean end to end
(isReadable at sources.ts:121 is the sole filter, harvest.ts:130 iterates only
that list, isBlocked appears nowhere executable in harvest, and the
isReadable -> !isBlocked mutation goes red). "No verdict moved" was PROVEN
rather than argued: across check()'s entire dependency chain the branch has
exactly four non-comment deltas - the front-door guard, +prose, +finalUrl and
two new constants - and no existing threshold value changed, so every input the
old guard refused is still refused. Both calibration scripts reproduce
cell-for-cell (32-span table set-equal with pair counts, 12/20 split, ceiling
12, 18/208 = 8.7%) with a negative control proven to fire. 18 of 20 mutations
red, each proven applied and restored; the two survivors are correct.
It found nine one-clause fixes, none executable, and answered both judgement
items: preserve the Fable reviews rather than relabel 27 citations, and the CLI
coverage gap does NOT block - "no exit 1" is STRUCTURAL, not merely observed
(awk finds exactly three returns: 2, 2, 0, and bin.ts's top-level .catch maps
any throw to 2), and the sub-floor claims file produces a message BYTE-IDENTICAL
to check's, which is the README migration sentence proven rather than asserted.
Its sharpest finding: TASK 10 HALF-FIXED A TWIN. It corrected the README's
global-flags sentence and left the spec's counterpart standing - the exact
failure [[doc-drift-sweep-whole-document]] is named for, inside the task whose
entire job was that sweep. Also measured: bin.ts's "under --json nothing is
read or written on disk" was FALSE (it reads <doc>.claims.json and exits 2 on a
malformed one), found by running rather than reading.

Final fix wave (sonnet, single dispatch as the skill requires): commits
2744796 + 1106424. Eight of nine closed, item 9 correctly parked. 361 tests,
tsc clean, NO EXECUTABLE LINE CHANGED (21 changed +/- lines across src/+test/,
0 non-comment, detector proven on a planted `const x = 1;`).
Item 4 is the one worth recording: 27 shipped citations across 16 src/ and
test/ files and the spec pointed at two review documents in git-ignored scratch
that cleanup destroys, and BOTH documents number their findings from F1 (and,
the re-review found, from F6 as well). Preserving both files into
docs/superpowers/plans/ with a header naming the range each owns fixed all 27
at once without touching a single citation. Relabelling was considered and
rejected: rewriting 27 sites risks inventing a falsehood at 27 sites. This is a
defect the PROCESS created, not the code - the branch would have merged with 27
dangling references and the documents that resolved them deleted.

Scoped re-review of the fix wave (opus) over f6efbe7..1106424: ALL NINE
ADDRESSED. Byte-fidelity of the preserved reviews proven by sha256 - removing
exactly the 9 inserted header lines reproduces both scratch originals
bit-for-bit. Nine citation spot-checks across nine files all resolve to the
right document under its stated numbering. Item 5 proven BY RUNNING, with the
skipped instrument proven live: with a malformed claims file, `harvest --json`
exits 2 and leaves the draft's md5 unchanged; with a hostile _note draft
present, --json exits 0 while the same run WITHOUT --json exits 2 on it.

Ruling: F-1 - CHANGELOG.md:14's "harvest is a second consumer of the reader
plan 1.2 built" is PARKED and surfaced to the user rather than fixed, though it
is one word. readSource has three callers, so as an ordinal it is the same
undercount item 2 corrected in fetch/types.ts, and it sits in a PRESENT-TENSE
plan 2 section - but it survives on the ordinary reading of "a second" as "an
additional", the whole-branch reviewer called it not a blocker, and the skill
allows exactly one fix wave precisely so that close-out does not become an
unbounded cycle. Offered to the user as a one-word follow-up instead. - Cost if
wrong: a CHANGELOG sentence undercounts a caller list by one, in a document
whose next edit will touch that section anyway.

Ruling: F-2 - three residual scratch citations are ACCEPTED as-is: the prior
plan's 2026-09-07-plan-1-2-reader.md:31 cites a directory that never existed
(2026-09-07-plan-2-harvest; only the 09-08 one does), and plan-2-harvest.md:34
and the ledger still reference scratch - because all three now have a
resolvable in-repo target, the first is a PRIOR plan's historical document that
this branch has no license to rewrite, and the other two are records of where
work happened rather than pointers a reader must follow. - Cost if wrong: a
reader chasing a path in a historical plan document finds nothing and looks in
docs/superpowers/plans/ instead, where the content now is.

Ruling: F-3 - the preserved reviews' headers say "moved out of git-ignored
scratch" while the originals still sit in the workspace. Left as written,
because the sentence becomes true the moment the workspace is deleted, which is
the next step in this plan's own close-out. - Cost if wrong: two headers are
briefly imprecise inside a directory that no longer exists.

Close-out: 28 commits over main @ ff71ec8, 361 tests (from 281), tsc clean,
build clean, tree clean, example/ untouched across the whole branch, three
standing ASCII exceptions unchanged at 57/45/3, the only tracked NUL file the
deliberate pdf-binary fixture. The keystone holds: only io/draft.ts and
io/evidence.ts write, and neither addresses <doc>.claims.json.
