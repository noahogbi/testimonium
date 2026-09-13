# bulletin-srccheck cutover — design

**Status:** draft, amended after review
**Date:** 2026-09-12
**Project:** 2 of 4 in the testimonium cutover, scoped in
`2026-09-11-testimonium-0-2-0-design.md` §10.
**Spans two repositories.** testimonium (public, this repo) ships a package
change; omnisscientia (private origin) consumes it. **omnisscientia is
read-only from the authoring session** — it is designed and specced here and
executed by the session that owns that repo.

**§12 records what review changed.** Read it before trusting any memory of an
earlier draft.

---

## 1. What this is

`scripts/bulletin-srccheck.mjs` in the origin repo answers one question per
bulletin item: does the cited URL actually carry the claims the item rests on?
It hand-rolls a fetch ladder, a challenge-page check, a curl retry, a phrase
matcher and an originality measure. testimonium was extracted from that code.
This project moves the script onto the extracted package, so that one
implementation carries the doctrine instead of two.

It is the pilot of the four cutover projects because its input shape
(`source_url` + `_claims[]`) maps almost directly onto `check(url, claims)`,
and because a mistake costs an exit code on a drafting run rather than a wrong
row in a database.

**The parity bar, set by the repo owner:** capability parity plus a
reconciliation run, with every differing verdict adjudicated before any old
code is deleted.

---

## 2. Scope and sequencing

Two halves, strictly ordered. The second cannot begin until the first is
published, because the adapter imports a symbol that does not exist yet.

### Half A — testimonium 0.3.0

1. **Export `toText`.** The origin's originality measure needs the source's
   extracted prose, and `check()` returns excerpts, never the document.
2. **`node.ts` and `curl.ts` warn before returning `EMPTY_RESPONSE`.**

Both are additive; neither moves a verdict. Minor bump.

### Half B — the origin cutover, one branch

- new `scripts/lib/issue-check.mjs` (the adapter)
- rewritten `scripts/bulletin-srccheck.mjs` (a thin CLI)
- the fixture corpus
- the record/replay reconciliation harness
- an instrumented `bulletin-srccheck.legacy.mjs`, kept for the reconciliation
  and deleted when it passes

**Nothing in `scripts/lib/source-fetch.mjs` is deleted by this project.**
`citation-check.mjs` still depends on most of its exports, and the cutover of
that script is project 3. (Precisely: after this project `curlText`'s export
becomes dead — its only consumers are srccheck and source-fetch's own
internals — but it is left in place regardless, because deleting anything from
that module is project 3's decision to make with project 3's evidence.) The
only code this project earns the right to delete is srccheck's own inline
ladder, and only after the reconciliation clears.

---

## 3. Capabilities dropped, named

### 3.1 `bloombergBody` — dropped, accepted

srccheck builds its Bloomberg haystack as
`${toText(body)} ${bloombergBody(body)}` — a JSON-state extractor that recovers
full article text from paywall-truncated pages (`source-fetch.mjs:86-97`).
**The package has no per-host body extractor at all**: `computeSignals` is
plain `toText(input.rawBody)` (`src/classify/signals.ts:148`), and the only
Bloomberg references in `src/` are a host rule and a challenge-signature note.

So this cutover drops a capability srccheck imports and exercises.

**Accepted, for a stated reason.** A publisher-specific body extractor was
considered and *declined* in `2026-09-11-testimonium-0-2-0-design.md` §7's
non-circumvention stance. That decline binds here. The practical cost is also
currently small: the origin's own header records bloomberg.com as hard-walled
since 2026-08-24, so on live URLs both arms hit the wall and the package's
challenge signature covers it — both land `unreachable`.

**What is genuinely lost**, and must not be discovered later as a surprise:
if the wall ever lifts, srccheck silently loses the ability to verify
Bloomberg citations that the origin could verify, and originality loses the
extracted body from its haystack too. §8.9 makes this a declared difference
class and §9A pins the fixture's expectation so the fixture author is not left
guessing.

### 3.2 `humainBody` / `isHumain` — not in scope, and the exposure is created, not inherited

Measured: `bulletin-srccheck.mjs` does not import them, and its import list
(`norm, toText, curlText, pdfText, uaFor, isPdf, isBbg, bloombergBody,
TIMEOUT_MS, isChallengePage`) does not include `fetchSourceText` either — the
script hand-rolls its own loop. The humain path lives inside `fetchSourceText`
(`source-fetch.mjs:397`, calls at `:421` and `:439`), which is
`citation-check.mjs`'s path. **srccheck never had humain handling, so this
cutover cannot lose it.**

**The exposure is not live in `citation-check.mjs` today.** `humainBody` is
what *closed* it there, in origin commit `cb4e366` (2026-09-11). The exposure
lives in **testimonium**, which has no humain extractor, and it *opens* at
project 3's cutover unless the extractor moves too.

Why it matters there: humain.com serves its prose inside a `blocks="…"` HTML
attribute, so an extractor sees only the page's visible chrome. Probed at 6,824
characters — over testimonium's 4,500 floor — which means it reads as an
ordinary readable document and a claim that is genuinely present returns
**`unsupported`: a false accusation**, the worst outcome the keystone rule
exists to prevent. (That character count is carried from the prior session's
probe and has not been re-measured here.)

Recorded so project 3 inherits it as a named requirement rather than
rediscovering it — alongside the same open question for `bloombergBody`.

### 3.3 Also out of scope

The `citation-check.mjs` cutover (project 3), the admin surface (project 4),
and any change to `bulletin-validate.mjs`.

---

## 4. testimonium 0.3.0 in detail

### 4.1 `toText` becomes public

Spec 5.3 is amended a second time. The public surface becomes `defaultFetcher`,
`norm`, `toText`, `THRESHOLDS`, `validateClaims`, `classifyRun` and the
existing types.

**The sealed set is restated:** `readSource`, `computeSignals`, `Read`, and
`SignalResult`. Earlier drafts of this spec also listed "the per-host body
extractors" — **there are none in the package**; the sealed per-host component
is the UA and host-rule machinery (`src/rules/hosts.ts`), which is what prior
specs meant by per-host *helpers*. The wrong wording is called out here because
it is probably what made §3.1's `bloombergBody` loss invisible in the first
draft.

The distinction that licenses this export is that `toText` is a pure
html-to-prose function — holding it lets nobody assemble a verdict, exactly as
`norm` already does. `readSource` and `computeSignals` stay sealed because
holding *those* does.

**Cost accepted:** `toText`'s output becomes a compatibility commitment. A
future extraction change is a breaking change. This is the same trade already
made for `norm`, taken again knowingly.

### 4.2 Two bundled rungs stop swallowing failures

`src/fetch/node.ts:24` and `src/fetch/curl.ts:62` each
`catch { return EMPTY_RESPONSE; }` with no diagnostic. Meanwhile
`src/fetch/read-source.ts:88` warns when a **third-party** fetcher throws,
citing ruling C12 — *"WARNED about rather than swallowed"* — and the comment
above it cites the bundled rungs as the well-behaved reference.

Not-throwing and not-diagnosing are different properties. These two rungs
satisfy the contract's letter while producing precisely the silently-vanishing
rung this codebase repeatedly names as its recurring failure shape.

**`pdf.ts` is already fixed** and is NOT part of this work. Its catch at `:49`
already warns (`warn pdf rung failed for ${url}: …`), landed in commit
`005330a` on 2026-09-11. An earlier draft of this spec claimed all three rungs
were silent and cited `pdf.ts:53` for it; that line does hold
`return EMPTY_RESPONSE;`, so the citation resolved while the behavioural claim
attached to it was false. **The new warns must match `pdf.ts`'s existing
message format**, which is also the model for the wording.

**Cost accepted:** a genuinely dead link now warns once per rung attempted, so
escalation makes that twice. Judged worth it — a bare `unreachable` cannot
distinguish a typo'd hostname from a timeout, and that distinction is the whole
diagnostic value of the line the origin prints today.

---

## 5. The adapter

```
checkIssue(issue, { fetcher, allowUnclaimed }) -> { items[], tally }
```

**`checkIssue` prints nothing.** Rendering belongs to the CLI. This is the
whole reason for the split: a fixture corpus that asserts against returned
objects is a regression test, whereas one that scrapes stdout is a smoke test.
It also gives project 3 something to reuse — building the adapter once here is
what prevents the second copy whose cost `source-fetch.mjs` already
demonstrates.

Each item carries:

- `verdict`
- **`reads[]` — one record per tee entry, `{ rung, status, bytes }`.** Not a
  single `status`/`bytes` pair: the origin prints a line *per rung*
  (`http 200  N bytes`, `retrying misses via curl (N bytes)`,
  `curl retry hit a challenge interstitial - NOT READ`,
  `pdf  N chars extracted via pdftotext`), and a single pair cannot produce
  them.
- `claims[]` of `{ text, tag, rung }`, `tag` being `ok` / `ok*` / `MISS`
- `firedRule` when a rule fired
- `originality: { words, run }`
- `structural` — see below

**A missing `source_url` is a distinct structural status, not a verdict.**
It must not be folded into `unreachable`: we did not fail to read a page, there
was no page named.

Two `RunTally` fields need saying explicitly, because `issue.json` has no
natural source for either. **`orphaned` is always 0** — every claim in an issue
belongs to exactly one item. **`infrastructure` is set by the pre-flight
failures in §7**, never by anything a source does: a source that cannot be
fetched is `unreachable`, a fact about availability rather than about our
machinery.

---

## 6. The tee, and what originality measures

The adapter constructs:

```
fetcher: tee(defaultFetcher({ hosts: loadRules().hosts, identity: SRCCHECK_IDENTITY }))
```

Supplying `CheckOptions.fetcher` short-circuits `buildFetcher`, so the adapter
constructs `defaultFetcher` itself — both are exported, so no ladder is
reimplemented anywhere.

**`identity` is load-bearing and must not be omitted.** `sec.gov` carries
`requiresIdentity: true` (`src/rules/hosts.ts:17-25`); with no identity
configured, `userAgentFor` warns and sends a browser UA, which sec.gov refuses.
The origin sends `SEC_UA = "omnisscientia-bulletin noahogbi@gmail.com"`
automatically (`source-fetch.mjs:44,49,52`). Without this line **every SEC
filing flips from `ok` to NOT READ** — including the canary's item 1, which is
an EDGAR exhibit. `SRCCHECK_IDENTITY` carries the origin's existing SEC_UA
value.

The adapter should also pass `source_label` through as
`CheckOptions.sourceLabel` — it feeds C1, which is reported and never gating,
so it costs nothing and keeps the provenance data at parity.

The tee is pass-through and records `{ url, rung, rawBody, status, bytes }`.
`RawResponse` carries `status` and `bytes`, and `Fetcher.fetch` receives the
rung, so every line in §5's `reads[]` is available — including the
content-type PDF re-route, which goes through the same fetcher.

**Originality measures per-read and takes the maximum, excluding vetoed
reads.** Not against a concatenation: joining reads lets an n-gram span the
seam and score a match present in neither source. The veto exclusion matters
because the origin never measures originality on a challenge page or an
unclaimed item — both `continue` before reaching it — so including wall bodies
would invent runs the origin never reports.

Extraction is per-rung: `norm(toText(rawBody))` for HTML rungs,
`norm(rawBody)` for `pdftotext`, whose body is already extracted text.

**This deliberately fixes a latent origin bug.** Today
`longestSharedRun(it.body, hay)` uses `hay` and never `curlHay`, so when node
returns a shell and curl returns the document, the drafter's prose is compared
against the shell. Originality is warning-only — it cannot move a verdict or an
exit code — so the change is low-risk in either direction.

Note that per-read-max would strictly dominate today's single-read measurement
*only under identical extraction*. It does not: §8.8's extraction drift and
§3.1's dropped Bloomberg haystack both break that premise, so the run can move
in either direction and §8.3 declares it accordingly.

---

## 7. Verdict mapping, exit codes, pre-flight

| verdict | rendered as |
| --- | --- |
| `supported` | `ok` / `ok*` per claim, rung from `evidence[].rung` |
| `unsupported` | `MISS` per entry in `missed`; matched claims still render `ok` |
| `unreachable` | the NOT READ line, plus `firedRule`'s note and `lastConfirmed` **when a rule fired** |
| `unclaimed` | `warn no _claims listed for this item` |
| (no `source_url`) | structural `FAIL`, not a verdict |

Three qualifications on that table:

- **`ok*` is a close reconstruction, not an exact one.** `dedupeEvidence`
  (`src/text/excerpt.ts:230-241`) merges overlapping excerpts across entries
  and keeps the first entry's rung, so a curl-located claim can render under a
  node rung when the two reads' excerpts overlap textually. Disclosed rather
  than fixed; it changes a `*` on rare items.
- **The commonest `unreachable` has no fired rule.** The sub-floor case —
  §8.1's own class — carries `firedRule: null`. The NOT READ line needs
  specified wording for the no-rule case rather than an empty parenthetical.
- **Keeping hits alongside misses on `unsupported`** is what 0.2.0's
  evidence-on-unsupported change makes possible. It is parity with the origin
  script, which already prints both; it is an improvement only relative to
  testimonium's own 0.1.0 CLI.

**Exit:** `classifyRun(tally, { unreachable: true, unclaimed: !allowUnclaimed })`.
`unreachable: true` restores today's behaviour, where a failed fetch fails the
gate. Exit 2 becomes available for infrastructure, which the origin currently
uses only for a missing argument.

**Structural failures must reach the exit code.** `RunTally` has no structural
field, and §5 correctly refuses to fold a missing `source_url` into either
`unreachable` or `infrastructure` — so the CLI must OR a structural-failure
flag into its exit, forcing 1. Without this, an issue whose only defect is a
missing `source_url` exits 0, where today it exits 1: a gate regression on
exactly the item shape the script's header says it exists for.

**Unclaimed items now fail by default, with `--allow-unclaimed` to override.**
Today an item with no `_claims` warns and passes, `bulletin-validate.mjs`
ignores `_claims` by design (`:20`, `:158`), and `bulletin-review.mjs` treats
them as already-verified input — so **no gate anywhere requires an item to
carry any claims at all**. That is the hole testimonium names as its top risk,
open in the origin today. The default moves to the safe side; the escape hatch
stays explicit so a mid-draft run still works when the drafter asks for it.

**Pre-flight runs `validateClaims` whole, before any network**, with every
offender named by item number, exit 2. Not just the 16-character floor: a
non-string `_claims` entry — a bare number in the JSON — throws at `check()`'s
door just as readily, and `validateClaims` already reports both `not-a-string`
and `below-floor`. Running the whole validator is what makes the pre-flight
complete rather than a guess at which failure will happen first.

Measured against `scripts/fixtures/bulletin-review-canary.json`: 3 items, 4
claims, shortest `norm(claim).length` of 32 — comfortably clear of 16. (32, not
the raw 38: the floor's predicate measures the normalized string, and "billion"
folds to "bn".) Real `issue.json` files are per-issue command-line arguments and
are not committed, so the true distribution is not measurable from the repo.
This specifies the behaviour rather than betting on the distribution.

---

## 8. Expected difference classes

Pre-declared so the reconciliation is a test and not a fishing expedition.
**Nine classes. Anything outside them is a defect until shown otherwise.**

An earlier draft declared five. Review falsified that by inspection, before any
reconciliation run: classes 6 through 9 below were all derivable from the code.
The count is pinned here because a list with no expected number under-delivers
silently.

**8.1 — Sub-floor partial matches.** The class to watch.
`isReadable` is `!isBlocked(s) && s.proseChars >= 4500`
(`classify/verdict.ts:105`).

| source | today | after |
| --- | --- | --- |
| short page, **all** claims match | all `ok` | `supported` — unchanged |
| short page, **not all** claims match (including none) | per-claim `ok` + `MISS` | **`unreachable`** |

A full match short-circuits at `matched === total` (`verdict.ts:111`) *before*
the floor is consulted on `:120`, and `assemble` overrides `matched` with the
cross-read union count — so a full match, including one assembled across two
sub-floor reads, lands `supported`. Only matches that are not total move.

Both still exit 1, so the gate fires either way. What changes is the drafter's
instruction: a partial match on a sub-4,500-character source stops naming which
claim missed and says the page could not be confirmed read. That is the
keystone rule working as designed — do not accuse from a page you cannot prove
you read — but the bulletin cites short press releases routinely, so **the
reconciliation must report how many items land here.** A large fraction is a
go/no-go signal requiring a threshold conversation before the cutover proceeds,
not something to absorb quietly.

**8.2 — Unclaimed items now fail.** Policy change, §7, approved.

**8.3 — Originality may report a different run.** §6, warning-only, and it can
move in either direction rather than only upward.

**8.4 — Fetch-error diagnostic text moves to a warn line.** §4.2.

**8.5 — Challenge detection may diverge** between testimonium's five vetoes and
the origin's `isChallengePage`, including the uncapped-tier asymmetry in §11.

**8.6 — The old arm gives up where the new arm climbs; exit can flip 1 → 0.**
On a node fetch error or a challenge interstitial the origin prints its line,
increments `problems` and `continue`s — curl is never tried. The package's
ladder climbs past both. A page that challenges node but serves curl the
document goes from exit 1 to `supported`, exit 0. Almost certainly an
improvement, but it is a gate answer changing and needs its own fixture.

**8.7 — The non-200 gate is dropped; exit can flip 1 → 0.** The origin fails
any non-2xx even when every claim then matches
(`if (!res.ok) { FAIL non-200; problems++ }`, and it still extracts and
matches afterwards). testimonium consults status exactly once, as
`documentGone: status === 404 || status === 410`
(`classify/signals.ts:181`). A 403 or 500 serving the full text — soft paywalls
do this — goes from exit 1 to exit 0. The `FAIL non-200` line also has no home
in §7's table; either it is reproduced from `reads[]` or its loss is accepted
here explicitly.

**8.8 — Matcher and extraction drift**, in *both* directions on identical
bytes:

- `norm`: testimonium strips U+00AD and has punctuation-space clauses
  (`normalize.ts:24,46-47`); the origin has neither
  (`source-fetch.mjs:231`). Adds matches — the safe direction.
- `toText` entities: the origin decodes `&mdash;` to `--`
  (`source-fetch.mjs:66`); testimonium decodes to an em dash, which `norm`
  folds to a single `-`. A claim written against the origin's `--` rendering
  MISSes under testimonium — **the unsafe direction.** Testimonium also decodes
  a much larger entity table.
- Headers: srccheck's inline node fetch sends no `Accept` header; the package's
  node rung does (`src/fetch/node.ts`). Same URL, potentially different body.
- `isPdf`: the origin tests the whole URL for `\.pdf($|\?)`
  (`source-fetch.mjs:188`); testimonium tests the path only and adds a `/pdf/`
  segment rule. A `?u=/pdf/` redirector takes the HTML path in one and the PDF
  rung in the other.
- **PDF text through `toText`:** `computeSignals` runs *every* rawBody through
  `toText` (`signals.ts:148`), whose tag strip eats spans like
  `x < 5 and y > 3` out of extracted PDF text, which the origin matches raw. A
  claim quoting an inequality from a filing can match in the origin and MISS in
  the package. (§6 gets this right for originality by using `norm(rawBody)` for
  pdftotext — the hazard was understood on one path and missed on the other.)

**8.9 — Bloomberg citations lose the JSON-state haystack.** §3.1. Currently
masked by the live wall; a declared class so that a pre-wall body in the
fixture corpus has a stated expectation.

---

## 9. The two reconciliation instruments

### A — fixture corpus

**New arm only**, driven by a stub `Fetcher` returning canned `RawResponse`
values. No network, deterministic, permanent. Its job is durable regression
protection, not parity — which is what lets it sidestep the problem that the
old arm cannot take a stub fetcher and that a local server would break host
rules keyed off hostname.

**Fourteen shapes**, each with a stated expectation rather than just a name:

1. challenge interstitial → `unreachable`
2. node-shell paired with curl-document → escalation, `supported`
3. PDF → matched against raw extracted text
4. Bloomberg **pre-wall body** → claims MISS without `bloombergBody`, pinning §8.9
5. Bloomberg **wall body** → `unreachable` via the challenge signature
6. 404 → `unreachable` via `documentGone`
7. 403 serving full text → `supported`, pinning the §8.7 flip
8. fetch failure at `status: 0` → `unreachable`
9. unclaimed item → fails by default, passes under `--allow-unclaimed`
10. sub-16-character claim → pre-flight exit 2
11. non-string `_claims` entry → pre-flight exit 2
12. missing `source_url` → structural FAIL, **exit 1**, pinning §7
13. originality run of 8+ words, and a run excluded because it falls inside
    quotation marks
14. **sub-floor partial match** → `unreachable`, pinning §8.1

### B — record and replay

The first draft had both arms fetch live and compared a SHA-256 per
`(url, rung)`. That does not work: modern news pages embed per-request nonces
and rotating modules, so raw bodies differ on *every* fetch for many hosts —
those items re-run forever and criterion 4 never clears, or the operator tires
and adjudicates on mismatched hashes, which is exactly what the hashing existed
to prevent.

**The stub belongs on the new arm, which can take one.** The old arm's
inability to take a fetcher blocks stubbing *it*, not the comparison:

1. Instrument `bulletin-srccheck.legacy.mjs` to **record** `(url, rung,
   rawBody, status)` for every fetch it makes, and run it on the real drafts.
2. Run `checkIssue` with a **replay** `CheckOptions.fetcher` serving those exact
   bytes.

Byte equality then holds by construction, so **every difference is
behavioural** and files against one of §8's nine classes or is a defect. A rung
the legacy arm never fetched replays as `EMPTY_RESPONSE` and lands in the
"attempted by one arm only" finding bucket — which is a finding, not a
mismatch, and is expected wherever §8.6 fires.

The original is not edited; the legacy copy carries the instrumentation and is
deleted when the reconciliation clears.

**Risk to name:** real `issue.json` files are ephemeral. If none exist in the
working directory, instrument B has nothing to run on and the cutover cannot
clear its bar. The executing session must confirm the corpus exists **before**
starting Half B.

---

## 10. Acceptance criteria

1. testimonium 0.3.0 published with `toText` exported and `node.ts`/`curl.ts`
   warning in `pdf.ts`'s message format; suite green; `npm pack` contents
   unchanged in shape.
2. `checkIssue` returns structured results, including per-read `reads[]`, and
   prints nothing.
3. The fixture corpus covers all fourteen shapes in §9A with their stated
   expectations, and passes.
4. Instrument B runs record/replay on a non-empty corpus of real drafts, and
   every behavioural difference is adjudicated in writing against §8's nine
   classes.
5. The count of items landing in §8.1 is reported explicitly, with a go/no-go
   call recorded.
6. A sec.gov citation resolves `supported` end to end, proving the identity
   wire of §6.
7. `bulletin-srccheck.mjs` no longer contains a fetch ladder, a challenge check
   or a curl retry.
8. `source-fetch.mjs` is unchanged.
9. `bulletin-srccheck.legacy.mjs` is deleted only after (4) and (5) clear.

---

## 11. Open questions and recorded asymmetries

**The uncapped wall-signature tier is inexpressible in the package.** Recorded
as found rather than left for the reconciliation to trip over. The origin has
two tiers: `UNAMBIGUOUS_WALL_SIGNATURES` fire with **no length cap**, added for
the roughly 1,180-character eCFR/FederalRegister wall served at HTTP 200. The
package's N3 is conjoined with `proseChars < maxChallengeChars` (800), and a
local rule cannot lift that conjunction. Below 4,500 characters the floor
converges the two — today's real cases land `unreachable` either way — but a
wall carrying those phrases padded past 4,500 reads as a document and returns
**`unsupported`**, a false accusation the origin catches and the package
cannot. This is the package's documented padded-wall gap meeting a host family
known to serve walls at scale.

**How many bulletin sources are sub-floor?** Unmeasurable from the repo;
answered by instrument B. Drives §8.1's go/no-go.

**Does `isChallengePage` catch anything the five vetoes miss, beyond the
uncapped tier above?** Deferred to the reconciliation. Note the deferral is
*not* because the origin's rules are newer — measured, testimonium's
`challenge.ts` was edited later (2026-09-11 23:20) than `source-fetch.mjs`
(22:03), and the four JS-shell signatures were resynced *from* the origin. It
is deferred because signature-by-signature equivalence is not decidable by
reading two regex lists.

---

## 12. What review changed

Fable reviewed the first draft against both codebases. Findings folded in:

| finding | change |
| --- | --- |
| `bloombergBody` dropped, unnamed | new §3.1 — named, accepted, with the §7 decline as its licence and §8.9 as its class |
| sec.gov identity unwired | §6 — `identity` is now specified and load-bearing; new criterion 6 |
| §8's five classes falsified by inspection | §8 — nine classes, count pinned; 8.6–8.9 added |
| `pdf.ts` already warns | §4.2 — Half A is two rungs, not three; the false claim is recorded rather than quietly dropped |
| missing `source_url` exits 0 | §7 — structural flag ORs into the exit; §9A shape 12 pins it |
| humain exposure located backwards | §3.2 — the exposure is *created* by project 3, not inherited from citation-check |
| byte-pinning cannot converge on dynamic pages | §9B — record/replay replaces live hash comparison |
| §4.1 sealed a component that does not exist | §4.1 — corrected, with a note that the error likely caused the §3.1 blind spot |
| item shape cannot render per-rung lines | §5 — `reads[]` replaces a single status/bytes pair |
| `ok*` not exact; no-rule `unreachable` wording | §7 — both disclosed |
| originality would measure wall bodies | §6 — vetoed reads excluded; the "strictly dominates" claim withdrawn |
| pre-flight incomplete | §7 — runs `validateClaims` whole, not just the floor |
| canary claim length measured with the wrong ruler | §7 — 32 normalized, not 38 raw |
| §2 `curlText` claim overbroad | §2 — corrected, with the reason nothing is deleted anyway |
| §11 deferral rationale stale | §11 — corrected, deferral re-justified |
| `sourceLabel` not passed | §6 — added |

Verified correct and now load-bearing: the `verdict()` short-circuit order, the
`assemble()` union override including the cross-read sub-floor path, §3.2's
import list and line citations, the `buildFetcher` short-circuit, the tee's
feasibility including the content-type PDF re-route, every field in §7's table,
the exit mapping, `bulletin-validate.mjs:20`/`:158`, the `hay`-never-`curlHay`
originality bug, §9A's stub-fetcher premises, and timeout parity.
