# Fable review: plan 2 (`harvest`) implementation plan

**Numbering owned by this document: F1-F12** (this plan review's own finding
numbers). A citation like "(Fable F1)" in `src/` or `test/` may instead mean
the companion design review, which owns its own F1-F18 - see
`2026-09-08-plan-2-harvest-fable-design-review.md` beside this file. Preserved
here (moved out of git-ignored `.superpowers/sdd/` scratch) because 27 shipped
citations across 16 source and test files point at these two documents by
finding number, and relabelling them was rejected as riskier than preserving
the source.

Reviewed: `docs/superpowers/plans/2026-09-08-plan-2-harvest.md` at `aa7dc2c` on
`feat/plan-2-harvest` (4020 lines, 10 tasks), against spec 8.2 as authority,
7.3/7.4/6.6/5.3/13/10 as context, the three ledgers, and the design review
F1-F18. Suite re-run at review time: 281 passed at `ff71ec8`+plan commit.
Date of review: 2026-09-08 (session clock 2026-09-08; the plan's measurements
dated 2026-09-08 were all re-derived, see "What was verified by running").

## VERDICT: APPROVE WITH CORRECTIONS

Ten tasks, all executable from their text alone; every load-bearing number and
behaviour claim I tested reproduced exactly (list at the end). Three MAJOR
corrections - all small, none structural - plus nine MINOR. Nothing blocks
execution once the corrections below are applied to the plan text.

**Corrections, numbered for checkoff:**

1. (F1) Task 8/9: exclude zero-claim entries from the draft file - a proposal
   entry `"url": []` is refused by `parseClaimsFile` on rename. Add a test.
2. (F2) Task 10: rule on spec 8.2 filter 2's "Plan 2's calibration counts how
   many real claims appear in two cited sources of the same draft" - either
   perform the count or amend the sentence; today the plan silently ships it
   false.
3. (F3) Task 10 Step 1/6: add spec 13 Q3 (:1263-1264) "203 real claims ...
   18 of 203 refused" to the enumerated amendment list - it is the same
   falsified population as 7.3's sentence, in a second place.
4. (F4) Task 2 Step 5: also amend thresholds.ts's second header paragraph
   ("boundary between we read a document and we did not"; "rerunning
   scripts/calibrate.mjs") - false for the two new entries as left.
5. (F5) Task 9: the plan adds FIVE bin tests, not four; expected totals are
   341/341 at Tasks 9/10, not 340/340 (and the header ladder and the report's
   ladder change with it).
6. (F6) Tasks 3+7: the grep-count predictions are wrong - the import lines in
   check.ts and filters.ts also match; expected 7 lines after Task 3 and 10
   after Task 7, not 6 and 8.
7. (F7) Plan-1.2 ledger's parked astral-fold item ("Park for plan 2 - harvest
   is the consumer") gets a ruling: fix, re-park with a dated line, or
   disclose. The plan currently drops it without a decision.
8. (F8) Task 9 Step 4 (recommended): under `--json`, keep stdout pure JSON -
   send the per-URL report lines to stderr or suppress them.
9. (F9) Task 10 Step 2: after inserting the harvest sentence, rename the
   following "Both read a URL through the same fetch ladder" to name
   `check` and `reachability` - the antecedent of "Both" breaks.
10. (F10-F12, cosmetic): Task 10 Step 1 "The five below" (seven are listed);
    Task 1's challenge.ts descriptors ("lines 18-25", "last paragraph" - it is
    18-24 and not last); optionally scope the rewritten rot-tolerance sentence
    in challenge.ts the way spec 6.3 does.

---

## Findings, ranked by cost if shipped

### F1. MAJOR - CONFIRMED. A draft entry with zero surviving claims is written as `"url": []`, which the loader refuses - the migration promise breaks on the ordinary case

**What is wrong.** Task 9's harvest branch builds the draft from
`report.proposals.map((p) => ({ url: p.url, claims: p.claims }))` and Task 8's
`buildDraft` writes `draft[entry.url] = [...entry.claims]` for every entry.
`proposals` contains one entry per readable URL regardless of how many claims
survived the filters, so a readable source that shares nothing with the draft
- or whose every span was filtered - lands in the file as an empty array.
`parseClaimsFile` (src/io/claims.ts:69) refuses `[]`: "claims must be a
non-empty array". Task 8's own test, "is a claims file the loader accepts once
the author renames it" (the F8 fix), covers only the non-empty entry, so
nothing pins either behaviour.

**Cost if shipped.** The author follows the README's migration story, renames
a draft holding any zero-proposal URL, and `check` exits 2 naming a key she
never wrote, with a message about a file the tool itself produced. This will
reproduce on Task 9's own smoke run if `example/sample.md`'s prose does not
quote its sources verbatim. It also quietly falsifies spec 8.2 step 6's "in
the claims-file shape" - `[]` is not a value that shape admits (7.3: non-empty
array or notApplicable).

**Fix.** Omit empty entries from the draft (filter in the CLI's `entries`
mapping or in `buildDraft`); the per-URL report line already tells the author
"0 proposed" so nothing is lost. Extend the Task 8 draft test with a
zero-claim entry asserting the key is absent and the parse still succeeds.
Exit code stays 0 - "a draft that proposes nothing" is already specified.

### F2. MAJOR - CONFIRMED. Spec 8.2 filter 2's promised calibration - the reprint cost - lands in no task, and no amendment touches the sentence

**What is wrong.** 8.2 filter 2 (spec :1030-1032): "Plan 2's calibration
counts how many real claims appear in two cited sources of the same draft, so
the reprint cost is a number, not a guess." Task 2 measures the floor (claims
vs unrelated fixtures) and the seed noise (unrelated fixture pairs). Neither
counts real claims appearing in two cited sources of one draft - that needs
readable reads of the drafts' actual cited sources, which the frozen corpus
does not contain. The calibration doc's "What was NOT done" section discloses
a different gap (no host-same pairs, filter 3's domain), not this one
(filter 2's domain). Task 10 amends three spec sentences; this is not one of
them. `grep -in "reprint" plan` confirms the requirement appears only as
comment prose about what filter 2 is for.

**Cost if shipped.** The day the plan merges, the binding spec asserts a
measurement exists that was never made - a false sentence of exactly the
class R13 exists to prevent, created knowingly this time. The frequency
filter's recall cost (how many REAL claims it would eat) stays a guess while
the spec says it is a number.

**Fix.** Controller's choice, but rule on it explicitly: (a) add the count -
it needs the four drafts' footnote URLs and network reads, so realistically it
is a scripted live probe, out of scope for the suite; or (b) amend the
sentence in Task 10 to record that the count was not performed and why (the
frozen corpus holds no same-draft source pairs), and add it to the calibration
doc's "What was NOT done". (b) is one sentence in each of two documents and
matches the plan's own disclosure discipline.

### F3. MAJOR - CONFIRMED. The "203 distinct real claims / 18 of 203" population is falsified in TWO spec places; Task 10 fixes one

**What is wrong.** Task 2's re-derivation moves the population to 208 (I
reproduced 208 exactly; see below). Task 10 Step 6(a) amends 7.3:853-856. But
spec 13 Q3's resolution (:1263-1264) carries the twin: "the licence and the
measurement: 203 real claims, chance matches at 3 and 12 characters and none
above, 18 of 203 refused." It is not in Task 10's enumerated list. The Step 1
sweep grep does include `203` and would print those lines, and Step 1 says a
sixth finding is expected - but this repository's record (R13 itself; the
plan-1.2 review's 6.3 finding; the memory line "fix twins as a pair") is that
unenumerated twins get missed, and the instruction's own count is wrong
("The five below" precedes seven items), which weakens the only net.

**Cost if shipped.** The spec disagrees with itself about its own calibration
population - 208 in 7.3, 203 in 13 Q3 - which is the precise defect class this
repo has now shipped three times.

**Fix.** Add :1263-1264 to Task 10's enumerated amendments with wording
mirroring 7.3's ("<N> real claims ... <R> of <N> refused, re-derived <DATE>;
this line said 203/18-of-203 until then"), and correct "The five below" to
the actual count.

### F4. MINOR - CONFIRMED. Task 2 leaves two sentences of thresholds.ts's header false for the entries it adds

Step 5 replaces the header's first paragraph and one licensing sentence, but
the second paragraph survives: "They are the boundary between 'we read a
document' and 'we did not'. Changing one without rerunning
scripts/calibrate.mjs against the corpus is a keystone violation."
`minClaimChars` and `harvestSeedChars` are not read-boundaries, and their
re-derivation scripts are calibrate-claim-floor.mjs and
calibrate-harvest-seed.mjs, not calibrate.mjs. The task edits this exact
comment block; leaving these lines is doc drift created in the file being
edited. **Fix:** one sentence naming the per-entry scripts ("its own
docstring names the script that re-derives it"), and scope the boundary
sentence to the four verdict entries.

### F5. MINOR - CONFIRMED. The plan-1.2 ledger's parked astral-fold item, addressed "for plan 2", is dropped without a ruling

Plan-1.2 ledger, Task 5 minor: `foldWithMap` iterates per UTF-16 unit, so an
astral character is never case-folded; "Park for plan 2 (harvest is the
consumer)." The plan and the draft report never mention it (grep: zero hits
for astral/10400/surrogate). The failure direction in harvest is safe - a
case-differing astral span simply never matches, a false miss, no false
proposal - but a parked item aimed at this plan needs a decision line or it
evaporates from the record. **Fix:** one ruling in the plan (re-park with the
safe-direction argument, or fix), plus a line in Task 10's ledger step.

### F6. MINOR - CONFIRMED (by construction). `harvest --json` stdout is report lines + JSON, unlike `reachability --json`

Task 9's branch prints the per-URL report lines unconditionally to stdout,
then the draft JSON. `reachability --json` prints pure JSON;
`check --json` mixes (house precedent), and the spec's convention claim is
only "prints instead of writing", so this is not a spec violation - but
`harvest doc.md --json > draft.json` produces a file `jq` and the author's
editor both choke on, and the smoke step even codifies the mixed output.
**Fix (recommended, not demanded):** under `--json`, route the report lines
to stderr (console.error) or print JSON only.

### F7. MINOR - CONFIRMED. Task 9 adds five tests; the plan says four, and the totals ladder says 340

Step 1's three describes hold 2+1+2 = 5 `it`s; Step 5 says "4 more than
before", and the plan-wide ladder (281 -> ... 336, 340, 340) should end
341/341. Every other rung of the ladder checks out (283, 289, 293, 297, 305,
313, 323, 336 all reconcile with the tests each task adds). The plan's own
reconcile-before-committing rule catches this at execution, but the plan's
numbers are meant to be true first. **Fix:** 5 / 341 / 341, in the header,
Task 9, Task 10 Step 7, and the report.

### F8. MINOR - CONFIRMED. Both grep-count predictions for the floor's doors are wrong

Task 3 Step 9 predicts six lines for `grep -rn "belowClaimFloor\|
claimFloorMessage" src/`; the actual is seven - the plan's own Step 6 adds
`import { belowClaimFloor, claimFloorMessage } from "./io/claims.js";` to
check.ts, and the import line matches the pattern. Task 7 Step 8 predicts
eight; the actual is ten (filters.ts's import line, same reason). An
instrument whose documented success-reading is wrong on correct code is the
exact class the global constraints warn about. **Fix:** 7 and 10, with the
import lines named so the executor knows they are expected.

### F9. MINOR - CONFIRMED. Task 10 Step 2's insertion breaks the antecedent of "Both read a URL ..."

README 318-325 is ONE paragraph. The harvest sentence is appended "after
`reachability` needs neither.", i.e. mid-paragraph, directly before "Both
read a URL through the same fetch ladder..." - whose "Both" then follows a
sentence about `harvest`. The agreement claim is genuinely two-command (the
plan is right not to widen it), but the pronoun now misleads. **Fix:** start
that run as "`check` and `reachability` read a URL through the same fetch
ladder..." or break the paragraph.

### F10. MINOR - CONFIRMED. Task 10 Step 1: "The five below were found" precedes a list of seven

Cosmetic, but it sits inside the drift-sweep instruction, where a wrong count
teaches the executor to stop looking early. Fix the number (and renumber if
correction 3 adds an eighth).

### F11. MINOR - CONFIRMED. Task 1's descriptors for the challenge.ts edit are off

The paragraph is lines 18-24 (seven lines - the count is right, the range
"18-25" is not), and it is not "the last paragraph of that comment" - the
pattern-guidance paragraph follows at 26. The begin/end text anchors are exact,
so the edit is executable; fix the descriptors so nobody deletes into line 26.

### F12. MINOR - PLAUSIBLE. The rewritten challenge.ts comment keeps the unconditional "The list ROTTING ... still cannot cost truth"

Spec 6.3 conditions rot-tolerance on "only below the prose floor" and records
that draft 1 "stated it without that condition" as an error; 6.3's above-floor
paragraph carries the ECB known-gap wall as the live counterexample. The
comment's claim survives under a marginal-cost reading (a COMPLETE list also
cannot veto an above-the-cap body, N3's length conjunction, so rot changes no
outcome) - which is presumably why plan 1.1's correction left it - but the
reading is implicit and the sentence pattern-matches the recorded draft-1
error. One scoping clause ("rot changes no outcome a complete list would have
prevented: above the cap N3 cannot fire at all, below it the floor catches
what the list misses") makes it match 6.3. While there: 6.3:475's "There the
list's completeness does bear on truth" is itself strictly false under the
length conjunction (completeness is irrelevant above the cap - the exposure
exists regardless) - a candidate for Task 1's sweep or a ledger note, not a
demand.

---

## Rulings on the seven questions

1. **"Byte-identical" read as identical-outside-version-and-date: ACCEPTED.**
   The strict reading makes harvest unusable on day two (the marker embeds the
   date), defeating step 6's own purpose sentence ("a missing or edited
   `_note` means the author has touched the file") and design-review Q6's
   framing ("never destroy author work", "marker unchanged" as author-touch
   detection). A `_generated` field is a second marker with the same
   ambiguity plus a shape change. Keep `isHarvestNote` exactly as specified
   (anchored regex + exact sentence match) and keep Task 10's amendment.
2. **Selection rule and 21: ACCEPTED, both.** I re-derived the sweep
   independently against the shipped `foldWithMap`/`norm`/`toText` with the
   plan's replica: every digit of the table reproduced (L=20 above-floor mean
   1.2, L=21 0.9, 32 spans at 21, 43 at 20, longest 27 chars "terms of use
   privacy policy"). The rule (smallest L in 20..25 with above-floor mean
   < 1.0) was stated before the run, is monotone over the band, and "fewer
   than one chance proposal per unrelated source" is a defensible review-
   burden bound. 20 fails it on the numbers; 21 is the value - re-derived on
   execution day per the plan's own discipline.
3. **Task 1 fixing 7.2: KEEP - I agree with the controller.** The sentence is
   confirmed false (N2/N3 are rule-fed vetoes; `src/rules/load.ts:53-62` has
   said "NOT complete for signature and path rules" since C13), it is one
   clause in the same family as R13, and R6's precedent is fix-in-round, not
   park. Parking known-false spec sentences is the habit that produced R13.
4. **8.2 recording at-most-one-readable-read: NO spec edit.** The plural
   "reads" is the contract; at-most-one is an incidental property of the
   shipped ladder's stop rule, and a characterization test is where incidental
   properties live (this repo's own practice). Task 8's test turns red if the
   ladder changes, which is the moment to amend the spec.
5. **`harvest` in the agreement seam: ACCEPT the omission.** The seam file's
   property is verdict-shaped (check's verdict vs reachability's partition);
   harvest has no verdict. The property harvest COULD state - proposes-from
   iff reachability-readable - is enforced by the single `isReadable` import
   and is mutation-tested in Task 6 Step 6 (the `!isBlocked` mutation turns
   the stub test red). Task 10's one-sentence note of why it is absent is the
   right record. No change.
6. **`dropContained` extraction: YES, right call.** One containment rule with
   two call sites (per-read in `commonSpans`, cross-read union in `harvest()`)
   is the anti-drift shape this repo's ladder-copy history demands; the
   replica/shipped-function swap in Task 5 Step 6 then proves the calibration
   measured the shipped rule. All eight span-test vectors reproduced exactly
   in my independent run, including both snap directions.
7. **The 16-literal substitution table: YES.** Spec 7.3 refuses a lenient
   front door, so leaving the tests alone is not on the table. I verified all
   seven counts exact on 2026-09-08 (4, 3, 1, 2, 2, 5, 1, plus the four
   singletons and `["real claim", ""]`), verified the three message-assertion
   rewrites hit the only `/non-empty/`-style assertions the floor changes
   (empty-array and non-string keep matching the new wording), and swept every
   other test file for claim literals: none reach the floor's doors
   (bin.test.ts never loads claims; signals/read-source tests bypass the
   floor by design).

---

## What was verified by running (all against `dist/` at the plan commit)

- **R13 mechanism end to end:** WALL+READABLE -> `unsupported`, missed
  `["spending rose sharply"]`, rungs `["node","curl"]`, no `firedRule`, no
  `evidence`; NO_SIGNATURE variant -> `supported`, evidence rungs
  `["node","curl"]`. Prose volumes 72/74 (under cap 800) and 7720 (over floor
  4500); READABLE lacks claim A. Exactly what Task 1's tests assert. The
  mutation anchors exist: `if (isBlocked(r.computed.signals)) continue;` IS
  check.ts:134; `/just a moment/` is in the signature list;
  excerpt.ts:102-104 match Step 5's revert text verbatim.
- **Every floor-probe number:** 70/20/89/31 claim strings, 210 total, 208
  distinct, 10 document fixtures totalling 367,390 chars, spurious exactly
  `"SAUDI ARABIA"`@12 and `"169"`@3, ceiling 12, refused-at-16 = 18, the full
  refused-at-F line. All four source files pure ASCII. Sources byte-stable at
  the report's sizes/mtimes; `<pinned origin commit withheld>...` resolves; origin-repository HEAD
  `8f05ab39` (read-only throughout).
- **Every seed-sweep number:** the full 9-row table digit-for-digit, 43/32
  spans at L=20/21, longest span 27 normalized chars.
- **All eight Task 5 span-test vectors** through the plan's algorithm
  transcribed verbatim: PASS, including both word-snap directions, the U+0130
  map fixture, dedupe-on-repeat, and the seed-default/inequality pair.
- **Task 8's fixture arithmetic:** `commonSpans(prose, toText(page))` yields
  exactly `[SHARED]` with no bugs; the two-source page carries both spans and
  its normText contains norm(SHARED) (so the frequency drop count of 1 is
  right); the page body's prose volume is 7293.
- **Anchors and interfaces:** claims.ts array branch at :62; check.ts guard
  at :47-66 with `norm` used nowhere else; thresholds.ts has exactly four
  entries ending `binarySampleCodePoints: 65_536,` (so `minClaimChars`
  becomes the fifth, keeping 7.3's sentence true, and "four of the six" is
  right); DEFINITION regex and the parser's final two lines byte-match; `text`
  in the parser is already LF-normalized and code-blanked, so
  `text.replace(DEFINITION, "")` is the promised prose; readSource returns
  `{reads, attempted, pdfUrl}`; SignalResult carries `text` at :25 and
  computeSignals receives `input.finalUrl`; `phraseFound` IS
  `norm(h).includes(norm(n))`, so `normText.includes(n)` is the claimed
  equivalence; toRule's messages match `/lastConfirmed/` and `/note/`;
  `withFile` exists; the only RuleSet literal is check.test.ts:601;
  claimsPathFor/evidencePathFor implementations are byte-identical to the
  plan's exported versions; bin.ts's usage literal, reachability block, and
  `command !== "check"` gate are where the plan says; CHANGELOG is
  reverse-chronological so the insertion anchor is right; the
  "deprecation path" phrasing exists in both prior sections;
  `/verif(y|ying|ication)[\s\S]{0,20}human/` catches the WALL fixture;
  autocrlf=true; no Document literal exists anywhere; example claims all
  clear the floor.
- **Spec quotes:** 6.3:456-460, the rot paragraph, 7.2:766-768, the table row
  at :1298, 7.3:853-856, 8.2:1088, 8.2 step 6's overwrite sentence - all
  byte-accurate as quoted. The N4 paragraph does record two corrections, so
  Step 3's replacement sentence about it is true.

## What is right - do not disturb

- **Task 1 is exactly R13's prescribed dispatch**, pin shapes included, and
  both mutations discriminate. The read-voice spec rewrite is accurate to the
  measured mechanism.
- **Calibration-before-code is real, not ceremonial**: committed scripts, a
  pre-stated selection rule, frozen fixtures with honest provenance
  ("working tree" recorded as weak), an acceptance test whose vacuous-pass
  guard (documents >= 10, rows >= 200) is the right lesson from this repo's
  instrument failures, and the replica-to-shipped-function swap in Task 5
  Step 6 that closes the loop most plans leave open.
- **The keystone survives harvest**: draft-only writes with a mechanical
  grep proof (Task 8 Step 6), `isReadable` not `!isBlocked` with the F1
  mutation test, readable-only voting, self-validation failures dropped AND
  reported without touching the exit code, `finalUrl` reported-never-gating
  with the gate's byte-identity asserted, and the `_note` sentence verbatim
  from the spec. No route to a false attestation or accusation is created;
  the author-rubber-stamp exposure is disclosed in the three places that
  matter (spec, README, `_note`).
- **The seams hold.** Every Interfaces block matches its consumer
  name-for-name and type-for-type (I checked each pair); the one prior-plan
  failure mode - two copies of one rule - is specifically engineered out
  (`dropContained` shared, one message builder, one `isReadable`, one
  `readSource`, one version string).
- **Test discipline**: every new behaviour has a mutation step proving its
  test can fail; boundary tests built FROM the constants; the enumerated
  literal-substitution table with pre-verified counts is the right way to
  land a breaking change on a suite.
- **The doc-drift task exists and mostly works** - the sweep list is real
  (all seven items verified as currently-false-or-about-to-be), and "name
  every sentence's pin" is the right closing discipline. The corrections
  above extend it; they do not redesign it.
