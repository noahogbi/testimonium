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

- Task 1: the file-writing tool turned the test's `\u00e9` escape into a literal accented
  character; the non-ASCII sweep caught it, and it was rewritten as the ASCII escape. The source
  file was written by heredoc to avoid the same rewrite. Test semantics unchanged.
- Task 1 finding, not a ruling: the "no `/` boundary" mutation also reddens the 15-redirect
  test - ilga.gov's `billstatus.asp` would read as under `billstatus` - so the boundary is
  load-bearing on real data, not only on the constructed sibling case.
- Release: `npm pack` is 85 files, up from 83 - `dist/classify/moved.js` and its `.d.ts`.
- Task 5: the README's list of unguarded routes said "the target of a redirect after
  removal"; narrowed to "a redirect after removal to another article", since root and ancestor
  redirects are now gated.

## Final review

One fresh whole-branch review: 0 Critical - it could construct no route that accuses where
0.7.1 did not, and confirmed recheck and the pdftotext path are safe. Fixed in one pass:

- **Important, a regression the spec itself caused.** The gate ran inside `assemble`, so
  escalation saw `unreachable` and stopped climbing. A first rung bounced to the homepage while
  the next rung was served the cited page went from `supported` (0.7.1) to `unreachable`:
  verified against both builds by the reviewer. Escalation now keys on the verdict before the
  gate (`assemble` returns `judged`); the gate is applied again after the climb. Test "still
  climbs when the first rung was bounced to the root" RED -> GREEN; reverting to the gated
  verdict reddens it and the amended root test. The spec's section 4 carries a dated note.
- **Important.** A query-addressed cited root (`/?p=123`) redirected to the bare homepage was
  still accused. `movedAway` now treats a cited root with a query as a page when the landing
  is the bare root. Test "treats a query-addressed page at the root as a page" RED -> GREEN.
  The recording has no such URL, so movement stays 0 of 618.
- **Documentation raised from Minor:** `redirectedTo`'s docstring and the CLI helper's said it
  appears only when the gate withheld an accusation (a veto can be the reason); `moved.ts`
  dropped "readable" from "two domain migrations"; the README's "measured 15 of those" pointed
  at the wrong antecedent; a test comment said all 15 redirects were cross-host; the report said
  the root test "does not spend the escalation"; the spec named `analyze.mjs`.
- **Disclosed rather than changed:** a canonical rewrite of a page to the root (`/index.html`
  -> `/`) reads as moved away and withholds a genuine accusation - the safe direction - now
  stated in `moved.ts`, the README and the CHANGELOG.

Test count after the fix pass: 647 / 53. Fidelity byte-identical; movement still 0 of 618.
