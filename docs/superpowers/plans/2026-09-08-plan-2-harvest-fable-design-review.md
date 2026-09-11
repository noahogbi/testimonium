# Fable design review: plan 2 (`harvest`) draft amendment

**Numbering owned by this document: F1-F18** (the design review's own finding
numbers). A citation like "(Fable F1)" in `src/` or `test/` may instead mean
the companion plan review, which owns its own F1-F12 - see
`2026-09-08-plan-2-harvest-fable-plan-review.md` beside this file. Preserved
here (moved out of git-ignored `.superpowers/sdd/` scratch) because 27 shipped
citations across 16 source and test files point at these two documents by
finding number, and relabelling them was rejected as riskier than preserving
the source.

Reviewed: `.superpowers/sdd/2026-09-07-plan-2-harvest/design-draft.md` against
`main @ 6546176`, read-only. Verified by running (no repo writes): `npx tsc
--noEmit` clean; `npm test` 246 passed; `probe-floor.mjs` re-run against `dist`
as-is (dist is NOT stale: every `dist/**/*.js` is newer than its `src` file and
the load-bearing constructs, `isBlocked`, `proven`, the bn/mn folds, are present
in the built output); `git status --short` clean before and after. Scratch
scripts live under `C:\Users\noaho\AppData\Local\Temp\claude\fable-review-plan2\`
(`lcs2.mjs`, `noise.mjs`, `fold-props.mjs`, `excerpt-open.mjs`).

Severity scale used below: BLOCKING = the amendment must not enter the spec
with this text; MAJOR = a plan drafted from this text would carry the defect;
MINOR = precision or wording.

**Withheld 2026-09-10.** The origin repository is not named in this review as
published, and the one claims file it names by slug is called `source-a` here,
matching the labels the plan and the calibration doc now use. Mechanical
substitutions: no finding, severity or verdict below changed.

---

## 1. Verdict

**REWORK** - the draft's central safety claim (2.5: "a URL with no non-blocked
read is reported as `unreachable`, exactly as `check` would") is false because
`isBlocked` omits P2, so sub-floor paywall stubs and 22 of the 25 challenge
fixtures are legal harvest sources; and its central refactor claim (2.4: "zero
behaviour change, covered by the existing 246 tests") cannot hold because the
repo already holds a second ladder copy with a different escalation predicate
that no test pins.

Findings: 4 BLOCKING, 6 MAJOR, 8 MINOR.

---

## 2. Findings, ranked by cost if shipped

### F1. BLOCKING - CONFIRMED. The candidate and voting predicate is `!isBlocked`, which omits P2; harvest would propose from paywall stubs and unlisted interstitials

**What is wrong.** Draft 2.5: "Candidates for a URL are the union over that
URL's non-blocked reads. A URL with no non-blocked read is reported to the
author as `unreachable`, exactly as `check` would report it." Filter 2 likewise
lets "any other cited URL V with a non-blocked read" vote.

`isBlocked` (`src/classify/verdict.ts:75-79`) is N1||N2||N3||N4||N5 only.
`verdict()` (`verdict.ts:81-91`) returns `unreachable` for a non-blocked read
whose `proseChars < THRESHOLDS.minProseChars` (P2, the 4,500 floor). So the set
"non-blocked reads" is strictly larger than "reads `check` would treat as the
document". On the calibrated corpus that gap is not theoretical:
`docs/calibration-2026-09.md:96` - "The 22 challenge fixtures that reach the
body-derived gate span 43-1,180" - i.e. 22 of 25 challenge pages pass all five
vetoes and are rejected ONLY by P2. Every one of them is a harvest source under
2.5 as written. The largest, `www-federalregister-gov-...` at 1,180 chars
(calibration row 22), is a wall whose text harvest would index.

The realistic false-attestation route is the paywall stub: a sub-floor 200 that
carries the lede and no signature. `test/check.test.ts:151-173` already pins
this as an ACCEPTED EXPOSURE for `check` ("a sub-floor stub that proves the
claim outranks a larger clean document"). Harvest turns that accepted exposure
into a generator: stub carries the lede, author quoted the lede, harvest
proposes the lede, author confirms, `check` attests `supported` against the
stub. That is exactly "the false-attestation route ... re-entered through a
different door" that 2.5 says it closes.

**Cost if shipped.** False `supported` minted by the tool's own suggestion, on
the class of page (paywall stubs) that is the common case for news sources.

**Fix.** Harvest's usable-read predicate must be the predicate under which
`check` would license a verdict from the body: `!isBlocked(s) && s.proseChars
>= THRESHOLDS.minProseChars`. Export it once from `verdict.ts` (e.g.
`isReadable(s)`), have `verdict()` and `reachability()`'s readable branch
(`src/reachability.ts:91`) and harvest all call it, and state it in 8.2
normatively: "Harvest proposes nothing from a read that would not license an
accusation." Vetoed OR sub-floor reads cast no vote in filter 2 either. Update
the 2.5 sentence to say what `check` actually does: a URL whose every read is
vetoed or sub-floor is `unreachable`.

### F2. BLOCKING - CONFIRMED. "Zero behaviour change, covered by the 246 tests" cannot hold: there are already TWO inline ladder copies with DIFFERENT escalation predicates, and no test pins either

**What is wrong.** Draft 2.4 says `check()` holds "the fetch loop inline" and
that moving it to `readSource` is "covered by the existing 246 tests; it lands
as its own task with zero behaviour change". Draft 7 repeats: "Evidence: the
246 tests pass before and after with no test changed."

The repo has two loops, not one:

- `src/check.ts:78-117` pushes `challenged: challengeHeader || challengePath ||
  challengeSignature` (lines 109-116) - N1||N2||N3.
- `src/reachability.ts:52-89` pushes `challenged: blocked` where `blocked =
  isBlocked(c.signals)` (lines 80, 88) - N1..N5.

`nextAction` (`src/fetch/ladder.ts:24-40`) escalates unless `last.proseChars >=
floor && !last.challenged`. So on a FIRST read at 404/410 with a body over the
floor (the ECB shape), or an N5 body over the floor, `check` STOPS on `node`
and `reachability` ESCALATES to `curl`. The plan 1.1 ledger recorded this and
handed it here: "Task 2: escalation divergence noted per instruction, not fixed
- check.ts stays on inline N1||N2||N3" and "Recorded so plan 2 does not inherit
a false premise" (`docs/superpowers/plans/2026-09-07-plan-1-1-extraction-ledger.md`).
The draft inherits it: it never mentions `reachability.ts`, counts two
`readSource` callers where there are three, and says "the two callers climb
identically".

No test can catch the change. `test/check.test.ts:379-392` ("a 404 or 410
vetoes even a full match, end to end") asserts `verdict` and the absence of
`evidence`, not `rungsAttempted`; every `rungsAttempted` assertion in that file
(lines 53, 129, 145, 169, 204, 274, 303, 332) uses a first read that is
sub-floor or N1..N3-challenged, where both predicates agree.
`test/reachability.test.ts:49-60` asserts `readable`/`unreadable` only. So a
`readSource` unified on EITHER predicate changes one caller's rung sequence and
the suite stays green. That is the repo's own named defect class - an
instrument that reports success without being able to fail - for the third
time (ledger: "second instance of an instrument reporting success without
running").

**Cost if shipped.** A silent change to which rung's text `check` (or
`reachability`) judges, undetectable by the suite the draft cites as its
evidence; and the spec 5.1 "un-copyable" rule stays violated by a second copy
the amendment does not acknowledge.

**Fix.** (a) The amendment DECIDES the escalation predicate and records why.
Recommended: escalate unless the read is usable (`isReadable`, F1) - the
reachability semantics, which also match the ladder's stated purpose ("some
hosts challenge node fetch and hand curl the document"; a 404 to node and a
document to curl is the same shape). (b) Before the move, add two tests per
caller pinning `rungsAttempted` for a first read vetoed ONLY by N4 and ONLY by
N5 with body >= floor, so the move can fail. (c) `readSource` has three
callers: `check`, `reachability`, `harvest`; `reachability` moves onto it in
the same task, or the copy remains. (d) 2.4's "Ladder decisions depend only on
`proseChars` and the challenge flags" should read "on `proseChars`, the
`challenged` flag as computed by the caller, the available rungs, and
`isPdf(url)`" - the flag is precisely the thing that differs.

### F3. BLOCKING - CONFIRMED. Self-validation (2.7) does not validate the offset map; `foldWithMap` has a map/folded length desync that 2.7 passes

**What is wrong.** Draft 2.7: "what it validates is the offset map's round trip
- that the source characters the map picked out re-normalize to the folded span
that was matched." It does not. `phraseFound(text_R, s)` where `s` is a
contiguous slice of `text_R` is `norm(text_R).includes(norm(slice))`, which is
true for ANY contiguous slice unless `norm` is non-homomorphic across the
slice boundary (bn/mn folds, comma-before-space, trim). A slice that the map
placed at the WRONG offset is still a slice of `text_R` and passes.

And the map does place slices at the wrong offset. `src/text/excerpt.ts:95`
pushes `(FOLD[raw] ?? raw).toLowerCase()` per input code unit with ONE
`map.push(i)`; `"\u0130".toLowerCase()` (LATIN CAPITAL I WITH DOT ABOVE,
standard in Turkish text) is two code units, so `folded.length = map.length +
1` after each such character. Measured with `fold-props.mjs`: a source with one
U+0130 before the span gives `folded.length` 109 vs `map.length` 108; the
map-derived slice of the span "the budget will rise by twelve percent" is
`"he budget will rise by twelve percent "` (first character lost, one trailing
character gained), and `phraseFound(text, slice)` is TRUE. 2.7 emits it. The
author is shown a claim that is not their words and not a span the source
"says" in any useful sense; if confirmed, `check` attests it (it IS in the
source), so the failure is unrecognisable proposals, not a false verdict - but
2.7 is described as a guard and it guards nothing here.

`excerptFor` (`excerpt.ts:170-200`) tolerates the same defect today because its
window is 240 chars wide and it re-checks `phraseFound(slice, claim)` on the
WINDOW (line 200), so a one-character shift stays inside the excerpt. Plan 1's
excerpts are shifted by one character per preceding U+0130 - a latent plan-1
defect this review surfaces in passing.

Also confirmed for the record: `norm(s).length <= foldWithMap(s).folded.length`
on all 17 property cases (so seeding at the floor on folded text cannot miss an
above-floor span - see Q3), and `folded.trim() !== norm(s)` for bn/mn inputs,
Greek final sigma and astral-plane letters, as the draft expects.

**Cost if shipped.** Garbage proposals on any source with Turkish, Azeri or
other dotted-I text; a 2.7 that the spec will describe as the guard for the
`foldWithMap <-> norm` seam while it cannot detect the seam's actual failure.

**Fix.** (a) Repair `foldWithMap`: push one map entry per OUTPUT code unit (loop
over the lowercased result), and add an invariant test `folded.length ===
map.length` over a Unicode-heavy property set including U+0130, U+03A3 final
sigma and an astral letter. (b) Rewrite 2.7 as a real round trip: emitted slice
`s` must satisfy `foldWithMap(s).folded === matchedFoldedSpan` (exact equality
in fold space, the space the match was made in) AND `phraseFound(prose, s)` AND
`phraseFound(text_R, s)`. (c) A non-zero self-validation failure count is a bug
signal, not a filter statistic: the report says so and exit code stays 0 but
the line is labelled `BUG:`.

### F4. BLOCKING - CONFIRMED. The calibration rule in 3.4 is self-contradictory on this corpus: its two criteria license F=13 and F>=31 respectively, and the "13-20 band" comes from only one of them

**What is wrong.** 3.4: "The floor is licensed at the smallest F that admits
ZERO spurious real claims and ZERO host-different by-chance spans, plus a
margin." 3.3 calls 13-20 "the band the data supports".

Measured (`lcs2.mjs`, seed-and-extend on `norm` output over all 45 pairs of the
10 document fixtures; the corpus has ZERO host-same pairs, so every pair is
host-different): longest common spans per pair are `" terms of use privacy
policy "` (29-30), `"s accessibility statement "` (26), `" the relationship
between "` (26), `" artificial intelligence "` (25), `". all rights reserved.
"` (23), `" skip to main content "` (22). Pairs with a common span >= F: F=13
-> 45/45, F=16 -> 41, F=20 -> 25, F=25 -> 13, F=30 -> 1, F=40 -> 0.

So criterion 1 (zero spurious real claims) gives F=13; criterion 2 (zero
host-different by-chance spans) gives F=31. Applied literally, 3.4 licenses
F>=31, which refuses 45+ of 203 real claims (22%+), not 8-12%. And the
host-same/host-different split does not separate boilerplate from chance:
`terms of use privacy policy`, `all rights reserved` and `skip to main content`
are boilerplate that crosses hosts. The two criteria are also measuring
different things: criterion 1 is the loader's correctness question (can a real
claim attest against the wrong page); criterion 2 is harvest's precision
question (how much noise does seed-and-extend generate). Only the first belongs
to `minClaimChars`.

**Cost if shipped.** Either the calibration task is unsatisfiable as written and
gets "interpreted" (the exact way numbers go quietly wrong here), or the floor
lands at 31+ and Q3's cost triples.

**Fix.** Split the numbers and the criteria. `minClaimChars` (loader refusal) is
licensed by criterion 1 plus an a-priori margin (see F6). Harvest's seed length
`L` is a separate constant chosen for precision (see F7). Cross-fixture spans
feed a hand-classified table (boilerplate vs chance); only chance spans inform
the floor discussion, and boilerplate spans seed `src/rules/boilerplate.ts` and
the frequency filter's justification. The acceptance test pins the loader
floor only.

### F5. MAJOR - CONFIRMED (fixture) / PLAUSIBLE (redirect). Two more doors: above-floor un-vetoed walls and wrong-page reads are legal harvest sources, and the draft does not name them

**What is wrong.** Q1 asks for "any path by which text from a vetoed or wrong
read can reach the draft file". Two paths survive even after F1:

1. The known-gap fixture (`fixtures/corpus.json:249-256`): the ECB error page
   at status 200, 13,221 extracted chars of intact navigation, no signature,
   passes N1..N5 AND P2. `check` accuses from it today (spec 6.3:462-469 calls
   this the measured exposure). Harvest would index it; a draft that mentions
   "European Central Bank" or "monetary policy decisions" gets those spans
   proposed for the dead URL, and `check` then attests them against the error
   page. The frequency filter catches this only if a second cited URL carries
   the same nav text.
2. A read whose `finalUrl` is the site's homepage or a login page over the
   floor (redirect on a moved article). Homepages list current headlines; the
   author quoted the headline; harvest proposes it; `check` attests it while
   the headline is on the homepage and accuses when it rotates off. The draft
   never reads `finalUrl` (which `RawResponse` carries and `computeSignals`
   receives).

Spec 8:769-770 - "everything harvest emits goes through the same checker, so a
bad harvest produces visible misses, never a false `supported`" - is false for
both classes and the amendment leaves it standing.

**Cost if shipped.** A false `supported` minted from a page that is not the
document, on the one fixture the corpus already holds for that purpose.

**Fix.** Record both in 8.2 as accepted exposures with the same wording
discipline as the README's "Measured limits", correct spec 8:769-770 in the
same amendment ("harvest can only propose what the checker would attest; where
the checker is already exposed above the floor, harvest is exposed with it"),
and: (a) report `finalUrl` per URL and flag any read whose final path differs
from the cited path - cheap, no new heuristic; (b) treat the known-gap fixture
as the evidence draft section 6 says footnote-proximity attribution is waiting
for, and schedule it, even if not in plan 2.

### F6. MAJOR - PLAUSIBLE (on CONFIRMED numbers). "Smallest F admitting zero spurious" is a fit to two events; the licence should be a-priori with the measurement as a sanity check

**What is wrong.** Criterion 1 rests on n=2 spurious events (`"169"`, `"SAUDI
ARABIA"`) among 25 claims under 21 chars against 10 pages. The longest spurious
claim (12) is a point estimate; one more fixture with a two-word proper noun in
it moves it to 18. The acceptance test as drafted ("mutating the floor by +-4
kills a named test in each direction") then pins the corpus, not the property -
the same shape as the ECB-size dependence `test/check.test.ts:175-200` was
rewritten to avoid. The draft's own words in 3.3 ("a bare number is present on
any page carrying that number") are the real licence: it is a-priori, the way
spec 6.3:521-526 says the status argument had to become.

**Cost if shipped.** A floor that looks measured and is not; a `docs/` number
that changes when the corpus grows and is then defended as calibrated.

**Fix.** State the floor's licence as: a-priori argument (bare numbers and
single tokens attest nothing) + measurement confirming no real above-floor
claim matched an unrelated page + margin over the longest observed spurious
match. Pick F in the 16-20 range on that basis and say the sample is small.
Keep the mutation test but phrase what it pins: that the named spurious claims
are refused and the named shortest-clean claims admitted at THIS corpus.

### F7. MAJOR - CONFIRMED. Seeding at exactly `minClaimChars` conflates harvest precision with loader correctness; at the floor the noise is heavy, and spans end mid-word

**What is wrong.** 2.3 sets `L = THRESHOLDS.minClaimChars`. Measured
(`noise.mjs`, distinct maximal common spans per UNRELATED fixture pair): L=13
mean 24.8 spans per pair (max 269); L=16 mean 5.0 (max 51); L=20 mean 0.9;
L=25 mean 0.2. A draft citing ten sources at L=13 would receive hundreds of
by-chance proposals before filters 2-3, and filter 2 only removes spans shared
by two CITED sources. The spans are also character-maximal, so they end
mid-word: observed `"s the ability to"`, `"communications w"`, `"s terms of use
privacy policy"`. And the map-derived slice carries the source's raw whitespace
run (the map records the offset of the FIRST character of a run,
`excerpt.ts:90-91`), so an emitted claim can contain `"\n\n  "`.

**Cost if shipped.** Review burden that defeats harvest's purpose (the draft's
own "over-proposal costs review time"), and claims files full of fragments the
author has to trim by hand.

**Fix.** Decouple: `harvestSeedChars` (precision; 20-25 by these numbers) is a
separate constant that MUST be >= `minClaimChars` (a test asserts the
inequality). Snap span ends outward-then-inward to word boundaries in fold
space before mapping back, then apply filter 1. Collapse whitespace runs in the
emitted slice (norm-equivalent, so `check` is unaffected). None of this touches
the loader floor.

### F8. MAJOR - CONFIRMED. Harvest's output and its read of the existing claims file both collide with `parseClaimsFile` as it stands

**What is wrong.**

- 2.8 keys the draft file "by the URL as cited in the document". `parseClaimsFile`
  (`src/io/claims.ts:45-52`) THROWS when two keys normalize alike. A document
  citing `https://x.org/a` and `https://x.org/a/` (or `http://` vs `https://`,
  or a `#fragment`) produces a draft file that `check` refuses with exit 2
  after the author renames it.
- Filter 4 reads `<doc>.claims.json` with, presumably, the same parser. After
  Q3 that parser refuses any file holding a sub-floor claim, so on exactly the
  files harvest is meant to help migrate (section 5: "[the origin repository]'s
  four files would need 15-25 edits") harvest exits 2 before proposing anything.
- Filter 4 says nothing about a `{ "notApplicable": "<reason>" }` entry for U
  (`claims.ts:78`). Harvest should propose nothing for a URL the author has
  declared not checkable.

**Fix.** Key the draft by ONE spelling per `normalizeUrl` key (the first
citation's spelling), and say so. Decide filter 4's behaviour on a refused
existing file and write it down - recommended: exit 2 with the loader's own
message (uniform refusal means harvest does not get a lenient parser), with the
README migration note saying "run harvest AFTER fixing the named claims".
Skip `notApplicable` URLs entirely and list them in the report.

### F9. MAJOR - CONFIRMED. Local boilerplate rules as `string[]` break the dated-rule discipline the same paragraph invokes

**What is wrong.** 2.6 filter 3: bundled entries carry `lastConfirmed` and a
note ("the discipline `challenge.ts` and `hosts.ts` already follow"), but the
local rules file "gains an optional `boilerplate: string[]`". `loadRules`
(`src/rules/load.ts:12-31, 67-75`) requires `pattern`, `lastConfirmed`
(YYYY-MM-DD) and `note` on every local rule and rejects anything else; a bare
string array is a different shape with no date and no provenance - the rot the
discipline exists to make visible. Note also that unknown top-level keys in a
local rules file are silently ignored today (`load.ts:67-76`), so a
`boilerplate` key would be dropped without error by the CURRENT loader - fine
for forward compatibility, but the draft should say the loader gains the key.

Separately: "Drop `s` if `norm(s)` contains the normalized text of any rule
phrase" is a substring test, so a rule `all rights reserved` deletes a real
claim quoting a copyright dispute. Additive-only makes that recall, not
correctness, as the draft says - but say it with the example.

**Fix.** Local boilerplate rules use the `LocalRule` shape (`pattern`,
`lastConfirmed`, `note`) and `toRule`; `RuleSet` gains `boilerplate:
readonly Rule[]`. Filter 3 tests the rule's RegExp against `norm(s)`, like
`matchesChallengeSignature` does.

### F10. MAJOR - PLAUSIBLE. The frequency filter is under-specified where it matters

**What is wrong.** 2.6 filter 2 does not say: (a) which read of V - a URL has
several (rungs); (b) whether U's own other reads count (they must not, or a
node/curl pair for one URL kills every proposal); (c) how two cited URLs that
`normalizeUrl` to the same key are treated (one source, not two - otherwise a
URL cited twice with a fragment votes against itself); (d) that it is vacuous
for a single-source document (Q5). Its stated cost ("a press release and the
wire story that reprints it") is the common case in news-heavy drafts - the
origin-repository claims files cite wire copy - so the cost is not marginal and
should be quantified in calibration (how many real claims appear in two cited
sources of the same draft).

**Fix.** Filter 2: "for any OTHER normalized URL V with at least one usable
read, if `phraseFound(text_R', s)` for ANY usable read R' of V". Report the
count dropped by this filter per URL so the author can recover the reprint
case, and print a one-line notice when the document cites fewer than two
usable sources.

### F11. MINOR - CONFIRMED. "beside the other three" - `THRESHOLDS` has four entries

`src/classify/thresholds.ts:29, 41, 81, 98`: `minProseChars`,
`maxChallengeChars`, `maxBinaryDensity`, `binarySampleCodePoints`.
`minClaimChars` would be the fifth. Draft 3.1.

### F12. MINOR - CONFIRMED. "drifted from the first twice already" - three repairs

`excerpt.ts:25-30` (dash range), `:36-42` (zero-width DROP set), `:48-52`
(punctuation pull-back); commits ffb8918, c2f2f75, 1e0858b. Draft 2.2. The
direction of the error matters because the count is the argument for exporting
`foldWithMap` rather than tolerating a third rendering - it is stronger than
stated. Also note the drift class F3 adds: not a missing fold but a length
mismatch inside a fold.

### F13. MINOR - CONFIRMED. `_note` says "testimonium 0.2.0"; the code has two version strings, both "0.1.0"

`src/index.ts:9` `VERSION = "0.1.0"` and `package.json:3` `"version": "0.1.0"`
are maintained separately. Harvest stamping a version into a file the author
keeps needs ONE source; the amendment should say which (recommended: read
`package.json` via the `./package.json` export at build, or derive `VERSION`
from it) and whether plan 2 is the 0.2.0 bump.

### F14. MINOR - CONFIRMED. "`--json` prints that report as JSON instead" - the repo is inconsistent and the draft implies uniformity

`src/bin.ts:128-129`: `reachability --json` prints JSON INSTEAD of the human
report. `src/bin.ts:188`: `check --json` prints JSON IN ADDITION to the human
lines and the summary. Harvest choosing "instead" is fine; the amendment should
say it follows `reachability`, and either fix `check` or record the difference.

### F15. MINOR - CONFIRMED. Section 6's soft-hyphen statement is false

Draft 6: "a span containing U+00AD in the source fails self-validation (2.7)
and is not proposed." `norm` does not delete U+00AD (`normalize.ts:13` strips
only `[\u200B-\u200F\u2060\uFEFF]`), so a slice containing it passes
`phraseFound(text_R, slice)` (verified with `node` against `dist`: `true`).
What actually happens is upstream: the draft prose has no soft hyphen, so
seed-and-extend stops at it and the span SPLITS into two shorter spans, each
possibly under the floor. Recall loss, as the draft says, but by a different
mechanism, and one that would ALSO propose a soft-hyphen-carrying span if the
author's draft was pasted from the same source. Folding U+00AD into `norm`'s
deletion set (and `DROP`) is the right one-line fix and should stay in plan 2.

### F16. MINOR - CONFIRMED. Spec 5.3 is already false at 6546176 and the amendment edits 5.1 next to it without correcting it

Spec 5.3:239-240: primitives "are exported to the test suite through a separate
internal entry point." `package.json:11-14` exports only `"."` and
`"./package.json"`; `test/exports.test.ts:5-12` pins exactly that; the tests
import `../src/*` directly. There is no internal entry point. The draft's
`readSource` is described as "internal" in the same sense - it should say
"module-internal, imported by path inside `src/`, unreachable through
`exports`", and the amendment should fix 5.3 while it is there (Q8).

### F17. MINOR - CONFIRMED. Prose stripping (2.1) must remove MULTI-LINE footnote definitions and must not re-parse fenced code differently from the adapter

`DEFINITION` (`src/adapters/gfm-footnotes.ts:5`) is
`/^\[\^([^\]]+)\]:[ \t]*(.*(?:\n[ \t]+\S.*)*)/gm` - it consumes indented
continuation lines. A prose stripper that removes only the first line of a
definition leaks the continuation (source titles, URLs, quoted text) into
`prose`, and harvest then "finds" the source's own title in the draft. The
amendment should say `prose` is derived by removing every `DEFINITION` match
(same regex, same `blankFencedCode` pass, `gfm-footnotes.ts:49`), so the two
views of the document cannot disagree about what is a footnote.

### F18. MINOR - CONFIRMED. Under-specified mechanics a plan would have to invent

- `norm(text_V)` is recomputed per `phraseFound` call; with hundreds of
  candidate spans and ten sources that is O(spans x sources x |text|) - cache
  `norm(text)` per read (filter 2 and 2.7).
- 2.3's "linear" claim needs the seed loop to skip ahead past an extended span
  and to drop seeds already covered; the draft states containment-dedupe but not
  the skip.
- `bin.ts:87` usage string `<check|reachability>` and the `claimsPathFor` /
  `evidencePathFor` helpers (`bin.ts:70, 74`) need a `draftPathFor`; the draft
  does not mention `bin.ts` at all.
- The probe's walker would count a `notApplicable` reason string as a claim if
  one existed in the four files (none do today); the in-repo calibration script
  must skip object entries.

---

## 3. Answers to the draft's eight questions

**Q1 - keystone at every point?** No. Paths by which text from a vetoed or
wrong read reaches the draft file, in cost order: (1) sub-floor, un-vetoed
reads - paywall stubs and 22 of 25 challenge fixtures - because the candidate
predicate is `!isBlocked`, which omits P2 (F1); (2) above-floor un-vetoed walls
- the known-gap ECB fixture at 200 (F5); (3) redirect-to-homepage / wrong-page
reads with `finalUrl` never consulted (F5); (4) map-shifted slices that 2.7
cannot detect (F3). Vetoed reads themselves ARE excluded correctly by 2.5, and
`check` already excludes vetoed matches from `locatedBy` (`check.ts:154`), so
that half of 2.5 is sound. After F1's fix, (2) and (3) remain as stated
exposures and (4) is closed by the fold round-trip check.

**Q2 - source typography?** Yes. It is what `check` matches, what spec 7.3:718
requires ("what the source says"), and what the author must confirm as the
source's words. What makes proposals unrecognisable is not typography but (a)
mid-word span ends, (b) raw whitespace runs from the map, and (c) map-shifted
slices - F7 and F3. Fix those three and add `phraseFound(prose, s)` to
self-validation so every proposal is provably also in the author's draft.

**Q3 - seed at exactly `minClaimChars`?** Sound for recall: measured
`norm(s).length <= foldWithMap(s).folded.length` on every property case
(`norm` only removes or shrinks relative to the fold - bn/mn, trim, comma), so
any span with normalized length >= L has folded length >= L and contains an
L-gram seed. Filter 1 on `norm` then refuses the spans whose folded length
cleared L but normalized length did not. A seed BELOW the floor finds the same
maximal spans (extension is independent of seed length) plus shorter ones the
filter refuses, so it buys nothing and costs noise. The real question is the
opposite direction: seed ABOVE the floor for precision (F7). Recommendation:
`harvestSeedChars >= minClaimChars`, asserted by a test.

**Q4 - lowering the 8-12% cost with uniform refusal?** No design does without a
distinctiveness heuristic, because the refused claims ARE the non-distinctive
ones by construction; a token-count floor (>= 3 words) refuses the same set.
Three things reduce the felt cost: choose F at the low end (16, a-priori margin
over the observed 12) rather than 20 - that is 18 refusals (9%) not 25 (12%);
make the refusal message actionable (name the claim, its length, the floor, and
"extend to include the surrounding words"); and note that harvest itself
proposes above-floor replacements, so migration is `harvest` then edit. State
the number the calibration actually yields, not "8-12%".

**Q5 - frequency filter on single-source documents?** Vacuous, not wrong. The
floor and rules still apply; correctness does not depend on filter 2 (it is a
precision filter). A one-line notice in the report ("1 usable source: the
cross-source boilerplate filter had nothing to compare against") is enough; no
exit code change, no flag. The larger under-specification is F10.

**Q6 - refuse to overwrite its own draft?** Neither always-overwrite nor
always-refuse. Overwrite only when the existing draft's `_note` carries
harvest's own marker unchanged; if the `_note` is missing or edited, the author
has touched the file - refuse, exit 2, message says rename or delete it. This
keeps "never destroy author work" with no new flag in plan 2.

**Q7 - `readSource` in the same plan?** Own plan 1.2, landed first, containing:
the escalation-predicate decision (F2), the pinning tests that make the move
able to fail, `reachability` moved onto the shared reader (three callers, not
two), the `isReadable` export (F1), the `foldWithMap` length fix (F3) and the
U+00AD fold (F15). Every one of those is a plan-1 defect harvest would
otherwise build on. The draft's own claim that the refactor is "covered by the
existing 246 tests" is the reason it needs its own review: that claim is what a
plan-1.2 ledger would be checking.

**Q8 - false claims in section 4's edits?** Edit 5 (5.1 sentence) is accurate
but sits beside a 5.3 that is already false (F16). Edit 3 (section 14
rewording) is consistent with 6.3:447-451 and correct; 6.5:589 ("the signature
list section 6 exists to demote") is the same family but "demote" is not
false, leave it. Edit 1 (new 8.2) must NOT carry 2.5's "exactly as `check`
would" (F1), 2.7's "validates the offset map's round trip" (F3), 2.4's "climb
identically" (F2) or 3.1's "other three" (F11). The amendment should also
correct spec 8:769-770 ("never a false `supported`", F5). Edits 2, 4 and 6 are
fine.

---

## 4. Probe re-run

Re-run of `probe-floor.mjs` against `dist` as-is (not stale, see header):

- Population B: 10 document fixtures, 367,390 chars - matches 3.3.
- Population A: 205 strings, 203 distinct, keyed by footnote number, no object
  entries - matches 3.3 ("203 distinct").
- Bands (claims / matched >= 1 unrelated fixture): 1-10: 14 / 1 (`"169"`);
  11-20: 11 / 1 (`"SAUDI ARABIA"`, normalized length 12); 21-30: 20 / 0; 31-40:
  19 / 0; 41-60: 57 / 0; 61+: 82 / 0. Longest spurious: 12. Refused at F: 8 ->
  7, 12 -> 15, 16 -> 18, 20 -> 25, 25 -> 33, 30 -> 45, 40 -> 62.

**Every number matches draft 3.3 exactly.**

What the probe measures and does not: it measures real claims against
unrelated pages (Q3's loader question). It does NOT measure harvest's noise -
cross-fixture common spans - which is the 3.4 criterion-2 population and the
seed-length question. Those numbers are new and in F4/F7: longest
host-different common span 29-30 chars (boilerplate), pairs with span >= F:
13 -> 45/45, 20 -> 25, 25 -> 13, 30 -> 1, 40 -> 0; distinct maximal spans per
unrelated pair at L=13/16/20/25: mean 24.8 / 5.0 / 0.9 / 0.2.

Caveat the draft states and I confirm: the corpus has no host-same pairs at
all, so 3.4 item 3's "host-same reported separately" is an empty population on
this corpus; source-a cites `openai.com` pages (same host as the gpt-4o fixture,
different page), which would be the first host-same pair if a second openai
page were captured.

---

## 5. What is right

- The shape: no model, phrase matching as sole arbiter, propose-and-confirm,
  never writing `<doc>.claims.json`, exit 0 on zero proposals, no exit 1. All
  of it holds the refusal line spec 9 draws.
- Source typography for proposals (2.2), and the reasoning that it removes the
  markdown-side offset map entirely.
- Refusing a third normaliser and exporting `foldWithMap` instead - correct
  instinct; F3 makes it the ONLY safe path, since a third copy would inherit
  the same latent defect.
- The keystone constraint stated normatively (2.5) so it cannot be re-decided
  as an implementation detail - the mechanism is wrong (F1), the move is right.
- Cross-source frequency as the primary boilerplate mechanism, additive-only
  rules with dates and notes, and the honest expectation that the bundled list
  may ship empty.
- Uniform refusal at three readers with one constant, and refuse-not-warn for
  the reason given: a warning on a green run is not read.
- Calibration before code, an acceptance test before the number, the probe
  saved beside the draft and its numbers reproducible to the digit.
- Stating the 8-12% cost and the direction of both caveats without smoothing.
- Naming the seams in section 7 before a reviewer asked; three of the five
  were where the defects were.
- L-gram seed-and-extend with no dependency, containment dedupe, no upper cap
  on span length.
- The section 14 correction is right and matches 6.3.
