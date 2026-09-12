# testimonium 0.2.0: closing the gaps a real integration found

**Status:** design, approved in sections 2026-09-11. Not yet implemented.

**Supersedes nothing.** This extends `2026-09-06-testimonium-design.md`, which
remains the binding authority. Where this document and that one disagree, that
one wins until this is merged and its amendments are folded in.

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
each is a capability that exists today, in production use, that would be lost
by adopting this package as it stands. The governing requirement is **no lost
functionality**.

Two findings from that exercise are worth recording because they change how
much of the rest should be believed.

**The extractors are equivalent.** Spec 11 warned that translating the fetch
layer was "where behaviour gets silently changed". Measured on identical bytes
across five hosts, this package's `toText` and the origin's agree to within two
characters: 108,248 vs 108,259 on a large encyclopedia article, 23,806 vs
23,814 on a reference page, 551 vs 553 on a short government release. The
riskiest part of the port is sound.

**One flagged regression was not live.** The ledger reported that a consent
shell clearing the prose floor would end the ladder and produce a false
accusation. Measured against the host named in the origin's own defeat log,
the shell yields 310 prose characters against a 4,500 floor, so this package
escalates past it. The protection is real but incidental: it comes from the
floor, not from the design. A shell whose chrome cleared 4,500 would stop the
ladder. Section 3 fixes the mechanism rather than relying on the coincidence.

## 2. The boundary rule

The origin's gates and this package are not the same kind of artifact. One is
a private tool serving one publication; the other is a public package. The rule
that decides where each MISSING capability lands:

> **General web-fetching defeats belong in testimonium. Editorial judgment,
> storage, and one publication's conventions belong to the caller.**

Applied, this keeps out: an HTML `<li id="fn-N">` footnote adapter (spec 11.2
already calls other flavours "adapters someone writes later"); any database
read or write; an originality or paraphrase check (spec 9 makes it an explicit
non-goal); and a caller's own dry-run flag.

It also keeps out two things the ledger listed as MISSING, for a different
reason - see section 6.

## 3. Escalate before accusing

### The defect

`nextAction` stops climbing the moment a read is readable
(`src/fetch/ladder.ts:48-49`). The origin instead retries through a second rung
**whenever a claim missed**, even at a clean 2xx. Its own log records that this
"killed six false misses" in a single issue.

The failure this prevents: a host serves a JavaScript or consent shell to one
rung and the real document to another. If the shell's chrome clears the prose
floor, this package judges the read readable, stops, finds no claims in the
chrome, and returns `unsupported` - an accusation against an author whose
citation was correct. That is the exact outcome the keystone rule exists to
prevent.

### Why the obvious fix is wrong

Tell the ladder whether claims matched, and claim-matching moves inside the
fetch loop. `nextAction` is pure ladder policy - history in, next action out -
and its docstring records why: in the origin, "challenged at fetch, so try
curl" lived inside the fetch function, a second caller reimplemented it inline,
and that copy diverged three ways on the day the rule landed. `readSource`
returns raw reads and never sees a claim, because "a caller holding raw reads
can assemble a verdict this function never issued".

That separation is load-bearing and stays.

### The design

Escalation lives in `check()`, which the spec already designates as owning the
verdict. The ladder gains one capability - being told not to stop at the first
readable read - and stays claim-blind.

1. `readSource` as today. Compute the verdict.
2. **If the verdict is `unsupported` AND an untried rung remains**, resume the
   ladder exhaustively.
3. Recompute the verdict over the union of all reads.

`nextAction` gains a flag, not a claim. The claim-awareness sits in the one
function that already owns verdicts.

**Resume, not restart.** The second pass continues from the existing history,
so the first rung is not fetched twice. `readSource` returns its history and a
companion entry point continues from it. The cost is exactly one extra fetch.

### What it cannot do

- **It cannot make a verdict worse.** The verdict is already a union across
  reads; a further read can only add evidence. A vetoed second read is excluded
  and the verdict stands.
- **It cannot fire on a PDF.** `nextAction` stops after one attempt for PDF
  URLs and there is no second rung. This is a no-op there, stated here so it is
  not discovered as a surprise.
- **It cannot fire when no rung remains untried**, which is the common case for
  a citation that is genuinely unsupported.

### The archive invariant

`recheck` compares a live read against archived bytes. The archive stores every
attempted read, and the replay fetcher advertises the **recorded** rungs. An
archive written by 0.1.0 with only `node` recorded therefore offers no untried
rung on replay: escalation cannot fire, and no spurious drift appears.

**This is an invariant, not an argument, and section 7 requires a test for it.**

## 4. The other five behaviour changes

| # | change | today |
| --- | --- | --- |
| 1 | **`identity` reachable from `CheckOptions`** | declared at `default-fetcher.ts:13`, read at `:25-33`, and settable by nobody: `check()` builds `defaultFetcher({hosts})` and `CheckOptions` has no `identity` field. Every citation to a host requiring a declared identity takes the warn-and-use-a-browser-UA branch. Spec 11.4 says this moved to configuration; the configuration exists and is not wired to the front door. |
| 2 | **Evidence on partially-supported rows** | `io/evidence.ts:95-97` returns `missed` for `unsupported` and attaches `evidence` only for `supported`. A footnote where four of five claims matched keeps zero passages. Add `evidence` and `retrievedAt` alongside `missed`. |
| 3 | **Four challenge signatures** | `"javascript is disabled"`, `"enable javascript and then reload"`, `"enable javascript to run this app"` (the stock React/Vite noscript shell), `"please turn javascript on"`. None matches a bundled pattern; all four verified by running both matchers. |
| 4 | **Narrow the N2 `/consent/` path veto** | it rejects legitimate pages *about* consent, including a data-protection regulator's own guidance - and that regulator is the host in the origin's defeat log. |
| 5 | **`warn pdftotext failed: <message>`** | `pdfFetch` returns `EMPTY_RESPONSE` silently. Spec 11.3 says a missing or failing rung is "reported as provenance"; today it is reported as nothing. |

## 5. The library is a first-class surface

Two of four commands are reachable from an import. `harvest` and `recheck` are
CLI-only, as is the entire archive layer, `writeEvidenceFile`, `classifyRun`,
`THRESHOLDS`, `isReadable` and `norm`. The exports map lists `"."` and
`"./package.json"` only, so no deep import reaches them.

Some of that is deliberate and stays: no fetch-level entry point returning raw
text, and `check()` keeps owning the verdict. But four omissions make the
library a second-class path, and one of them defeats a seam this package
advertises.

| export | why |
| --- | --- |
| **`defaultFetcher`, `FetcherOptions`** | `CheckOptions.fetcher` advertises "bring your own reader - a headless browser, a paid proxy". With no default to delegate to, that means reimplementing the ladder. The seam is currently usable only by wholesale replacement. |
| **`norm`** | a caller doing text analysis beside this package's matching must use the same normalization or the two silently disagree. Verified identical to the origin's across 142 real claim strings; exporting pins an equivalence that already holds. |
| **`THRESHOLDS`, or `validateClaims`** | `check()` throws a `TypeError` on a sub-floor claim (`check.ts:62-69`) via `findIndex`, so it reports only the FIRST offender. A caller has no way to test a claim before calling and no way to enumerate offenders. The CLI has a good story here; the library has none. |
| **`classifyRun`** | run-level policy belongs to the caller (spec 8), but leaving every caller to invent "what fails a run" is how the origin's ladder diverged three ways. Exporting it as a pure, optional function gives parity without taking the policy away. A caller applying a stricter policy on top - refusing to publish while any source is unreachable, say - is the design working, not a conflict. |

**Acceptance criterion:** a library consumer can reproduce the CLI's output for
a document while importing only what the exports map lists. Testable, and it
fails loudly if a later change quietly makes the CLI special again.

`harvest` and `recheck` stay CLI-only in 0.2.0. This is a decision, not an
oversight: exporting a surface is a compatibility commitment, and `recheck` is
built around files on disk in a way a database-backed caller could not use.

## 6. What this package will not do, stated rather than implied

Add to spec 9 and to the README:

> testimonium does not defeat paywalls, bot walls, or consent walls. A source
> it cannot legitimately read is `unreachable`, never `unsupported`. A caller
> with legitimate access - a subscription, an institutional proxy, an
> authenticated session - supplies it through `CheckOptions.fetcher`, and both
> arms then run through the same `check()`.

Two ledger rows are declined on this ground, and the reason is recorded so a
later reader does not helpfully complete the port:

- **A publisher-specific body extractor** that recovers full article text from
  a page's embedded JSON state, defeating paywall truncation. Inside a private
  tool, checking one's own citations against a publication one subscribes to is
  a defensible gray area. Distributing it in a free public package is not: it
  ships circumvention for a named publisher to everyone, against that
  publisher's terms. It also contradicts this package's own stance - the
  keystone exists so that a page we could not legitimately read is reported
  honestly rather than converted into an accusation. A tool arguing that
  citations must be verifiable should not ship a bypass for the one case where
  the honest answer is "I could not read this."
- **A publisher-pinned user agent** for the same host. Identifying as a browser
  is general and already supported through `HostRule.userAgent`; pinning an old
  browser version at one publisher is defeat-shaped rather than general.

Both remain available to any caller with legitimate access, through `fetcher`.
That is what section 5 makes possible.

## 7. Verification

Every item gets an instrument shown able to fail before its pass is believed -
the standing rule, earned across thirteen recorded instrument failures. Three
need naming because the obvious test would not catch the defect.

**Escalation, both directions.** A test proving it fires when a readable read
missed with a rung untried, and a test proving it does not fire otherwise. A
test that only proves the first half would pass against an implementation that
escalates always, which is a different and more expensive tool.

**The archive invariant.** A 0.1.0-shaped archive with one recorded rung must
produce no escalation on replay and therefore no drift. Tested, not argued.

**The `/consent/` veto, both directions.** A legitimate consent-topic URL that
must now pass, AND an actual consent wall that must still be vetoed. Narrowing
a veto risks letting the real thing through; a test checking only that the
legitimate page passes would look exactly like success.

**The exports**, per section 5's acceptance criterion.

**And one report, because verdicts move.** Run 0.1.0 and 0.2.0 over the
committed fixture corpus and record every verdict that changes, with its
reason, as a dated document. Built here on fixtures where it costs no network,
and reused as the reconciliation instrument by the follow-on projects. This is
what turns "verdicts may improve" into something a reader can check.

## 8. Compatibility

**0.2.0 changes verdicts.** Escalate-before-accusing moves some `unsupported`
to `supported`. That is a fix and it is in the safe direction - away from
accusation - but the package is published now, and every plan before this one
took breaking changes for free on the basis that it was not. The CHANGELOG
says so plainly, in those terms.

The evidence-shape change is additive: `unsupported` rows gain `evidence` and
`retrievedAt`. No field is removed or retyped.

The four new exports are additive.

## 9. Follow-on projects, scoped here so they are not implicit

This document covers project 1 only. The remaining three are recorded so the
sequence is visible and so nothing in them is mistaken for out-of-scope
drift.

| # | project | note |
| --- | --- | --- |
| 2 | **Cut over the simpler of the origin's two gates** | its `url` + claims shape maps almost directly onto `check(url, claims)`. The pilot: a mistake costs an exit code, not a wrong stored row. |
| 3 | **Cut over the second gate; delete the shared fetch layer** | needs the caller's own HTML footnote adapter and its own storage writes. Ends with one ladder rather than two. |
| 4 | **The caller's admin surface** | its read side already exists and already honours the keystone in its messaging. What is missing is producing verdicts there rather than from a terminal: trigger, progress for work too slow to block a request, per-citation detail, and freshness against the document's last edit. |

**Parity bar for 2 and 3, set by the owner:** capability parity plus a
reconciliation run. Before the old code is deleted, both implementations run
over all existing content, every differing verdict is diffed and adjudicated
one by one, and the adjudications are written down. The origin's existing unit
suites for its shared libraries are the offline half of that instrument and
cost no network.

**Coupling to watch:** 0.2.0 adds evidence on partially-supported rows and
project 3 will store it. If project 4 lags, passages are stored that nothing
displays. Harmless, but it argues for 4 following 3 closely.
