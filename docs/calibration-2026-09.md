# Calibration

Three thresholds, three dated records. `minProseChars` (plan 1) is below;
`minClaimChars` and `harvestSeedChars` (plan 2) are at the end.

**Date:** 2026-09-07 (round 3, after ruling C7) — supersedes the round-1 and round-2 records.
Round 3's own baseline numbers were then overtaken twice more, same day: the entity-decoding
fix (`6932e5e`, `4e47996`) changed several fixtures' extracted length before Task 3 added two
more fixtures on top. **Every number on this page has been re-verified against both changes**
by Task 4 (plan 1.1) - re-run the reproduce line below rather than trust a number here that
looks stale.
**Corpus:** `fixtures/corpus.json` — round 3 calibrated against 33 fixtures: 24 `challenge`,
9 `document`. Task 3 added 2 more (see "Two new body shapes" below), and a known-gap row
(below that) is filed separately; the corpus is now 36 rows: 25 `challenge`, 10 `document`,
1 `known-gap`. The known-gap row is **not** a population member and no number on this page
counts it.
**Instrument:** `toText` (Task 3) then `proseVolume` (`src/classify/thresholds.ts`), with
N4 (HTTP 404/410 veto) and N5 (non-text veto, Task 2) applied first
**Reproduce:** `npm run build && node scripts/calibrate.mjs && node scripts/sweep-floor.mjs && npx vitest run`

## Outcome: the gate closes

**All four acceptance assertions pass.** 23 of 23 tests green, `tsc --noEmit` clean.

| chosen | value | status |
|---|---:|---|
| `minProseChars` | 4,500 | **licensed** — all four assertions pass |
| `minSlugOverlap` | *withdrawn* | C1 no longer gates the verdict (ruling C7) |

The accusation gate is now **N4 first, then prose volume**. It took three rounds to get
here, and the two failures are worth more than the success — they are recorded below in
full, because the reason C1 is absent is not obvious from the code and someone will
otherwise try to add it back.

## What licenses the floor

**Re-verified for Task 4 (plan 1.1)** against the current 36-row corpus. Two of round 3's
own numbers below moved since they were first recorded - the smallest real document dropped
from 6,858 to 6,394 (the entity-heavy fixture Task 3 added is smaller than round 3's
smallest), and the ECB fixture's extracted length dropped from 13,221 to 13,216 once the
entity-decoding fix landed (`6932e5e`, `4e47996`) - and every downstream figure that depends
on them (gap, clear air, the sweep) is recomputed from the corrected numbers, not carried
forward by arithmetic on the old ones.

| quantity | value |
|---|---:|
| largest challenge fixture that no veto rejects | 1,180 |
| smallest real document | 6,394 ‡ |
| gap | 5,214 |
| **chosen floor** | **4,500** |
| clear air below the floor | 3,320 |
| clear air above the floor | 1,894 |

**‡ The smallest real document is a CONSTRUCTED fixture, and it sets the sweep's upper
bound.** `documents/entity-heavy-article.html` was authored for Task 3 (plan 1.1) to
exercise the entity table; it is real-*shaped*, not a real capture, and the rest of this
page marks non-measured properties with a dagger for exactly this reason. At 6,394 it is
now the corpus's smallest document, below the smallest real capture
(`blog-mozilla-org-en-.html`, 6,858), so it - not a measured page - is what caps the floor
sweep, moving that cap from 6,658 to 6,194. Two consequences worth being explicit about:
the upper end of the licensed range is now set by a file this project wrote, and shortening
that fixture would narrow the range further. Neither affects the chosen floor of 4,500,
which sits far from both ends, but neither should be discovered later either.

Both margins are more than nine times the 200-character margin the acceptance test
requires. `scripts/sweep-floor.mjs` (added for this re-verification, so the figure can be
re-run rather than trusted) sweeps every integer floor from 1 to 120,000 and checks all four
acceptance assertions at each one; it finds **4,815 values** that satisfy every assertion, a
contiguous range of `[1,380, 6,194]`. 4,500 sits 3,120 above its lower bound and 1,694 below
its upper. The choice is not delicate. (Both figures re-run 2026-09-07 after plan 1.1's
final fix round, against a fresh `npm run build`: unchanged.)

The three challenge fixtures that extract far past this floor — the Cloudflare blog 404 at
2,154, the PDF-binary fixture (Task 3) at 6,221, and the ECB 404 at 13,216 — never reach
prose volume: the two 404s are rejected by **N4** and the PDF binary, served at 200, is
rejected by **N5** (it is not text at all). That is the whole reason the floor gets to be
this comfortable. **N4 and N5 are both load-bearing now**: without N4, the ECB page alone
makes these assertions unsatisfiable (round 1's finding); without N5, the PDF-binary
fixture's 6,221 extracted characters would sit inside the gap between 1,180 and 6,394 and
collapse most of it.

## The two populations

**Re-verified for Task 4 (plan 1.1)** to include Task 3's two additions and the
entity-decoding drift; both population counts and the challenge maximum changed from
round 3's original record.

### `challenge` (n = 25)

Prose volume: min 43, max 13,216. **Excluding the three vetoed fixtures (two by N4, one by
N5): 43 to 1,180.** Status: 23 at 200, 2 at 404.

### `document` (n = 10)

Prose volume: min 6,394, max 108,248. Status: all 200.

### Read together

The 22 challenge fixtures that reach the body-derived gate span 43–1,180. The ten
documents span 6,394–108,248. Nothing lies between 1,180 and 6,394 **among fixtures that
reach the gate** - but the PDF-binary fixture's own raw prose volume, 6,221, sits inside
that numeric gap. It never reaches prose volume at all: N5 vetoes it first, on body shape
rather than length, which is exactly why N5 has to run before the floor is consulted rather
than being another number to tune. The separation among fixtures the floor actually judges
is not marginal, and no such fixture sits near the boundary from either side.

## Which mechanism does the separating, for which fixtures

| mechanism | fixtures decided | notes |
|---|---:|---|
| **N4 (HTTP 404/410 veto)** | 2 challenge (#23, #24) | The Cloudflare blog 404 and the ECB 404. Both statuses measured twice. Neither is separable by body shape — the ECB page out-extracts two real documents. |
| **N5 (non-text veto, Task 2)** | 1 challenge (`pdf-binary-served-at-200.bin`, Task 3 - not one of the 33 numbered rows below; see "Two new body shapes") | Extracts to 6,221 characters, past the 4,500 floor on length alone, and served at 200 so N4 does not see it either. Only a check on the raw body's own bytes catches it. |
| **Prose volume >= 4,500** | 22 challenge (#1–#22), 10 document (#25–#33 plus `entity-heavy-article.html`, Task 3 - not row-numbered below) | Every one clears by margin. Largest challenge in this group is 1,180 against a 4,500 floor; smallest document is 6,394 (`entity-heavy-article.html`), not 6,858 as recorded when this table was first written - see "Two new body shapes". |
| **Slug/label overlap** | **0** | Withdrawn from the verdict. Still computed and printed. See below. |

## Why C1 was withdrawn — the finding worth keeping

`slugLabelOverlap` is still exported and still printed by `scripts/calibrate.mjs`, but it
no longer influences any verdict. Three measurements killed it, and the third is the one
that matters.

**Round 1 — the signal was circular.** The overlap drew content words from the document's
own `<title>`. A title arrives in the *same response* as the body, so every page contains
its own title by construction. All 12 corpus fixtures carrying a title scored title-only
overlap of exactly **1.00** — challenge and document alike. Exhaustive search over 24,915
threshold pairs: **zero** solutions with the ECB fixture present, 249 without it.

**Round 2 — with the title removed, the vacuous case appeared on the document side.**
`blog.mozilla.org/en/` has path `/en/`, and `en` falls under the four-character
content-word floor, so it scores the documented vacuous **0.00** — identical to the
Federal Register anti-scraping wall. The populations share their minimum, and no threshold
fits between two equal values. Exhaustive search over 33,165 pairs: 414 solutions,
**every one at a negative threshold**, none at `V >= 0`. A negative bound on a [0,1] metric
is not a calibration; it is C1 switched off wearing a number.

**And in both variants the ordering is inverted.** This is the decisive one. Restricted
to the fixtures where the signal is measurable at all, C1 does not merely fail to
separate — it ranks the populations backwards, and it does so under *either* definition of
the metric:

| metric variant | highest-scoring challenge | lowest-scoring document | verdict |
|---|---|---|---|
| **round 1**, title included | `www-federalregister-gov-...` at **0.80** | `developer-mozilla-org-...HTTP-Status` at **0.75** | inverted |
| **rounds 2-3**, URL path only | `blog-cloudflare-com-...` at **0.33** | `blog-mozilla-org-en-` at **0.00** | inverted |

The 0.80-over-0.75 pair is the sharper evidence, because round 1 is the version where C1
had its richest inputs and it *still* ranked an anti-scraping wall above a real reference
page. Any threshold placed between those two values rejects the document and admits the
wall. C1 is not a weak signal on this evidence; it is **anti-correlated**.

A gate that does no work while implying safety is worse than no gate, so C1 was removed
from the verdict rather than left in place with a permissive number. It is kept as
computed output because it is useful `--explain-fetch` material and the natural starting
point if someone later assembles a corpus where it discriminates. **Nothing should
reintroduce it to the accusation path without a fresh calibration run showing separation
on real fixtures.**

### C1's evidence base was always document-only

Worth recording so the withdrawal is not re-litigated from the same thin data: 21 of the
24 challenge fixtures are constructed battery bodies carrying no URL, so their 0.00 is the
*absence of an input*, not a measurement of the signal. The one non-vetoed challenge with
a real URL (Federal Register) scores 0.00 too. The two challenge fixtures with informative
overlap scores are both vetoed by N4 first. So every constraint that ever shaped
`minSlugOverlap` came from the nine documents, and there is not one fixture in the corpus
that C1 rejects and prose volume admits.

## Statuses: how each one was obtained

Two corrections to what earlier briefs claimed, both confirmed by reading the files:
`fixtures/challenge-battery.mjs` does **not** declare statuses — its tuples are
`[name, isBotCheck, text]` — and `scripts/capture-fixtures.mjs` logged `r.status` without
persisting it (now fixed). Statuses therefore come from three sources of three different
strengths, and the corpus mixes them:

1. **Measured (12 fixtures).** The capture script's stdout is preserved verbatim in
   `task-3-report.md`; a re-fetch of all 12 URLs on 2026-09-07 agreed **12 of 12** on
   status. Two are 404 (ECB, Cloudflare blog); ten are 200.
2. **Declared by case name (4 fixtures).** `paywall-stub-at-200`,
   `soft-404-served-at-200`, `gdpr-geo-block-at-200`, `cookie-consent-wall-at-200` state
   their status in the name, and the battery header groups them as "the adjacent open
   class of 2xx pages that are NOT bot checks".
3. **Stipulated (17 fixtures, marked with a dagger below).** The constructed bot-wall
   bodies have no response attached and no declared status. 200 was stipulated as the
   **adversarial worst case**: it maximises the fixture's chance of passing the gate, so
   it cannot make the suite artificially green, and it matches the tool's premise that
   walls served at 200 are what defeat link checkers. Since N4 keys only on 404/410, any
   non-404/410 value gives identical results for every assertion.

**No fixture was assigned 404 or 410 that was not measured as such.** `soft-404-served-at-200`
is the case that proves N4 is not quietly doing more than it should: it is semantically a
404 but its declared status is 200, so N4 does **not** veto it, and it is rejected on
prose volume instead.

## Per-fixture data (all 33)

A dagger marks a stipulated status. Overlap is reported but does not gate. This table is
round 3's original 33 rows only; Task 3's two additions (`pdf-binary-served-at-200.bin` and
`entity-heavy-article.html`) are not numbered here - see "Two new body shapes" below for
those.

| # | fixture | kind | status | prose | overlap | outcome | decided by |
|---:|---|---|---:|---:|---:|---|---|
| 1 | `challenge/datadome-block.html` | challenge | 200 † | 43 | 0.00 | rejected | prose (4,457 clear) |
| 2 | `challenge/stock-react-vite-noscript-shell.html` | challenge | 200 † | 46 | 0.00 | rejected | prose (4,454 clear) |
| 3 | `challenge/cloudflare-noscript-line.html` | challenge | 200 † | 58 | 0.00 | rejected | prose (4,442 clear) |
| 4 | `challenge/imperva-incapsula.html` | challenge | 200 † | 80 | 0.00 | rejected | prose (4,420 clear) |
| 5 | `challenge/perimeterx-human-press-and-hold.html` | challenge | 200 † | 106 | 0.00 | rejected | prose (4,394 clear) |
| 6 | `challenge/gdpr-geo-block-at-200.html` | challenge | 200 | 107 | 0.00 | rejected | prose (4,393 clear) |
| 7 | `challenge/paywall-stub-at-200.html` | challenge | 200 | 111 | 0.00 | rejected | prose (4,389 clear) |
| 8 | `challenge/soft-404-served-at-200.html` | challenge | 200 | 128 | 0.00 | rejected | prose (4,372 clear) |
| 9 | `challenge/vercel-security-checkpoint.html` | challenge | 200 † | 138 | 0.00 | rejected | prose (4,362 clear) |
| 10 | `challenge/eurlex-202-the-fixture.html` | challenge | 200 † | 157 | 0.00 | rejected | prose (4,343 clear) |
| 11 | `challenge/amazon-robot-check.html` | challenge | 200 † | 165 | 0.00 | rejected | prose (4,335 clear) |
| 12 | `challenge/eur-lex-french.html` | challenge | 200 † | 174 | 0.00 | rejected | prose (4,326 clear) |
| 13 | `challenge/cookie-consent-wall-at-200.html` | challenge | 200 | 175 | 0.00 | rejected | prose (4,325 clear) |
| 14 | `challenge/cloudflare-retired-pre-2023-wording.html` | challenge | 200 † | 200 | 0.00 | rejected | prose (4,300 clear) |
| 15 | `challenge/anubis-foss-site-bot-wall.html` | challenge | 200 † | 207 | 0.00 | rejected | prose (4,293 clear) |
| 16 | `challenge/cloudflare-turnstile-checkbox-page.html` | challenge | 200 † | 214 | 0.00 | rejected | prose (4,286 clear) |
| 17 | `challenge/bloomberg-wall.html` | challenge | 200 † | 223 | 0.00 | rejected | prose (4,277 clear) |
| 18 | `challenge/cloudflare-managed-challenge-ing-form.html` | challenge | 200 † | 281 | 0.00 | rejected | prose (4,219 clear) |
| 19 | `challenge/google-sorry-page.html` | challenge | 200 † | 396 | 0.00 | rejected | prose (4,104 clear) |
| 20 | `challenge/perimeterx-block-page.html` | challenge | 200 † | 466 | 0.00 | rejected | prose (4,034 clear) |
| 21 | `challenge/cloudflare-turnstile-cookie-privacy-boilerplate-800-chars.html` | challenge | 200 † | 982 | 0.00 | rejected | prose (3,518 clear) |
| 22 | `challenge/www-federalregister-gov-documents-2024-01-29-2024-01580-.html` | challenge | 200 | 1,180 | 0.00 * | rejected | prose (3,320 clear) |
| 23 | `challenge/blog-cloudflare-com-cloudflare-incident-on-november-18-2025-.html` | challenge | 404 | 2,154 | 0.33 | rejected | **N4 veto** |
| 24 | `challenge/www-ecb-europa-eu-press-pr-date-2024-html-index-en-html.html` | challenge | 404 | 13,216 | 1.00 | rejected | **N4 veto** |
| 25 | `documents/blog-mozilla-org-en-.html` | document | 200 | 6,858 | 0.00 | reaches accusation | prose (2,358 clear) |
| 26 | `documents/www-theverge-com-tech.html` | document | 200 | 16,449 | 1.00 | reaches accusation | prose (11,949 clear) |
| 27 | `documents/developer-mozilla-org-en-US-docs-Web-HTTP-Status.html` | document | 200 | 23,595 | 0.50 * | reaches accusation | prose (19,095 clear) |
| 28 | `documents/www-bls-gov-news-release-cpi-nr0-htm.html` | document | 200 | 24,248 | 1.00 | reaches accusation | prose (19,748 clear) |
| 29 | `documents/docs-python-org-3-library-json-html.html` | document | 200 | 26,208 | 1.00 | reaches accusation | prose (21,708 clear) |
| 30 | `documents/www-gov-uk-government-news.html` | document | 200 | 33,070 | 1.00 | reaches accusation | prose (28,570 clear) |
| 31 | `documents/apnews-com-hub-technology.html` | document | 200 | 45,390 | 1.00 | reaches accusation | prose (40,890 clear) |
| 32 | `documents/openai-com-index-gpt-4o-system-card-.html` | document | 200 | 76,930 | 1.00 | reaches accusation | prose (72,430 clear) |
| 33 | `documents/en-wikipedia-org-wiki-Textual-criticism.html` | document | 200 | 108,248 | 1.00 | reaches accusation | prose (103,748 clear) |

*(Rows 24, 27–30, 32, and 33 were corrected for Task 4, plan 1.1: their extracted lengths
shifted by a few characters each after the entity-decoding fix (`6932e5e`, `4e47996`) landed,
after round 3's numbers above were first recorded. Confirmed directly against `toText`'s
current output, not carried forward from the old table by arithmetic.)*

The overlap column is what `scripts/calibrate.mjs` prints today: the current
`slugLabelOverlap`, URL path only, with no label supplied by the corpus. `*` marks the two
fixtures that formed the round-1 inversion, when the metric still included the fetched
title — #22 scored **0.80** and #27 scored **0.75** under that definition, a challenge
above a document. Those two rows are the reason C1 does not gate.

Note that the current definition inverts too, just via different fixtures: challenge #23
scores 0.33 against document #25's 0.00, and challenge #24 ties the document ceiling at
1.00. Among fixtures that actually reach the body-derived gate, the highest challenge
(#22, 0.00) exactly ties the lowest document (#25, 0.00) — the round-2 finding that no
threshold fits between two equal values.

## Known gap — a real page that reaches an accusation

**Added 2026-09-07, after the final whole-branch review. No threshold was changed.**

The ECB capture (#24) is filed in `fixtures/corpus.json` a **second time**, same file, with
`"kind": "known-gap"` and `"status": 200`. It is not part of either population and nothing
on this page counts it; the acceptance test and `scripts/calibrate.mjs` both key on
`challenge`/`document` and skip it. `test/classify/corpus-verdict.test.ts` pins it.

What it exposes, measured through the shipped pipeline:

| body | status | prose | bundled signature? | verdict |
|---|---:|---:|---|---|
| ECB error page, real capture | 404 | 13,216 | none matches | `unreachable` (N4) |
| the identical bytes | 200 | 13,216 | none matches | **`unsupported`** |

So on this page **N4 is the only thing standing between an author and a false
accusation.** Nothing about the body rejects it: 13,216 characters of intact navigation
chrome out-extracts two real documents in the corpus, and it carries no wording the
challenge-signature list recognizes.

The same hole is reachable a second way, and this one does involve the signature list:
`challengeSignature` only vetoes on a body under `THRESHOLDS.maxChallengeChars` (800
extracted characters), because a real article *about* bot walls matches every signature in
the list. **Above 800 characters the signature list stops vetoing entirely**, so a wall
carrying two bundled signatures and padded past the 4,500 prose floor reaches `unsupported`
just as the ECB page does at 200. The bundled corpus has no such fixture — the largest
non-vetoed challenge is 1,180 characters, comfortably under the floor — which is precisely
why the exposure needed pinning rather than another ledger line.

**`maxChallengeChars` and `minProseChars` were deliberately left alone.** Whether the tool
should accuse on a body it cannot distinguish from chrome is a design question with a real
cost on both sides (raising the floor loses genuine short documents; extending the
signature veto to long bodies loses articles that discuss bot walls). Moving a calibrated
number is not a bug fix, and it would invalidate this page's measurements.

## Five more known gaps, disclosed but not fixed (Task 4, plan 1.1)

**Added 2026-09-07; two more appended during the final fix round the same day.** Found
during Task 2's and Task 3's reviews and then the whole-branch review, none pinned by a
fixture - three are code-shape gaps a corpus fixture cannot cleanly isolate without also
demonstrating the fix, and two are fixed nowhere in this plan on purpose. Recorded the same
way the ECB known-gap above is: named plainly rather than left to be found in production.

Figures marked *[re-measured 2026-09-07]* were run again against the built `dist/` of the
branch as it now stands, during the final fix round. The one figure on this page that
cannot be reproduced from anything in this repository is the arxiv density below: it came
from a live fetch, and it is left as originally recorded rather than restated as if it had
been checked again.

### All-ASCII non-prose evades N5

N5's `looksBinary` (`src/classify/signals.ts`) counts replacement characters and control
bytes. Text encoded as base64, ASCII85, or PostScript's own text operators is neither of
those - it is printable ASCII, just not prose - so under a textual (or absent) `content-type`
it passes both of N5's checks. Measured directly *[re-measured 2026-09-07]*: a
26,668-character body of pure base64 (`Buffer.from(...).toString("base64")`, headers `{}`,
status 200) computes `notText: false` and reaches `verdict: "unsupported"` against a claim
it plainly does not contain - a live route to a false accusation, not a theoretical one.
Closing it needs a design for what "not prose" means beyond byte-level noise, which this
plan has not done.

### A binary tail past 64KB evades `looksBinary`

`looksBinary` samples only the first `THRESHOLDS.binarySampleCodePoints` (65,536) code
points of the raw body. Measured directly *[re-measured 2026-09-07]*: a 72,000-character
clean ASCII prose head followed by a control-byte tail (16,000 more characters) computes
`notText: false`, because the sample never reaches the tail - the body is 18% binary
overall and measures exactly 0 inside the window. Narrow -
the real arxiv PDF fixture behind Step 1's recovery is already about 59% binary within its
own first 64KB when decoded as UTF-8 (measured directly against the live paper at
`https://arxiv.org/pdf/1706.03762v7`, 38,579 of 65,517 sampled code points), so a real PDF is
unlikely to trigger this - but nothing stops a body deliberately shaped to keep its binary
content past the sample boundary. Widening or removing the sample is an unreviewed change to
a shipped veto's behavior, not a documentation fix, so it is disclosed here instead. The gap
is now pinned by a characterization test in `test/classify/signals-nottext.test.ts` that
says in its title that it documents a known gap, so the gap cannot change size silently.

### An uncompressed PDF inside the window evades `looksBinary` too

**Added 2026-09-07, final fix round.** The third N5 evasion, and the one neither disclosed
gap above covers: the body is entirely INSIDE the sample window and it does carry real
control bytes. There are simply not enough of them.

Measured directly *[re-measured 2026-09-07]*: an uncompressed PDF - text operators plus a
single 500-character embedded-font binary object - of 55,668 characters computes

| quantity | value |
|---|---:|
| body length (characters, and code points) | 55,668 |
| entirely inside the sample window | yes |
| binary characters | 500 |
| measured density | 0.00898 |
| `notText` | **false** |
| `check()` verdict | **`unsupported`**, with the claim named in `missed` |

against a threshold of 0.01. The precondition is the same as the base64 gap's - an absent or
lying `content-type`, since a truthful `application/pdf` trips N5's other trigger first -
but uncompressed content streams are an ordinary PDF shape, not a constructed oddity.

**Not closed by moving the threshold.** 0.00898 sits close enough to 0.01 that tightening
the number would appear to fix it, and that is exactly why it was left alone:
`maxBinaryDensity` has never been swept against real pages with genuinely low but non-zero
binary density (see "The two N5 constants" below), so lowering it would trade a disclosed
evasion for an undisclosed false-accusation risk on legitimate documents. That is a
calibration decision and it needs the sweep first.

### A claim inside an HTML comment can attest `supported`

Verified live on current `main`: `toText` strips HTML tags but not comment bodies, and a
commented-out block of markup always contains a `>`, which is enough to leak into the
extracted prose. A claims-file phrase present only inside `<!-- ... -->` - never in anything
a reader would see rendered - can therefore verify as `supported`: a false attestation from
text no reader sees. It is disclosed rather than fixed here because fixing it can only move a
verdict *toward* `unsupported`, which this plan's constraints forbid; it is plan 2 work. See
the README's "What this does not do" for the same disclosure aimed at a user rather than a
maintainer.

### The soft hyphen decoded but `norm()` did not strip it - a false MISS, closed by plan 1.2

**Added 2026-09-07, final fix round.** The one gap on this page that runs in the ACCUSATION
direction, and until now it was disclosed nowhere at all - not here, not in the README.

`&shy;` (U+00AD SOFT HYPHEN) is a rendering hint: a browser shows `co&shy;operation` as
*cooperation* and breaks the word there only if the line runs out. Task 1 added `shy` to the
entity table, so `toText` now decodes it into a literal U+00AD in the extracted text.
`norm()` did not remove it - U+00AD was outside both of `norm()`'s stripping ranges at that commit, which covered
U+200B..U+200F plus U+2060 and U+FEFF for zero-widths, and U+2010..U+2015 plus U+2212
for dashes. (Written as code points deliberately: every character in those two ranges is
either invisible or indistinguishable from an ASCII hyphen in an editor, and this
repository has twice been corrupted by pasting such characters literally.)

Measured directly at ae9d299 *[re-measured 2026-09-07]*, before the change, on a paragraph reading
`closer co&shy;operation on enforcement`:

| claim | `phraseFound` at ae9d299 |
|---|---|
| `cooperation` | **false** |
| `co-operation` | **false** |

Both spellings a reader might reasonably copy out missed. On a body above the 4,500-character
prose floor that was an `unsupported` verdict against an accurate citation.

**Not a regression** - it missed before this branch too, because before Task 1 the entity
did not decode at all and the raw `&shy;` sat in the text instead. Adding `shy` to the table
changed which character breaks the match, not whether it breaks. The fix belonged with
`norm()`'s folding table and was parked for plan 2 (it landed in plan 1.2, below); it was recorded here because it was the
only one of these gaps written down nowhere.

**Closed 2026-09-08 (plan 1.2).** `norm()` now deletes U+00AD alongside the zero-widths
(`src/text/normalize.ts`), and the excerpt fold drops it the same way so the offset map stays
aligned with the matcher (`DROP` in `src/text/excerpt.ts`). Deleted, not folded to a hyphen:
the character marks a place a word MAY break, so the word the page shows is the unbroken one.
Re-measured after the change, from a fresh build, with

    npm run build && node -e "Promise.all([import('./dist/text/normalize.js'), import('./dist/text/extract.js')]).then(([n, x]) => { const doc = x.toText('<p>closer co&shy;operation on enforcement</p>'); for (const c of ['cooperation', 'co-operation']) console.log(c, n.phraseFound(doc, c)); })"

| claim | `phraseFound` |
|---|---|
| `cooperation` | **true** |
| `co-operation` | **false** |

`co-operation` still misses, and should: nothing on the page says it. The fixture corpus holds
no soft hyphen in either form (39 files, 0 `&shy;`, 0 raw U+00AD, counted 2026-09-08), so no
fixture verdict moved. The one-line command above printed `false` / `false` at ae9d299 before
the change; run it again before believing this table.

## The two N5 constants, and what does and does not license them

**Added 2026-09-07, final fix round.** `THRESHOLDS.maxBinaryDensity` (0.01) and
`THRESHOLDS.binarySampleCodePoints` (65,536) moved out of `src/classify/signals.ts`, where
they were bare literals, into `src/classify/thresholds.ts` alongside `minProseChars` and
`maxChallengeChars`. **Neither value was changed.**

**They are not licensed the way `minProseChars` is, and this page should not be read as if
they were.** There is no sweep behind either one. `scripts/sweep-floor.mjs` varies the prose
floor and nothing else; the acceptance test in `test/classify/acceptance.test.ts` licenses
the floor and nothing else. What exists instead is a gap between two measured populations
that sit nowhere near each other:

| population | measured binary density | when |
|---|---:|---|
| all 34 pre-Task-3 corpus fixture rows | **0.0000** (maximum over all 34, not a mean) | re-measured 2026-09-07 |
| `fixtures/challenge/pdf-binary-served-at-200.bin` | **0.5315** | re-measured 2026-09-07 |
| real arxiv PDF bytes | 0.5888 | plan 1.1 reviewer, live fetch (38,579 binary of 65,517 sampled code points); not reproducible from this repo |
| constructed binary wrapped in tag-shaped spans | 0.316 | plan 1.1 reviewer; not reproducible from this repo |

The arxiv row was reported as 0.5887 when it was taken, computed against the 65,536-**unit**
sample window that shipped at the time. The same raw counts over **code points** - the unit
the scan uses now - give 0.5888. That difference is exactly the unit mismatch this round
closed, and it is worth leaving visible: the old denominator understated every density it
measured, always in the direction that withholds a veto.

So every measurement to date is either exactly zero or above 0.3, and 0.01 is an arbitrary
point inside a 0.3-wide empty band. **The measurement that would matter has not been made:
a sweep over legitimate pages with genuinely low but non-zero binary density, which is what
would say how much room the threshold has on the tolerant side.** That sweep is deferred.
Until it exists, moving the number in either direction is guesswork - which is why the
uncompressed-PDF evasion above, at 0.00898, is disclosed rather than closed.

The sample window is a cost bound rather than a measurement: 65,536 code points covers every
corpus fixture whole and avoids scanning multi-megabyte bodies to answer a yes/no question.
No page was ever measured to choose it.

Both constants are now bracketed by characterization tests in
`test/classify/signals-nottext.test.ts` - a body at density 0.02 is vetoed, one at 0.005 is
not, and binary beginning 2,000 characters in is detected. Before those tests, mutating
0.01 to 0.5 and 65,536 to 1,024 each killed **zero** tests; each mutant is now killed by the
test that names it.

## Two new body shapes (Task 3, plan 1.1)

**Added 2026-09-07.** Every fixture calibrated above — all 33 rows, and the known-gap
duplicate — is a friendly HTML page. Nothing in the corpus was ever a binary body or a body
dense with HTML entities, which is precisely why the two defects this plan fixes (the
un-vetoed content-negotiated PDF, and gaps in the entity table) survived sixteen reviews of
the original work. Two fixtures close that hole. The corpus is now 36 entries: 25
`challenge`, 10 `document`, 1 `known-gap`.

### `challenge/pdf-binary-served-at-200.bin`

A synthetic but structurally faithful PDF — `%PDF-1.7` header, object dictionaries, a
16,384-byte binary `stream`/`endstream` block, an `xref` table — filed `kind: "challenge"`,
`status: 200`, at `https://arxiv.org/abs/2401.01234v2` (no `.pdf`, no `/pdf/` segment: the
content-negotiated shape N4/N3 cannot see and N5 exists for).

This pins N5 (`notText`, the "body is not text at all" veto added in `78881e3`). Decoded as
UTF-8 and run through `toText`, the binary stream extracts to 6,221 characters —
**above** the 4,500-char floor by 1,721, with plenty of margin. That is the load-bearing
property: an earlier size (8KB of stream) was rejected in review because it measured a
median of 4,087 extracted characters across 200 random draws and fell below the floor
75.5% of the time — meaning the fixture would have pinned nothing, and pass or fail purely
on the floor rather than on N5. `test/classify/corpus-verdict.test.ts` asserts
`proseVolume(toText(...)) >= THRESHOLDS.minProseChars` directly on this fixture so that
claim cannot silently stop being true; without that assertion the fixture would fail
*silently*, because N5 vetoes either way in this file's `headers: {}` context and every
test would stay green regardless of which gate actually did the rejecting.

### `documents/entity-heavy-article.html`

A **constructed** (authored here, not captured) real-shaped news article using six
spellings of non-ASCII prose across its body:
`&mdash;`, `&#8212;`, and `&#x2014;` (three encodings of the same em dash), `&eacute;` /
`&Eacute;`, `&hellip;`, `&nbsp;`, `&amp;`, and `&lt;`. `kind: "document"`, `status: 200`.
Extracts to 6,394 characters, clear of the floor (and the 200-char margin) by 1,894.

This is the only end-to-end pin of Task 1's entity-table work. The corresponding test does
**not** call `run(f, [])` — `verdict()` returns `"unclaimed"` on `total === 0` before any
veto runs, so an empty-claims call would pass for any fixture, challenge shells included,
and assert nothing. Instead the test supplies a claim written the way a reader would type
it after reading the rendered page — `RENDERED_CLAIM`, built with `String.fromCodePoint`
so the test file itself stays ASCII — while the fixture spells the identical sentence with
entities. The pipeline is required to decode the entities and report `"supported"`.

## What was NOT done

No fixture was dropped, omitted, or reclassified across any of the three rounds. The
200-character margin is untouched. No assertion was weakened or deleted — the two margin
assertions still demand 200 characters of clear air, and every fixture now provides at
least 1,894 (`entity-heavy-article.html`, the new smallest document - see above; unchanged
on the challenge side, where the tightest margin is still 3,320). `proseVolume` and
`slugLabelOverlap` are byte-for-byte as specified in the
brief. No status was guessed, and none was set to 404 or 410 for convenience.

The gate closes because a signal that could not do its job was removed after being
measured three times — not because anything was tuned to make it pass.

## Calibration of `minClaimChars` and `harvestSeedChars` (plan 2, 2026-09-09)

### Populations

Four real claims files, frozen into `fixtures/claims/` so these numbers
reproduce without the origin repo. Three were copied from
`<origin repo path withheld>`'s WORKING TREE and are uncommitted there, so
their provenance is an mtime and a size and nothing stronger;
`source-c-claims.json` is not on that repo's `master` at all and was taken from
`<pinned origin commit withheld>`, a commit on its `source-c-longform`
branch. `fixtures/claims/provenance.json` records all four.

That commit was the branch tip on 2026-09-08, when this task was written. On
2026-09-09, when the freeze was taken, the tip had moved to
`78d3aa9bbdfcf5a9a8faa71c0b61f5b64973a18f` and the pinned commit is now an
ancestor of it. The file's blob is `e03e28ff6bf3727810ce52b9fdb05898a13e6171`
at both, so the freeze is unaffected - but the commit, not the branch, is the
provenance, and the record says so rather than repeating a tip that has moved.

The three working-tree rows carry a `bytes` field - 5,684 / 1,839 / 3,165,
verified equal on the origin file and on the frozen copy - so a reader can
detect divergence from the origin the way `source-c-claims.json`'s blob hash
already lets them. It is the size ON DISK at freeze time: `source-a` and
`source-b` arrived CRLF and git stores them LF, so `git cat-file -s` reports
5,591 and 1,789 for those two. A size is weaker evidence than a commit, and
this does not change that.

From `npm run build && node scripts/calibrate-claim-floor.mjs`:

```
  source-a-claims.json: 70 claim strings
  source-b-claims.json: 20 claim strings
  source-c-claims.json: 89 claim strings
  source-d-claims.json: 31 claim strings
document fixtures: 10, 367390 chars
claim strings: 210, distinct: 208
```

The walker counts claim STRINGS only: a key beginning with `_` is a note to a
human reader and a `{"notApplicable": "<reason>"}` object's reason is prose
about why a URL is not checkable, and neither is a claim. All four files key by
footnote number.

All four frozen files are pure ASCII and hold no NUL bytes - measured, not
assumed: `LC_ALL=C tr -d '\000-\177' < FILE | wc -c` prints `0` for each, and
`LC_ALL=C tr -cd '\000' < FILE | wc -c` prints `0` for each, with the
instrument proved able to report non-zero first (`printf 'a\0b' | LC_ALL=C tr
-cd '\000' | wc -c` prints `1`). A fixture is allowed to carry non-ASCII; these
happen not to.

Spec 7.3 says "203 distinct real claims" and "18 of the 203". The frozen
population is 208 distinct: the three working-tree files moved in the origin
repo between that sentence and this freeze. The refusal count at 16 is what the
script printed and is unchanged at 18; the denominator is not the spec's.

### The floor

From `node scripts/calibrate-claim-floor.mjs`, same run:

```
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

The licence is a priori and the measurement is its sanity check, not its
derivation: two spurious events are not a derivation (Fable F6). What the
measurement establishes is that no claim this corpus holds at or above 16
normalized characters matches a page it was not written about, and that the
cost of the floor is 18 of 208 claims (8.7 percent), each a number, a name or a
fragment that states no proposition. Bound by
`test/classify/claim-floor.test.ts`, whose six assertions were each shown to
fail before they were trusted: at `minClaimChars: 12` the spurious-match
assertion fails naming `'SAUDI ARABIA'` and the margin assertion fails with
`expected 12 to be less than or equal to 9`; at `60` the cost assertion fails
with `expected 0.596... to be less than 0.15`; at `harvestSeedChars: 15` the
seed assertion fails with `expected 15 to be greater than or equal to 16`; and
with the four `*-claims.json` files moved out of `fixtures/claims/` the vacuity
guard fails with `expected 0 to be greater than or equal to 200`.

That fourth mutation is the one that matters most, for what else it shows. On
an empty claims population three of the other five assertions - the
spurious-match assertion, the margin assertion and the naming assertion - PASS,
vacuously, having examined nothing at all. The guard is the only thing between
this file and a check that reports success without running, and it has now been
watched to fail rather than assumed to work.

### The seed length

From `node scripts/calibrate-harvest-seed.mjs`:

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

The rule was stated in the script before the sweep was run: the smallest L in
20..25 whose MEAN count of emitted above-floor spans per unrelated pair is
below 1.0. The walk it took: **L=20 was rejected at 1.2**, which misses the
threshold by 0.2 and is the value spec 8.2's band names first, so a reader
skimming the plan would have guessed it; **L=21 qualifies at 0.9** and is the
value shipped. The max matters as much as the mean and is recorded beside it:
L=20's worst pair emits 9 above-floor spans, L=21's worst emits 5.

Both columns are reported because they answer different questions. `emitted` is
every maximal common span `commonSpans` would emit from an unrelated pair;
`above floor` is the subset at or above `minClaimChars`, which is what harvest
would actually propose. Above L=20 they coincide, because extension past a
20-character seed almost always clears a 16-character floor.

Spec 8.2 quotes 24.8 / 5.0 / 0.9 / 0.2 at L = 13 / 16 / 20 / 25 from a script
that was never committed and is in no git history; those figures are superseded
by this table, and the two measures are not the same quantity - 8.2 describes
L-gram seed matches, this counts what `commonSpans` emits after extension,
word-boundary snapping, whitespace collapse and containment dedupe, which is
what an author actually reviews. That wording discrepancy in 8.2 is recorded
here rather than edited away.

The script's `spansOf` is a REPLICA of the emit rules `src/harvest/spans.ts`
will ship, because `commonSpans` does not exist until Task 5. Its docstring
says so. Task 5 deletes the replica, imports the shipped function, and re-runs
this script to prove the numbers did not move.

### Every cross-fixture common span, hand-classified

`node scripts/calibrate-harvest-seed.mjs | sed -n '/hand-classification
population/,$p'` printed **32 distinct above-floor spans at L=21** (43 at
L=20). Every one is classified below. Spans are shown as the script prints
them - normalized, so lower-case.

| span | pairs | class | why |
| --- | --- | --- | --- |
| `skip to main content` | 6 | boilerplate | The accessibility skip link. On the page because of how it is built. |
| `accessibility statement` | 3 | boilerplate | Footer legal/accessibility link on ap, bls and gov.uk. |
| `terms of use privacy policy` | 3 | boilerplate | Two adjacent footer legal links, on ap, openai and theverge. |
| `relationship between` | 2 | chance | Ordinary English. Body prose on both sides of both pairs. |
| `all rights reserved.` | 1 | boilerplate | Copyright line: "copyright 2026 the associated press" / "(c) 2026 vm publishing llc". |
| `are included in the` | 1 | chance | Ordinary English; body prose on both sides (mdn, bls). |
| `artificial intelligence` | 1 | chance | Furniture on one side only (ap's "tech sections" nav) and article prose on the other (openai). One-sided, so recorded as chance. |
| `associated with the` | 1 | chance | Ordinary English. |
| `careers advertise with us` | 1 | boilerplate | Footer nav, ap and mdn - two unrelated sites with the same two link labels adjacent. |
| `circular references` | 1 | chance | Body prose on both sides (mdn on content negotiation, python docs on json encoding). |
| `difference between` | 1 | chance | Ordinary English. |
| `electric toothbrush` | 1 | chance | Body prose on both sides; two unrelated tech sites happened to run a toothbrush story. |
| `for more information` | 1 | chance | Body prose on both sides (python docs, bls). |
| `freedom of information` | 1 | boilerplate | Footer link on bls ("freedom of information act") and a nav category on gov.uk ("freedom of information releases"). Furniture on both sides. |
| `further exploration` | 1 | chance | Ordinary English; body prose on both sides. |
| `has been successfully` | 1 | chance | Ordinary English; body prose on both sides. |
| `in addition to the` | 1 | chance | Ordinary English. |
| `including information` | 1 | chance | Ordinary English; body prose on both sides. |
| `is available under the` | 1 | boilerplate | The licence footer: Wikipedia's "text is available under the creative commons..." and gov.uk's "all content is available under the open government licence". |
| `of the united states` | 1 | chance | Furniture on one side only (bls's "an official website of the united states government" banner) and article prose on the other (wikipedia). One-sided, so recorded as chance. |
| `over the same period` | 1 | chance | Ordinary English; body prose on both sides. |
| `personal information` | 1 | chance | Furniture on one side only (ap's "do not sell or share my personal information") and article prose on the other (openai on training-data filtering). One-sided, so recorded as chance. |
| `polski português русский` | 1 | boilerplate | The language switcher, on blog.mozilla and wikipedia. The only non-ASCII span in the population. |
| `report a problem with this` | 1 | boilerplate | Page-feedback link, mdn and gov.uk. |
| `the relationship between` | 1 | chance | Ordinary English; the longer form of the 2-pair span above. |
| `the wikimedia foundation` | 1 | chance | Furniture on one side only (wikipedia's footer trademark notice) and article prose on the other (theverge, on a unionization story). One-sided, so recorded as chance. |
| `this means that the` | 1 | chance | Ordinary English. |
| `this page was last` | 1 | boilerplate | The last-modified stamp: mdn's "this page was last modified on" and wikipedia's "this page was last edited on". |
| `transcription of the` | 1 | chance | Body prose on both sides (wikipedia on diplomatic transcription, openai on audio transcription). |
| `usually preferred since` | 1 | chance | Body prose on both sides; wikipedia and bls happen to share a four-word construction. |
| `website privacy notice` | 1 | boilerplate | Mozilla's footer legal link, on both mozilla fixtures. |
| `your privacy choices` | 1 | boilerplate | Consent/footer legal link, openai and theverge. |

**12 boilerplate, 20 chance.** The rule counted every emitted span, boilerplate
included, because all of it is noise an author must read. That is load-bearing:
with the 12 boilerplate rows excluded from the above-floor count, L=20's mean
falls to 0.7 and L=21's to 0.5, so the rule would pick 20. The split says what
the noise *is*; it is not an input to the rule. (That variant is not a
committed script and is not the shipped measurement: it is
`scripts/calibrate-harvest-seed.mjs` with the 12 spans above removed from the
`above` filter, run once to answer this question. Its above-floor means are
1.5 / 1.7 / 0.7 / 0.5 / 0.3 / 0.2 / 0.1 / 0.1 / 0.0 at
L = 13 / 16 / 20 / 21 / 22 / 23 / 24 / 25 / 30.)

The `boilerplate` rows are what filter 2 (cross-source frequency) exists for,
and none of them earns a bundled `boilerplate` rule: a bundled rule needs a
`lastConfirmed` date from a live observation, and a fixture is not one.
`src/rules/boilerplate.ts` ships empty.

Four spans are furniture on ONE side and article prose on the other -
`artificial intelligence`, `of the united states`, `personal information`,
`the wikimedia foundation`. They are recorded as `chance`, the conservative
direction. The classification cannot move the number - it is not an input to
the rule, as above - but a chance span filed as boilerplate would understate
how much of the residual noise is ordinary English, which is the thing a reader
of this table is trying to judge; and a span that is prose on one side is not
something a boilerplate rule can be trusted to remove.

One near-exception is worth naming, because it is visible in the table and a
reader will otherwise think it contradicts the next section. `blog.mozilla.org`
and `developer.mozilla.org` are different HOSTS, so the corpus still holds no
host-same pair; they are the same ORGANIZATION, and they share its furniture -
`website privacy notice` is emitted from exactly that pair. It is the closest
this corpus comes to the same-outlet population, and one pair is not a
population.

### What was NOT done

The corpus has no host-same pairs at all - no two document fixtures come from
the same site - so the "same outlet, different page" population, which is where
an outlet's own recurring furniture would show up, is empty here and both
numbers are silent about it. That is the gap the author's own `boilerplate`
rules exist to cover, and it is disclosed rather than closed.

Filter 2's reprint cost was not measured either, and it is a second and
separate gap from the one above - that one is in filter 3's domain, this one in
filter 2's. Spec 8.2 filter 2 said "Plan 2's calibration counts how many real
claims appear in two cited sources of the same draft, so the reprint cost is a
number, not a guess". No such count was made. It needs readable reads of these
four drafts' OWN cited sources; `fixtures/` holds no readable read of any of
them, and only live network reads could supply one - a network dependency
inside the task whose whole purpose is that its numbers reproduce from frozen
fixtures. So how many REAL claims the cross-source frequency filter would eat
is a guess here, disclosed rather than closed, and spec 8.2's sentence is
amended in Task 10 to say so instead of promising a number.

No claim was dropped, reworded or reclassified to make a number come out. If
the ceiling had reached the floor, the plan says to stop and report.
