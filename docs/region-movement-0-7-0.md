# What 0.7.0 moves - measured, not assumed

**Measured:** 2026-09-23, against `feat/0-7-0` at `8743551` (all three source changes in).
**Spec:** `docs/superpowers/specs/2026-09-23-testimonium-0-7-0-design.md` section 5.
**Script:** `scripts/region-movement-0-7-0.mjs`, over the built package.

## Result

Nothing moved. No fixture and no corpus page changed its `toText` output, crossed the region
cap, or changed its challenge-signature result. The hard stops did not trigger. Two results -
one fixture, one recorded page - would carry a `firedRule` with `vetoed: false`, which is the
provenance change working as designed, not a movement.

## Why no live fetch was needed

All three changes act on extraction regions, and 0.6.0's movement run (fetched 2026-09-22)
recorded every page's regions (`regionsAfter`). The signature match is a pure function of
those regions. The cap nearly is: it counts distinct RAW description values, and a value that
decodes to nothing (`&nbsp;`) uses a slot without leaving a region, so the recording shows the
cap's result, not its count - see Limits. The fixtures are read from their bytes, where both
are exact.

## Populations

| population | size | source |
| --- | --- | --- |
| fixtures | 38 | the set named by `fixtures/totext-0-5-0.json` |
| corpus | 618 rows, 551 with regions | `description-movement-0-6-0.ndjson`, 103,823,714 bytes, fetched 2026-09-22 by 0.6.0's Task 6; session-local scratch at `C:/users/noaho/testimonium-0-5-0/.superpowers/sdd/2026-09-21-testimonium-0-6-0/` |

Corpus regions per page: 1 region on 65 pages, 2 on 446, 3 on 34, 4 on 6. No page carried more
than 3 distinct descriptions; the cap is 8.

## Results

| check | fixtures | corpus | hard stop? |
| --- | --- | --- | --- |
| `toText` differs from the 0.5.0/0.6.x hash | 0 of 38 | not applicable (no bytes) | no |
| over the region cap | 0 (proven by the `toText` row: an unmoved extraction lost nothing) | 0 of 551 with more than 3 distinct descriptions | no |
| signature result differs, flat join vs one region | 0 | 0 of 551 | no |
| signature matched but did not veto (`vetoed: false`) | 1 | 1 | never a stop |

A separate fidelity snapshot (`scripts/fidelity-snapshot.mjs`: `toText`, every `SignalResult`
field, `check()` verdicts and excerpts, one harvest run) was taken before the first source edit
and after the last: byte-identical.

## The two `vetoed: false` results

Both match the bundled rule "Cloudflare Turnstile and managed challenge"
(`/verif(y|ying|ication)[\s\S]{0,20}human/`) on a body past `maxChallengeChars` (800):

- **`fixtures/challenge/cloudflare-turnstile-cookie-privacy-boilerplate-800-chars.html`**, 982
  prose chars. A real wall padded just past 800 by cookie and privacy boilerplate - the fixture
  exists to pin that boundary. `vetoed: false` is the padded-wall trace the spec keeps
  `firedRule` for.
- **`https://openai.com/index/daybreak-securing-the-world/`**, 17,180 prose chars, read on the
  node rung at HTTP 200. **Not a wall.** The pattern matched ordinary article prose: "...develop
  a targeted patch and verify the result. humans remain in control of which findings to
  investigate...". This is exactly what the 800-char conjunction exists to protect, and it
  shows why the field says "matched, decided nothing" rather than "wall": before 0.7.0 this
  result carried the Turnstile rule as `firedRule` with nothing to say it had not fired.

## Cost

`check()` over 50 absent claims on a page with 5,000 distinct descriptions (the same page and
claims in both runs):

| | regions | time |
| --- | --- | --- |
| 0.6.2 (measured 2026-09-23) | 5,001 | ~2,400 ms |
| 0.7.0 (best of five) | 9 | 24 ms |

## Calibration

`scripts/calibrate.mjs` and `scripts/sweep-floor.mjs` were run at `8743551` and against a build
of `eca0f4c` (the 0.6.2 merge) in a scratch worktree. Both outputs are byte-identical between the
two. The floor sweep still reports 4,902 satisfying floors in `[1380, 6281]`, as
`docs/calibration-2026-09.md` records. No refresh is needed.

## Limits

- The corpus rows carry regions but no claims, so this shows where vetoes and regions move,
  not which live claims would change verdict - the same limit the 0.6.0 report disclosed.
- The recording is one read per URL, under 0.6.0's simplified rung selection (the first 2xx
  with a body), as the 0.6.0 CHANGELOG disclosed. A page whose OTHER rung carries a join-only
  signature phrase is unmeasured.
- The cap counts raw values before decoding, so a page with enough descriptions that decode to
  nothing (`&nbsp;`, `&#160;`) can push a real description past the cap while the recording
  shows it as fewer regions. No page in the recording has more than 3 distinct descriptions,
  but raw counts are not in the recording, so this case is unmeasurable here.
- No PDF read is among the 551 rows: all 67 pdftotext rows recorded no regions and are
  skipped.
- The recording is 2026-09-22's pages. A page that has since grown a ninth distinct description
  or a join-only signature phrase would not appear here.
