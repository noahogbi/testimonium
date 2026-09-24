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
