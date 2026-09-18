# What description extraction moves: 618 live URLs

0.5.0 makes `toText` harvest text from `description`, `og:description` and
`twitter:description` meta tags, which it previously discarded along with every other
attribute value. This measures what that changes, against the 618 source URLs cited by 99
published bulletin issues.

**Headline: 5 URLs cross the 4,500 prose floor. 0 cross the 800 signature cap.** The plan
treats any floor crossing as a finding that changes the release rather than a number to
tabulate, so this report is the stopping point, not a step on the way to one.

## Method

Each URL was fetched **once** and extracted **twice from the same bytes**:

- **after** - `computeSignals` over the raw body
- **before** - `computeSignals` over the same body with every `<meta>` tag removed first

Comparing against the 2026-09-13 baseline instead would mix this change's effect with source
drift, and drift would be indistinguishable from movement. The baseline is used only as a
cross-check.

Both arms run the real signal pipeline rather than a hand-rolled extraction, so `proseChars`
is whatever testimonium actually measures.

**The "before" arm was verified to reproduce pre-0.5.0 behaviour**, not assumed to. Genuine
pre-0.5.0 `toText` (from commit `d76c84a`) was run against the meta-pre-strip across every
HTML fixture: 36 of 36 byte-identical. A control confirms the comparison can detect a
difference when one exists. This matters because two fix rounds reshaped `extract.ts` after
the plan was written, and the plan's claim of verification predated them.

## Counts

| | |
| --- | --- |
| URLs measured | 618 of 618 |
| yielded a reading | 549 (69 no-read) |
| non-vetoed | 532 (17 vetoed) |
| gained any description text | 483 of 549 (88.0%) |
| gained nothing | 66 (12.0%) |
| **crossed the 4,500 floor** | **5** |
| **crossed the 800 cap** | **0** |
| prose went *down* anywhere | 0 |

That the count of measurable URLs is 549 - the same figure the independent 2026-09-13
sub-floor measurement reached - is a corroboration, not a coincidence.

## The five floor crossings

Each was 20 to 390 characters short of the floor and cleared it by 40 to 201.

| URL | before -> after | gained | duplicated | still crosses if duplicates discounted |
| --- | --- | --- | --- | --- |
| `nhtsa.gov` Tesla Cybercab audit query | 4407 -> 4701 | 294 | 150 | yes |
| `casar.house.gov` OpenAI/Anthropic transparency | 4110 -> 4584 | 474 | 151 | **no** |
| `techcrunch.com` Apple Intelligence / Qwen | 4480 -> 4604 | 124 | 0 | yes |
| `techcrunch.com` Palihapitiya Series A | 4432 -> 4548 | 116 | 0 | yes |
| `openai.com` Economic Research Exchange | 4374 -> 4540 | 166 | 0 | yes |

All five are ordinary HTML read on the `node` rung. None is vetoed, none is PDF-shaped, so
none is an artifact of how this harness picks a rung.

### The casar row is weaker than the other four

It clears the floor only because 151 characters of its gain restate a sentence already in its
own body - ledes commonly repeat the meta description, and deduplication runs only among the
three tag values, never against body text. Discount the restatement and it does not cross.

The 4,500 floor is a proxy for *did we really read a document*, so a crossing that rests on
counting one sentence twice is a different and weaker finding than one that rests on new text.
It is listed separately for that reason rather than tallied alongside the rest.

## What the crossings are, and are not

They are **not** shells becoming accusable. The crossers sit at the very top of the sub-floor
distribution: 22 URLs occupy the 4,000-4,499 band and 5 of them crossed, while the median
sub-floor page is 3,510 characters and only 4 of 71 fall below 1,000.

Every crosser is a substantial article that was already just under an arbitrary line. What a
crossing changes is the verdict available for such a page: below the floor it is `unreachable`
- we decline to judge - and above it, a claim that does not match becomes `unsupported`, which
accuses the author.

So the question this raises is not whether description extraction is unsound. It is whether a
~100-character publisher-written description should decide if a 4,400-character article is
judged or declined. That is a calibration question about the floor itself.

### What this report cannot answer

Whether any crossing is a *manufactured accusation* depends on whether that page's cited
claims are in its description. A page that crosses and whose claims are absent from the
description moves from `unreachable` to `unsupported` without anything new being verified.

**The claim text is not available from this repository.** The corpus carries only `{url, cites}`,
and these URLs appear nowhere else in omnisscientia; the claims live in `post_citations` in
Postgres. The question is therefore open and belongs to whoever holds that database. It is
recorded here as unanswered rather than guessed at.

## Distribution of gains

| gain (chars) | URLs |
| --- | --- |
| 0 | 66 |
| 1-50 | 13 |
| 51-100 | 64 |
| 101-250 | 336 |
| 251-500 | 53 |
| 501-1000 | 11 |
| 1001-2500 | 5 |
| 2501+ | 1 |

Median gain among URLs that gained anything: **148**. Maximum: **3,283**. The shape is a
single sentence of description on most pages, which is what the deduplication exists to keep
from being counted three times.

## The 800 signature cap

No URL crosses it. Crossing would disarm the N3 challenge signature for that read, and the
mechanism by which a shell's description can support a claim - its matches entering the
cross-rung union - is not exercised anywhere in this corpus.

## Cross-check against the 2026-09-13 baseline

Of 549 readings, 536 matched a baseline `proseChars`: 508 within 500 characters and 510 within
10%. 21 diverged by more than 2,000 characters or 50%.

**Most of those 21 are not source drift.** They are PDFs. This harness takes the first rung
returning a 2xx with a non-empty body, so all 16 `.pdf` URLs were read on the `node` rung as
raw bytes rather than routed to `pdftotext` - the baseline read them the other way. All 16 are
caught by the binary-density veto, so they can never reach a verdict or manufacture a crossing;
the effect is confined to this one statistic. Divergences are reported here as an instrument
artifact, not as pages that changed.

## Limits

- **One week of drift.** The baseline is 2026-09-13; these are live pages read 2026-09-18.
  Only the cross-check is exposed to this - the before/after comparison uses one fetch.
- **Live pages.** A page can change between two runs of this harness. Nothing here is
  reproducible byte-for-byte except through the recorded NDJSON.
- **Rung selection is simplified**, as described above. It cancels out of the before/after
  delta, because both arms extract the same bytes, and it does not cancel out of the absolute
  cross-check.
- **Duplication is measured per sentence** against the body, so a description restating a lede
  with different punctuation may be scored as new text. The figure understates duplication
  rather than overstating it.
