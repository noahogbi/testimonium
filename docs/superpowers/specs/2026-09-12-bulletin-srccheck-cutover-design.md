# bulletin-srccheck cutover — design

**Status:** draft, pending review
**Date:** 2026-09-12
**Project:** 2 of 4 in the testimonium cutover, scoped in
`2026-09-11-testimonium-0-2-0-design.md` §10.
**Spans two repositories.** testimonium (public, this repo) ships a package
change; omnisscientia (private origin) consumes it. **omnisscientia is
read-only from the authoring session** — it is designed and specced here and
executed by the session that owns that repo.

---

## 1. What this is

`scripts/bulletin-srccheck.mjs` in the origin repo answers one question per
bulletin item: does the cited URL actually carry the claims the item rests on?
It hand-rolls a fetch ladder, a challenge-page check, a curl retry, a
phrase matcher and an originality measure. testimonium was extracted from that
code. This project moves the script onto the extracted package, so that one
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
2. **The three bundled rungs warn before returning `EMPTY_RESPONSE`.**

Both are additive; neither moves a verdict. Minor bump.

### Half B — the origin cutover, one branch

- new `scripts/lib/issue-check.mjs` (the adapter)
- rewritten `scripts/bulletin-srccheck.mjs` (a thin CLI)
- the fixture corpus
- the byte-pinned reconciliation harness
- an instrumented `bulletin-srccheck.legacy.mjs`, kept for the reconciliation
  and deleted when it passes

**Nothing in `scripts/lib/source-fetch.mjs` is deleted by this project.**
`citation-check.mjs` still depends on every one of its exports. The only code
this project earns the right to delete is srccheck's own inline ladder, and
only after the reconciliation clears.

---

## 3. Explicitly out of scope

Recorded so a later reader does not mistake silence for oversight.

**`humainBody` / `isHumain` are untouched.** Measured this session:
`bulletin-srccheck.mjs` does not import them, and its import list
(`norm, toText, curlText, pdfText, uaFor, isPdf, isBbg, bloombergBody,
TIMEOUT_MS, isChallengePage`) does not include `fetchSourceText` either — the
script hand-rolls its own loop. The humain path lives inside `fetchSourceText`
(`source-fetch.mjs:397`, calls at `:421` and `:439`), which is
`citation-check.mjs`'s path. srccheck never had humain handling, so this
cutover cannot lose it.

This matters beyond bookkeeping: humain.com serves its prose inside a
`blocks="…"` HTML attribute, so the page's visible chrome is what an extractor
sees. Probed at 6,824 characters — over the 4,500 floor — which means it reads
as an ordinary readable document and a claim that is genuinely present returns
**`unsupported`: a false accusation**, the worst outcome the keystone rule
exists to prevent. That exposure is real, it is live in `citation-check.mjs`
today, and it stays open until project 3. It is named here so project 3
inherits it as a known requirement rather than rediscovering it.

Also out of scope: the `citation-check.mjs` cutover (project 3), the admin
surface (project 4), and any change to `bulletin-validate.mjs`.

---

## 4. testimonium 0.3.0 in detail

### 4.1 `toText` becomes public

Spec 5.3 is amended a second time. The public surface becomes
`defaultFetcher`, `norm`, `toText`, `THRESHOLDS`, `validateClaims`,
`classifyRun` and the existing types.

**The sealed set is restated, unchanged in substance:** `readSource`,
`computeSignals`, `Read`, `SignalResult`, and the per-host body extractors.
The distinction that licenses this export is that `toText` is a pure
html-to-prose function — holding it lets nobody assemble a verdict, exactly as
`norm` already does. `readSource` and `computeSignals` stay sealed because
holding *those* does.

**Cost accepted:** `toText`'s output becomes a compatibility commitment. A
future extraction change is a breaking change. This is the same trade already
made for `norm`, taken again knowingly.

### 4.2 The bundled rungs stop swallowing failures

`src/fetch/node.ts:25`, `src/fetch/curl.ts:63` and `src/fetch/pdf.ts:53` each
`catch { return EMPTY_RESPONSE; }` with no diagnostic. Meanwhile
`src/fetch/read-source.ts:88` warns when a **third-party** fetcher throws,
citing ruling C12 — *"WARNED about rather than swallowed"*. The package holds
other people's fetchers to a standard it does not hold its own to, and the
comment immediately above that warn cites the bundled rungs as the
well-behaved reference.

Not-throwing and not-diagnosing are different properties. The rungs satisfy
the contract's letter while producing precisely the silently-vanishing rung
this codebase repeatedly names as its recurring failure shape.

**Change:** each of the three warns with the rung, the url and the error
message before returning `EMPTY_RESPONSE`. No interface change, no verdict
moves.

**Cost accepted:** a genuinely dead link now warns once per rung attempted,
so escalation makes that twice. Judged worth it — a bare `unreachable` cannot
distinguish a typo'd hostname from a timeout, and that distinction is the
whole diagnostic value of the line the origin prints today.

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

Each item carries: `verdict`, `status` and `bytes` (from the tee), a `claims[]`
of `{ text, tag, rung }` where `tag` is `ok` / `ok*` / `MISS`, `firedRule` when
a rule fired, and `originality: { words, run }`. The run-level `tally` is
shaped for `classifyRun`.

Two `RunTally` fields need saying explicitly, because `issue.json` has no
natural source for either. **`orphaned` is always 0** — every claim in an
issue belongs to exactly one item, so the orphaned-claim concept the claims
file format carries has no counterpart here. **`infrastructure` is set by the
pre-flight failures in §7** (a sub-16-character claim, unreadable input), never
by anything a source does: a source that cannot be fetched is `unreachable`,
which is a fact about availability, not about our machinery.

**A missing `source_url` is a distinct structural status, not a verdict.**
Today it is `FAIL no source_url` and `continue`. It must not be folded into
`unreachable`: we did not fail to read a page, there was no page named.

---

## 6. The tee, and what originality measures

The adapter passes `fetcher: tee(defaultFetcher({ hosts }))` into `check()`.
Supplying `CheckOptions.fetcher` short-circuits `buildFetcher`, so the adapter
constructs `defaultFetcher` itself — both are exported, so no ladder is
reimplemented anywhere. The tee is pass-through and records
`{ url, rung, rawBody, status, bytes }`. `RawResponse` carries `status` and
`bytes`, which is where the existing `http 200  12345 bytes` line comes from.

**Originality measures per-read and takes the maximum.** Not against a
concatenation: joining reads lets an n-gram span the seam and score a match
present in neither source. `longestSharedRun` run against each read separately,
keeping the longest, is equally sensitive with no boundary artifact.

Extraction is per-rung: `norm(toText(rawBody))` for HTML rungs,
`norm(rawBody)` for `pdftotext`, whose body is already extracted text.

**This deliberately fixes a latent origin bug.** Today
`longestSharedRun(it.body, hay)` uses `hay` and never `curlHay`, so when node
returns a shell and curl returns the document, the drafter's prose is compared
against the shell. Per-read-max can only find a longer run than today, never a
shorter one, and originality is warning-only — it cannot move a verdict or an
exit code — so the change costs at most one extra reword suggestion.

---

## 7. Verdict mapping, exit codes, pre-flight

| verdict | rendered as |
| --- | --- |
| `supported` | `ok` / `ok*` per claim, rung from `evidence[].rung` |
| `unsupported` | `MISS` per entry in `missed`; matched claims still render `ok` |
| `unreachable` | the existing NOT READ line, plus `firedRule`'s note and `lastConfirmed` |
| `unclaimed` | `warn no _claims listed for this item` |
| (no `source_url`) | structural `FAIL`, not a verdict |

`unsupported` rendering is **better than today**: a 4-of-5 item currently shows
its misses without its hits, because 0.1.0 kept no evidence on `unsupported`.
0.2.0 changed that and this surfaces it.

**Exit:** `classifyRun(tally, { unreachable: true, unclaimed: !allowUnclaimed })`.
`unreachable: true` restores today's behaviour, where a failed fetch fails the
gate. Exit 2 becomes available for infrastructure, which the origin currently
uses only for a missing argument.

**Unclaimed items now fail by default, with `--allow-unclaimed` to override.**
Today an item with no `_claims` warns and passes, and `bulletin-validate.mjs`
ignores `_claims` by design (`:20`, `:158`) — so **no gate anywhere requires an
item to carry any claims at all**. That is the hole testimonium names as its
top risk, open in the origin today. The default moves to the safe side; the
escape hatch stays explicit so a mid-draft run still works when the drafter
asks for it.

**Sub-16-character claims are caught pre-flight, before any network**, with
every offender named by item number, exit 2. Under testimonium they would
otherwise throw at `check()`'s door mid-run, after fetches have been paid for.
Measured against `scripts/fixtures/bulletin-review-canary.json`: 3 items, 4
claims, shortest 38 characters — comfortably clear. But real `issue.json` files
are per-issue command-line arguments and are not committed, so the true
distribution is not measurable from the repo. This specifies the behaviour
rather than betting on the distribution.

---

## 8. Expected difference classes

Pre-declared so the reconciliation is a test and not a fishing expedition.
**Anything outside these five is a defect until shown otherwise.**

1. **Sub-floor partial matches.** The largest class, and the one to watch.
   `isReadable` is `!isBlocked(s) && s.proseChars >= 4500`
   (`classify/verdict.ts:105`).

   | source | today | after |
   | --- | --- | --- |
   | short page, **all** claims match | all `ok` | `supported` — unchanged |
   | short page, **some** claims match | per-claim `ok` + `MISS` | **`unreachable`** |

   A full match short-circuits at `matched === total` (`verdict.ts:111`)
   *before* the floor is consulted on `:120`, and `assemble` overrides `matched`
   with the cross-read union count — so a full match, including one assembled
   across two sub-floor reads, lands `supported`. Only partial matches on
   sub-floor sources move.

   Both still exit 1, so the gate fires either way. What changes is the
   drafter's instruction: a partial match on a sub-4,500-character source stops
   naming which claim missed and says the page could not be confirmed read.
   That is the keystone rule working as designed — do not accuse from a page you
   cannot prove you read — but the bulletin cites short press releases
   routinely, so **the reconciliation must report how many items land here.**
   A large fraction would be a go/no-go signal requiring a threshold
   conversation before the cutover proceeds, not something to absorb quietly.

2. **Unclaimed items now fail.** Policy change, §7, approved.
3. **Originality may report a longer run.** §6, warning-only.
4. **Fetch-error text moves to a warn line.** §4.2.
5. **Challenge detection may diverge** between testimonium's five vetoes and
   the origin's `isChallengePage`.

---

## 9. The two reconciliation instruments

They have different jobs. This resolves a problem that surfaced while
specifying them: the old arm calls global `fetch` and `curlText` directly, so
it cannot take a stub fetcher, and pointing both arms at a local server would
break the host rules that key off hostname (`isBbg`).

### A — fixture corpus

**New arm only**, driven by a stub `Fetcher` returning canned `RawResponse`
values. No network, deterministic, permanent. Its job is durable regression
protection, not parity — which is what lets it sidestep the hostname problem
entirely.

Shapes: challenge interstitial; node-shell paired with curl-document
(escalation); PDF; Bloomberg; 404; fetch failure at `status: 0`; unclaimed
item; sub-16-character claim; missing `source_url`; an originality run of 8+
words; a run excluded because it falls inside quotation marks; and **a
sub-floor partial match**, pinning §8.1 so it can never change silently.

### B — byte-pinned reconciliation

**Both arms, on whatever real untracked drafts exist in the working
directory.** Both log a SHA-256 per `(url, rung)`.

- matching hash, differing output ⇒ **behavioural**, adjudicate
- differing hash ⇒ **drift**, re-run
- a rung one arm attempted and the other did not ⇒ a finding, not a mismatch

Hashing is what makes drift detectable rather than assumed. Without it a source
that changes between the two runs reads as a behaviour change — and worse in
the other direction, a real regression can be waved off as drift, which is the
failure this whole project exists to prevent.

The old arm is instrumented as a copy, `bulletin-srccheck.legacy.mjs`, so the
original is not edited before the cutover lands.

**Risk to name:** real `issue.json` files are ephemeral. If none exist in the
working directory when the reconciliation runs, instrument B has nothing to run
on and the cutover cannot clear its bar. The executing session must confirm the
corpus exists **before** starting Half B.

---

## 10. Acceptance criteria

1. testimonium 0.3.0 published with `toText` exported and the three rungs
   warning; suite green; `npm pack` contents unchanged in shape.
2. `checkIssue` returns structured results and prints nothing.
3. The fixture corpus covers all twelve shapes in §9A and passes.
4. Instrument B runs on a non-empty corpus of real drafts, and every
   behavioural difference is adjudicated in writing against §8.
5. The count of items landing in §8.1 is reported explicitly, with a
   go/no-go call recorded.
6. `bulletin-srccheck.mjs` no longer contains a fetch ladder, a challenge
   check or a curl retry.
7. `source-fetch.mjs` is unchanged.
8. `bulletin-srccheck.legacy.mjs` is deleted only after (4) and (5) clear.

---

## 11. Open questions

- **How many bulletin sources are sub-floor?** Unmeasurable from the repo;
  answered by instrument B. Drives §8.1's go/no-go.
- **Does the origin's `isChallengePage` catch anything testimonium's five
  vetoes miss?** Deferred to the reconciliation rather than settled by
  inspection, because the origin's rule set has been edited more recently than
  the extraction.
