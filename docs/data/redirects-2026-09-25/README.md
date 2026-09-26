# Redirect recording, 2026-09-25

Backing data for testimonium 0.8.0's redirect gate
(`docs/superpowers/specs/2026-09-25-testimonium-0-8-0-design.md` section 3, and
`docs/redirect-movement-0-8-0.md`). Committed because it cannot be regenerated: the
fetches were live on 2026-09-25, and where a URL lands is a dated fact about that day.

- **What:** every read of the 618 distinct source URLs cited by published bulletin issues,
  taken through testimonium 0.7.1's own `readSource` - the ladder `check()` uses - recording
  for each read its rung, `finalUrl`, readability, `documentGone` and prose volume.
  One NDJSON row per URL.
- **Input list:** omnisscientia `docs/superpowers/worklogs/data/2026-09-13-subfloor/results.json`.
- **Script:** `measure.mjs`, as it ran (its paths are absolute to the machine it ran on).
  Sequential, 800 ms between URLs, resumable.
- **Identity:** `testimonium-0.8.0-redirect-measurement`, with no contact address, so hosts that
  require one (sec.gov) may have read as unreachable. That does not affect where a readable
  read landed.
- **A re-run will not reproduce these numbers.**
