# Calibration of `minProseChars` and `minSlugTitleOverlap`

**Date:** 2026-09-06
**Corpus:** `fixtures/corpus.json` — 33 fixtures: 24 `challenge`, 9 `document`
**Instrument:** `toText` (Task 3) → `proseVolume` / `slugTitleOverlap` (`src/classify/thresholds.ts`)
**Reproduce:** `npm run build && node scripts/calibrate.mjs`

## Outcome: BLOCKED — the gate does not close

**No pair of thresholds satisfies the four assertions in `test/classify/acceptance.test.ts`.**
This is not a tuning shortfall. An exhaustive search over 24,915 candidate pairs
(every `minProseChars` value at which an assertion outcome can change, crossed with
`minSlugTitleOverlap` from 0.00 to 1.50 in steps of 0.01) returned **zero** solutions.

The values recorded in `src/classify/thresholds.ts` are therefore the best *available*
pair, not a licensed calibration. Two of the four assertions are red at them, and at
every other pair as well.

| chosen | value | status |
|---|---:|---|
| `minProseChars` | 4,500 | provisional — mid-gap for 32 of 33 fixtures |
| `minSlugTitleOverlap` | 0.30 | provisional — dimension does not separate |

## The two populations

### `challenge` (n = 24)

Prose volume: **min 43, max 13,221**; median 190. Excluding the ECB outlier: max **2,154**.
Overlap: 21 fixtures score 0.00, but see the vacuity caveat below. The three with
url/title score **0.60, 0.80, 1.00**.

### `document` (n = 9)

Prose volume: **min 6,858, max 108,257**; median 26,592.
Overlap: **min 0.75, max 1.00**; 8 of 9 score 1.00.

### Read together

On prose volume the populations separate cleanly **except for one fixture**: the gap
between the challenge runner-up (2,154) and the lowest document (6,858) is 4,704
characters wide, and the ECB 404 sits at 13,221 — inside the document range, above two
real documents.

On overlap the populations **do not separate at all**. The highest-scoring challenge
with real metadata (0.80) outranks the lowest-scoring real document (0.75), and the ECB
404 ties the maximum at 1.00.

## Per-fixture data (all 33)

`overlap` marked `*` is vacuous — see caveat. `cleared by` names the dimension(s) on
which the fixture is clear of its threshold **by the required margin** (200 chars / 0.05).

| # | fixture | kind | prose chars | overlap | passes gate? | cleared by |
|---:|---|---|---:|---:|---|---|
| 1 | `challenge/datadome-block.html` | challenge | 43 | 0.00 * | no | both |
| 2 | `challenge/stock-react-vite-noscript-shell.html` | challenge | 46 | 0.00 * | no | both |
| 3 | `challenge/cloudflare-noscript-line.html` | challenge | 58 | 0.00 * | no | both |
| 4 | `challenge/imperva-incapsula.html` | challenge | 80 | 0.00 * | no | both |
| 5 | `challenge/perimeterx-human-press-and-hold.html` | challenge | 106 | 0.00 * | no | both |
| 6 | `challenge/gdpr-geo-block-at-200.html` | challenge | 107 | 0.00 * | no | both |
| 7 | `challenge/paywall-stub-at-200.html` | challenge | 111 | 0.00 * | no | both |
| 8 | `challenge/soft-404-served-at-200.html` | challenge | 128 | 0.00 * | no | both |
| 9 | `challenge/vercel-security-checkpoint.html` | challenge | 138 | 0.00 * | no | both |
| 10 | `challenge/eurlex-202-the-fixture.html` | challenge | 157 | 0.00 * | no | both |
| 11 | `challenge/amazon-robot-check.html` | challenge | 165 | 0.00 * | no | both |
| 12 | `challenge/eur-lex-french.html` | challenge | 174 | 0.00 * | no | both |
| 13 | `challenge/cookie-consent-wall-at-200.html` | challenge | 175 | 0.00 * | no | both |
| 14 | `challenge/cloudflare-retired-pre-2023-wording.html` | challenge | 200 | 0.00 * | no | both |
| 15 | `challenge/anubis-foss-site-bot-wall.html` | challenge | 207 | 0.00 * | no | both |
| 16 | `challenge/cloudflare-turnstile-checkbox-page.html` | challenge | 214 | 0.00 * | no | both |
| 17 | `challenge/bloomberg-wall.html` | challenge | 223 | 0.00 * | no | both |
| 18 | `challenge/cloudflare-managed-challenge-ing-form.html` | challenge | 281 | 0.00 * | no | both |
| 19 | `challenge/google-sorry-page.html` | challenge | 396 | 0.00 * | no | both |
| 20 | `challenge/perimeterx-block-page.html` | challenge | 466 | 0.00 * | no | both |
| 21 | `challenge/cloudflare-turnstile-cookie-privacy-boilerplate-800-chars.html` | challenge | 982 | 0.00 * | no | both |
| 22 | `challenge/www-federalregister-gov-documents-2024-01-29-2024-01580-.html` | challenge | 1,180 | 0.80 | no | prose |
| 23 | `challenge/blog-cloudflare-com-cloudflare-incident-on-november-18-2025-.html` | challenge | 2,154 | 0.60 | no | prose |
| 24 | `challenge/www-ecb-europa-eu-press-pr-date-2024-html-index-en-html.html` | challenge | 13,221 | 1.00 | **YES** | **NEITHER** |
| 25 | `documents/blog-mozilla-org-en-.html` | document | 6,858 | 1.00 | **YES** | both |
| 26 | `documents/www-theverge-com-tech.html` | document | 16,449 | 1.00 | **YES** | both |
| 27 | `documents/developer-mozilla-org-en-US-docs-Web-HTTP-Status.html` | document | 23,601 | 0.75 | **YES** | both |
| 28 | `documents/www-bls-gov-news-release-cpi-nr0-htm.html` | document | 24,254 | 1.00 | **YES** | both |
| 29 | `documents/docs-python-org-3-library-json-html.html` | document | 26,592 | 1.00 | **YES** | both |
| 30 | `documents/www-gov-uk-government-news.html` | document | 33,076 | 1.00 | **YES** | both |
| 31 | `documents/apnews-com-hub-technology.html` | document | 45,390 | 1.00 | **YES** | both |
| 32 | `documents/openai-com-index-gpt-4o-system-card-.html` | document | 76,936 | 1.00 | **YES** | both |
| 33 | `documents/en-wikipedia-org-wiki-Textual-criticism.html` | document | 108,257 | 1.00 | **YES** | both |

## Which dimension does the separating

- **Prose volume does all the real work.** It clears 23 of the 24 challenge fixtures
  (#1–#23) with margin, including both fixtures that overlap fails to clear (#22 at 0.80
  and #23 at 0.60, each above `minSlugTitleOverlap`).
- **Overlap separates nothing that prose volume does not already separate.** There is no
  fixture in the corpus that overlap rejects and prose volume admits. Its measured role
  in this corpus is zero.
- **Neither dimension separates #24, the ECB 404.** It is the only fixture on either side
  of the corpus that the accusation gate classifies wrongly.

### Caveat: 21 of the 24 challenge overlap scores are vacuous

Fixtures #1–#21 carry `"url": ""` and `"title": ""` in `fixtures/corpus.json`. With no
url and no title there are no content words, and `slugTitleOverlap` returns 0 by its
documented "return 0, not 1, when there is nothing to test" rule. **Those 0.00s are not
measurements of the overlap signal — they are the absence of an input.** The overlap
dimension is genuinely exercised by exactly 3 challenge fixtures and 9 documents, and on
those 12 it does not separate the populations. Any future claim that overlap is carrying
weight must be re-established against challenge fixtures that actually have metadata.

## Why no pair of thresholds works — the proof

Write `P` for `minProseChars` and `V` for `minSlugTitleOverlap`.

**Assertion 4** (every real document clears both thresholds with margin) requires, for
every document, `prose ≥ P + 200` and `overlap ≥ V + 0.05`. The lowest document is 6,858
chars and the lowest document overlap is 0.75, so:

> `P ≤ 6,658` and `V ≤ 0.70`

**Assertion 1** (no challenge passes the accusation gate) requires, for the ECB fixture,
`NOT (13,221 ≥ P AND 1.00 ≥ V)` — that is, `P > 13,221` **or** `V > 1.00`. But
`P ≤ 6,658 < 13,221` and `V ≤ 0.70 < 1.00`, so both disjuncts are false.

**Assertions 1 and 4 are jointly unsatisfiable.** Assertion 3 fails on the same fixture
for the same reason and is likewise unsatisfiable: clearing it would need `P ≥ 13,421` or
`V ≥ 1.05`.

Exhaustive search confirms the algebra: 0 solutions in 24,915 pairs. With fixture #24
alone removed from the corpus, **249** pairs satisfy all four assertions
(`P ∈ [1,380, 6,658]`, `V ∈ [0.00, 0.70]`). The design is one fixture away from working,
and that fixture is a real page a real citation can point at.

## Diagnosis

The ECB 404 defeats the accusation gate on both dimensions at once, for two independent
reasons.

**Prose volume.** The page is a full ECB site chrome — global navigation, a language
switcher, a press-release date index, and a footer — wrapped around a one-line error
message. Chrome is prose to a tag stripper. 13,221 characters of it outweighs two
genuine documents in the corpus.

**Overlap — and this is the structural half.** `slugTitleOverlap` draws its content words
from the URL path *and the title*, but **the title is fetched from the same response as
the body**. When that response is an error shell, the title is the error shell's own
title, so its words are present in the body by construction. Every fixture in this corpus
that has a title scores **title-only overlap of exactly 1.00 — all 12 of them, challenge
and document alike.** The title contributes no evidence whatsoever; it is circular in
precisely the way the function's own doc comment argues a URL is not.

For the ECB fixture the URL path contributes only `press` and `date` after stopwording
(`html`, `index` and the numeric `2024` are all removed), and both appear in the nav
chrome — so path-only overlap is also 1.00. The title contributes `sorry`, `does`,
`exist`, which are the 404 message's own words. Every one of the five content words is a
guaranteed hit:

```
words:   [press, date, sorry, does, exist]
matched: [press, date, sorry, does, exist]   → 1.00
```

Restricting the metric to the URL path does **not** rescue it: ECB scores 1.00 path-only,
while the MDN document scores 0.50 and the Mozilla blog has no path content words at all
(vacuous). Path-only ordering is *worse*, not better.

The signal design is what is wrong, not the numbers. Two dimensions that both fail on the
same page are not two dimensions. Task 4 stops here, per its stop condition.

## What was NOT done

Per the stop condition, none of the following were used to turn the suite green: no
fixture was dropped, omitted, or reclassified; the 200-character and 0.05 margins are
untouched; no assertion was weakened or deleted; `proseVolume` and `slugTitleOverlap` are
byte-for-byte as specified in the task brief.
