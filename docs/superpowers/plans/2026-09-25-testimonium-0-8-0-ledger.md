# testimonium 0.8.0 - execution ledger

**Spec:** `docs/superpowers/specs/2026-09-25-testimonium-0-8-0-design.md`
**Plan:** `docs/superpowers/plans/2026-09-25-testimonium-0-8-0.md` (five tasks, executed inline)
**Built on:** `v0.7.1` (`44b196a`).

## Commits

| task | change | commit |
| --- | --- | --- |
| 1 | `movedAway` in `src/classify/moved.ts` | `52f0a72` |
| 2 | the gate and `redirectedTo` in `check()` | `1beb560` |
| 3 | CLI "moved to" / "served from" | `22d3083` |
| 4 | the recording, movement script and report | `6d841e8` |
| 5 | README, version, CHANGELOG, this note | the release commit |

## Measurement

- Fidelity snapshot before the first source edit and after the last: byte-identical.
- Movement over the committed recording: 618 rows; 603 on the cited page (468 readable); 15
  redirected (13 readable), every one the same article at a new address; `movedAway` 0. No
  hard stop.
- Calibration: `calibrate.mjs` and `sweep-floor.mjs` byte-identical against a scratch build of
  `44b196a`; the worktree's `node_modules` junction was unlinked before removal and the real
  `node_modules` checked intact.

## Test count

636 -> 640 / 53 files -> 643 -> 645, exactly as planned.

## Rulings made during execution

- Task 1: the file-writing tool turned the test's `é` escape into a literal accented
  character; the non-ASCII sweep caught it, and it was rewritten as the ASCII escape. The source
  file was written by heredoc to avoid the same rewrite. Test semantics unchanged.
- Task 1 finding, not a ruling: the "no `/` boundary" mutation also reddens the 15-redirect
  test - ilga.gov's `billstatus.asp` would read as under `billstatus` - so the boundary is
  load-bearing on real data, not only on the constructed sibling case.
- Task 5: the README's list of unguarded routes said "the target of a redirect after
  removal"; narrowed to "a redirect after removal to another article", since root and ancestor
  redirects are now gated.
