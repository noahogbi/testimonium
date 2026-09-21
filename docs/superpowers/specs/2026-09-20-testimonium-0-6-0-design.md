# testimonium 0.6.0 — attest only what is on the page

**Status:** design, revised after three review rounds. See §9 for what review changed and §8
for what was cut.
**Amends** the behaviour 0.5.0 shipped.

## 1. What this fixes

0.5.0 made `toText` harvest `description` / `og:description` / `twitter:description`
content. That closed a real failure — a page whose prose lives in its description read as
unreadable — and opened two that this release closes. Both are live on npm and both were
verified by execution, not by reading:

| # | route | verified |
| --- | --- | --- |
| 1 | a claim spanning the join between two harvested regions matches text that exists **nowhere on the page** and returns `supported` | yes |
| 2 | `IS_DESCRIPTION` and `CONTENT_ATTR` match substrings of the whole tag, so the wrong attribute's text is harvested — and the real description is lost | yes |

Both are **tightenings against false attestation**, which is what makes them one release: each
removes a way the tool can say "this page says that" when it does not.

A third route — `tagsIn` abandoning the tail of a document after an unterminated quote — was
specified here across three review rounds and **is cut**. §8 records why, because the reason
is about this document's own reliability rather than about the defect.

### The ranking this rests on

`2026-09-06-testimonium-design.md:101-103` ranks the two wrong verdicts, and the document
subordinates itself to the **keystone rule** at `:109-110`, of which the ranking is the
rationale: a false accusation "is a worse failure than the one the tool exists to prevent,
because it is self-inflicted and it is aimed at the author's own honest citations."

**Name the spec you cite.** "A false `supported` is the one outcome the spec calls inviolable"
belongs to the CONSUMER cutover spec `2026-09-15-citation-check-cutover-design.md` §1, not to
the design spec. The two rank oppositely and both are quoted in `src/text/extract.ts`.

## 2. The seam (route 1)

### What is wrong

`toText` returns one flat string. In `check()`'s verdict path the match is
`src/classify/signals.ts:148-150`, and `phraseFound` is
`norm(haystack).includes(norm(phrase))` (`src/text/normalize.ts:53`). Any claim straddling a
join between concatenated regions matches, though no reader could encounter that sequence.

**Verified at both joins:** body|description ("The committee reviewed the" + "quarterly
filings without objection.") and description|description ("The board met in March." +
"Revenue rose twelve percent."). A fix treating the harvest as one merged block leaves the
second open.

### `check()` is not the only matcher

**`harvest` proposes claims against the same flat string.** `src/harvest/spans.ts` extends and
pins candidate spans with `phraseFound` over the flat `toText` output, and
`src/harvest/filters.ts` frequency-filters over the same. A span crossing a join passes
harvest's own assertion, enters the author's claims file **with her approval**, and is then
rejected by the post-fix `check()` — an accusation against a claim this tool proposed. That is
the design spec's worst-ranked outcome, produced by fixing one matcher and not the other.
**Route 1 covers both.**

### The fix

Extraction exposes its regions internally: **the body, plus each distinct description value
separately**. A claim must match entirely within one region.

```ts
matchedClaims = claims.filter((c) => regions.some((r) => phraseFound(r, c)))
```

**Harvest scans per region rather than filtering a flat scan.** A candidate span is drawn from
within one region, so it cannot cross a join by construction. The alternative — flat scan plus
post-filter — drops legitimate join-adjacent spans whole instead of clipping them to the
region, a coverage loss with no compensating benefit.

### Comments this falsifies

- **`src/harvest/spans.ts`** asserts "THIS IS THE ONLY WAY ASSERTION 1 CAN FAIL" and its
  `normBoundaryNote` attributes every assertion-1 drop to a digit-magnitude fold. Under
  per-region scanning a join-crossing span never reaches assertion 1 at all, so the comment is
  not wrong about a *new* failure path — it is a proof phrased over the flat source that must
  be **restated per region**, with digit-fold boundary effects now arising at region edges.
  (An earlier draft said region-awareness "makes a join-crossing span a second way it can
  fail." That is the failure mode of the rejected flat-scan design, not the mandated one.)
- **`src/harvest/sources.ts`'s `HarvestRead.normText`** is a one-flat-string memoization whose
  docstring records why it exists. Per-region voting obsoletes the interface as written. The
  behavioural delta is accepted: a span matching another source only across that source's join
  no longer votes, so there are fewer frequency drops, and every surviving span remains
  per-region matchable by `check()`.

### Direction

The fix removes matches that spanned a join, **and restores matches that a fold across a join
had destroyed.** Only the two token-rewriting `norm` folds do this — `billion` and `million`;
the `bn` and `mn` folds merely delete the join space, so the region match survives in the flat
text. Verified: a body ending "Revenue was 12" and a description beginning "billion users
grew" normalize across the join to "...was 12bn users grew...", so the claim "billion users
grew" fails against the concatenation today and matches the description region. Both movements
are correct.

### Excerpts

**Locate the excerpt within the matching region.** A flat lookup is not merely sometimes null,
it can be actively wrong: with descriptions "The board met" and "in march the group met in
march at noon", the claim "met in march" legitimately matches the second region while
`excerptFor` finds the JOIN-SPANNING occurrence and returns a passage conjoining two separate
meta tags as one sequence. A null excerpt is an acceptable fallback where a region lookup
fails — a `supported` row with no excerpt renders nothing (cutover spec §1) — but a
join-spanning passage is not.

### The consumer-visible consequence

Closing the seam turns a `supported` into an `unsupported` on a readable page — a **correct
accusation**, which fails a run by default. Pages green today go red. The changelog must say
so; §5 question 2 produces the list.

## 3. The wrong-attribute harvest (route 2)

Both `IS_DESCRIPTION` and `CONTENT_ATTR` are tested against the whole tag string, so each
fires on a substring appearing anywhere in the tag — including inside a different attribute's
name or value. Verified:

- `<meta name="keywords" content="'x' name='description' LEAKED">` harvests `LEAKED` from a
  tag that is not a description at all.
- `<meta name="description" data-content="WRONG" content="THE REAL DESCRIPTION">` harvests
  `WRONG` — `\bcontent` matches inside `data-content`.
- `<meta name="description" title='use content="INJECTED" here' content="THE REAL DESCRIPTION">`
  harvests `INJECTED`.

In the last two the wrong text enters prose **and the real description is lost entirely.**

### The fix is the class, not the instances

Both regexes pattern-match over the tag string. Fixing them one at a time is how an earlier
draft of this spec shipped a fix for one while its sibling stayed open. **Parse the tag's
attributes into name/value pairs and decide from those**: description-ness from the
`name`/`property` attribute's value, the content from the `content` attribute's value.

### The grammar, pinned

Left unstated, a parser changes the harvest on **well-formed** pages, and 0.5.0's tests pin
only attribute order and quote style — so the criteria would not catch it.

| axis | rule | why |
| --- | --- | --- |
| whitespace around `=` | permitted: `name = "description"` | valid HTML5 and harvested today; a stricter parser would silently drop a real description |
| unquoted values | **not** harvested | preserves 0.5.0 behaviour exactly; a parser that accepted them would newly harvest `name=description`. Disclosed in §7 |
| attribute names AND values | case-insensitive, including the `og:`/`twitter:` prefixes | today's regexes are `/i`, and 0.5.0 harvests `name="DeScRiPtIoN"`, `property="OG:Description"` and `<META ...>` - verified. A parser that lowercases NAMES but compares the value with `=== "description"` passes every other row and silently drops a real description on a well-formed page. `name="Description"` is ordinary legacy CMS output |
| duplicate attributes | **first** wins | matches 0.5.0's first-match behaviour **for `content`** (verified: `content="A" content="B"` harvests `A`) and matches HTML5; the natural `map.set` loop is last-wins and would diverge silently. For a duplicated `name` 0.5.0 is not first-match - `name="keywords" name="description"` harvests today because the substring defect fires - and a first-wins parser will not. That divergence is the route-2 class being closed, on malformed input |
| `/` before `>` | inert | the no-space `"/>` form appears in the calibration fixtures (AP News `twitter:description`) |

### Direction — both ways

This fix **removes** leaked text and **restores** real descriptions currently lost to the
`CONTENT_ATTR` defect. Measured on one constructed tag: 8 characters of leaked text removed,
20 characters of real description restored — a net **add**.

So a page can cross the 4,500 floor in **either** direction. Downward is safe: a readable page
becomes `unreachable` rather than accused. **Upward is not** — it turns `unreachable` into
`unsupported` where `matched < total`, a new accusation, which is the design authority's
worst-ranked outcome. §5 asks both directions.

Route 2 also moves matches: a claim that matched leaked text loses its match, so pages can go
red for this route too, not only for route 1. The changelog obligation covers both.

## 4. Semver

**Minor — 0.6.0.** Route 2 changes `toText`'s committed output; route 1 changes verdicts.
This repository's doctrine (`src/text/normalize.ts:7-11`) treats a change to committed output
as breaking, which argues for major; as with 0.5.0 it ships as minor on the narrower ground
that `^0.5.0` excludes `0.6.0`. **That concession must appear in the changelog** — 0.5.0's
entry dropped it and review restored it.

## 5. Measurement

Re-run `scripts/description-movement.mjs` against 0.6.0 and answer:

1. **Does route 2 move any page across the 4,500 floor, in either direction?** Upward is the
   release-changing one. For any crossing, report whether the gain is duplicated body text
   using the **fold-aware longest-common-run cover** — not whole-sentence exact matching,
   which understated duplication badly enough in 0.5.0's report to reverse two of five
   verdicts.
2. **Which pages lose a match, to either route?** Name them. They are the evidence the seam
   and the leak were real in the wild rather than only constructible, and they are the pages
   whose CI runs go red.
3. **Do either route's changes move any calibration fixture?** If so, `scripts/calibrate.mjs`
   and `scripts/sweep-floor.mjs` are re-run and the figures in `docs/calibration-2026-09.md`,
   the design spec, `src/classify/thresholds.ts`, `src/classify/verdict.ts` and the README are
   refreshed — the obligation 0.5.0 discharged in its own PR. A prototype sweep found no
   fixture movement; that must be established against the real implementation, not assumed.

**The harness passes `claims: []`, so it cannot answer question 2 as it stands.** Either
extend it to carry the corpus's stored claims, or answer from constructed fixtures and say
plainly that the live corpus was not used. Do not report a number the instrument cannot
support; 0.5.0's report had to disclose exactly this after the fact.

## 6. Acceptance criteria

1. A claim spanning the body/description join does not match. A claim spanning two description
   values does not match.
2. A claim matching entirely within the body, or entirely within any single description value,
   **does** match — including when a `norm` token-rewriting fold (`billion`, `million`) across
   a join previously destroyed it. This is the criterion a careless fix breaks.
3. **Every span `harvest` proposes is matchable by the post-fix `check()` against the same
   extraction.** No tool-proposed claim may produce an accusation. The qualifier is not a
   weakening: a page re-fetched at check time can legitimately have changed, which is source
   drift rather than a tool defect.
4. An excerpt is located within the matching region; no excerpt spans a join. A null excerpt
   is acceptable where a region lookup fails.
5. `toText`'s output is unchanged by the route-1 fix alone, proven by byte-comparing pre- and
   post-fix extraction over every `.html` file under `fixtures/` (38 on disk at time of
   writing; name the glob, not a count).
6. Attribute parsing: a `keywords` tag containing `name='description'` in its content is not
   harvested; `data-content` does not satisfy `content`; a `content="..."` appearing inside
   another attribute's value does not satisfy it either; and the real description IS harvested
   in each of those cases. Every row of §3's grammar table has a test — whitespace around `=`,
   unquoted values still unharvested, duplicate `content` attributes taking the first, the
   `"/>` form, and **case-insensitivity on the attribute VALUE as well as the name**:
   `name="DeScRiPtIoN"`, `property="OG:Description"` and `<META ...>` must each still harvest.
7. Every unrendered-text route 0.5.0 closed stays closed **for the constructions 0.5.0's tests
   pin — pages whose earlier markup keeps quote parity intact**: script (closed and unclosed),
   `<template>` (closed and unclosed), comment (plain, early `>`, unclosed), and a meta-shaped
   string inside a terminated attribute. This is not a general guarantee about terminated
   attributes; see §7's first bullet for the case that remains open.
8. `<noscript>` content is still harvested.
9. 585 existing tests pass, or every deviation is named with the reason it is correct.

## 7. What this release does NOT fix

- **Tag boundaries diverge from a browser's, and already do today.** A quote character
  appearing inside an UNQUOTED attribute value desyncs the scan's quote parity, so it can end
  a "tag" at a `>` that HTML5 places inside a later quoted value, exposing a meta-shaped
  string there as a live tag. Verified on published 0.5.0:
  `<div title=O'Brien><span data-x='A > <meta name="description" content="INJECTED"> B'>`
  harvests `INJECTED`, while HTML5 ends the unquoted `title` at the `>` and puts the meta text
  inside the span's single-quoted `data-x`, where no element exists and nothing renders. An
  apostrophe in an unquoted value is ordinary content, not an attack. This predates the
  release and is not closed by it, which is why criterion 7 is scoped rather than universal.
  It belongs in the README's known-gaps list.

  **An earlier draft illustrated this with
  `<div title="unterm><span data-x="A > <meta ...> B">` and claimed HTML5 would render none of
  it. That was false**: HTML5 closes the double-quoted `title` at the very next `"`, so the
  meta is a live element for a browser too and 0.5.0 agrees with it there. The claim survived
  two review rounds because it was never traced through the tokenizer - the same mechanism
  that defeated the first recovery rule in §8, applied to an example rather than a rule.
- **The abandoned tail after an unterminated quote** — see §8.
- **Other joins in the body region.** `<title>` text lands in the body at head position, so a
  claim spanning title|body matches text no reader encounters as a sequence. The body path
  still strips with `<[^>]*>` rather than `tagsIn`, so a `>` inside an attribute leaks the
  attribute tail into body prose, and `<template>` and comment tails likewise sit in body text
  — 0.5.0 closed those on the harvest side only. Same shape as route 1, inside the region this
  fix treats as one block. Body extraction stays contractually untouched here.
- **Unquoted attribute values** are still not harvested, now by explicit decision (§3) rather
  than by accident of the regexes.
- A claim appearing only in a description still returns `supported` **below** the 4,500 floor,
  because `matched === total` precedes the floor. Deliberate, disclosed in the README, and the
  shape the consumer cutover exists to fix.
- The stale `"two of nine real documents"` count in `src/classify/verdict.ts`.

## 8. Why the `tagsIn` recovery was cut

`tagsIn` stops at the first tag whose quote is never closed, discarding every later tag
including real descriptions. On a page with enough body prose to clear the floor, that leaves
`matched < total` on a readable page — an accusation, not merely lost coverage. It is a real
defect and it is the one the design spec's ranking cares most about, so cutting it needs a
reason.

**The reason is that three review rounds produced three rules and all three were wrong**, each
in a way the round before had not considered:

| round | rule | how it failed |
| --- | --- | --- |
| 1 | recover at the first `>` inside *that* quote | harvested nothing on its own motivating case — the unterminated quote is closed by the description's own attribute quote |
| 2 | first `>` inside *any* quote, one recovery per document | the bound contradicted a universally quantified criterion; multi-strand pages abandon the second description |
| 3 | criterion scoped to the first stranded scan | still false when the stranded region contains no `>` before the description — the recovery point becomes the description's own closing `>` and swallows it |

Each rule also carried costs the previous one had not surfaced: a deliberate HTML5 divergence,
a reopening of the meta-in-attribute route for unterminated attributes, and a residual where
the recovery budget is spent on the first malformation rather than the useful one.

Against that, **the malformation is not present in the corpus**: a scan replicating `tagsIn`
over all 38 real captured fixtures strands on none of them. The fix is therefore buying a
correction for a shape we have never observed, at the cost of the most intricate rule in the
document — one that has been wrong every time it has been written.

It is deferred to its own release, where the rule can be settled on its own terms and, ideally,
against evidence of real incidence. Detecting a strand needs raw bodies, which the 618-URL
movement corpus does not retain, so that evidence requires its own fetch.

**This is not a judgment that the defect does not matter.** It is a judgment that a rule wrong
three times running should not ship alongside two fixes that are simple, verified, and
independently valuable.

## 9. What review changed

### Round one

| finding | change |
| --- | --- |
| the recovery rule did not fix its own motivating case | §8 — eventually cut |
| route 1 fixed `check()` and not `harvest`, so the tool would accuse an author over a claim it proposed | §2 — both matchers; criterion 3 |
| "the predicate can only remove matches" and "a region match is by construction in the flat text" were both false | §2 Direction, rewritten with the digit-fold counterexample |
| "the excerpt still resolves" was false; it returns null in that case | §2 Excerpts |
| other joins (title, attribute leak, template/comment body tails) unrecorded | §7 |
| the seam closure's CI-visible consequence unstated | §2 |

### Round two

| finding | change |
| --- | --- |
| `CONTENT_ATTR` carried the identical whole-tag defect, injecting wrong text AND losing the real description | §3 — the fix became attribute parsing, closing the class |
| meta-in-a-TERMINATED-attribute already open on published 0.5.0 via quote-parity desync | §7 — recorded; criterion 7 scoped |
| `spans.ts` asserts "THIS IS THE ONLY WAY ASSERTION 1 CAN FAIL", which the fix falsifies | §2 — rewrite obligation |
| whether harvest scans per region or filters a flat scan was left to the plan | §2 — decided: per region |
| "four digit-unit folds" was true of two | §2 |
| criterion 3 unguaranteeable against a re-fetch | criterion 3 — "against the same extraction" |
| the excerpt fallback permitted a join-spanning passage | §2 — region-located, null as fallback |

### Round three

| finding | change |
| --- | --- |
| the recovery criterion was STILL false — a single-strand page whose strand contains no `>` before the description harvests nothing | §8 — the rule was cut rather than patched a fourth time |
| route 2's fix now ADDS text, while the adjacent sentence still analysed removal only; upward floor crossings unexamined | §3 Direction — both ways; §5 question 1 |
| the attribute grammar was unpinned on five axes where parsing changes well-formed pages | §3 — grammar table; criterion 6 |
| a criterion promised a general terminated-attribute guarantee its own §7 example contradicts | criterion 7 — scope moved into the criterion's own text |
| the `spans.ts` rationale described the failure mode of the REJECTED design | §2 — restated as a per-region proof |
| `HarvestRead.normText`'s docstring obsoleted, unrecorded | §2 |

### Round four

| finding | change |
| --- | --- |
| the grammar table pinned attribute-NAME case but not VALUE case; a parser comparing `=== "description"` passes every other row and silently drops `name="Description"` on a well-formed page | §3 case row; criterion 6 |
| §7's leak example proved nothing - HTML5 closes that double-quoted `title` at the next `"`, so the meta is live for a browser too and 0.5.0 agrees with it | §7 - replaced with a verified divergent example, and the false claim recorded |
| "first duplicate wins" preserves 0.5.0 only for `content`; a duplicated `name` behaves differently | §3 duplicate row scoped |
