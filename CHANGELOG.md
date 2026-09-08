# Changelog

## 0.1.0 (unreleased)

Initial implementation of plan 1 (`check`, `reachability`). See
`docs/superpowers/plans/2026-09-06-plan-1-core.md` and
`docs/superpowers/specs/2026-09-06-testimonium-design.md` for the design.

### Plan 1.1 (extraction fidelity) - changes since the plan-1 merge

Five behaviour changes visible to anyone integrating against `check`, the CLI,
or the `Fetcher` interface. All of them landed after `dbaa030` and before this
version was released, so they carry no deprecation path.

- **BREAKING (CLI): an unrecognized `--flag` now exits 2 instead of being
  ignored.** `testimonium check doc.md --fail-on-unrechable` - a typo - used to
  exit 0 and print nothing, so a user who believed they had hardened CI had
  not, invisibly. It now prints `unknown flag <name>` and exits 2 as an
  infrastructure failure. Any pipeline passing a flag this build does not
  recognize will start failing; that is the point. Note the current limit,
  which is deliberate and characterized rather than fixed: only `--`-prefixed
  arguments are inspected, so a single-dash `-j` still passes through as a
  positional.
- **A new veto moves verdicts (N5, "the body is not text at all").** A response
  whose `content-type` is non-textual, or whose raw body is dense with
  replacement characters and control bytes, now reads `unreachable` where it
  previously reached `supported` or `unsupported`. This closes a false
  accusation - a content-negotiated PDF decoded to a megabyte of "prose" and
  cleared every threshold - and costs the mirror case: a readable HTML page
  served under, say, `application/octet-stream` is now declined rather than
  judged. Both directions are documented in the README under "What this does
  not do".
- **`isPdf` recognizes a `/pdf/` path segment, and matches the path only.**
  `arxiv.org/pdf/1706.03762v7` now selects the PDF rung, where before only a
  `.pdf` suffix did. Both patterns are matched against the URL with query and
  fragment stripped, so `?u=/pdf/` on a redirector no longer selects the PDF
  rung for an HTML page, and `doc.pdf#page=4` - which the old suffix pattern
  missed - now does.
- **The PDF rung is advertised only when BOTH `curl` and `pdftotext` are
  present.** `pdfFetch` downloads with curl before it converts, so on a machine
  with pdftotext and no curl the rung used to be advertised, attempted, and
  fail - reporting `unreachable` with `ladderTruncated: false`, the one field
  built to disclose that gap. `rungsAvailable` and `ladderTruncated` are now
  accurate on such a machine.
- **A custom `Fetcher` no longer has to lowercase its header keys.** The
  classifier normalizes field-name casing itself, so a `CheckOptions.fetcher`
  passing a server's own casing through keeps the N1 and N5 vetoes. Previously
  `CF-Mitigated: challenge` was silently ignored where `cf-mitigated:
  challenge` was honored, which turned a blocked page into an accusation. No
  action is needed for existing fetchers - lowercasing is still accepted, just
  no longer required.

### Notes for integrators

- `CitationResult.missed` is present **only** on results whose `verdict` is
  `"unsupported"`. This is a deliberate narrowing, not an oversight: the type
  is structurally unable to express an accusation - a list of claims the
  author allegedly failed to support - attached to a verdict that is not
  accusing. Read `r.missed ?? []` rather than assuming the field exists.
- `CitationResult.evidence` and `.retrievedAt` are present only on
  `"supported"` results, by the same doctrine.
