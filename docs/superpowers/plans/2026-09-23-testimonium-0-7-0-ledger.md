# testimonium 0.7.0 - execution ledger

**Spec:** `docs/superpowers/specs/2026-09-23-testimonium-0-7-0-design.md`
**Plan:** `docs/superpowers/plans/2026-09-23-testimonium-0-7-0.md` (five tasks, executed inline)
**Built on:** `v0.6.2` (`eca0f4c`).

## Commits

| task | change | commit |
| --- | --- | --- |
| 1 | description region cap, `MAX_DESCRIPTION_REGIONS = 8` | `53fb948` |
| 2 | `matchesChallengeSignatureIn`, used by `computeSignals` | `437d3e8` |
| 3 | `FiredRule.vetoed`, `explainFetchLine` | `8743551` |
| 4 | `scripts/region-movement-0-7-0.mjs`, `docs/region-movement-0-7-0.md` | `b2ee79a` |
| 5 | README, version, CHANGELOG, this note | the release commit |

## Measurement

- Fidelity snapshot (`scripts/fidelity-snapshot.mjs`) before the first source edit and after
  Task 3: byte-identical.
- Region movement: fixtures 38 and corpus 551 of 618 - `toText` moved 0, over the cap 0,
  signature result moved 0. Hard stops did not trigger.
- `vetoed: false`: one fixture (the 800-char Turnstile boundary fixture, 982 prose chars) and
  one live page (`openai.com/index/daybreak-securing-the-world/`, 17,180 prose chars, an
  article whose prose matched the Turnstile pattern - a match, not a wall).
- Cost: 50 claims on a 5,000-description page, ~2,400 ms at 0.6.2, 24 ms at 0.7.0.
- Calibration: `calibrate.mjs` and `sweep-floor.mjs` byte-identical against a scratch build of
  `eca0f4c`.

## Test count

623 -> 625 -> 629 -> 633. The plan predicted 623 -> 625 -> 628 -> 631: it undercounted Task 2
by one (three matcher tests plus one signals test) and Task 3 by one (`explainFetchLine` has two
tests). The tests are as the plan wrote them; only its arithmetic was wrong. 52 files throughout.

## Rulings made during execution

- Task 2 and Task 3: the count chain above, corrected rather than matched.
- Task 3: the new sentence in `assemble`'s docstring went after "licenses it." rather than
  mid-paragraph, so the paragraph's argument reads intact.
- Task 4: calibration compared by diffing the scripts' output against a 0.6.2 build rather
  than against the figures in `docs/calibration-2026-09.md` - the same question, a stricter
  instrument. The scratch worktree's `node_modules` junction was unlinked before the worktree
  was removed, and the real `node_modules` checked intact.

## Final review

One fresh whole-branch review: 0 Critical, no code defect. It probed every Review Focus item on
the built package, re-ran the measurement (identical but for timing), reproduced the cost ratio
(~100x), and confirmed the openai.com page is the only per-region signature match in all 551
rows. Fixed in one pass, all documentation:

- Two docstrings stranded by insertion (`descriptionValues`, `renderOutcome`) reattached.
- `matchesChallengeSignatureIn` said a rules file may carry `g`/`y` flags; it cannot
  (`loadRules` uses `new RegExp(pattern)`). It now names a caller-built `RuleSet`.
- The report called the cap a pure function of recorded regions; it counts raw values the
  recording lacks. Corrected, and added as a limit, with the one-read-per-URL limit; the
  PDF limit, which described an empty subset, replaced. The table's cap row now credits the
  `toText` hash row, which is what proves it for the fixtures.
- README scoped `vetoed: false` to bundled signatures; local ones behave the same, and only when
  no path rule matched.
- CHANGELOG: a `firedRule` from a pre-0.7.0 evidence file has no `vetoed`; treat as unknown.

Deferred minors: `matchesChallengeSignature` (flat) and `matchesChallengePath` stay stateful for a
caller-built `g`/`y` rule (pre-existing; no in-tree caller can reach it); a `check()` test
pinning the escalated winner's `vetoed` (guaranteed structurally by `firedRuleOf`).
