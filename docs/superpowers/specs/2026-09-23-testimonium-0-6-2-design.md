# testimonium 0.6.2 - close what 0.6.0 left open, move nothing

**Status:** design, approved in conversation 2026-09-23; not yet reviewed as a written spec.
**Builds on** `v0.6.1` (`ca86870`), which the omnisscientia session shipped for the pdftotext
tag-stripper fix. This release was scoped as 0.6.1 and renumbered when that one landed first.
**Source of the work:** the "Still open after 0.6.0" table in
`docs/superpowers/plans/2026-09-21-testimonium-0-6-0-ledger.md`.

## 1. What this is, and the property that makes it a patch

The 0.6.0 ledger recorded ten items that were found, decided, and deliberately left. This
release closes the eight that can be closed **without moving a single verdict**, and defers
the two that cannot.

**The governing property: no verdict, no `toText` output, no `SignalResult` field and no
harvest proposal changes on any input the test suite or the 38 bundled fixtures can express.**
Everything in scope is a message, a test, a comment, dead code, or a cost-only refactor. That
is what licenses a patch number, and it is proved by execution (section 7), not argued.

| ledger item | disposition |
| --- | --- |
| `recheck` attribution message | **fixed** - section 2 |
| four tests that can pass vacuously | **fixed** - section 3 |
| `HarvestRead.text` is dead | **fixed** - section 4 |
| `seedIndex` rebuilt per region | **fixed** - section 4 |
| `dropContained`'s stale argument | **fixed** - section 5, with a test |
| `"two of nine real documents"` | **fixed** - section 5 |
| stale citations | **fixed** - section 5 |
| the `tagsIn` recovery | **stays cut** - 0.6.0 spec section 8; nothing new to say |
| unbounded region count | **deferred** - section 6 |
| flat-join reads in the challenge signature and slug overlap | **deferred** - section 6 |

## 2. The `recheck` attribution line

### The defect

`renderOutcome` (`src/bin.ts:96-97`) prints, for every `pipelineDrift` row:

    This is a regression in testimonium, not a defect in your document.

`pipelineDrift` means the archived bytes, judged by the running tool (A), disagree with the
verdict recorded when they were archived (R). When the tool that archived them and the tool
judging them now are the **same version**, that sentence is the only explanation available and
is correct. When the versions **differ**, it is frequently false: 0.6.0 deliberately stopped a
claim matching across a region join, so a 0.5.0 archive of a join-only match now yields
`L = A = unsupported` against `R = supported` - a tightening working as designed, reported as a
regression. The same row can also hide a genuine source drift (the live page changed too, and
we cannot tell), which the fixed sentence misattributes.

The exit code (2) is correct in every one of these cases and **does not change**. The category
and `compare.ts` do not change. One sentence changes.

### The rule

The line branches on the **tool version**, which the outcome already carries:
`o.bundledVersionChanged` is computed as `entry.toolVersion !== input.toolVersion`
(`src/archive/compare.ts:130`), and `o.archivedToolVersion` is `entry.toolVersion`.

- **Same version** (`bundledVersionChanged` false): the existing sentence, verbatim.
- **Different version:**

      testimonium <VERSION> reads these archived bytes differently than <archivedToolVersion>
      did, which recorded them as <recorded>. See the CHANGELOG between those versions;
      this is not a defect in your document.

A `pipelineDrift` row is only produced with an archive entry present, whose `toolVersion` is a
required field (`src/archive/format.ts:61`) and whose recorded verdict is `supported` by the
invariant `compareCitation` checks. So both interpolated values are always present on this row;
no null branch is specified, and the renderer must not invent one.

**The name is misleading, the value is right.** `bundledVersionChanged` reads as "the bundled
rules moved", and the header suffix says exactly that - but what it compares is the tool
version the rules ship inside. This release keys on it because it is the tool version, and
does **not** rename it or reword the suffix: both are outside this item, and a rename touches
`CitationOutcome`'s shape. Recorded here so a later reader does not "fix" the new line to use a
rules hash.

### Tests

- A render test per branch (same version; different version), asserting the exact lines.
- **The ledger's own case, end to end:** a synthetic archive entry stamped `0.5.0` whose
  recorded verdict is `supported` for a claim that matches only across a body|description
  join, replayed under the current tool. It must land on `pipelineDrift`, exit 2, and print the
  different-version wording. This is the case that motivated the item, so it is the test that
  proves it closed.

## 3. Four tests that can pass vacuously

Each fix is **mutation-checked**: break the property the test names, show it goes red, restore.

| test | why it is vacuous | fix | mutation that must redden it |
| --- | --- | --- | --- |
| `test/harvest/proposals.test.ts` | loops over proposals asserting absence; zero proposals passes. It is the only test for criterion 3's harvest half | add a **positive control**: assert a specific non-spanning span IS proposed, so an empty list is red. The control phrase is chosen by execution, not guessed | make `harvest()` return no proposals; and separately revert per-region scanning (`4586b85`'s source) |
| `test/text/excerpt-region.test.ts` test 1 | `?? ""` turns a null excerpt into a pass | assert the excerpt is non-null before asserting its content | make the matched region's excerpt null |
| `test/text/excerpt-region.test.ts` test 2 | re-implements the region traversal instead of observing `check()`; reverting all of `049da8f` leaves it green | drive `check()` and assert the returned excerpt is the description sentence | revert `049da8f`'s source change |
| `test/harvest/filters.test.ts` helper | hardcodes `regions: [text]`, so no filter is ever exercised over more than one region | the helper takes regions; add a two-region case for the frequency filter | collapse the filter's per-region loop to the first region |

Each existing assertion is kept; these add teeth, they do not replace coverage.

## 4. Dead code and cost

Harvest's types are internal: `src/index.ts` exports nothing from `src/harvest*`, so neither
change below touches the public surface.

**`HarvestRead.text`.** Nothing in `src/` reads it and its docstring ("the extracted text,
which proposals are cut from") is false - proposals are cut from `regions`. Remove the field,
its population at `src/harvest/sources.ts:151`, and the docstring; rewrite `regions`'s
docstring, which currently defines itself as "`text`'s regions". Any test constructing a
`HarvestRead` drops the field.

**`seedIndex`.** `commonSpans` folds the *draft* and builds `seedIndex(doc.folded)` on every
call - once per region, per read, per source - although the draft is constant across a
`harvest()` run. Introduce an internal prepared-draft form (fold plus index, built once per
`harvest()`), and have `harvest()` use it. **`commonSpans(docProse, sourceText, seedChars)`
keeps its signature and behaviour**, implemented over the prepared form, because
`scripts/calibrate-harvest-seed.mjs` calls it with a swept `seedChars`. `seedIndex`'s docstring
states the cost model; update it to say where the index is built.

Proof it is cost-only: every harvest test's proposals are unchanged, and the section 7 hash
includes harvest output.

## 5. Stale text

| where | what is wrong | correction |
| --- | --- | --- |
| `src/harvest.ts:121-135`, `dropContained` comment | "NO FIXTURE CAN EXERCISE THE UNION TODAY" is now true only by accident: per-region scanning makes an ordinary page whose description repeats its lede yield the same span twice before `dropContained` | rewrite the argument for per-region scanning, **and add the test** it now makes possible: a lede-repeating page proposes the span once; with the `dropContained` call removed it proposes it twice |
| `src/classify/verdict.ts:27` | "two of nine real documents" is wrong (the ledger says two of ten documents, or one of nine real captures) | establish the figure **from the calibration data by execution**, not from the ledger's parenthetical, and state it with its population |
| `test/text/extract-descriptions.test.ts:195` | cites `descriptionText`, now `descriptionValues`, and "the comment above the filter" | rename, and repoint at a comment that exists |
| `docs/superpowers/specs/2026-09-15-citation-check-cutover-design.md:100` | describes `excerptFor` taking the first match - the mechanism 0.6.0's `049da8f` replaced | append a dated note under the line; do not rewrite the historical spec |
| `docs/superpowers/specs/2026-09-20-testimonium-0-6-0-design.md:42` | cites `signals.ts:148-150` for the defect; those lines are now the fix | append a dated note naming the defect's commit instead |
| `README.md:225` | "a description regex would key on" - there is no description regex since 0.6.0's attribute parse | reword to the attribute parse |

Specs are corrected by **appended dated notes**, not rewrites, so the review history they record
stays legible.

## 6. Deferred, and why

Both items change what the tool computes and so cannot ride a patch whose governing property
is that nothing moves.

- **Unbounded region count.** A cap changes `toText`'s byte output on a page over the cap. It
  needs its own spec: a cap value justified against the 38 fixtures and the 618-URL corpus
  (0.6.0 measured none above 2 regions), and a movement report. Cost today: ~3.7 s for 50
  claims on a synthetic 5,000-description page.
- **Flat-join challenge signature and slug overlap.** Moving `matchesChallengeSignature` and
  `slugLabelOverlap` onto regions changes veto inputs and therefore needs the calibration
  re-run. Safe direction (a veto, not an accusation), near-zero incidence.

Both stay listed as open in the ledger note this release adds.

## 7. Verification

- **Baseline:** 617 tests / 52 files, `tsc --noEmit` exit 0, at `ca86870`. A different number
  before the first task means stop and report.
- **Fidelity snapshot, taken before any source edit:** over all 38 fixtures, hash `toText`
  output, every `SignalResult` field, `check()` verdicts and excerpts for the fixtures' claims,
  and the harvest test corpus's proposals. Re-run after the last source edit; **every hash must
  match**. A mismatch is a stop, not a finding to explain away.
- **Mutation checks** as listed in section 3, plus: reverting the section 2 branch reddens the
  end-to-end test.
- Non-ASCII codepoint sweep and NUL check on every written file; CRLF preserved; every edit
  asserted applied.

## 8. Release

- **Semver:** patch. No public signature changes; one CLI message line changes wording on the
  version-mismatch branch only.
- `VERSION` and `package.json` to `0.6.2`, `: string` annotation kept, `dist/version.d.ts`
  checked to emit `string`.
- CHANGELOG entry, dated on the release commit's date, stating plainly that no verdict moves
  and naming the recheck wording change.
- A short ledger note beside the 0.6.0 ledger marking the eight items closed with commits, and
  the two deferred items still open.
- Do not tag, publish, or push without the owner.

## 9. Acceptance criteria

1. A 0.5.0-stamped archive of a join-only match rechecks to `pipelineDrift`, exit 2, with the
   different-version wording; a same-version `pipelineDrift` still prints the regression line.
2. Each of the four section 3 tests goes red under its named mutation.
3. `HarvestRead.text` no longer exists and `tsc` is clean.
4. `harvest()` builds the draft's seed index once per run; `commonSpans`'s signature is unchanged.
5. The `dropContained` union test exists and goes red with the call removed.
6. Every section 5 correction is present.
7. The section 7 fidelity hashes match before and after.
