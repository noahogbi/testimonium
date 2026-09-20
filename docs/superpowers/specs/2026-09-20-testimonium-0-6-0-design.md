# testimonium 0.6.0 — attest only what is on the page

**Status:** design, revised after review. See §10 for what review changed.
**Amends** the behaviour 0.5.0 shipped.

## 1. What this fixes, and why it is one release

0.5.0 made `toText` harvest `description` / `og:description` / `twitter:description`
content. That closed a real failure — a page whose prose lives in its description read as
unreadable — and opened three narrower ones. All three are live on npm and all three were
verified by execution, not by reading:

| # | route | direction | verified |
| --- | --- | --- | --- |
| 1 | a claim spanning the join between two harvested regions matches text that exists **nowhere on the page** and returns `supported` | false attestation | yes |
| 2 | `IS_DESCRIPTION` tests the whole tag, so a `keywords` tag whose content contains `name='description'` is harvested | wrong text enters prose | yes |
| 3 | `tagsIn` abandons every later tag after an unterminated quote, discarding real descriptions | false accusation | yes |

They ship together because **they pull in opposite directions.** 1 and 2 remove wrong
`supported`; 3 removes wrong `unsupported`. Shipping 3 alone would loosen attestation
without the matching tightening.

### The ranking this rests on

`2026-09-06-testimonium-design.md:101-103` ranks the two wrong verdicts: a false accusation
"is a worse failure than the one the tool exists to prevent, because it is self-inflicted and
it is aimed at the author's own honest citations." The document subordinates itself to the
**keystone rule** at `:110-111`, of which that ranking is the stated rationale.

**Name the spec you are citing.** "A false `supported` is the one outcome the spec calls
inviolable" belongs to the CONSUMER cutover spec `2026-09-15-citation-check-cutover-design.md`
§1, not to the design spec. The two rank oppositely and both are quoted in
`src/text/extract.ts`. Every ranking argument below names its source.

## 2. The seam (route 1)

### What is wrong

`toText` returns one flat string. In `check()`'s verdict path the match is
`src/classify/signals.ts:148-150`:

```ts
const text = toText(input.rawBody);
const matchedClaims = input.claims.filter((c) => phraseFound(text, c));
const missedClaims  = input.claims.filter((c) => !phraseFound(text, c));
```

`phraseFound` is `norm(haystack).includes(norm(phrase))` (`src/text/normalize.ts:53`). Any
claim straddling a join between concatenated regions matches, though no reader could
encounter that sequence.

**Verified**, at both joins: body|description ("The committee reviewed the" + "quarterly
filings without objection.") and description|description ("The board met in March." +
"Revenue rose twelve percent."). A fix treating the harvest as one merged block leaves the
second open.

### `check()` is not the only matcher

**`harvest` proposes claims against the same flat string.** `src/harvest/spans.ts` extends
and pins candidate spans with `phraseFound` over the flat `toText` output, and
`src/harvest/filters.ts` frequency-filters over the same. A span crossing a join therefore
passes harvest's own assertion, enters the author's claims file **with her approval**, and is
then rejected by the post-fix `check()` — `unsupported` on a readable page, a red run against
a claim this tool proposed.

That is the design spec's worst-ranked outcome, produced by fixing one matcher and not the
other. **Route 1 covers both.** A release that fixed only `signals.ts` would manufacture the
failure it exists to prevent.

### The fix

Extraction exposes its regions internally: **the body, plus each distinct description value
separately**. A claim must match entirely within one region.

```ts
matchedClaims = claims.filter((c) => regions.some((r) => phraseFound(r, c)))
```

The same region rule governs harvest's span assertion and its frequency filter.

### What does not change

- **`toText`'s output is byte-identical** under this fix. It remains the join of the same
  regions in the same order. Routes 2 and 3 do move it; route 1 does not.
- **`proseChars` and every calibration figure** are unchanged by this fix.

### Direction — corrected

The earlier draft claimed the predicate "can only ever remove matches" and that a region
match is "by construction also present in the flat text". **Both are false, with a verified
counterexample.** `norm` folds digit-unit pairs: a body ending "Revenue was 12" and a
description beginning "billion users grew during the quarter" normalize *across the join* to
"...was 12bn users grew...", so the claim "billion users grew" **fails** against the
concatenation today and **matches** the description region. Any of `norm`'s four digit-unit
folds at a region boundary does this.

So the corrected statement is: the fix removes matches that spanned a join, **and restores
matches that a fold across a join had destroyed.** Both movements are correct. A page can
become `supported` — correctly, because the claim genuinely is in that region, which is what
criterion 2 requires.

### Excerpts — corrected

`excerptFor` works on the flat text, and in the fold case above it returns **null** for a
claim that legitimately matched a region: its window spans the join and its own contract
check fails. That is an existing, tolerated outcome — a `supported` row with no excerpt
renders nothing (cutover spec §1) — not a new defect. The implementation either accepts a
null excerpt for these rows or locates the excerpt within the matching region; it must not
assume the flat lookup always resolves.

### The consumer-visible consequence

Closing the seam turns a `supported` into an `unsupported` on a readable page — a **correct
accusation**, which fails a run by default. Pages green today go red. That is the intended
outcome and it must be stated plainly in the changelog; §6's question 2 produces the list.

## 3. The wrong-attribute harvest (route 2)

`IS_DESCRIPTION` is tested against the whole tag string, so it fires on any tag containing
something shaped like `name="description"` anywhere — including inside a different attribute's
value. **Verified:** `<meta name="keywords" content="'x' name='description' LEAKED">` harvests
`'x' name='description' LEAKED`.

Decide description-ness from the tag's own attribute-name positions. This **changes `toText`'s
output**, removing text that was never the page's description.

Because it removes text, a page can cross the 4,500 floor **downward**. That direction is
safe — a readable page becomes `unreachable` rather than accused, and a full match is
unaffected because `matched === total` precedes the floor — but §6 must count it, since a
crossing is a release-changing finding by this project's own rule.

## 4. The abandoned tail (route 3)

`tagsIn` scans tag by tag respecting quoted attribute values. On an unterminated quote it
runs to end of input and stops, discarding every later tag including real descriptions.

**Verified end to end:** a ~5,900-character readable page whose claim lives only in a
description after `<div title="unterminated>` returns **`unsupported`** — an accusation, not
merely lost coverage, because `matched === total` is tested before the floor
(`src/classify/verdict.ts`).

### The rule — corrected, because the earlier draft did not fix its own example

The earlier draft said "recover at the first `>` observed while inside **that** quote". That
is wrong, and wrong precisely on the motivating case. In
`<div title="unterminated><p>x</p><meta name="description" content="...">` the unterminated
`"` is closed by **the description's own attribute quote**; parity alternates, and the rule
recovers at the wrong position. Measured: it harvests **nothing**.

**The rule is: recover at the first `>` observed inside ANY quote during the stranded scan,
and allow at most one recovery per document.**

The bound is load-bearing, not tidiness. Unbounded, the rule is quadratic — a repeated
`<a b="c>"` unit plus one stray quote measured 18 KB → 200 ms, 36 KB → 806 ms, 72 KB →
3,249 ms, roughly 4x per doubling, which is a denial of service in a gate that fetches
arbitrary URLs. Bounded to one recovery it is linear: **288 KB → 3 ms**, and it still
recovers the motivating description.

### The cost, which is larger than the earlier draft admitted

Consider `<div title="x > <meta name='description' content='INJECTED'> tail`. Per HTML5 a
browser absorbs everything to end of input into the `title` value and renders **nothing** —
there is no meta element. **Any** recovery that satisfies criterion 5 harvests `INJECTED`;
verified. The two inputs — a real description after a malformed tag, and a meta-shaped string
inside an unterminated attribute — are indistinguishable to a tokenizer, because HTML5
absorbs both.

So route 3 **deliberately reopens the meta-in-attribute route for unterminated attributes.**
That is accepted here, under the design spec's ranking: the alternative is accusing an author
over our own parse failure. It is bounded to one recovery per document, and it must be
disclosed in the README's known-gaps list beside the existing entries.

The earlier draft's sentence claiming the recovered tag "is a genuine publisher-authored
description rather than the stale or injected content the strips exist to exclude" is false
in exactly this construction and is withdrawn. **The same sentence appears in `tagsIn`'s
comment in `src/text/extract.ts`, along with a now-stale "Scheduled for 0.5.1" — the
implementation rewrites both.**

## 5. Semver

**Minor — 0.6.0.** Routes 2 and 3 change `toText`'s committed output; route 1 changes
verdicts. This repository's doctrine (`src/text/normalize.ts:7-11`) treats a change to
committed output as breaking, which argues for major; as with 0.5.0 it ships as minor on the
narrower ground that `^0.5.0` excludes `0.6.0`. **That concession must appear in the
changelog** — 0.5.0's entry dropped it and review restored it.

## 6. Measurement

Re-run `scripts/description-movement.mjs` against 0.6.0 and answer four questions:

1. **Does route 3's recovery move any page across the 4,500 floor upward?** Any crossing is a
   release-changing finding, not a number to tabulate. For each, report whether the gain is
   duplicated body text using the **fold-aware longest-common-run cover** — not whole-sentence
   exact matching, which understated duplication badly enough in 0.5.0's report to reverse two
   of five verdicts.
2. **Which pages lose a match to route 1?** Name them. They are the evidence the seam was real
   in the wild rather than only constructible, and they are the pages whose CI runs go red.
3. **Does route 2 move any page across the floor downward?**
4. **Do routes 2 or 3 move any calibration fixture?** If so, `scripts/calibrate.mjs` and
   `scripts/sweep-floor.mjs` are re-run and the figures in `docs/calibration-2026-09.md`, the
   design spec, `src/classify/thresholds.ts`, `src/classify/verdict.ts` and the README are
   refreshed — the obligation 0.5.0 discharged in its own PR. A prototype sweep over the
   on-disk HTML fixtures found no movement under either fix, so the expected answer is "no
   refresh needed"; it must be established against the real implementation, not assumed.

**The harness passes `claims: []`, so it cannot answer question 2 as it stands.** Either
extend it to carry the corpus's stored claims, or answer question 2 from constructed fixtures
and say plainly that the live corpus was not used. Do not report a number the instrument
cannot support; 0.5.0's report had to disclose exactly this after the fact.

## 7. Acceptance criteria

1. A claim spanning the body/description join does not match. A claim spanning two description
   values does not match.
2. A claim matching entirely within the body, or entirely within any single description value,
   **does** match — including when a `norm` digit-unit fold across a join previously destroyed
   it. (This is the criterion a careless fix breaks.)
3. **Every span `harvest` proposes is matchable by the post-fix `check()`.** No tool-proposed
   claim may produce an accusation.
4. `toText`'s output is unchanged by the route-1 fix alone, proven by byte-comparing pre- and
   post-fix extraction over every `.html` file under `fixtures/` (38 on disk at time of
   writing; name the glob rather than a count).
5. A `keywords` tag containing `name='description'` in its content is not harvested; genuine
   `description`, `og:description` and `twitter:description` still are, in every attribute
   order and quoting style the 0.5.0 tests already cover.
6. A page with an unterminated quote followed by a real description harvests that description
   — including when both use double quotes, which is the case the earlier draft failed.
7. Termination and linearity: a `<` with no `>` anywhere after it terminates; **and** a
   repeated `<a b="c>"` unit followed by a stray quote completes in time linear in input
   length. (The earlier criterion tested only the first family, which never exercises
   recovery at all.)
8. Every unrendered-text route 0.5.0 closed stays closed **for terminated attributes**:
   script (closed and unclosed), `<template>` (closed and unclosed), comment (plain, early
   `>`, unclosed), and a meta-shaped string inside a *terminated* attribute. The unterminated
   variant is a named, accepted reopening per §4.
9. `<noscript>` content is still harvested.
10. 585 existing tests pass, or every deviation is named with the reason it is correct.

## 8. Open questions

1. **Should regions be visible to consumers?** Needed only internally; not proposed for
   export. Named so the omission is a decision.
2. **Question 2's instrument** — extend the harness to carry claims, or answer from fixtures
   and disclose. Decide before the plan is written.

## 9. What this release does NOT fix

- **Other joins in the body region.** `<title>` text lands in the body at head position, so a
  claim spanning title|body matches text no reader encounters as a sequence. The body path
  still strips with `<[^>]*>` rather than `tagsIn`, so a `>` inside an attribute leaks the
  attribute tail into body prose, and `<template>` and comment tails likewise sit in body
  text — 0.5.0 closed those on the harvest side only. These are route 1's shape inside the
  region this fix treats as one block. Body extraction stays contractually untouched in this
  release; recorded here so they are not rediscovered as new.
- A claim appearing only in a description still returns `supported` **below** the 4,500 floor,
  because `matched === total` precedes the floor. Deliberate, disclosed in the README, and the
  shape the consumer cutover exists to fix.
- The stale `"two of nine real documents"` count in `src/classify/verdict.ts` — pre-existing
  and unrelated.
- Unquoted attribute values (`content=Foo`) are still not harvested. Safe direction; one line
  in the docstring, not a behaviour change.

## 10. What review changed

| finding | change |
| --- | --- |
| the recovery rule did not fix its own motivating case — the unterminated quote is closed by the description's own attribute quote | §4 — recover at the first `>` inside ANY quote |
| the only reading that did fix it was quadratic, measured 4x per doubling | §4 — bounded to one recovery per document, verified linear at 288 KB |
| criteria 5 and 7 were jointly unsatisfiable: any working recovery harvests injected text from an unterminated attribute | §4 names the reopening as an accepted cost; criterion 8 scoped to terminated attributes |
| route 1 fixed `check()` and not `harvest`, so the tool would accuse an author over a claim it proposed | §2 — route 1 covers both matchers; criterion 3 added |
| "the predicate can only remove matches" and "a region match is by construction in the flat text" were both false | §2 Direction rewritten with the digit-unit fold counterexample |
| "the excerpt still resolves" was false; it returns null in that case | §2 Excerpts rewritten to the actual contract |
| other joins (title, attribute leak, template/comment body tails) went unrecorded | §9 |
| no calibration-refresh, README-gap or comment-rewrite obligation | §6 question 4, §4, §3 |
| the seam closure's CI-visible consequence was unstated | §2 |
| criterion 3 named "36 HTML fixtures", a universe that does not exist | criterion 4 names a glob |
