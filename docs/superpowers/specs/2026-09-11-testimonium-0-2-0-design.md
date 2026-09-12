# testimonium 0.2.0: closing the gaps a real integration found

**Status:** design, revised 2026-09-11 after review. Not yet implemented.

**This document AMENDS `2026-09-06-testimonium-design.md`.** That spec remains
the binding authority for everything this one does not name. Section 2 lists
every clause this supersedes, because three of the changes below reverse
doctrine that spec states positively, and an amendment nobody declared is how a
document goes quietly false.

---

## 1. Why there is a 0.2.0

0.1.0 was extracted from a private origin repository and published on
2026-09-11. Extraction was verified against a fixture suite, but it had never
been asked to *replace* the thing it was extracted from. Preparing that
replacement produced a capability ledger: 104 rows comparing every behaviour of
the origin's two citation gates against this package.

**58 PRESENT, 24 DIFFERENT, 18 MISSING, 4 OBSOLETE**, plus 8 behaviours where
this package would newly refuse something the origin accepted.

The MISSING rows are the subject of this document. They are not a wish list:
each is a capability in production use today that would be lost by adopting
this package as it stands. The governing requirement is **no lost
functionality**.

Two measurements from that exercise change how much of the rest should be
believed.

**The extractors are equivalent.** Base spec 11 warned that translating the
fetch layer was "where behaviour gets silently changed". Measured on identical
bytes across five hosts, this package's `toText` and the origin's agree to
within two characters: 108,248 vs 108,259 on a large encyclopedia article,
23,806 vs 23,814 on a reference page, 551 vs 553 on a short government release.
The riskiest part of the port is sound.

**One flagged regression was not live.** The ledger reported that a consent
shell clearing the prose floor would end the ladder and produce a false
accusation. Measured against the host named in the origin's own defeat log, the
shell yields 310 prose characters against a 4,500 floor, so this package
escalates past it. The protection is real but incidental: it comes from the
floor, not from the design. A shell whose chrome cleared 4,500 would stop the
ladder. Section 4 fixes the mechanism rather than relying on the coincidence.

**Where the evidence lives.** The ledger is the basis for these counts and for
all three follow-on projects. It describes a private repository's internals and
therefore cannot be committed here; it needs a durable home beside that
repository rather than in scratch. Until it has one, the numbers above are
attested by this document alone, which is weaker than this project's standard.

## 2. Amendments to the binding spec

Each change below reverses or widens a clause the 2026-09-06 spec states
positively. **Both the spec text and the in-code doctrine comments move
together** - a corrected sentence whose twin survives elsewhere is this
repository's most persistent defect, and 7.4 in particular appears twice.

| binding clause | where | amendment |
| --- | --- | --- |
| **6.6** the ladder escalates until a read is readable | base spec 6.6; `src/fetch/read-source.ts:33-34`; `src/classify/verdict.ts:85-86` | it may also escalate past a readable read when the verdict would be `unsupported` and a rung is untried (section 4) |
| **7.4** "Non-`supported` results carry no renderable fields at all - no excerpt, no `retrievedAt`" | base spec **line 995 AND line 2133** (summary table); `src/io/evidence.ts:27-35` and `:70-83` | **`unsupported` only** gains `evidence` and `retrievedAt`. `unreachable` stays bare - we did not read the page, so there is nothing honest to render. |
| **5.3** "The primitives (`norm`, `toText`, `isPdf`, per-host helpers) are genuinely unavailable to consumers" | base spec line 260 | `norm` and `defaultFetcher` become available; `toText` and the per-host helpers stay sealed (section 6) |
| **9** what this does not do | base spec 9 | gains the non-circumvention statement (section 7) |

`test/exports.test.ts` pins the runtime export allowlist and must be updated in
the same change as any addition, not after it.

## 3. The boundary rule

The origin's gates and this package are not the same kind of artifact. One is a
private tool serving one publication; the other is a public package.

> **General web-fetching defeats belong in testimonium. Editorial judgment,
> storage, and one publication's conventions belong to the caller.**

Applied, this keeps out: an HTML `<li id="fn-N">` footnote adapter (base spec
11.2 already calls other flavours "adapters someone writes later" - it belongs
to project 3); any database read or write; an originality or paraphrase check
(base spec 9 makes it an explicit non-goal - see section 10 for its recovery
path); and a caller's own dry-run flag.

It also keeps out two rows the ledger listed as MISSING, for a different reason
- see section 7.

## 4. Escalate before accusing

### The defect

`nextAction` stops climbing the moment a read is readable
(`src/fetch/ladder.ts:48-49`). The origin instead retries through a second rung
**whenever a claim missed**, even at a clean 2xx. Its own log records that this
"killed six false misses" in a single issue.

The failure this prevents: a host serves a JavaScript or consent shell to one
rung and the real document to another. If the shell's chrome clears the prose
floor, this package judges the read readable, stops, finds no claims in the
chrome, and returns `unsupported` - an accusation against an author whose
citation was correct. That is the outcome the keystone rule exists to prevent.

### Where the claim-blind boundary actually is

An earlier draft of this section said `readSource` "returns raw reads and never
sees a claim". **That is false.** `readSource(url, claims, opts)` takes claims
as its second parameter (`src/fetch/read-source.ts:43`) and hands them to
`computeSignals` on every rung (`:68-76`), which does the phrase matching per
read; `matchedClaims` rides on every `Read`, and raw bytes are dropped once
signals are computed.

The boundary that *is* real, and that this design preserves: **the climb
decision is claim-blind.** `Attempt` carries `{rung, readable}` and nothing else
(`ladder.ts:8-11`), so `nextAction` decides from readability alone. That is the
separation whose loss the ladder's own docstring records - in the origin,
"challenged at fetch, so try curl" lived inside the fetch function, a second
caller reimplemented it inline, and that copy diverged three ways the day it
landed.

Stating it the wrong way was dangerous, not merely wrong: an implementer
"restoring" the claimed property would pull claims out of `readSource` and break
`matchedClaims` and the cross-rung union.

### The design

Escalation is triggered in `check()`, which the base spec already designates as
owning the verdict. `nextAction` gains a flag - never a claim.

1. `readSource` as today. Compute the verdict.
2. **If the verdict is `unsupported` AND an untried rung remains**, resume the
   ladder with the stop-at-readable rule suspended.
3. Recompute the verdict over all reads.

**Resume, not restart.** The second pass continues from the existing attempt
history so the first rung is not fetched twice. `SourceReads` has no history
field today (`read-source.ts:78-84`); the continuation entry point either
returns the `Attempt[]` it already builds internally (`:45`) or derives it from
`reads` via `isReadable`. The spec requires only that the resumed call not
re-fetch.

**Only `check()` passes the flag.** `reachability` and `harvest` also call
`readSource` and must not escalate - `reachability` passes `[]` for claims
(`reachability.ts:45`) and has no verdict to protect. Caller-divergent ladder
behaviour is precisely the historical failure above, so the flag's default is
off and the divergence is stated here and in the code.

### What it cannot do

- **It cannot make a verdict worse.** Verified rather than assumed, and the
  reason is not the one an earlier draft gave: the verdict is *not* purely a
  union across reads. The matched count is a union (`check.ts:133-146`) but the
  signals fed to `verdict()` come from the winning read
  (`proven ?? bestReadable ?? largest`, `check.ts:103-122`). The conclusion
  holds anyway: the `unsupported` trigger guarantees a readable read exists, so
  `bestReadable` never yields to `largest`; a vetoed second read cannot become
  `proven` (blocked implies `unreachable`, `verdict.ts:102`), cannot enter
  `bestReadable`, and its matches are excluded from the union
  (`check.ts:141`). Recomputation can therefore return only `unsupported` or
  `supported`, never `unreachable`, and `missed` can only shrink.
- **It cannot fire on a PDF.** `nextAction` returns before any HTML rung for
  PDF URLs (`ladder.ts:40-42`).
- **It cannot fire twice, or past exhaustion.** `HTML_ORDER` is two rungs
  (`ladder.ts:25`), so at most one extra fetch.

### What it does that costs money, stated plainly

An earlier draft claimed escalation "cannot fire when no rung remains untried,
which is the common case for a citation that is genuinely unsupported". **That
is backwards.** The ladder is node-first and stops at the first readable read,
so the common honest case - a healthy page node read fine that simply lacks the
claim - always leaves curl untried and **always escalates**. Escalation
therefore costs one curl fetch on *every* `unsupported`, not on a rare shell.

That cost is accepted: the origin retried on every miss too. It is recorded
here because section 8 requires a test that escalation does not fire
inappropriately, and a test author reading the earlier sentence would have
encoded "genuinely unsupported implies no escalation" as a fixture -
contradicting the design it was meant to verify.

### The archive invariant

`recheck` compares a live read against archived bytes. `replayFetcher`
advertises the recorded rungs only (`archive/replay.ts:32-35`), every attempted
read is archived (`record.ts:77-84`), only `supported` verdicts stage entries
(`bin.ts:595`), and replay runs only for supported entries (`recheck.ts:106`).
So across every 0.1.0 archive shape - node-only, node+curl, pdftotext-only - no
untried rung exists where the trigger could fire, and no spurious drift appears.
Forward-consistent too: a 0.2.0 escalated-supported entry records both rungs,
and replay escalates into the recorded curl read and reproduces the union.

This was verified against the code, not reasoned from the design. Section 8
still requires a test, and specifies one that can fail.

## 5. The other six behaviour changes

| # | change | today |
| --- | --- | --- |
| 1 | **`identity` reachable from `CheckOptions`** | declared at `default-fetcher.ts:13`, read at `:23-35`, settable by nobody: `check()` builds `defaultFetcher({hosts})` and `CheckOptions` has no `identity` field. Every citation to a host requiring a declared identity takes the warn-and-use-a-browser-UA branch. Base spec 11.4 says this moved to configuration; the configuration exists and is not wired to the front door. |
| 2 | **Evidence on `unsupported` rows** | `io/evidence.ts:95-97` returns `missed` for `unsupported` and attaches `evidence` only for `supported`. A footnote where four of five claims matched keeps zero passages. Adds `evidence` and `retrievedAt`. **`unreachable` is unchanged and stays bare.** Amends binding 7.4 at both its sites - see section 2. |
| 3 | **Four challenge signatures** | `"javascript is disabled"`, `"enable javascript and then reload"`, `"enable javascript to run this app"` (the stock React/Vite noscript shell), `"please turn javascript on"`. None matches a bundled pattern (`rules/challenge.ts:51-76`); all four verified by running both matchers. |
| 4 | **Narrow the N2 `/consent/` path veto** | it rejects legitimate pages *about* consent, including a data-protection regulator's own guidance - and that regulator is the host in the origin's defeat log. |
| 5 | **Surface a failed PDF rung as provenance** | `pdfFetch` returns `EMPTY_RESPONSE` silently. Base spec 11.3 says an absent rung is reported as provenance; this widens that to a *failing* rung, which is this document's own argument rather than a quotation. Note `pdf.ts:49-50`'s catch also covers the curl download, so the message must not say "pdftotext failed" unconditionally. |
| 6 | **Content-type PDF re-route** | the origin reads a content-negotiated PDF - one served from a URL with no `.pdf` - by re-checking `isPdf(url, contentType)` after the fetch. This package picks the rung from URL shape before any fetch (`read-source.ts:44`, `ladder.ts:40-42`), N5 vetoes the bytes (`signals.ts:182`), and the document reads `unreachable`. `isPdf` still accepts a `contentType` argument (`pdf.ts:24-27`) and nothing calls it with one. This is a general defeat, so section 3's rule keeps it in. Constraint: the pick-before-fetch invariant forbids falling through to curl on a *failed* PDF fetch; it does not forbid an N5-triggered `pdftotext` attempt when an HTML rung returns `application/pdf`, which cannot libel HTML as a PDF. |

## 6. The library is a first-class surface

Two of four commands are reachable from an import. `harvest` and `recheck` are
CLI-only, as is the archive layer, `writeEvidenceFile`, `classifyRun`,
`THRESHOLDS`, `isReadable` and `norm`. The exports map lists `"."` and
`"./package.json"` only.

Four omissions make the library second-class, and one defeats a seam this
package advertises.

| export | why |
| --- | --- |
| **`defaultFetcher`, `FetcherOptions`** | `CheckOptions.fetcher` advertises "bring your own reader - a headless browser, a paid proxy". With no default to delegate to, that means reimplementing the ladder. The seam is currently usable only by wholesale replacement. |
| **`norm`** | a caller doing text analysis beside this package's matching must use the same normalization or the two silently disagree. Verified identical to the origin's across 142 real claim strings. |
| **`THRESHOLDS`, or `validateClaims`** | `check()` throws a `TypeError` on a sub-floor claim (`check.ts:62-69`) via `findIndex`, reporting only the FIRST offender. A caller cannot test a claim before calling, nor enumerate offenders. |
| **`classifyRun`** | run-level policy belongs to the caller, but leaving every caller to invent "what fails a run" is how the origin's ladder diverged. Exported as a pure optional function. A caller applying a stricter policy on top - refusing to publish while any source is unreachable - is the design working. |

**What stays sealed, stated precisely.** Exporting `defaultFetcher` does expose
a `.fetch()` returning `rawBody`, so "no fetch-level entry point returning raw
text" was too broad. What is sealed is **the ladder and the classified reads**:
`readSource`, `computeSignals`, `Read`, `SignalResult`. A caller can obtain
bytes; it cannot obtain this package's judgment of bytes except through
`check()`. That is the property that matters - a caller holding classified reads
could assemble a verdict `check()` never issued.

**Acceptance criterion**, scoped so it is satisfiable: a library consumer
importing only what the exports map lists reproduces the CLI's `CitationResult`
array and its exit code. It does not reproduce the evidence-file bytes or stdout
formatting, which stay sealed. The test fails loudly if a later change makes the
CLI special again.

`harvest` and `recheck` stay CLI-only. A decision, not an oversight: exporting a
surface is a compatibility commitment, and `recheck` is built around files on
disk in a way a database-backed caller could not use.

## 7. What this package will not do, stated rather than implied

Added to base spec 9 and the README:

> testimonium does not defeat paywalls, bot walls, or consent walls. **Its
> design goal is that a source it cannot legitimately read reads `unreachable`,
> never `unsupported`**, enforced by the five vetoes and the prose floor. A
> caller with legitimate access - a subscription, an institutional proxy, an
> authenticated session - supplies it through `CheckOptions.fetcher`.

**The goal is stated as a goal, with a known gap named**, because
`src/classify/signals.ts:167-179` already records the counterexample: a wall
matching a signature but padded past roughly 4,500 characters is caught by
neither the signature (`maxChallengeChars` is 800, `thresholds.ts:54`) nor the
floor - "a known, accepted gap", with a `known-gap` fixture. Section 4's
escalation closes it only where the other rung serves the document; a fat wall
on both rungs still returns `unsupported`. Publishing the absolute form would
mint this repository's own defect class deliberately.

Two ledger rows are declined on this ground, recorded so a later reader does not
helpfully complete the port:

- **A publisher-specific body extractor** recovering full article text from a
  page's embedded JSON state, defeating paywall truncation. In a private tool,
  checking one's own citations against a publication one subscribes to is a
  defensible gray area. Distributing it in a free public package is not: it
  ships circumvention for a named publisher to everyone, against that
  publisher's terms. It also contradicts this package's stance - a tool arguing
  that citations must be verifiable should not ship a bypass for the one case
  where the honest answer is "I could not read this."
- **A publisher-pinned user agent** for the same host. Identifying as a browser
  is general and already supported; pinning an old browser version at one
  publisher is defeat-shaped. It is also dead capability - that host has been a
  hard block since 2026-08-24 (`rules/hosts.ts:26-34`).

The extractor remains available to a caller with legitimate access through
`fetcher`, which section 6 makes possible. The user agent needs no custom
fetcher at all - a local `--rules` host entry sets it (`rules/hosts.ts:3`).

## 8. Verification

Every item gets an instrument shown able to fail before its pass is believed.
Four need specifying, because the obvious version of each passes without
measuring its subject.

**Escalation, both directions.** A test proving it fires when a readable read
missed with a rung untried - **including the common healthy-page case, which
fires** - and a test proving it does not fire when no rung remains, on a PDF, or
from `reachability`/`harvest`.

**The archive invariant, armed.** The obvious test - an only-`node` supported
archive - passes vacuously: replay returns `supported`, so the escalation
trigger is never reached, and it would pass even against a `replayFetcher` that
wrongly advertised the machine's rungs, the exact failure `archive/replay.ts:13-22`
warns about. `recheck()` keeps only `replayVerdict` (`recheck.ts:105-112`), so
"no drift" cannot observe an extra attempt anyway. Instead: drive `check()`
directly with `replayFetcher` over a one-rung entry, with claims the archived
bytes lack, forcing an unsupported replay - then assert `rungsAttempted` equals
exactly the recorded rungs. That fails if replay ever offers an untried rung.

**The `/consent/` veto, both directions.** A legitimate consent-topic URL that
must now pass, AND an actual consent wall that must still be vetoed. A test
checking only the first half would look exactly like success.

**The reconciliation report needs a paired fixture.** `fixtures/corpus.json`
holds single bodies - one path and status per row - so both rungs replay
identical bytes and escalation changes **zero** verdicts on it. A report built
only on the current corpus would show the other deltas while implying the
headline change had been reconciled. It needs at least one paired per-rung
fixture: shell-to-node, document-to-curl.

**And the report itself.** Run 0.1.0 and 0.2.0 over the corpus and record every
verdict that changes, with its reason, as a dated document - the same instrument
the follow-on projects reuse for their reconciliation run.

## 9. Compatibility

**0.2.0 changes verdicts.** Escalation moves some `unsupported` to `supported` -
a fix, in the safe direction - but the package is published now, and every plan
before this took breaking changes for free on the basis that it was not. The
CHANGELOG says so in those terms.

The evidence-shape change is additive in JSON (`unsupported` rows gain two
fields) and a **doctrine reversal** at the spec level; section 2 records it as
such.

The four new exports are additive, and `test/exports.test.ts` moves with them.

## 10. Follow-on projects

This document covers project 1 only.

| # | project | note |
| --- | --- | --- |
| 2 | **Cut over the simpler of the origin's two gates** | its `url` + claims shape maps closely onto `check(url, claims)` - with one exception, below. |
| 3 | **Cut over the second gate; delete the shared fetch layer** | needs the caller's own HTML footnote adapter and its own storage writes. Ends with one ladder. **Precondition:** decide whether the citations table moves to URL keying. If it keeps `(document, footnote number)`, the origin's footnote-moved protection vanishes unreplaced. Archive the origin's fetch layer before deleting it. |
| 4 | **The caller's admin surface** | its read side exists and already honours the keystone in its messaging. Missing: producing verdicts there rather than from a terminal - trigger, progress for work too slow to block a request, per-citation detail, freshness against the document's last edit. |

**The originality check is project 2's, and it needs the tee.** The ledger calls
it the single largest whole-capability loss. It cannot be rebuilt on the public
API as 0.1.0 stands, because `check()` returns no source text. This spec's
export of `defaultFetcher` is what makes it recoverable: the caller wraps it in
a recording tee - the `recordingFetcher` pattern, `archive/record.ts:39-52` - and
keeps the same bytes `check()` read. Without that sentence, project 2's parity
bar promises something it cannot deliver.

**Parity bar for 2 and 3, set by the owner:** capability parity plus a
reconciliation run. Before the old code is deleted, both implementations run
over all existing content, every differing verdict is diffed and adjudicated one
by one, and the adjudications are written down. The origin's existing unit
suites for its shared libraries are the offline half of that instrument and cost
no network.

**Coupling to watch:** 0.2.0 adds evidence on `unsupported` rows and project 3
will store it. If project 4 lags, passages are stored that nothing displays -
harmless, but it argues for 4 following 3 closely. Related: the ledger's
"locator" warning row becomes derivable on those rows once change 5.2 lands
(`excerpt === null`), so it needs no separate work.
