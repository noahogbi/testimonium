# testimonium 0.6.0 — attest only what is on the page

**Status:** design, for review before any implementation.
**Supersedes nothing.** Amends the behaviour 0.5.0 shipped.

## 1. What this fixes, and why it is one release

0.5.0 made `toText` harvest `description` / `og:description` / `twitter:description`
content. That closed a real failure — a page whose prose lives in its description read as
unreadable — and opened three narrower ones. All three are live on npm today and all three
were verified by execution, not by reading:

| # | route | direction | verified |
| --- | --- | --- | --- |
| 1 | a claim spanning the join between two harvested regions matches text that exists **nowhere on the page** and returns `supported` | false attestation | yes |
| 2 | `IS_DESCRIPTION` tests the whole tag, so a `keywords` tag whose content contains `name='description'` is harvested | wrong text enters prose | yes |
| 3 | `tagsIn` abandons every later tag after an unterminated quote, discarding real descriptions | false accusation | yes |

They ship together because **they pull in opposite directions.** 1 and 2 remove wrong
`supported`; 3 removes wrong `unsupported`. Shipping 3 alone would loosen attestation
without the matching tightening, which is the wrong order to take these in.

### The ranking this rests on

`2026-09-06-testimonium-design.md:101` ranks the two wrong verdicts and everything in that
document is subordinate to the ranking: a false accusation "is a worse failure than the one
the tool exists to prevent, because it is self-inflicted and it is aimed at the author's own
honest citations."

That is why 3 is in scope at all, and it is also why 1 is not in tension with it: closing a
seam does not accuse anyone falsely. A claim that only matched across a join was never on the
page, so declining to attest it is a *correct* non-attestation, not a manufactured accusation.

**Note the citation carefully.** The phrase "a false `supported` is the one outcome the spec
calls inviolable" belongs to the CONSUMER cutover spec §1, not to the design spec. The two
point opposite ways and both are quoted in `src/text/extract.ts`. Any argument in this
document that leans on a ranking must name which spec it means.

## 2. The seam (route 1)

### What is actually wrong

`toText` returns one flat string, and the whole match is two lines
(`src/classify/signals.ts:149-150`):

```ts
const text = toText(input.rawBody);
const matchedClaims = input.claims.filter((c) => phraseFound(text, c));
```

`phraseFound` is `norm(haystack).includes(norm(phrase))` (`src/text/normalize.ts:53`). So any
claim straddling a join between concatenated regions matches, even though no reader could
ever encounter that sequence.

**Verified.** A page whose body ends "The committee reviewed the" and whose description
begins "quarterly filings without objection." attests the claim "reviewed the quarterly
filings without objection" as `supported`.

**And the seam is not only at the body/description boundary.** Two description tags carrying
different sentences are themselves joined with a space, and a claim spanning *those* attests
as well — verified with `"met in March. Revenue rose twelve percent"` across a `description`
and an `og:description`. A fix that treats the harvest as one `described` block leaves this
open.

### The fix

Extraction exposes its regions internally. The regions are **the body, plus each distinct
description value separately** — not the body plus one merged description block. A claim must
match entirely within one region:

```ts
matchedClaims = claims.filter((c) => regions.some((r) => phraseFound(r, c)))
```

### What this deliberately does not change

- **`toText`'s output is byte-identical.** It remains the join of the same regions in the same
  order with the same separators. It is a committed public surface and consumers use it for
  their own purposes; this release does not move it *for this fix*. (Routes 2 and 3 do move
  it — see below.)
- **`proseChars` and every calibration figure are unchanged by this fix**, because they derive
  from `toText`'s output.
- **`excerptFor` continues to work against the flat text.** A region match is by construction
  also present in the flat text, so the excerpt still resolves. The implementation must prove
  this rather than assume it.

### Direction

The predicate can only ever **remove** matches: a claim matching a region always matches the
concatenation, and the converse is precisely what is being closed. No page becomes `supported`
because of this fix. Some pages stop being `supported`, correctly.

## 3. The wrong-attribute harvest (route 2)

`IS_DESCRIPTION` is tested against the whole tag string, so it fires on any tag whose text
contains something shaped like `name="description"` anywhere — including inside a *different*
attribute's value.

**Verified.** `<meta name="keywords" content="'x' name='description' LEAKED">` harvests
`'x' name='description' LEAKED` into extracted prose.

The fix is to decide description-ness from the tag's own attribute-name positions rather than
from a substring of the whole tag. This **changes `toText`'s output** on affected pages, in
the direction of removing text that was never the page's description.

## 4. The abandoned tail (route 3)

`tagsIn` scans tag by tag, respecting quoted attribute values. When a quote is never closed it
consumes to end of input and the scan stops, discarding every later tag — including
legitimate `<meta name="description">` tags that appear after the malformed one.

**Verified.** A page with `<div title="unterminated>` followed by a real description harvests
nothing.

### Why this is a false-accusation route

On a page with enough body prose to clear the 4,500 floor on its own, losing a description
that carried a claim leaves `matched < total` on a readable page — which is `unsupported`, an
accusation, not `unreachable`. It does **not** merely cost coverage.

### The fix, and its bound

On reaching end of input inside a quote, recover at the **first `>` observed while inside
that quote**, if one was seen; otherwise stop as today. Recording that position during the
same pass keeps the scan linear — there is no rescanning, and no adversarial input can make
it quadratic. A naive "retry from `i+1`" would reopen that, and is rejected for that reason.

This **changes `toText`'s output** on malformed pages, in the direction of recovering real
description text.

### The honest cost

Recovery harvests from a page a strict parser would render differently, because after an
unterminated quote a browser absorbs following markup into the attribute value. So this fix
does attest text a browser might not display. It is taken because the design spec ranks the
alternative — accusing an author over our own parse failure — as worse, and because the tag
recovered is a genuine publisher-authored description rather than the stale or injected
content the `<template>` / comment / script strips exist to exclude.

## 5. Semver

**Minor — 0.6.0.** Routes 2 and 3 change `toText`'s committed output; route 1 changes
verdicts. This repository's doctrine (`src/text/normalize.ts:7-11`) treats a change to
committed output as breaking, which argues for major; as with 0.5.0 it is released as minor on
the narrower ground that `^0.5.0` excludes `0.6.0`, so nobody receives it without choosing to.

That concession must appear in the changelog. 0.5.0's entry originally dropped it and it was
restored in review.

## 6. Measurement

The 618-URL harness (`scripts/description-movement.mjs`) exists, is resumable, and writes
NDJSON. Re-run it against 0.6.0 and answer exactly three questions:

1. **Does route 3's recovery move any page across the 4,500 floor?** Same gate as 0.5.0: any
   crossing is a finding that changes the release, not a number to tabulate. For each
   crossing, report whether the gain is duplicated body text, using the fold-aware
   longest-common-run cover — **not** whole-sentence exact matching, which understated
   duplication badly enough in 0.5.0's report to reverse two of five verdicts.
2. **How many pages lose a match to route 1?** These are the pages that were attesting across
   a join. Name them; they are the concrete evidence that the seam was real in the wild rather
   than only constructible.
3. **How many pages lose harvested text to route 2?**

The harness passes no claims to `computeSignals`, so question 2 needs claims. Either extend
the harness to carry the corpus's stored claims, or answer question 2 from a constructed
fixture set and say plainly that the live corpus was not used for it. **Do not report a
number for question 2 that the instrument cannot support** — the 0.5.0 report had to disclose
exactly this limitation after the fact.

## 7. Acceptance criteria

1. A claim spanning the body/description join does not match. A claim spanning two description
   values does not match.
2. A claim matching entirely within the body, or entirely within any single description value,
   **does** match. (This criterion exists because it is the one a careless fix breaks.)
3. `toText`'s output is unchanged by the route-1 fix alone, proven by running the pre-fix and
   post-fix extractors over all 36 HTML fixtures and comparing bytes.
4. A `keywords` tag containing `name='description'` in its content is not harvested; a genuine
   `description`, `og:description` and `twitter:description` still are, in every attribute
   order and quoting style already covered by the 0.5.0 tests.
5. A page with an unterminated quote followed by a real description harvests that description.
6. A page with `<` and no `>` anywhere after it still terminates, and an adversarial input of
   many unterminated tags completes in time linear in its length.
7. Every unrendered-text route closed in 0.5.0 stays closed: script (closed and unclosed),
   `<template>` (closed and unclosed), comment (plain, early `>`, unclosed), and a
   meta-shaped string inside another tag's attribute.
8. `<noscript>` content is still harvested.
9. 585 existing tests still pass, or every deviation is named with the reason it is correct.

## 8. Open questions

1. **Should the regions be visible to consumers?** The fix needs them only internally, and
   this release does not propose exporting them. A consumer wanting per-region text has no
   way to ask for it. Deferred deliberately; naming it here so the omission is a decision
   rather than an oversight.
2. **Question 2's instrument** — extend the harness to carry claims, or answer from fixtures
   and disclose. Decide before the plan is written, not during execution.

## 9. What this release does NOT fix

- A claim appearing only in a description still returns `supported` **below** the 4,500 prose
  floor, because `verdict()` tests `matched === total` before any floor test. That is
  deliberate and disclosed in the README; it is the shape the consumer cutover exists to fix.
- The stale `"two of nine real documents"` count in `src/classify/verdict.ts` — pre-existing,
  unrelated to 0.5.0, and out of scope. Recorded so it is not rediscovered as new.
- Unquoted attribute values (`content=Foo`) are still not harvested. Safe direction; worth one
  line in the docstring, not a behaviour change.
