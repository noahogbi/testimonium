# What 0.6.0 moves: 618 live URLs, and four constructed fixtures

0.6.0 ships two tightenings against false attestation (design spec
`2026-09-20-testimonium-0-6-0-design.md`):

- **route 2** - `src/text/extract.ts` now parses a `<meta>` tag's attributes into
  name/value pairs instead of matching `IS_DESCRIPTION`/`CONTENT_ATTR` against
  the whole tag string. The old regexes fired on a substring appearing
  anywhere in the tag - inside another attribute's name, or inside another
  attribute's VALUE - so a malformed page could harvest leaked text that was
  never a description, or lose its real description to a `data-content`
  collision. This is the only route that can change `toText`'s committed
  BYTE output, so it is the only route this report's live-corpus measurement
  (question 1) can see.
- **route 1** - `check()` and `harvest()` now match a claim within a single
  extraction region (the body, or one description value) rather than across
  the flat concatenation `toText` used to hand them. A claim spanning the
  join between two regions used to match text that exists nowhere on the
  page; it no longer does. Route 1 does not change `toText`'s output at all -
  proven in tasks 2 and 3's own reviews by diffing `text`/`proseChars` across
  every fixture between the pre- and post-route-1 commits, 0 mismatches - so
  it cannot appear in this report's before/after `proseChars` delta and is
  answered separately, from constructed fixtures (question 2).

**Headline: route 2 moved nothing on this corpus.** Not "0 floor crossings" as
the weaker claim - `textBefore === textAfter`, the exact string, on all 551 of
618 URLs that yielded a reading. 486 of those 551 readings carry a harvested
description in BOTH arms, so this is not an artifact of most pages lacking a
description tag to disagree over; the old (whole-tag-substring) extractor and
the new (attribute-parsing) extractor agree on every single one, byte for
byte. Zero URLs cross the 4,500 prose floor in either direction. The hard
stop specified in task-6-brief.md - stop after writing this report if any
page crosses upward - did not trigger.

## Counts

| | |
| --- | --- |
| URLs measured | 618 of 618 |
| yielded a reading | 551 (67 no-read) |
| non-vetoed (after) | 534 (17 vetoed) |
| readings with a harvested description (either arm - identical) | 486 of 551 (88.2%) |
| **readings where `textBefore !== textAfter`** | **0 of 551** |
| **crossed the 4,500 floor, either direction** | **0** |
| `vetoedBefore !== vetoedAfter` | 0 |
| `challengeSignatureBefore !== challengeSignatureAfter` | 0 |
| proseAfter >= 4,500 (at/above floor) | 487 of 551 |
| proseAfter < 4,500 (below floor) | 64 of 551 |

That 551 (not 549, `docs/description-movement-0-5-0.md`'s figure from
2026-09-18) yielded a reading is consistent with four days of ordinary live-
web churn on a 618-URL corpus, not a discrepancy to explain - see "Limits".

## Method

This is a DIFFERENT comparison from `docs/description-movement-0-5-0.md`'s
own. That report compared "no `<meta>` ever harvested" (0.5.0's before) to
"0.5.0's description harvest" (0.5.0's after), to measure what THAT release
changed. 0.6.0 already harvests descriptions; what changed is WHICH text a
malformed tag yields. Stripping `<meta>` tags entirely, as the 0.5.0 script
did, would measure nothing about this release - route 2 only diverges from
the pre-0.6.0 extractor on tags shaped to trigger the substring-matching bug
(a leaked keyword, a `data-content` collision, a `content="..."` planted
inside another attribute's value), which almost no real page's markup is
shaped to trigger.

So `scripts/description-movement.mjs` was rewritten (not merely re-run) to
compare, for the SAME fetched bytes:

- **before** - the genuine pre-0.6.0 (commit `ac71498`, the last commit
  before route 2's fix) `toText`: `IS_DESCRIPTION`/`CONTENT_ATTR` whole-tag
  substring matching, flat single-string output. Ported mechanically into
  the script (TypeScript type annotations stripped, nothing else changed).
- **after** - the CURRENT `computeSignals`, i.e. route 2's `toTextRegions`
  joined, exactly as `check()` reads a page today.

**The port was verified, not assumed, before being trusted for the live
run**, the same discipline `description-movement-0-5-0.md` used for its own
pre-0.5.0 control:

1. `git show ac71498:src/text/extract.ts` was compiled standalone with `tsc`
   (the file has zero imports, so this needed no project context) into a
   genuine, independently-produced JavaScript module.
2. The hand port was run against every `.html` fixture under `fixtures/**`
   (38 files) and compared byte-for-byte against that genuine compiled
   module's output: **38 of 38 identical.**
3. The port was refactored once more (splitting body and description text
   apart, so a floor crossing could be duplicate-checked against its own
   body without re-fetching) and re-verified against BOTH the genuine
   compiled module and the first, already-verified port: **38 of 38
   identical against each**, confirming the refactor changed nothing.
4. **Control: the comparison can detect a difference when one exists.**
   **Cases A and B** in "Question 2" below - the keyword-tag leak and the
   `data-content` collision - show the ported old extractor and the current one
   disagreeing, so the instrument is not vacuously reporting "no difference"
   because it cannot see one. **Cases C and D are NOT controls for this
   comparison**: they are route-1 cases carrying one ordinary description, where
   the two extractors agree by construction and only the MATCH position differs.
   An earlier draft of this sentence claimed all four showed the extractors
   disagreeing, inflating a two-case control into a four-case one.

Everything downstream of extraction (prose-volume calculation, the five
vetoes, challenge-signature matching) is computed by a small mirror function
in the script, `vetoSignalsForText`, parametrised on an externally supplied
`text` rather than deriving it from `rawBody` via `toTextRegions` - because
`computeSignals` always extracts with the CURRENT extractor internally, and
there is no other way to hand it the "before" text. The mirror reuses every
exported piece of the real veto arithmetic (`proseVolume`, `isBlocked`,
`matchesChallengeSignature`, `matchesChallengePath`, `THRESHOLDS`) and copies
only the four small helpers `computeSignals` keeps private
(`byLowercasedName`, `hasChallengeHeader`, `isTextualContentType`,
`looksBinary`) verbatim from `src/classify/signals.ts`. **Sanity-checked**
by calling both the real `computeSignals` and the mirror on the SAME
(current) text across all 39 fixture bodies (38 `.html` plus the PDF-shaped
binary fixture) and comparing `vetoed`/`challengeSignature`/`proseChars`:
**39 of 39 identical.**

Each URL is fetched **once** and extracted **twice** from the same bytes,
exactly as 0.5.0's script did - `readSource` is sealed and not exported, so
the rung ladder is walked directly, taking the first read with a 2xx status
and a non-empty body. Which rung produced the bytes cancels out of the
before/after comparison because both arms extract the same chosen bytes.
Rate-limited at 800ms after every live fetch attempt, run as a resumable
NDJSON job (one line per URL, a restart skips URLs already recorded) against
the same 618-URL corpus `docs/description-movement-0-5-0.md` used:
`C:\users\noaho\omnisscientia\docs\superpowers\worklogs\data\2026-09-13-subfloor\urls.json`,
read only, never written to.

## Question 1: floor crossings from route 2, both directions

**Zero, in both directions, and the search behind that count is total: all
618 URLs, not a sample.** `proseBefore` and `proseAfter` were computed for
all 551 URLs that yielded a reading; the upward-crossing predicate
(`proseBefore < 4500 && proseAfter >= 4500`) and the downward-crossing
predicate (`proseBefore >= 4500 && proseAfter < 4500`) each matched 0 rows.

This is not merely "no row happened to straddle the floor." **`gain` (=
`proseAfter - proseBefore`) is exactly 0 on every one of the 551 rows** - the
full distribution is a single bar:

| gain (chars) | URLs |
| --- | --- |
| negative | 0 |
| **0** | **551** |
| 1-50 | 0 |
| 51-100 | 0 |
| 101-250 | 0 |
| 251-500 | 0 |
| 501-1000 | 0 |
| 1001-2500 | 0 |
| 2501+ | 0 |

Compare `docs/description-movement-0-5-0.md`'s own gain table for the SAME
618-URL corpus under 0.5.0's (much broader) route: 483 of 549 readings
gained something, median 148 characters, five crossed the floor. Route 2 is
categorically narrower - it only diverges from pre-0.6.0 behavior on a tag
shaped to trigger one of design spec section 3's three substring collisions,
and no publisher's real markup among these 618 pages happens to be shaped
that way.

**Because there is no crossing, there is nothing to run the fold-aware
duplication check against.** The design spec and task-6-brief.md both ask
for that check ONLY "for any crossing" - the instrument exists and was
validated (self-test below), but this corpus gives it nothing to measure.
Recorded as a null result, not a skipped one: `scripts/description-movement.mjs`'s
row schema (`regionsAfter`, `bodyBefore`, `describedBefore`) was built
specifically so a crossing COULD be duplicate-checked against its own body
without a second fetch, and the fact that no row exercises it is itself part
of what this measurement establishes.

**The duplication instrument was validated independently of this corpus**,
so its non-use here is a fact about the data, not about whether the tool
works. Self-test (case reproduced from `docs/description-movement-0-5-0.md`'s
own corrected duplication finding - two sentences differing by one word and
one apostrophe codepoint, which whole-sentence exact matching scores as
`0` duplicated and which the fold-aware cover correctly does not): folding
case, Unicode NFKC, and curly-to-straight quotes, then finding the longest
common runs of 30+ characters, covers 54 of 69 folded characters between
`"Alibaba's Qwen models are the latest to challenge Apple Intelligence."`
and `"Qwen's models are the latest to challenge Apple Intelligence,
TechCrunch has learned."` - correctly nonzero despite the strings not being
equal, confirming the instrument is not silently vacuous the way exact
matching was.

## Question 2: pages that lose a match, to either route

**Answered from constructed fixtures, not the live corpus.** The harness
passes `claims: []` (it always has - see `description-movement.mjs`'s own
docstring history), so it cannot say which of the 618 live pages would lose
a match: doing that needs the corpus's stored claim text, which lives in the
bulletin items database (Postgres `post_citations`), not in the corpus
directory this repository can read - the corpus carries only `{url, cites}`,
and a whole-repository search of omnisscientia finds these 618 URLs nowhere
else. This is the same limitation `docs/description-movement-0-5-0.md`
disclosed after the fact ("What this report cannot answer"); the difference
here is that it is disclosed in advance rather than discovered by a reader.

So this question is answered by construction instead: four minimal HTML
documents, each built to isolate ONE route's loss, run through three
matchers against the SAME html and the SAME claim, executed against the
real 049da8f build (not merely described):

- `oldMatch` - the pre-route-2 extractor (verified above), matched flat.
- `newFlatMatch` - the current (route-2-fixed) extractor, matched flat -
  isolates route 2 alone.
- `newRegionMatch` - the current extractor, matched per region
  (`toTextRegions`) - what `check()` actually does on HEAD today.

`oldMatch && !newFlatMatch` attributes a loss to route 2. `newFlatMatch &&
!newRegionMatch` attributes a loss to route 1.

### Route 2 losses (the leak closed)

**Case A - keyword leak** (design spec section 3, first bullet, verbatim
construction): `<meta name="keywords" content="'x' name='description'
LEAKED">` on an otherwise unrelated page. Claim `"LEAKED"`:

```
oldMatch (pre-route-2, flat)        = true
newFlatMatch (post-route-2, flat)   = false   <- LOST TO ROUTE 2
newRegionMatch (HEAD, per-region)   = false
```

`oldToText` output included `... 'x' name='description' LEAKED` (the leaked
fragment, harvested from a `keywords` tag); `newToText` does not contain it
at all - `parseAttrs` reads `keywords` tag's `name` attribute as literally
`"keywords"`, which is not in `DESCRIPTION_VALUES`, so the tag is skipped
entirely.

**Case B - `data-content` collision** (design spec section 3, second
bullet): `<meta name="description" data-content="WRONG"
content="THE REAL DESCRIPTION">`. Claim `"WRONG"`:

```
oldMatch (pre-route-2, flat)        = true
newFlatMatch (post-route-2, flat)   = false   <- LOST TO ROUTE 2
newRegionMatch (HEAD, per-region)   = false
```

The SAME page, claim `"THE REAL DESCRIPTION"`, shows the other half of
route 2's direction - a GAIN, not a loss:

```
oldMatch (pre-route-2, flat)        = false
newFlatMatch (post-route-2, flat)   = true
newRegionMatch (HEAD, per-region)   = true
```

The old `CONTENT_ATTR` regex matched `\bcontent\s*=` inside `data-content`
and returned `WRONG`, discarding the real description entirely (the
`Set`-based dedup then never saw it). `parseAttrs` reads the tag's actual
`content` attribute and returns `THE REAL DESCRIPTION`; `data-content` is a
different attribute name and is never consulted.

### Route 1 losses (the join seam closed)

**Case C - body|description join** (the shape `test/harvest/proposals.test.ts`
uses, per task-5-report.md): body text ending `"The committee reviewed the"`,
description beginning `"quarterly filings without objection at the March
session."`. Claim `"The committee reviewed the quarterly filings without
objection"`:

```
oldMatch (pre-route-2, flat)        = true
newFlatMatch (post-route-2, flat)   = true
newRegionMatch (HEAD, per-region)   = false   <- LOST TO ROUTE 1
```

`toText`'s flat join reads straight through the body/description boundary;
no single region (`"The committee reviewed the"` or `"quarterly filings
without objection at the March session."`) contains the claim whole.

**Case D - description|description join**: two `<meta>` descriptions,
`"The board met in March."` and `"Revenue rose twelve percent."`. Claim
`"The board met in March. Revenue rose twelve percent"`:

```
oldMatch (pre-route-2, flat)        = true
newFlatMatch (post-route-2, flat)   = true
newRegionMatch (HEAD, per-region)   = false   <- LOST TO ROUTE 1
```

Same shape as case C, at the OTHER join the flat concatenation used to paper
over - two separate meta tags, never adjacent on any rendering, that used to
read as one sentence.

Every one of the four cases above is a `matched -> missed` transition: a
page that would have counted a claim as matched now counts it as missed. On
a page that clears the 4,500 prose floor and is not vetoed, that transition
is `supported -> unsupported` in isolation (holding every other claim on the
page fixed) - a CI-visible, correct accusation for cases C and D (design
spec section 2, "The consumer-visible consequence"), and a correct refusal
to accuse for cases A and B, where the "matched" claim was never really on
the page at all.

## Question 3: did any calibration fixture move

**No. Established against the real implementation at HEAD (`049da8f`), not
assumed from the design spec's prototype sweep.**

**Route 2** (the only route that can move `toText`'s byte output - see
above): the current `dist/text/extract.js`'s `toText` was compared against
the verified pre-route-2 port across every `.html` file under `fixtures/**`
(38 files, the same set `fixtures/corpus.json`'s 36 calibration rows are
drawn from): **0 of 38 differ.** This independently re-establishes what
task 1's own review found at an earlier commit (536b757) and what task 2's
controller re-confirmed at c646317 - now checked directly against the
commit this report measures, rather than inherited from an earlier task's
check.

**Route 1** cannot move a calibration figure derived from `proseChars`, by
construction: `toText` IS `toTextRegions(...).join(" ")` (task 2's proof),
so a change that only moves WHICH region a claim matches within cannot move
the joined string task 3's own review confirmed this with 0 mismatches in
`text`/`proseChars`/`slugLabelOverlap`/`challengeSignature` across all 38
fixtures between the pre- and post-route-1 commits. The two claim-shaped
calibration scripts were checked for completeness even though route 1
changes matching, not extraction: `scripts/calibrate-claim-floor.mjs`
reprints a FROZEN 2026-09-09 measurement (`fixtures/claim-lengths.json`) and
performs no live matching at all; `scripts/calibrate-harvest-seed.mjs` calls
`commonSpans` directly on whole-document `toText` pairs, bypassing
`harvest.ts`'s per-region loop entirely, so it exercises a code path route 1
never touches.

**Confirmatory re-run**, since the cost was low with a fresh build already
in hand: `node scripts/calibrate.mjs && node scripts/sweep-floor.mjs`
against HEAD reproduce `docs/calibration-2026-09.md`'s own recorded figures
exactly - smallest real document 6,481, largest no-veto challenge 1,180,
ECB 404 fixture 13,452, sweep-floor satisfying range `[1,380, 6,281]` at
4,902 integer floors. No refresh of `docs/calibration-2026-09.md`, the
design spec, `src/classify/thresholds.ts`, `src/classify/verdict.ts`, or the
README is triggered.

## Limits

- **Route 2's live-corpus effect is small because its trigger is rare.**
  Unlike 0.5.0 (which changed behavior on every page carrying an ordinary,
  well-formed description tag), route 2 only diverges from pre-0.6.0
  behavior on a page whose `<meta>` markup happens to be shaped like one of
  the three bug-triggering patterns in design spec section 3. A search
  across 618 real, currently-cited publisher pages finding **0 of 551**
  readings with any nonzero gain (and 0 floor crossings) is consistent with
  that rarity claim; it is not proof the pattern never occurs anywhere on
  the live web, only that it did not occur in this corpus on 2026-09-22.
  A corpus built specifically to contain adversarial or malformed markup -
  this one is 618 URLs a bulletin actually cited, not a red-team sample -
  would be expected to find route 2 moving more.
- **Live pages, and the raw data is session-local**, same as
  `docs/description-movement-0-5-0.md`'s own limit: a page can change
  between two runs, nothing here is reproducible byte-for-byte from the
  URLs alone, and the raw NDJSON (`.superpowers/sdd/2026-09-21-testimonium-0-6-0/description-movement-0-6-0.ndjson`,
  fetched 2026-09-22, roughly 99 MB - larger than 0.5.0's ~51 MB because each
  row also carries `regionsAfter`, `bodyBefore` and `describedBefore` for a
  duplicate check no row ended up needing) is git-ignored and not in the
  repository.
- **Question 2 is answered from constructed fixtures, not the live corpus**,
  disclosed in advance rather than found after publication - see "Question
  2" above for why (`claims: []`, no claim text reachable from this repo).
  The four constructed cases show the MECHANISM is real and was verified by
  execution against the real 0.6.0 build; they say nothing about live
  incidence, i.e. how many of the 618 (or any other) real pages actually
  carry claims that would transition this way.
- **The duplication instrument is validated but unexercised by this
  report's own figures.** No row in this corpus crossed the floor, so no
  figure above depends on the fold-aware longest-common-run cover - the
  self-test under "Question 1" demonstrates it works, but that is a
  standalone check, not a measurement this report's headline rests on. Same
  lower-bound caveat as 0.5.0's report would carry if it were used here: a
  run shorter than 30 folded characters still reads as new text.
- **Rung selection is simplified** the same way 0.5.0's script simplified
  it: the harness takes the first rung returning a 2xx with a non-empty
  body, rather than replaying `check()`'s full escalation ladder. It cancels
  out of the before/after delta (both arms extract the same chosen bytes)
  and does NOT cancel out of the absolute figures this report does carry.
  Every count in "Counts" above - 551 readings, 534 non-vetoed, 487 at or above
  the floor, 64 below - is conditioned on that simplified selection and is not
  what `check()`'s ladder would report. An earlier draft of this bullet said the
  report carried no absolute figures; its own summary table is nothing but
  absolute figures.
