# Changelog

## 0.7.1 - 2026-09-24

One correction for programmatic callers; nothing else moves.

- **Every challenge matcher now tests from a clean `lastIndex`.** 0.7.0 reset it only in the
  per-region signature matcher. The flat signature matcher and the path matcher still gave an
  identical second call a different answer when a `RuleSet` built in code carried a `g` or `y`
  regex literal: a match leaves `lastIndex` past it, so the next test starts mid-string and
  misses. All three now share one reset. No bundled rule carries those flags and a rules file
  cannot (`loadRules` sets none), so a verdict could only differ for a caller passing its own
  stateful rules - and for that caller it was wrong.
- A test now pins that an escalated read's `firedRule` and `vetoed` come from the read that
  won, which 0.7.0 guaranteed by construction.

## 0.7.0 - 2026-09-23

Three changes to what the tool computes or reports, each measured offline against the 38
bundled fixtures and the regions 0.6.0 recorded for 618 live URLs (fetched 2026-09-22):
nothing moved. No fixture or page changed its `toText` output, crossed the region cap, or
changed its challenge-signature result (`docs/region-movement-0-7-0.md`).

- **At most eight distinct description values become regions.** Every claim is tested against
  every region, so a page with thousands of `description` tags cost claims x regions: 50 claims
  on a 5,000-description page took ~2.4 s, and now take 24 ms over 9 regions. No real page in
  the 618-URL run carried more than 3 distinct descriptions. Past the cap text is removed, which
  is the accusation direction, so it is only reachable on a page with more than 8.
- **A challenge signature must match within one extraction region.** It matched against the
  join of the page body and its description values, so a signature phrase split across that
  seam - text that is nowhere on the page as a sequence - could veto a short page. The one
  flat-join read 0.6.0 left. Fewer vetoes is the only direction this can move; measured, it
  moved none. `slugLabelOverlap` is unchanged: no verdict reads it.
- **`firedRule` gains `vetoed`.** True for a challenge-path veto and for a signature veto on a
  short body; false for a signature that matched a body too long to veto. That case is kept -
  it is the only trace of a wall padded past every veto - but it no longer reads as a veto, and
  `--explain-fetch` now says "rule matched, did not veto (page too long)". Measured, one live
  page carries `vetoed: false`, and it is an ordinary article whose prose matched the Turnstile
  pattern ("verify the result. humans remain in control"): a match, not a wall. Additive: an
  output field gained, none removed. A `firedRule` read back from an evidence file written
  before 0.7.0 has no `vetoed`; treat its absence as unknown, not as `false`.

## 0.6.2 - 2026-09-23

Closes what 0.6.0 recorded as left open, and **moves no verdict**: `toText` output and every
`SignalResult` field on all 38 bundled fixtures, `check()` verdicts and excerpts on the 18 long
enough to yield claims, and one harvest run over the document fixtures are byte-identical to
0.6.1, compared by a committed script (`scripts/fidelity-snapshot.mjs`) run before the first
source edit and after the last.

- **`recheck` no longer calls a version change a regression.** A `pipeline drift` row means
  the archived bytes, judged today, disagree with the verdict recorded when they were archived.
  When the archive was written by a different testimonium version, that is often a deliberate
  tightening - 0.6.0 stopped a claim matching across a region join, so every 0.5.0 archive of
  such a match lands here - and the report said "This is a regression in testimonium". It now
  names both versions and points at the CHANGELOG between them. Same-version drift still says
  regression. The category and the exit code (2) are unchanged.
- **Harvest folds and indexes the draft once per run**, not once per region per read per
  source. Cost only; proposals are unchanged. The unused `HarvestRead.text` field is removed
  (internal; not exported).
- **Four tests that could pass without testing anything now have an assertion that can
  fail**, each shown red under a mutation of the property it names; and the `dropContained`
  union that 0.6.0's per-region scanning made reachable is now pinned by a test.
- Six stale comments and citations corrected.

Still open, deliberately: an unbounded description-region count, and the challenge-signature
and slug-overlap checks reading the flat join. Both change what the tool computes, so neither
fits a release whose promise is that nothing moves.

## 0.6.1 - 2026-09-23

One correction in the accusation direction.

- **pdftotext output is no longer run through the HTML tag stripper.** Every rung's body went
  through `toTextRegions`, which deletes everything from a `<` to the next `>`. That is right
  for HTML and destructive for extracted PDF text, where `p < 0.001` and `x > 3` are prose. A
  statistics paper could lose most of its text before any claim was tested, and every claim
  in the lost span read as missing: a false `unsupported` against an accurately quoted source.
  Measured on three papers cited by one article on 2026-09-23 (curl, `pdftotext -layout`, then
  the old path): arXiv 2306.07458 fell from 117,217 characters to 38,302; the Green and Chen
  CSCW 2019 author PDF from 98,794 to 74,787; arXiv 2010.07938 from 85,894 to 54,693. Each
  missed claim is found in the same extraction without the stripper. `SignalInput` gains an
  optional `bodyKind: "html" | "text"` (default `"html"`, so every existing caller is
  unchanged); `readSource` sets `"text"` for the `pdftotext` rung on both paths, the `.pdf`
  URL and the content-type re-route. Text bodies are whitespace-collapsed only, as
  `plainTextRegions`. **Verdicts on PDF sources can move from `unsupported` to `supported`,
  and `proseChars` on PDF reads rises**; HTML reads are byte-identical. **Measured on the 618-URL corpus (2026-09-23):**
  its 16 PDF-shaped URLs are the whole population this change can move. All 16 read; 15
  extract byte-identically on both paths, and one (a court complaint with six `<`
  characters) gains 383 characters, 0.7% of its text. The corpus is mostly filings and
  letters; the loss concentrates in statistics-heavy research papers, where it ran to
  two thirds of a document. Script: an ad-hoc one-fetch, two-extraction comparison
  against the stale-build `toText` (the same tag stripper); not committed.

## 0.6.0 - 2026-09-22

Two tightenings against false attestation, and a measurement against the same 618 live URLs
0.5.0 measured, because a change to a committed surface earns one every time.

- **A claim can no longer match across the join between two extraction regions.** `check()`
  and `harvest()` used to match against `toText`'s flat concatenation of the page body and
  every harvested description value, so a claim spanning the seam between two of them - the
  tail of the body running into the head of a description, or two separate description tags
  that are never adjacent on any rendering - could match text that exists nowhere on the page
  as a sequence. Matching is now confined to a single extraction region. This closes on
  `harvest` as well as `check`: a proposal spanning a join would otherwise have had the tool
  accuse an author over its own suggested claim. `toText`'s own output does not change - it is
  still the flat join, still the committed surface it has been since 0.3.0 - because a claim's
  match *position* moved, not the text itself; tasks 2 and 3 each diffed `text`/`proseChars`
  across every fixture between the pre- and post-fix commits and found 0 mismatches.
  **`<doc>.evidence.json` excerpts do change, on ordinary pages and not only on the seam
  cases.** An excerpt is now located inside the region that matched, so a claim ending the
  body no longer draws the following description into its trailing context: the passage
  loses a trailing ellipsis and any publisher blurb that used to ride along. That is the
  intended repair - the old passage conjoined two things a reader never sees adjacent - but
  it is a committed surface, and the README tells authors to commit that file.
- **A `<meta>` tag's `name`/`property` and `content` are now read by parsing its attributes,
  not by matching two regexes against the whole tag string.** `IS_DESCRIPTION` and
  `CONTENT_ATTR` matched a substring appearing anywhere in the tag - inside another attribute's
  name, or inside another attribute's value - so `<meta name="keywords" content="'x'
  name='description' LEAKED">` harvested the leaked fragment as if it were a real description,
  and `<meta name="description" data-content="WRONG" content="THE REAL DESCRIPTION">` harvested
  `WRONG` from `data-content` and lost the real description entirely, because the `Set`-based
  dedup never saw it. Both regexes are gone; the tag's attributes are parsed into name/value
  pairs and only the genuine `content` attribute is read. One deliberate widening rides
  along and is not a substring-bug shape: the attribute VALUE is trimmed before comparison,
  so `<meta name=" description " content="...">` now harvests where 0.5.0 read nothing.
  That is more permissive than a browser too - HTML5 matches standard metadata names
  exactly - and it moves text in the ADDING direction, which is the direction that can lift
  a page over the prose floor.
- **Pages green today can go red, on both routes, and this release does not know how many.**
  The region fix turns a claim that only ever matched by reading across a join into a correct
  miss: on a page that clears the prose floor and is not vetoed, that is a `supported` becoming
  a correct `unsupported` naming the claim - not a regression to fix in this tool, but a CI run
  that was green yesterday and is red today. The attribute fix moves matches in both directions
  on a malformed tag: a leaked fragment or a `data-content` collision stops matching, the real
  description starts. Four constructed cases exercise all four transitions against the real
  0.6.0 build (`docs/description-movement-0-6-0.md`, "Question 2"): a keyword-tag leak and a
  `data-content` collision (the attribute fix, one losing a false match and gaining the true
  one on the same page), and a body-description join and a description-description join (the
  region fix, both losing a match that only ever existed across the seam). **The measurement
  below cannot say, and does not claim, how many of the 618 live pages actually lose a match
  this way**: the harness passes no claims (`claims: []`) because the claim text these URLs
  were cited for lives in a database this repository cannot read, so the four cases above are
  answered from constructed fixtures, disclosed in advance rather than found after publication.
  They prove the mechanism is real; they say nothing about its live incidence. Read "zero
  movement" below as exactly that measurement, not as "nobody is affected" - only the first was
  measured.
- **Measured against the same 618 source URLs 0.5.0 measured** (`docs/description-movement-0-6-0.md`).
  Every absolute count below is conditioned on the harness's simplified rung selection - the
  first rung returning a 2xx with a non-empty body - which is NOT `check()`'s escalation
  ladder, so these are not the figures a real run would report; only the before/after deltas
  are independent of it:
  618 of 618 measured, 551 yielded a reading, 534 non-vetoed. **Zero floor crossings in either
  direction. Zero rows where the extracted text
  differs at all** - not the weaker "zero crossings": the exact string is identical on all 551
  readings, and 486 of those 551 carry a harvested description in both arms, so the zero is a
  real measurement of agreement, not an absence of anything to disagree over. Zero veto flips,
  zero challenge-signature flips. This figure measures the attribute-parsing fix only, and only
  its effect on `toText`'s byte output - the region fix changes matching, not extraction, so it
  cannot move a `toText` diff by construction (see the bullet above for how it was checked
  instead).
- **This repository's own doctrine (`src/text/normalize.ts:7-11`) treats a change to committed
  output as breaking, which argues for a major bump; it ships as minor on the narrower ground
  that `^0.5.0` in a consumer's dependency range excludes `0.6.0`, so nobody receives this
  change without choosing to take it.**

## 0.5.0 - 2026-09-19

One additive change to what `toText` extracts, the deduplication rule that
keeps it from inflating prose on its own, and a measurement against 618 live
URLs because a change to a committed surface earns one.

- **`toText` now reads text carried in `description`, `og:description` and
  `twitter:description` meta tags** (spec
  `2026-09-15-citation-check-cutover-design.md` section 3). It previously
  discarded every attribute value wholesale along with the tags themselves, so
  a page whose prose lives almost entirely in its description - a post whose
  rendered body strips to a sentence or two - read as unreadable no matter how
  substantial that description was. The fix names no publisher and reads bytes
  the server already returned in the response body: the same text any link
  preview renders, not an extraction of anything hidden or paywalled.
  `og:description` uses `property=`, not `name=`; both spellings are read,
  attribute order is not assumed, both quote styles are accepted, and entities
  inside `content` decode.
- **The three tags are deduplicated before appending.** They usually carry the
  same sentence, and counting it three times would inflate a page's measured
  prose toward the 4,500-character floor on the strength of one sentence
  repeated, not three sentences read. Description text is appended after the
  body, never prepended, so description text cannot win the first match ahead
  of body text. It does not make excerpts invariant: a claim matching at the
  very end of the body can now draw appended description text into its trailing
  context window, so an excerpt may gain a trailing ellipsis or a sentence of
  publisher blurb. **(Closed in 0.6.0: excerpts are located within the matching
  region, so neither half of that sentence is true any more.)**
- **This changes `toText`'s output, which has been a committed surface since
  0.3.0.** A caller diffing its own prose against a source's extracted text,
  or comparing extraction snapshots across a version bump, will see new
  characters on any page carrying a description. This repository's own doctrine
  (`src/text/normalize.ts:7-11`) treats a change to committed output as
  breaking, which argues for a major bump; it is released as minor on the
  narrower ground that `^0.4.0` in a consumer's dependency range excludes
  `0.5.0`, so nobody receives this change without choosing to take it.
- **Measured against the 618 source URLs cited by 99 published bulletin
  issues** (`docs/description-movement-0-5-0.md`): 618 of 618 measured, 549
  yielded a reading, 532 non-vetoed. 483 of 549 (88.0%) gained description
  text; 66 (12.0%) gained nothing. No URL's measured prose went down anywhere
  in the corpus - prose can only rise. Median gain among pages that gained
  anything: 148 characters; maximum: 3,283.
- **5 URLs cross the 4,500 prose floor. 0 cross the 800 signature cap.** Each
  of the five was already within 20 to 390 characters of the floor before
  this change - substantial articles sitting just under an arbitrary line,
  not shells becoming accusable. **Two of the five - `casar.house.gov` and the
  `techcrunch.com` Apple/Qwen row - clear the floor almost entirely on text
  already present in their own bodies**, and land back under it once that
  restatement is discounted; deduplication runs across the three meta tags but
  not against body text. Only three of the five cross on genuinely new text.
  No URL crosses the 800 signature cap anywhere in the corpus, and no read's
  challenge signature flips in either direction - but that is not a bound on
  the sub-floor case: a claim matching description text alone returns
  `supported` below the floor, because `matched === total` is tested before any
  floor test. 61 of the 549 readings sit below the floor and gained description
  text.

## 0.4.0 - 2026-09-14

One additive change - the package's first shipped type declarations - and the
type-level consequences of shipping it. No verdict moves.

- **The package ships TypeScript declarations for the first time.**
  `declaration: true` now emits a `.d.ts` beside every compiled file, the
  `exports` map's `"."` entry gains a `types` condition ordered before
  `default`, and a top-level `types` field serves legacy `node10` root-import
  consumers, who never consult `exports` at all. This is a minor bump, not a
  patch (spec 0.4.0 section 2.1): shipping declarations where none existed can
  break a working build through no change of the consumer's own - code that
  compiles today only because every import from this package resolves to `any`
  can go red the moment real types arrive, and that is precisely what a patch
  bump promises will not happen.
- **Nine types that were already reachable, but had no name to hold them in,
  are now exported** (spec 0.4.0 section 2.3): `Evidence`, `Rule`, `HostRule`,
  `Document`, `Footnote`, `ClaimsFile`, `ClaimEntry`, `Joined`, `BuiltinRung`.
  Each was already the field, parameter, or return type of an already-public
  signature - `CitationResult.evidence`, `RuleSet`, what `parseGfmFootnotes`
  returns, what `parseClaimsFile` returns, what `joinClaims` returns, the named
  half of `RungId` - so a consumer already received these shapes with no name
  to write a typed variable or a typed wrapper around them. Naming a shape
  already crossing the boundary commits the package to nothing that passing the
  value did not already commit it to.
- **`VERSION` and `THRESHOLDS` are widened before declaration emit could commit
  anyone to their literal values** (spec 0.4.0 section 2.6). `VERSION` is now
  explicitly annotated `: string` rather than left to infer as the literal
  `"0.4.0"`: shipped as a literal, `VERSION === "0.5.0"` fails to compile
  against it, which means every future release would have been a type-breaking
  change. `THRESHOLDS`'s six values are now typed `number`, not their literal
  values (`4500`, `800`, and so on) - via an explicit `Readonly<Thresholds>`
  annotation, since dropping the record's `as const` alone does not force the
  widening; `Object.freeze`'s own generic signature still infers literal types
  from a bare object-literal argument regardless. Shipped as literals, any
  future recalibration of the prose floor - which this spec's own section 5
  already records evidence for - would have been a semver-breaking change for
  every consumer comparing against `THRESHOLDS.minProseChars`. `Object.freeze`
  itself is untouched: it is what protects the keystone at runtime, and no type
  annotation ever did that job.

## 0.3.0 - 2026-09-13

Two additive changes, both in service of the first real integration replacing
the tool this package was extracted from. Neither moves a verdict.

- **`toText` is a runtime export.** A caller measuring how much of its own
  prose it shares verbatim with a source needs the source's extracted text, and
  `check()` returns excerpts rather than the document. `toText` is pure
  html-to-prose: holding it lets nobody assemble a verdict, which is why it can
  be exported while `readSource` and `computeSignals` stay sealed. Its output
  is now a compatibility commitment — the same trade already made for `norm`.
- **The `node` and `curl` rungs report their failures.** Both caught and
  returned `EMPTY_RESPONSE` with no diagnostic, so a dead link and a timeout
  were indistinguishable downstream. `read-source.ts` already warned when a
  *third-party* fetcher threw, citing ruling C12 — the package held other
  people's fetchers to a standard it did not hold its own to. `pdf.ts` was
  already fixed in 0.2.0.

## 0.2.0 - 2026-09-12

One verdict-moving change, one additive-but-doctrine-reversing field pair on
`unsupported` results, five new runtime exports, a stated non-circumvention
stance with two capabilities declined, and two CLI additions. This package is
published now, so unlike every plan before this one - each of which took a
breaking change for free on the basis that nothing was published yet - this
entry states plainly what moved and why.

- **Verdicts move.** `check` now climbs one more rung past a
  readable-but-`unsupported` read when an HTML rung is still untried, before
  returning a verdict that accuses an author's citation ("escalate before
  accusing", spec 0.2.0 section 4). This turns some `unsupported` results
  into `supported` - away from accusation, which is the safe direction - but
  it is still a behaviour change on a published tool: a 0.1.0 consumer's
  cached `unsupported` results can read differently after upgrading. Every
  verdict that actually moves - none do across the full fixture corpus (see
  the report for why that is the expected, uninteresting result), one does
  on the fixture built specifically to exercise this feature - is recorded
  with its reason in `docs/verdict-movement-0-1-0-to-0-2-0.md`.
- **`unsupported` results gain `evidence` and `retrievedAt`.** Additive in
  JSON - no field removed or retyped - but a doctrine reversal at the spec
  level: the binding spec stated, at two separate sites, that non-`supported`
  results "carry no renderable fields at all"; both sites are now amended
  (spec 0.2.0 section 2). An author who fixes four of five claims no longer
  loses the rendered evidence for the one claim that already passed.
  `unreachable` is unchanged and stays bare: we did not read the page, so
  there is nothing honest to render.
- **Five new runtime exports, plus their types.** `defaultFetcher`, `norm`,
  `THRESHOLDS`, `validateClaims`, `classifyRun`. `THRESHOLDS` is exported
  frozen (`Object.freeze`): it is the table that decides whether a page
  counts as read, and an unfrozen export would have let any consumer move
  that boundary process-wide. `toText`, `isPdf` and the per-host helpers
  stay sealed.
- **The non-circumvention stance, stated in the spec and the README.**
  testimonium's design goal is that a source it cannot legitimately read
  reads `unreachable`, never `unsupported`, stated as a goal with a named,
  accepted exception (a wall padded past the prose floor) rather than as an
  absolute the code cannot back. Two capabilities were considered and
  declined on this ground: a publisher-specific body extractor recovering
  full article text from a page's embedded JSON state, and a
  publisher-pinned user agent for the same, already hard-blocked, host. Both
  remain available to a caller with legitimate access, through
  `CheckOptions.fetcher` or a local `--rules` host entry - no fork required.
- **CLI: `--identity <app contact-email>` and `--help`/`-h`.** `--help`
  previously printed `unknown flag --help` and exited 2; it now prints usage
  and exits 0, whether invoked bare or alongside other flags.

**If you run `recheck` against a baseline archived under 0.1.0, read this
before filing a bug.** The live arm can now escalate on the ladder above;
the replay/control arm built from that pre-0.2.0 archive cannot, because
`replayFetcher` advertises only the rungs the archive actually recorded. The
first `recheck` you run after upgrading can therefore report live/archive
divergence on exactly the `unsupported` entries this release rescues. That
is this release's fix surfacing at the recheck seam, not a regression - see
"The recheck/replayFetcher interaction" in
`docs/verdict-movement-0-1-0-to-0-2-0.md` for the full mechanism.

## 0.1.0 - 2026-09-11

Initial implementation of plan 1 (`check`, `reachability`). See
`docs/superpowers/plans/2026-09-06-plan-1-core.md` and
`docs/superpowers/specs/2026-09-06-testimonium-design.md` for the design.

### Plan 2 (harvest) - changes since the plan-1.2 merge

One new command, one breaking refusal, and three additive fields. All of them
landed after `a1feba7` and before this version was released, so none carries a
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
names for it, plus two repairs and one non-change. All landed after `6546176`
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
or the `Fetcher` interface. All of them landed after `7accd06` and before this
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
