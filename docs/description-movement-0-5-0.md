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

| URL | before -> after | gained | duplicated | crosses on genuinely new text |
| --- | --- | --- | --- | --- |
| `nhtsa.gov` Tesla Cybercab audit query | 4407 -> 4701 | 294 | 151 | yes |
| `casar.house.gov` OpenAI/Anthropic transparency | 4110 -> 4584 | 474 | **473** | **no** |
| `techcrunch.com` Apple Intelligence / Qwen | 4480 -> 4604 | 124 | **120** | **no** |
| `techcrunch.com` Palihapitiya Series A | 4432 -> 4548 | 116 | 0 | yes |
| `openai.com` Economic Research Exchange | 4374 -> 4540 | 166 | 0 | yes |

All five are ordinary HTML read on the `node` rung. None is vetoed, none is PDF-shaped, so
none is an artifact of how this harness picks a rung.

### Two of the five cross only on text already in their own bodies

`casar.house.gov` and the `techcrunch.com` Apple/Qwen row clear the floor almost entirely on
restatement. Discount it and they land at 4,110 and 4,484 - both below the floor. Only three
of the five cross on genuinely new text.

Ledes commonly repeat the meta description, and deduplication runs only among the three tag
values, never against body text. The 4,500 floor is a proxy for *did we really read a
document*, so a crossing that rests on counting one sentence twice is a weaker finding than
one resting on new text, and the two kinds are not tallied together here.

**An earlier draft of this report put the duplicated figures at 151 and 0** and called the
other four clean. That was wrong, and the way it was wrong is worth recording: duplication
was measured as whole-sentence *exact* matching. The techcrunch description differs from its
own lede by one word (`Alibaba`) and one apostrophe codepoint, so exact matching scored it
zero. The figures above come from a fold-aware longest-common-run cover, which is stable
across 30-, 60- and 90-character minimum runs. This report's own Limits section had predicted
that exact matching would understate duplication, and the conclusion relied on the metric
anyway.

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

No URL crosses it, and no read's challenge signature flips in either direction.

**Do not read that as a bound on the shell case.** An earlier draft of this section said the
verdict "stays floor-protected below 4,500", which is false. `verdict()` tests
`matched === total` *before* any floor test, so a claim matching description text alone
returns `supported` on a page far below the floor - no cap crossing, no veto disarm and no
cross-rung union required. Verified end to end: a 214-character stub whose claim appears only
in `og:description` returns `unreachable` on 0.4.0 and `supported` on 0.5.0, quoting the
description as its evidence excerpt.

That is the intended behaviour - it is the shape the cutover spec exists to fix, where a page
we can genuinely read only through its description was previously declined. The 800 cap
governs something narrower: whether such a read's matches also enter the cross-rung union.
The exposed population here is **61 of 549 readings** - pages that remain below the floor and
gained description text.

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
- **Duplication is measured by a fold-aware longest-common-run cover** against the body, after
  case folding, Unicode NFKC normalisation and quote-character folding, counting runs of 30
  characters or more. The earlier per-sentence exact match understated duplication badly
  enough to reverse two of the five crossing verdicts - see the note above the table. Runs
  shorter than the threshold still read as new text, so the figure remains a lower bound on
  duplication.
