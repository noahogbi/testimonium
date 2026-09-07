# Calibration of `minProseChars` and `minSlugOverlap`

**Date:** 2026-09-07 (round 2, after ruling C6) — supersedes the 2026-09-06 round-1 record
**Corpus:** `fixtures/corpus.json` — 33 fixtures: 24 `challenge`, 9 `document`
**Instrument:** `toText` (Task 3) then `proseVolume` / `slugLabelOverlap`
(`src/classify/thresholds.ts`), with N4 (HTTP 404/410 veto) applied first
**Reproduce:** `npm run build && node scripts/calibrate.mjs && npx vitest run`

## Outcome: STILL BLOCKED — but the failure has moved to the other side

Ruling C6 worked for what it was aimed at. **Assertions 1 and 3 now pass.** N4 vetoes the
ECB 404 before its body is consulted, and dropping the fetched `<title>` from C1 removed
the tautology that pinned every overlap score to 1.00.

Removing the title, however, exposed the mirror image of the same defect at the other end.
`blog.mozilla.org/en/` is a genuine document whose **URL path contributes no content words
at all** — the path is `/en/`, and `en` is two characters, below the four-character floor
in `contentWords`. `slugLabelOverlap` therefore returns its documented vacuous **0.00**,
which is the *identical score* to the Federal Register challenge fixture.

A threshold cannot be placed between two equal values. **Assertions 2 and 4 now fail, on
that one fixture.**

| chosen | value | status |
|---|---:|---|
| `minProseChars` | 4,500 | **licensed** — every prose-dimension assertion passes at it |
| `minSlugOverlap` | 0.30 | **NOT licensed** — no non-negative value satisfies the suite |

### The search

Exhaustive evaluation of 33,165 threshold pairs (every `minProseChars` at which an
assertion outcome can change, crossed with `minSlugOverlap` from -0.50 to 1.50 in steps of
0.01):

```
searched 165 x 201 = 33165 pairs (V from -0.50 to 1.50)
SOLUTIONS (any V):        414
SOLUTIONS (V >= 0):       0   <-- meaningful range
  V range of solutions: [-0.50, -0.05]  P range: [1380, 6658]
```

**Every solution requires a negative `minSlugOverlap`.** That is not a calibration of C1,
it is C1 switched off: `overlap >= V` becomes a tautology for a function whose range is
[0, 1], and the deliberate vacuous 0.00 that the doc comment says must send a citation to
`unreachable` would instead become a pass. Shipping -0.05 would silently re-enable exactly
the "2,500-char unlisted wall at `/p?id=93714`" case the function was written to deny. It
is therefore recorded as unavailable, and 0.3 is left in place as the meaningful-range
placeholder.

## Why no non-negative pair works — the proof

Write `P = minProseChars`, `V = minSlugOverlap`.

Assertion 4 requires every document to clear both thresholds by margin. The Mozilla blog
scores overlap **0.00**, so `0.00 >= V + 0.05`, hence **`V <= -0.05`**. (Assertion 2 alone
already forces `V <= 0.00`.)

Assertion 3 requires every non-vetoed challenge to be clear by margin on prose *or* on
overlap. The Federal Register fixture also scores overlap 0.00, so the overlap route needs
`0.00 <= V - 0.05`, i.e. `V >= 0.05` — which contradicts `V <= -0.05`. It must therefore
be cleared on prose: `1,180 <= P - 200`, hence `P >= 1,380`. Assertion 4's prose half caps
`P <= 6,658`.

The feasible set is exactly `P in [1,380, 6,658]` **and** `V <= -0.05`, matching the
search. Constrained to the meaningful range `V >= 0`, it is empty.

## The two populations

### `challenge` (n = 24)

Prose volume: min 43, max 13,221; excluding the two N4-vetoed fixtures, **max 1,180**.
Overlap: **22 of 24 score 0.00**, including the Federal Register capture, the only
non-vetoed challenge that has a real URL. The two non-zero scores (0.33 and 1.00) both
belong to N4-vetoed fixtures and never reach the body-derived gate.

### `document` (n = 9)

Prose volume: min 6,858, max 108,257. Status: all 200.
Overlap: **min 0.00, max 1.00** — seven score 1.00, one scores 0.50, one scores 0.00.

### Read together

On **prose volume** the populations now separate cleanly and with room to spare: the
largest non-vetoed challenge is 1,180 and the smallest document is 6,858, a gap of 5,678
characters. `minProseChars = 4,500` sits inside it with 3,320 clear below and 2,358 clear
above, comfortably past the 200-character margin requirement.

On **overlap** the populations do not separate at all. Their ranges are not merely
adjacent — they **share their minimum**: 0.00 appears on both sides. C1 contributes
nothing that prose volume does not already contribute, and the one thing it does
contribute is a false rejection of a real document.

## C1 is calibrated against the document population only

This has to be stated plainly, because the number in the file otherwise looks better
supported than it is. **`minSlugOverlap` has no challenge-side evidence in this corpus.**

- 21 of 24 challenge fixtures are constructed battery bodies carrying no URL, so their
  0.00 is the *absence of an input*, not a measurement of the signal.
- The one remaining non-vetoed challenge, Federal Register, does have a real URL — and
  scores 0.00, the same as a real document. It is separated by prose, not by overlap.
- The two challenge fixtures with informative overlap scores (0.33 and 1.00) are both
  vetoed by N4 first and never reach C1 at all.

So every constraint that shaped `minSlugOverlap` came from the nine documents. There is
not one fixture in the corpus that C1 rejects and prose volume admits. Any future claim
that C1 carries weight needs challenge fixtures with real, specific URLs whose words are
genuinely absent from the served body — the corpus does not currently contain one.

## Which dimension does the separating

| mechanism | fixtures it decides | notes |
|---|---|---|
| **N4 (404/410 veto)** | 2 challenge (#23, #24) | Both measured 404, twice. This is what finally handles the ECB page that defeated round 1. |
| **Prose volume** | 22 challenge (#1-#22) | Does all the body-derived work, every one with margin. The largest is 1,180 against a 4,500 floor. |
| **Overlap** | **0 fixtures** | Rejects nothing prose volume does not already reject, and wrongly blocks document #25. |

## Statuses: how each one was obtained

The brief states that `fixtures/challenge-battery.mjs` "declares the status each case was
built to represent." **It does not.** Its case tuples are `[name, isBotCheck, text]` —
there is no status field anywhere in that file. Statuses were therefore obtained three
different ways, and the corpus now mixes evidence of three different strengths:

1. **Measured (12 fixtures).** `scripts/capture-fixtures.mjs` logged `r.status` at capture
   time, and that stdout is preserved verbatim in `task-3-report.md`. A re-fetch of all 12
   URLs on 2026-09-07 agreed **12 of 12** on status. Two are 404 (ECB, Cloudflare blog);
   ten are 200. Note that the capture script logged the status but never persisted it to
   the manifest, which is why this had to be recovered rather than simply read.
2. **Declared by name (4 fixtures).** `paywall-stub-at-200`, `soft-404-served-at-200`,
   `gdpr-geo-block-at-200` and `cookie-consent-wall-at-200` carry "at 200" in their case
   names, and the battery's header comment groups them as "the adjacent open class of 2xx
   pages that are NOT bot checks".
3. **Stipulated (17 fixtures, marked with a dagger below).** The constructed bot-wall
   bodies have no response attached and no declared status. 200 was stipulated as the
   **adversarial worst case**: it is the value that gives the fixture the greatest chance
   of passing the gate, so it cannot make the suite artificially green, and it matches the
   tool's own premise that walls served at 200 are what defeat link checkers. Since N4
   keys only on 404/410, any non-404/410 value produces identical results for every
   assertion. **No fixture was assigned 404 or 410 that was not measured as such.**

`soft-404-served-at-200` deserves a specific note: it is semantically a 404, but its
declared status is 200, so N4 correctly does **not** veto it. It is rejected on prose
instead. That is the right outcome, and it confirms N4 is not quietly doing the
soft-404's work.

## Per-fixture data (all 33)

A dagger in the status column marks a stipulated status. Measurements are at
`P = 4,500`, `V = 0.30`.

| # | fixture | kind | status | prose | overlap | outcome | separated by |
|---:|---|---|---:|---:|---:|---|---|
| 1 | `challenge/datadome-block.html` | challenge | 200 † | 43 | 0.00 | rejected (gate) | prose + overlap |
| 2 | `challenge/stock-react-vite-noscript-shell.html` | challenge | 200 † | 46 | 0.00 | rejected (gate) | prose + overlap |
| 3 | `challenge/cloudflare-noscript-line.html` | challenge | 200 † | 58 | 0.00 | rejected (gate) | prose + overlap |
| 4 | `challenge/imperva-incapsula.html` | challenge | 200 † | 80 | 0.00 | rejected (gate) | prose + overlap |
| 5 | `challenge/perimeterx-human-press-and-hold.html` | challenge | 200 † | 106 | 0.00 | rejected (gate) | prose + overlap |
| 6 | `challenge/gdpr-geo-block-at-200.html` | challenge | 200 | 107 | 0.00 | rejected (gate) | prose + overlap |
| 7 | `challenge/paywall-stub-at-200.html` | challenge | 200 | 111 | 0.00 | rejected (gate) | prose + overlap |
| 8 | `challenge/soft-404-served-at-200.html` | challenge | 200 | 128 | 0.00 | rejected (gate) | prose + overlap |
| 9 | `challenge/vercel-security-checkpoint.html` | challenge | 200 † | 138 | 0.00 | rejected (gate) | prose + overlap |
| 10 | `challenge/eurlex-202-the-fixture.html` | challenge | 200 † | 157 | 0.00 | rejected (gate) | prose + overlap |
| 11 | `challenge/amazon-robot-check.html` | challenge | 200 † | 165 | 0.00 | rejected (gate) | prose + overlap |
| 12 | `challenge/eur-lex-french.html` | challenge | 200 † | 174 | 0.00 | rejected (gate) | prose + overlap |
| 13 | `challenge/cookie-consent-wall-at-200.html` | challenge | 200 | 175 | 0.00 | rejected (gate) | prose + overlap |
| 14 | `challenge/cloudflare-retired-pre-2023-wording.html` | challenge | 200 † | 200 | 0.00 | rejected (gate) | prose + overlap |
| 15 | `challenge/anubis-foss-site-bot-wall.html` | challenge | 200 † | 207 | 0.00 | rejected (gate) | prose + overlap |
| 16 | `challenge/cloudflare-turnstile-checkbox-page.html` | challenge | 200 † | 214 | 0.00 | rejected (gate) | prose + overlap |
| 17 | `challenge/bloomberg-wall.html` | challenge | 200 † | 223 | 0.00 | rejected (gate) | prose + overlap |
| 18 | `challenge/cloudflare-managed-challenge-ing-form.html` | challenge | 200 † | 281 | 0.00 | rejected (gate) | prose + overlap |
| 19 | `challenge/google-sorry-page.html` | challenge | 200 † | 396 | 0.00 | rejected (gate) | prose + overlap |
| 20 | `challenge/perimeterx-block-page.html` | challenge | 200 † | 466 | 0.00 | rejected (gate) | prose + overlap |
| 21 | `challenge/cloudflare-turnstile-cookie-privacy-boilerplate-800-chars.html` | challenge | 200 † | 982 | 0.00 | rejected (gate) | prose + overlap |
| 22 | `challenge/www-federalregister-gov-documents-2024-01-29-2024-01580-.html` | challenge | 200 | 1,180 | 0.00 | rejected (gate) | prose + overlap |
| 23 | `challenge/blog-cloudflare-com-cloudflare-incident-on-november-18-2025-.html` | challenge | 404 | 2,154 | 0.33 | rejected (N4 veto) | N4 status |
| 24 | `challenge/www-ecb-europa-eu-press-pr-date-2024-html-index-en-html.html` | challenge | 404 | 13,221 | 1.00 | rejected (N4 veto) | N4 status |
| 25 | `documents/blog-mozilla-org-en-.html` | document | 200 | 6,858 | 0.00 | **BLOCKED** | **FAILS overlap** |
| 26 | `documents/www-theverge-com-tech.html` | document | 200 | 16,449 | 1.00 | reaches accusation | both clear |
| 27 | `documents/developer-mozilla-org-en-US-docs-Web-HTTP-Status.html` | document | 200 | 23,601 | 0.50 | reaches accusation | both clear |
| 28 | `documents/www-bls-gov-news-release-cpi-nr0-htm.html` | document | 200 | 24,254 | 1.00 | reaches accusation | both clear |
| 29 | `documents/docs-python-org-3-library-json-html.html` | document | 200 | 26,592 | 1.00 | reaches accusation | both clear |
| 30 | `documents/www-gov-uk-government-news.html` | document | 200 | 33,076 | 1.00 | reaches accusation | both clear |
| 31 | `documents/apnews-com-hub-technology.html` | document | 200 | 45,390 | 1.00 | reaches accusation | both clear |
| 32 | `documents/openai-com-index-gpt-4o-system-card-.html` | document | 200 | 76,936 | 1.00 | reaches accusation | both clear |
| 33 | `documents/en-wikipedia-org-wiki-Textual-criticism.html` | document | 200 | 108,257 | 1.00 | reaches accusation | both clear |

## Candidate resolutions (for ruling — NOT implemented)

1. **Give the corpus a `label` field.** `slugLabelOverlap` already accepts a third
   argument, and the acceptance test currently calls it with two. An author citing the
   Mozilla blog would write something like "The Mozilla Blog" beside the link, and those
   content words do appear in the body. This is the resolution the function's own doc
   comment anticipates. **Hazard:** the label must be genuinely authored. Populating it
   from the fetched `<title>` would reintroduce the exact circularity ruling C6 just
   removed, and would do so invisibly, because the field would still be named "label".
2. **Accept that a vacuous C1 sends the citation to `unreachable`**, and exempt fixtures
   with no authored content words from assertion 2 — the same shape as the N4 exemption
   already added to assertion 3. This is consistent with the declared policy for short
   legitimate documents (a lost `supported` is the safe direction), but it is a spec change
   and it widens the class of documents against which the tool silently stops working.
3. **Drop C1 from the accusation gate** and let N4 plus prose volume carry it. The
   measurement supports this for *this* corpus, but the corpus contains no fixture that
   tests what C1 was for, so this would be deciding on absent evidence.

I have no basis to choose between these, and each is a spec-level change rather than a
calibration. Reporting instead of picking.

## What was NOT done

Per the stop condition: no fixture dropped, omitted, or reclassified; the 200-character
and 0.05 margins untouched; no assertion weakened or deleted; `proseVolume` and
`slugLabelOverlap` are byte-for-byte as specified in the regenerated brief; and
`minSlugOverlap` was **not** set to the negative value that would turn the suite green by
nullifying the dimension. No status was guessed, and none was set to 404 or 410 for
convenience.
