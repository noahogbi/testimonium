# testimonium 0.6.2 - execution ledger

**Spec:** `docs/superpowers/specs/2026-09-23-testimonium-0-6-2-design.md`
**Plan:** `docs/superpowers/plans/2026-09-23-testimonium-0-6-2.md` (seven tasks, executed inline)
**Built on:** `v0.6.1` (`ca86870`). Scoped as 0.6.1 and renumbered when the omnisscientia
session shipped its pdftotext fix as 0.6.1 first.

## The 0.6.0 ledger's open items

| item | disposition | commit |
| --- | --- | --- |
| `recheck` attribution message | closed: the line depends on the tool version | `570a1ed` |
| four tests that can pass vacuously | closed: each has an assertion shown red under a mutation | `947fdcf` |
| `HarvestRead.text` is dead | closed: removed | `1eb4f7c` |
| `seedIndex` rebuilt per region | closed: `prepareDraft` once per `harvest()` run | `1eb4f7c` |
| `dropContained`'s stale argument | closed: comment rewritten, region union pinned by a test | `c48aad4` |
| `"two of nine real documents"` | closed: measured, now "two of the ten document fixtures" | `e2995c7` |
| stale citations | closed | `e2995c7` |
| the `tagsIn` recovery | stays cut (0.6.0 spec section 8) | - |
| unbounded region count | **open**: changes `toText` bytes past a cap; needs its own spec and measurement | - |
| flat-join challenge signature and slug overlap | **open**: changes veto inputs; needs calibration re-run | - |

## Fidelity

`scripts/fidelity-snapshot.mjs` hashed `toText` and every `computeSignals` field on the 38
fixtures named by `fixtures/totext-0-5-0.json`, `check()` verdicts and excerpts on the 18 of
them long enough to yield ten-word claims (the other 20 hash `null`), and one harvest run over
the document fixtures. The before snapshot was taken at `ca30c08` with `src/`
unmodified, deterministic over two runs, and shown to see a deliberate harvest perturbation.
The after snapshot at `e2995c7` was **byte-identical** (11,864 bytes both).

The recheck line is outside that instrument by design - it is CLI text, not a verdict - and
is covered by its own render and end-to-end tests.

## Test count

617 -> 620 -> 621 -> 622 -> 623, exactly as the plan predicted. 52 files throughout.

## Rulings made during execution

- Task 3: also corrected three texts the plan did not list but its own change made false - the
  `HarvestRead.regions` docstring (it named `commonSpans` and "the flat `text`") and
  `sources.test.ts`'s test name and comment. Cost if wrong: comment churn.
- Task 4: ran the spec's mutation for excerpt test 1 (excerpt forced null), which the plan's
  mutation table omitted. It reddens tests 1 and 2.
- Task 5: rewrote the paragraph above the plan's target too; after Task 3 it named the wrong
  function (`commonSpans`) and the wrong unit (one read, not one region).
- Task 6: the plan's note for the cutover spec said the `indexOf` first-match mechanism "is
  gone". False: testimonium's `excerptFor` still uses `indexOf`, now within one region, and the
  spec's `excerpt.mjs` is omnisscientia's parallel copy. The note says exactly that instead.
- Task 6: reflowed the README paragraph a one-phrase edit overran.

## Final review

One fresh whole-branch review. No Critical. It fuzzed the pre- and post-refactor `commonSpans`
and `spansAgainst` against each other over 12,000 random inputs (curly quotes, soft hyphens,
split surrogate pairs, digit-magnitude straddles, `seedChars` in {0, -1, NaN, 1..30}): zero
mismatches. Fixed in one pass, all comment or release-note text:

- `normBoundaryNote`, `PreparedDraft` and `HarvestProposal.bugs` docstrings named
  `commonSpans` as what `harvest()` calls; it calls `spansAgainst`.
- `filters.test.ts`'s normRegions test named a mutation on the removed `read.text`; it now
  names `read.regions.map(norm)`, verified to redden exactly that test.
- `dropContained`'s docstring still said "one read's candidates"; it is one region's, and the
  union it guards is the region union.
- The CHANGELOG said every `check()` verdict matched across 38 fixtures; the instrument
  exercises `check()` on 18 of them. It now says so.

Deferred minors: commit `e2995c7`'s message says "six" and holds five of the six section-5
corrections (the sixth is in `c48aad4`); `HarvestRead.regions`'s docstring has a ragged wrap.
