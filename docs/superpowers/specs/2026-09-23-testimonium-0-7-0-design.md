# testimonium 0.7.0 - bound the regions, match signatures within one, say whether a rule vetoed

**Status:** design, approved in conversation 2026-09-23; not yet reviewed as a written spec.
**Builds on** `v0.6.2` (`eca0f4c` on `main`).
**Source of the work:** the two items the 0.6.2 ledger left open
(`docs/superpowers/plans/2026-09-23-testimonium-0-6-2-ledger.md`), plus limit 3 of
omnisscientia's cutover reconciliation record
(`docs/superpowers/worklogs/2026-09-17-citation-reconciliation.md` section 8, in that repository).

## 1. What this changes

Three changes to what the tool computes or reports. None is expected to move a verdict on any
page ever measured, and section 5 measures that rather than assuming it.

| # | change | direction if it moves anything |
| --- | --- | --- |
| 1 | at most 8 distinct description values become regions | removes text: toward accusation, only past 8 distinct descriptions |
| 2 | a challenge signature must match within ONE region | fewer vetoes: `unreachable` can become a real verdict |
| 3 | `FiredRule` gains `vetoed: boolean` | none - additive provenance |

### Corrections to the record this spec rests on

- **`slugLabelOverlap` feeds no verdict.** The 0.6.0 ledger listed it beside the challenge
  signature as a flat-join read that "would veto a readable page". It cannot:
  `src/classify/verdict.ts:113` - "C1 (slugLabelOverlap) is reported on Signals but deliberately
  NOT consulted here". It is a reported measurement only. **It is out of scope** and stays a
  flat-text measurement; changing it would move a reported number for no verdict benefit.
- **A `firedRule` on a non-vetoing match is deliberate, not a defect.** `src/check.ts:56-69`
  records that a signature-matching wall padded past the prose floor "still carries the
  signature match as reported provenance", and `README.md` (the known-gap bullet after line 317)
  describes that route. The field is the only visible trace of that gap. So the change is not to
  remove it (omnisscientia's limit 3 read it as over-reach) but to make it say whether it
  decided the verdict.

## 2. The region cap

**Defect.** `descriptionValues` (`src/text/extract.ts`) caps nothing. Every claim is tested
against every region (`computeSignals`, `check()`'s excerpt lookup, `harvest()`'s per-region
scan), so a hostile page's cost is claims x regions: a synthetic 5,000-description page took
~3.7 s for 50 claims (0.6.0 ledger).

**Rule.** `descriptionValues` returns at most **`MAX_DESCRIPTION_REGIONS = 8`** values: the first
8 DISTINCT raw values in document order. A duplicate of a value already kept does not consume a
slot (deduplication stays by raw attribute text, as 0.6.0 fixed it). The body region is never
capped, so a page yields at most 9 regions. The constant lives in `src/text/extract.ts`, not in
`THRESHOLDS`: it is a resource bound, not a calibrated classifier threshold.

**Why 8.** There are three description names (`description`, `og:description`,
`twitter:description`). Measured over 0.6.0's 618-URL run (fetched 2026-09-22), 551 pages
yielded regions: 65 had 1, 446 had 2, 34 had 3, and 6 had 4 - so no real page carried more
than 3 distinct descriptions. 8 is more than twice that.

**Direction.** A cap removes text, which is the accusation direction: a claim living only in a
9th distinct description would go from `supported` to `unsupported` (above the floor). It is
reachable only on a page with more than 8 distinct descriptions; section 5 proves the 38
fixtures and the 551 corpus readings contain none.

**Cost after the cap.** Regions are bounded at 9 per page, so claims x regions is linear in
claims. `descriptionValues`' own tag scan stays linear in page size.

## 3. The challenge signature, within one region

**Defect.** `computeSignals` tests the bundled signatures against `regions.join(" ")`
(`src/classify/signals.ts:162`). A signature phrase that exists only across the join - the tail
of the body running into the head of a description, or two description tags - matches text that
is nowhere on the page as a sequence, and on a body under `THRESHOLDS.maxChallengeChars` (800)
it vetoes the page. This is the one flat-join read 0.6.0's "attest only what is on the page"
did not reach. Safe direction (a veto is not an accusation), near-zero incidence, but it is the
same argument 0.6.0 applied to claims.

**Rule.** New `matchesChallengeSignatureIn(regions, signatures = CHALLENGE_SIGNATURES)` in
`src/rules/challenge.ts`: the first rule, **in rule order**, whose pattern matches `norm(r)` for
SOME single region `r`. Each region is normalized once. Rule order is preserved so that when
several rules match, the one reported is the one the flat matcher would have reported, minus
join-only matches. `computeSignals` uses it in place of `matchesChallengeSignature(text, ...)`.

`matchesChallengeSignature(text, ...)` stays, unchanged, for its existing callers
(`test/rules/challenge.test.ts`, `scripts/description-movement.mjs`). It is not exported from
`src/index.ts`; neither is the new function.

**Unchanged:** the 800-character conjunction still measures `proseVolume(text)` over the whole
extraction. What moved is where the phrase must be, not how long the page must be.

**Direction.** Fewer signature matches means fewer vetoes: a page can move from `unreachable`
to a real verdict, including `unsupported`. That is the direction section 5 must stop on.

## 4. `FiredRule.vetoed`

`FiredRule` (`src/io/evidence.ts`) gains:

```ts
/** True when this rule decided the verdict: every path rule, and a signature
 *  rule when the body was short enough for it to veto. False for a signature
 *  that matched a body too long to veto - reported because that is the only
 *  trace of a wall padded past every veto (README, known gaps). */
readonly vetoed: boolean;
```

**Computed from the read that won** - the same read `firedRule` and the verdict already come
from (`check.ts` `assemble`) - as `pathRule !== null || signals.challengeSignature`. Because a
path rule takes precedence in `firedRule` (`pathRule ?? sigRule`), `vetoed` is true exactly when
the reported rule is the one that vetoed. The escalation note at `check.ts:56-69` still holds and
gains one sentence: the second read's `firedRule` now says whether it vetoed.

**CLI.** `--explain-fetch` (`src/bin.ts:768-770`) prints, for `vetoed: false`:

    rule matched, did not veto (page too long): <note> (last confirmed N days ago)

and the existing `rule fired: ...` line for `vetoed: true`.

**Compatibility.** An added required field on an output type. Callers reading `firedRule`
gain information and lose none; a caller constructing a `FiredRule` (none known, it is output
only) would need the field. Minor version, as 0.x allows. Existing tests asserting
`toEqual({ lastConfirmed, note })` gain `vetoed`.

## 5. Measurement

A committed `scripts/region-movement-0-7-0.mjs` over the BUILT package reads two populations:

1. **The 38 fixtures** named by `fixtures/totext-0-5-0.json`, from their bytes.
2. **The 0.6.0 corpus run**, frozen: `regionsAfter` for every row of
   `description-movement-0-6-0.ndjson` (618 rows, 551 with regions, fetched 2026-09-22). It is
   session-local scratch in the `C:/Users/noaho/testimonium-0-5-0` worktree
   (`.superpowers/sdd/2026-09-21-testimonium-0-6-0/`); the script takes its path as an argument
   and the report records the path, size and fetch date.

It reports:

- **Cap:** pages with more than 8 distinct description regions (expected 0), and for the
  fixtures, whether `toText` is byte-identical to 0.6.2 (`fixtures/totext-0-5-0.json` hashes).
- **Signature:** every page where the flat matcher and the per-region matcher disagree, with the
  rule, the prose length, and whether the flat match vetoed (under 800 chars). Expected 0.
- **Provenance:** how many pages carry a signature match that would report `vetoed: false`.
- **Cost:** `check()` over 50 absent claims on the 5,000-description page, before (0.6.2) and
  after, best of five runs.

**Limit, stated in advance:** the corpus rows carry regions but no claims, so the measurement
can show where vetoes and regions move, not which live claims would change verdict - the same
limit the 0.6.0 report disclosed. Regions recorded before 0.6.1 include PDF reads extracted with
the HTML stripper; those rows are vetoed or single-region either way and cannot carry a join.

**Hard stops before the release commit:** any page with more than 8 distinct descriptions, or
any page whose veto changes, is reported to the owner before continuing. A page whose
`vetoed: false` count is non-zero is NOT a stop - it is the gap being made visible.

**Calibration:** `scripts/calibrate.mjs` and `scripts/sweep-floor.mjs` re-run at HEAD must
match `docs/calibration-2026-09.md`; a difference is a stop.

The report is `docs/region-movement-0-7-0.md`.

## 6. Acceptance criteria

1. A page with 5,000 distinct descriptions yields exactly 9 regions. Asserted by count, not by
   time: this suite has timing-sensitive tests that fail under machine load. The cost is recorded
   in the section 5 report instead - measured 2026-09-23 at 0.6.2, parsing that page takes ~20 ms
   and `check()` over 50 claims ~2.4 s, so the report shows the after figure beside it.
2. The 9th distinct description is not a region; a duplicate within the first 8 does not consume
   a slot.
3. `toText` is byte-identical to 0.6.2 on all 38 fixtures (the existing hash test stays green).
4. A short page whose signature phrase exists only across a region join is not vetoed by it; the
   same phrase inside one region still vetoes.
5. When two rules match different single regions, the one reported is the earlier in rule order.
6. `firedRule.vetoed` is true for a path-rule veto and a short-body signature veto, false for a
   signature match on a body at or above 800 prose chars, and absent with `firedRule` when no
   rule matched.
7. `--explain-fetch` prints the "did not veto" line for `vetoed: false`.
8. Section 5's report exists, its hard stops did not trigger (or were reported and ruled on by
   the owner), and calibration re-runs match.

## 7. Release

Version `0.7.0` in `src/version.ts` (keep the `: string` annotation) and `package.json`;
CHANGELOG entry stating each change's direction and the measured result; README's `firedRule`
sentence (line 317) and the known-gap bullet updated to name `vetoed`; a ledger note beside the
0.6.2 one. Do not tag, publish or push without the owner.

## 8. Not in this release

- `slugLabelOverlap` stays a flat-text measurement (section 1).
- The padded-wall gap itself (a signature-matching wall past the floor passes every veto) is
  unchanged; this release makes it visible per result, not closed. Closing it needs a fixture
  and a threshold decision the calibration corpus cannot yet license.
