# Changelog

## 0.1.0 (unreleased)

Initial implementation of plan 1 (`check`, `reachability`). See
`docs/superpowers/plans/2026-09-06-plan-1-core.md` and
`docs/superpowers/specs/2026-09-06-testimonium-design.md` for the design.

### Plan 2 (harvest) - changes since the plan-1.2 merge

One new command, one breaking refusal, and three additive fields. All of them
landed after `ff71ec8` and before this version was released, so none carries a
deprecation path. Apart from the refusal below, `check` gained no new
behaviour: `harvest` is a third consumer of the reader plan 1.2 built, not a
change to the gate, and no verdict moved.

- **BREAKING, and meant to be: a claim shorter than `THRESHOLDS.minClaimChars`
  (16 characters once normalized) is refused.** It is refused by the
  claims-file loader, by `check()`'s front door and by `harvest`'s first
  filter, with one message naming the claim, its length, the floor and the
  remedy. An existing claims file carrying such a claim now fails to load and
  `check` exits 2 with the loader's message. That is the intended outcome: a
  bare number, a year, or a token like "the report" attests nothing about a
  source, and a match on one is a coincidence this tool cannot tell from
  evidence - the file asserted something the tool could never have verified.
  The remedy is to extend the phrase to take in the surrounding words, which
  `harvest` will also propose. Measured against 208 real claims frozen in
  `fixtures/claims/`: 18 of them are refused, and the two that matched a page
  they were not written about are both among them. Landed before 0.1.0 was
  released, so it carries no deprecation path. See
  `docs/calibration-2026-09.md` and spec 7.3.
- **New command: `testimonium harvest <doc.md>`.** It fetches every URL the
  document cites and proposes, as candidate claims, the spans that appear
  verbatim in both the document's own prose and a readable read of the
  source, normalized. It writes `<doc>.claims.draft.json` and **never**
  `<doc>.claims.json`. No model; phrase matching remains the sole arbiter,
  and every proposal is afterwards judged by `check` exactly as a
  hand-written claim is. Exit 0 when the draft was written or printed,
  including a draft proposing nothing; exit 2 for a refused input, a refused
  existing claims file, or a draft in the way that the author has edited.
  There is no exit 1. `--json` prints the draft instead of writing it, the
  convention `reachability --json` follows.
- **`RuleSet` gains `boilerplate: readonly Rule[]`,** the same dated
  `{ pattern, lastConfirmed, note }` shape as `signatures` and `paths`, and a
  local `--rules` file may add to it. It ships EMPTY and is consulted by
  `harvest` only: it can never change a verdict. Integrators constructing a
  `RuleSet` literal must add the field; `loadRules()` callers need no change.
- **`Document` gains `prose`** - the markdown with fenced code blanked and
  every footnote definition removed, from the parser's own passes. `body` is
  unchanged.
- **`harvest` inherits every exposure `check` has, unreduced, and adds one of
  its own.** A span common to the draft and a source is by definition one
  `check` will find in that source, so the heavy-chrome-at-200 route and the
  redirect route in the README's Measured limits apply to harvest identically.
  Its own addition is that it proposes what the author COPIED, which is not
  always what she CLAIMS; the draft's `_note` says so and her confirmation is
  what makes a proposal a claim. Harvest does report a proposal drawn from a
  read whose final path differs from the cited path, which `check` does not.
- **`VERSION` now has one source, `src/version.ts`**, re-exported unchanged
  from `src/index.ts`. `harvest` stamps it into every draft, so two copies
  that could drift would put a slightly untrue version on a file the author
  keeps. No public name changed.

### Plan 3 (drift) - changes since the plan-2 merge

One new command and one new side effect on an existing one. Both landed before
this version was released, so neither carries a deprecation path. **No verdict
moved**: `check()` is not modified by this plan at all, and `recheck` runs both
of its arms through it.

- **New: `check` writes `<doc>.archive/` for every citation that reads
  `supported`.** It holds the bytes the classifier saw - gzipped,
  content-addressed, hashed before gzip - and the verdict they produced, so a
  later `recheck` can control against them. It is written by the CLI through a
  recording fetcher, never from inside `check()`, which stays storage-agnostic
  and gains no option. `set-cookie` is never stored, in any form. Pass
  `--no-archive` to run the gate without writing the archive; that path is
  byte-for-byte the pre-plan-3 one, because the flag means "do not wrap", and
  `<doc>.evidence.json` is still written, as it has been since plan 1.
  Commit the archive: a control arm that exists only on the machine that wrote
  it cannot control anything in CI. An entry that changed in nothing material
  is preserved byte for byte, so a green run over an unchanged corpus leaves no
  diff, and an `archivedAt` is the date that baseline was established or last
  materially changed. It grows and nothing prunes it - see the README's
  `Recheck` section for the cost, in full.
- **New command: `testimonium recheck <doc.md>`.** It re-runs each claim
  against the live source AND against the archived bytes and reports what
  changed. **Exit 1 comes from exactly one outcome:** a live read that
  positively failed to find a claim the stored bytes still positively prove.
  Pipeline drift - the gate passing live while the stored bytes no longer do -
  is exit 2 and is a regression in this tool, not a defect in your document. A
  source the origin reports deleted is "gone since <date>", exit 0 unless
  `--fail-on-gone`. Changed claims, a changed `pdftotext` version and a changed
  local `--rules` file are named confounds and suppress the comparison at exit
  0 - except on a source the origin reports deleted, which is reported gone
  whatever else changed, with the confound named beside it, because nothing you
  can edit locally makes a page 404. At the run level 1 dominates 2,
  deliberately unlike `check`. `recheck` rewrites `<doc>.evidence.json` with
  the live arm's results and never writes the archive.
- **New flags:** `--no-archive` on `check`, `--fail-on-gone` on `recheck`.
  Neither is global, and neither is rejected on the other commands -
  `validateFlags` stays command-agnostic, as it has since plan 1.

### Plan 1.2 (reader) - changes since the plan-1.1 merge

Three verdict-moving changes, each confined to the case spec section 6.6
names for it, plus two repairs and one non-change. All landed after `3974d27`
and before this version was released, so they carry no deprecation path.

- **`check` climbs the fetch ladder past a first read vetoed only by N4
  (404/410) or only by N5 (not text).** It used to stop there and report
  `unreachable` while `reachability` climbed on. Both now escalate on one
  rule - climb unless the last read is readable, meaning no veto fired and
  its prose clears the floor - implemented once in `src/fetch/read-source.ts`
  and shared by both commands. The cost is extra fetches against documents
  that are genuinely gone. A URL whose node fetch returned a 404 wrapped in
  page chrome and whose curl fetch returned the document is now judged from
  the curl read: `supported` if it carries every claim, `unsupported`,
  naming the rest, if it carries only some - where it was `unreachable`
  either way. That second case is a verdict moved toward an accusation; it
  is made only from a readable read, which is the positive proof the
  keystone rule requires. It also opens one route to accusing on a gone
  document - the same error chrome served 404 to node and 200 to curl -
  which the README discloses beside the chrome-at-200 route it belongs to.
- **A readable read outranks a larger vetoed one (spec 6.6 rule 2).** A large
  wall on the first rung followed by a smaller readable page matching only
  some of the claims used to return `unreachable`; it returns `unsupported`,
  naming the claims the readable page did not carry. An equal-prose tie,
  which used to go to the first read whatever its veto, now goes to the
  readable one. This is the second of the two changes in this release that
  can move a verdict toward an accusation, and like the first it does so
  only where a readable read exists. `firedRule` on such a result now
  reports the readable read's rule (none), not the wall's.
- **`reachability` calls a URL readable iff some read of it is readable (spec
  6.6 rule 5).** It used to require that no attempted rung was vetoed, so a
  host that walled the node rung and served curl the document was readable to
  `check` and unreadable to `reachability`. The README bullet that disclosed
  the disagreement is gone, because the disagreement is.
- **The soft hyphen (U+00AD, `&shy;`) is deleted before matching.** The claim
  `cooperation` now matches a page whose HTML says `co&shy;operation`;
  `co-operation` still does not, and should not. Closes the false-miss route
  the plan 1.1 docs disclosed.
- **Excerpt offsets after a lengthening case-fold are right.** `foldWithMap`
  recorded one source offset per input character, but U+0130 lowercases to
  two code units, so the source offset of any match after such a character
  was late by one per occurrence. The function is exported for plan 2's
  harvest.
- **Nothing new is public.** `readSource`, `bestReadable`, `isReadable`,
  `isBlocked`, `computeSignals` and `nextAction` stay module-internal; a test
  pins the package surface, and another pins `VERSION` to `package.json`.

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
