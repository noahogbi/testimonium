# citation-check cutover — design

**Status:** draft, amended after review
**Date:** 2026-09-15 (amended 2026-09-16)
**Project:** 3 of 4 in the testimonium cutover.
**Spans two repositories.** testimonium ships a package change; omnisscientia
consumes it. **omnisscientia is read-only from the authoring session.**

**§14 records what review changed.** The first draft was wrong about what the
origin does today, in both directions. Read §14 before trusting any memory of it.

---

## 1. What this is, and why it is not project 2 again

`scripts/citation-check.mjs` verifies that each footnote's cited URL carries that
footnote's recorded claims, and **writes the result into `post_citations`**.
srccheck returned an exit code; this writes a stored row.

**Only `supported` renders to readers** — `inject-evidence.ts:76`,
`if (!row || row.status !== "supported") return whole;`, and even a `supported`
row with no locatable excerpt renders nothing (`:84`). The schema enforces the
vocabulary: `status in ('unverified','supported','unsupported','unreachable',
'not_applicable')` (`109_post_citations.sql:43-44`).

So the risk is asymmetric:

- A wrong **`supported`** publishes a passage to readers under a claim that is
  not supported.
- Every other wrong status renders nothing. It costs the author a passage and
  fails the gate. Recoverable.

**The inviolable property: never write `supported` wrongly.** §12.6 states it
operationally — note that it forbids *unadjudicated* gains, not gains.

---

## 2. Scope and sequencing

### Half A — testimonium 0.5.0

`toText` learns text carried in `description`, `og:description` and
`twitter:description` attributes, plus a verdict-movement report. §3.

**Semver: minor.** Not because the output is committed — the repo's own doctrine
(`normalize.ts:7-11`) says changing committed output is *breaking*, which argues
the other way. It is minor because under 0.x caret ranges `^0.4.0` excludes
0.5.0, so no consumer picks this up without choosing to.

### Half B — the origin cutover, one branch

1. Extract the shared fetcher/tee core from `scripts/lib/issue-check.mjs` (§5).
2. Move `humainBody` behind a `CheckOptions.fetcher` (§4).
3. Build `scripts/lib/post-check.mjs` (§6).
4. Rewrite `citation-check.mjs` as a thin CLI.
5. Dry-run reconciliation over every post with stored citation rows (§10).

### Out of scope

`bloombergBody` stays declined under 0.2.0 §7 — it defeats paywall truncation,
which is the circumvention that decline was written for. Project 4 untouched.
`source-fetch.mjs`'s dead exports go only after the reconciliation clears.

---

## 3. Half A: description-borne text

### 3.1 What it fixes, and what it does not

**It fixes the truthsocial shape.** A post whose text lives in
`<meta name="description">`, `og:description` and `twitter:description`, whose
rendered body strips to 81 characters. Measured 2026-09-15: 755 extracted prose
chars, 0 of 4 claims matched, `unreachable`.

**It does NOT fix humain.com, and the first draft of this spec said it did.**
humain's article text is HTML-entity-encoded JSON in `blocks="…"` and
`cards="…"` attributes (`source-fetch.mjs:99-155`) — `richText` and `quote`
nodes from release *bodies*. A description attribute is a one- or two-sentence
summary. They are different attributes carrying different text, and the claims
the origin measured on 2026-09-07 quote the bodies. §4 handles humain.

### 3.2 Why a general fix rather than a per-host extractor

It names no publisher, reads bytes the server already returned in full — the
same text any link preview renders — and closes the shape wherever it occurs.
Nothing is circumvented, which is why 0.2.0 §7's decline does not bind: that
decline was written against defeating a paywall's truncation, and
`bloombergBody` stays declined for exactly that reason.

### 3.3 The parse, constrained now rather than discovered later

- `og:description` uses `property=`, not `name=`. Both spellings must match.
- **Attribute order varies.** `content` before `name`/`property` occurs in the
  wild, and this codebase already hard-codes one order elsewhere
  (`signals.ts:42`'s `HEAD_MARKER`). Do not assume order.
- Single and double quotes both occur; entities inside `content` must decode.
- **The three tags usually carry the same sentence.** Deduplicate before
  appending, or one description counts three times toward the prose floor and
  three times toward srccheck's originality haystack.
- **Append, never prepend.** `excerptFor` takes the first match
  (`excerpt.mjs` `indexOf`), so description text placed before the body would
  win against body text and silently change the rendered passage on rows that
  are already `supported`. Legal under §11's excerpt class, but gratuitous.

### 3.4 What it moves, measured

`toText` discards attributes wholesale at `extract.ts:81`, and `proseVolume` is
plain length, so **this fix can only raise prose, never lower it.**

Measured across the fixture tree: **8 gain description text; none crosses the
4,500 floor, and none crosses the 800 signature cap.** The smallest gaining
document was already at 6,394.

State the population precisely: 37 *files* (27 challenge + 10 document), against
`corpus.json`'s 36 *rows* — the ECB file appears twice, once as a known-gap row.

**Correction carried from review:** an earlier draft said the one gaining
challenge fixture was "vetoed by signature, so its +235 is inert." Wrong veto.
It matches no signature at all, and the signature veto is structurally
impossible there anyway (`challengeSignature` requires prose < 800; the fixture
is 13,216). At status 404 its only veto is N4; under its known-gap row at 200,
**nothing vetoes it.** The conclusion survives; the explanation was the
firedRule-is-not-a-veto confusion `check.ts:54-67` explicitly warns about.

### 3.5 The movement report watches TWO thresholds

**The 4,500 floor.** A challenge page whose description pushes it over becomes a
readable document and returns `unsupported` — a manufactured accusation. This is
the report's primary question.

**The 800 signature cap.** A description pushing a signature-matching shell past
800 chars disarms N3. The verdict stays floor-protected below 4,500, but that
read's matches still enter `check()`'s cross-rung union — which is a path to
`supported` from a shell's description. That is the truthsocial mechanism
working as intended, and it must be stated as a mechanism rather than
discovered.

Run it against the 618-URL bulletin corpus (the 2026-09-13 harness). That is the
right population for the floor question and for §3.6, though **the posts-with-
stored-rows set is this project's true population** — §10 measures there.

### 3.6 A consequence in a gate shipped five days ago

`toText` is what srccheck's originality measure uses. Adding description text
means originality also compares the drafter's prose against descriptions, which
often duplicate the lede. Warning-only, cannot move a verdict or an exit code,
but real — and the deduplication in §3.3 matters here too.

---

## 4. humain: the origin keeps its own reader

`humainBody` moves behind `CheckOptions.fetcher`.

### 4.1 It is a DECORATOR, not a terminal fetcher — and this is load-bearing

`CheckOptions.fetcher` is a **single slot** (`check.ts:20`), and this project has
**two** claimants for it: humain extraction, and §10's replay fetcher. Wired
naively — replay in the slot, extraction forgotten — the replay serves raw humain
chrome, testimonium reads 6,824 characters of it, every claim misses on a
readable page, and **the reconciliation instrument manufactures a
supported-to-unsupported movement on every humain row.** Criterion 7 would then
fail on wiring rather than on behaviour, and the failure would look exactly like
a real regression.

So the extraction **wraps an inner fetcher** rather than replacing one:

```
extraction( tee( defaultFetcher(...) ) )     // live
extraction( tee( replayFetcher(...) ) )      // reconciliation
```

Tee inside, extraction outside: the tee records what the network or the replay
returned, and the extraction transforms it on the way to the classifier in both
arms identically.

### 4.2 Four details that silently move verdicts if omitted

1. **Apply per rung.** Extraction runs on whichever rung returned the bytes. A
   node read and a curl read of the same humain page must both be transformed, or
   `check()`'s cross-rung union sees one transformed body and one raw.
2. **Fall back on empty.** `humainBody` returns `""` when no attribute parses
   (`source-fetch.mjs:421`), and the origin then falls back to `toText`. The
   decorator must do the same: an empty extraction returns the body untouched,
   never an empty one.
3. **Pass `status`, `headers` and `finalUrl` through unchanged.** They drive N1,
   N2 and `documentGone`. A decorator that rebuilds a `RawResponse` and drops
   them disarms three vetoes.
4. **Only transform humain hosts.** `isHumain` gates it; every other host passes
   through untouched.

**Why here and not in the package.** humain's shape is JSON-in-an-attribute, and
a general rule for that — decode entities in any attribute, parse JSON, extract
string leaves — would also ingest analytics payloads, feature flags and config
blobs. That inflates prose and can make a claim match text that is not the
article: a false `supported`, the one outcome §1 forbids. The bring-your-own-
reader seam exists for exactly this.

**The stakes are measured, not hypothetical.** `source-fetch.mjs:107-111`:
without it, ten footnotes citing humain.com reported UNSUPPORTED against pages
that plainly carry the quoted sentences. Dropping it writes ten false
accusations.

**Acceptance, stated in the direction that is achievable.** No humain row may
move **out of `supported`**. That half holds by construction: testimonium's
`norm` is a strict superset of the origin's folds, so a claim the origin matched
in extracted humain text is matched by testimonium in the same text.

Movement in other directions is legitimate and must not fail the cutover — a
humain row that is `unreachable` or `unsupported` today can move under the
inherited classes (the prose floor, matcher drift) like any other row. An
earlier draft said "if any moves, the fetcher is wrong", which would have failed
a correct cutover.

---

## 5. The shared core

One module owning the **tee fetcher**, the **`defaultFetcher({ hosts, identity })`
construction**, and **which rung located each claim**. Both adapters call it.

**The fixture corpus cannot prove this safe, and the first draft claimed it
could.** Every one of project 2's fourteen shapes injects a stub fetcher, and
`bulletin-srccheck.mjs:148` passes its own `defaultFetcher` — so the
`opts.fetcher ?? defaultFetcher(...)` fallback at `issue-check.mjs:144-149` is
exercised by neither the tests nor production. A refactor that breaks the
identity wiring re-runs the corpus green.

**So the construction gets pinned directly** (§12.2): assert the constructed
fetcher resolves sec.gov's UA to the declared identity and consults
`loadRules().hosts`, and assert the CLI and the shared core make the same call.

---

## 6. The adapter

```
checkPost(post, rows, opts) -> { footnotes[], tally }
```

**`checkPost` writes nothing.** The CLI owns the database. Per footnote it
returns the intended patch — `status`, `evidence`, `fetch_recipe`,
`retrieved_at` — plus the pre-check outcome where one applies.

That separation is what makes §10 cheap: comparing intended patches needs no
database.

---

## 7. Status mapping

| testimonium verdict | stored status | renders? |
| --- | --- | --- |
| `supported` | `supported` | **yes** |
| `unsupported` | `unsupported` | no |
| `unreachable` | `unreachable` | no |
| `unclaimed` | `unverified` | no |
| *(pre-check)* | `not_applicable` | no |

### 7.1 What the origin actually does today

The rule at `citation-check.mjs:191` is
`if (!res.http2xx && evidence.length === 0) status = "unreachable"`.

**But `res.http2xx` is not raw status.** It is laundered through
`classify2xxBody` (`source-fetch.mjs:344-354`), which already sets
`http2xx: false` at 2xx for signature walls under 800 chars, **unambiguous walls
at any length**, and zero-text shells over 1,000 bytes. So JS shells and most
consent walls are already `unreachable` today, and humain is caught by
`humainBody`.

**The residual population is narrow:** 200s whose extracted text is non-empty,
carries no signature, and is sub-floor-sized chrome. The first draft called this
"the second defect this cutover repairs" and expected it to be the largest
class. That overstated it — the repair is the prose floor's, and its size comes
from the sub-floor rate, not from the rule's weakness.

**And the rule fails in the other direction too, which the first draft missed.**
Every non-2xx goes to `unreachable` regardless of body. testimonium consults
status only for 404/410, so a fat 403 block page whose text clears the floor and
misses the claims moves `unreachable` → **`unsupported`**: a new accusation
route. §11.7b.

### 7.2 One behaviour must survive exactly

On `unreachable` the patch is exactly `{ status, fetch_recipe }` — no
`evidence`, no `retrieved_at` (`:195-203`). `merge-duplicates` would otherwise
keep a stale date while blanking excerpts, leaving a reader "Read <date>" with no
passage under a claim that was fine. A **partial** patch.

### 7.3 Evidence shape

`CitationEvidence` is `{ claims: string[]; excerpt: string | null; method }`;
testimonium's `Evidence` is `{ claims; excerpt; rung }`. Structurally identical
but for the field name. Both excerpt implementations enforce the same contract at
their returns — a non-null excerpt contains its own claim, else null
(`excerpt.mjs:154,190`; `src/text/excerpt.ts:174,208`) — and both dedupes
preserve it.

**The VALUE vocabulary differs and must be mapped** — see §10.2.

---

## 8. Origin-only behaviours, all of which stay

**`moved`.** A stored row's URL differing from the footnote's current URL means
renumbering: the claims belong to another source and could even pass against it.
Pre-fetch, writes nothing, fails the run (`:127-133`).

**`not_applicable` has TWO paths, and the first draft named only one.**

1. **Author-set** (`:119-122`) — respected, no write, `check()` never sees it.
2. **Internal links** (`:135-139`) — `parseFootnotes` returns `url: null` for
   them (`footnotes.mjs:20-24`), and the gate **auto-writes**
   `{ status: "not_applicable", evidence: [] }`.

Losing the second regresses the gate on an ordinary post shape: an internal link
would fall through to the unclaimed branch, write `unverified`, and **fail the
run** without `--allow-unclaimed`.

**The branch order is part of the contract:** author-set → moved → internal-link
→ unclaimed → check.

**The `unclaimed` write must not be optimised away.** A footnote with no claims
writes an `unverified` row. Skipping it let a partially-gated post report "6 of 6
sources supported" across nine footnotes on 2026-09-12, because the checklist
rolls up rows that exist.

**The exit rule differs from srccheck's, deliberately.**
`unsupported || moved || (unclaimed && !allowUnclaimed)`. `unreachable` does NOT
fail. Project 2 set `failOn.unreachable: true` (`bulletin-srccheck.mjs:129`);
this gate must not.

---

## 9. Behaviours a rewrite loses silently

§7.2 names one. These are its siblings, and the same argument applies.

**The exit-2 contract.** Missing post-id or env → 2; **an unknown post id → 2**
(`:96-100`); PostgREST read error → 2; failed write → 2
(`:22, 36-39, 54-57, 63-66, 90-93`). Infrastructure, not an author defect. The
first draft discussed only exit 1.

**The write response is checked.** The upsert targets
`on_conflict=post_id,footnote_number` with `Prefer: resolution=merge-duplicates`
and reads the response, because an ignored 4xx drops the row while printing
success (`:70-94`, depending on the migration's unique index at
`109_post_citations.sql:60-65`).

**`checker_version` must bump to `"2"`.** The column exists to distinguish
checker generations (`109_post_citations.sql:52-54`); the CLI writes `"1"`
(`:29`). A cutover is the definition of a new generation, and post-cutover drift
measurement depends on telling them apart.

**Stored claims below testimonium's claim floor.** `check()` refuses any claim
under 16 normalized characters (`check.ts:173-180`). The legacy gate has no floor
and these rows were authored before one existed.

**Policy: refuse the footnote, write `unverified` with empty evidence, count it
as unclaimed.** Never a run-aborting throw, which would leave the reconciliation
unable to produce an intended patch for that footnote at all.

**Do NOT follow project 2's `no-source-url` precedent here.** That path forces
`Math.max(code, 1)` (`bulletin-srccheck.mjs:133`), so adopting it would add a new
exit-1 trigger and contradict criterion 9's "exit rule unchanged". Routing
through `unverified` instead reuses the accounting that already exists and
changes no exit semantics.

**And writing the row is the point, not a formality.** A refused footnote that
writes nothing leaves its **stale generation-1 row in place** — and if that row
says `supported`, it keeps rendering a passage to readers for a claim the new
checker declined to verify. Writing `unverified` clears it: nothing renders, the
roll-up sees the footnote, and the author is told. This is the same reasoning as
the 2026-09-12 incident in §8.

---

## 10. The reconciliation

Both arms with `--dry-run` (`:74`), over **every post with stored citation
rows**, comparing **intended patches**. Those are the only posts where a
comparison means anything, and they are the full population the cutover operates
on.

Same instrument as project 2, including both late corrections: **record the
legacy arm's bytes and replay them into the new arm**, and **record the legacy
arm twice**, bucketing anything that disagrees with itself as legacy-unstable.

Classify with project 2 §8.0's **ordering rule** — vetoes before the prose floor.
Testing the floor first doubled project 2's headline until corrected.

### 10.1 Replay misses

The new arm can request reads the legacy arm never made — the pdftotext
re-route, and `/pdf/`-path URLs that testimonium's `isPdf` matches and the
origin's extension-only rule does not. **A rung with no recorded bytes is
bucketed, never adjudicated**, as in project 2 §9B.

### 10.2 The comparison needs declared mappings, or it drowns in noise

**Rung vocabulary.** Legacy `fetch_recipe` and `evidence[].method` use
`fetch` / `curl` / `pdftotext` / `bloomberg-json` / `humain-aem` /
**`humain-aem-curl`** (`source-fetch.mjs:446`) / `challenge`
(`:162,178,201,223`). testimonium's `rung` is `node` / `curl` / `pdftotext`.

The mapping is part of the instrument, not the implementer's judgement:

| legacy | testimonium |
| --- | --- |
| `fetch` | `node` |
| `curl` | `curl` |
| `pdftotext` | `pdftotext` |
| `humain-aem` | `node`, transformed by §4's decorator |
| `humain-aem-curl` | `curl`, transformed by §4's decorator |
| `bloomberg-json` | no equivalent — §11.9 |
| `challenge` | no equivalent — the package reports `firedRule` instead |

The humain rows matter most here: §4's decorator makes the *bytes* equivalent
while the recipe *name* differs, so an undeclared mapping would flag every humain
row as a difference and bury the rows that actually moved.

**Excluded fields.** `retrieved_at`, `checked_at`, `updated_at` differ on every
run by construction. Exclude them from the diff.

**`fetch_recipe` on `unreachable` must be reconstructed.** The legacy arm writes
it (`:201`); `CitationResult` has no winning-rung field at all
(`io/evidence.ts:21-50`). Reconstruct from the last tee read attempted, and state
the rule in the instrument rather than leaving it to the implementer.

---

## 11. Difference classes

**Rebuilt against project 2's nine rather than re-derived**, because a fresh list
is how the first draft lost four of them.

| project 2 class | project 3 disposition |
| --- | --- |
| 8.1 sub-floor partial match | **inherited** — §11.1 |
| 8.2 unclaimed now fails | **superseded** — this gate already fails on unclaimed with the same `--allow-unclaimed` escape; no movement |
| 8.3 originality moves | **newly impossible** — citation-check has no originality measure |
| 8.4 fetch-error text becomes a warn | **inherited** — §11.4 |
| 8.5 challenge-detection divergence | **inherited and sharper** — the origin's uncapped wall tier has no package equivalent; §11.5 |
| 8.6 old arm gives up where the new climbs | **inherited** — §11.6 |
| 8.7 the non-200 gate | **inverted, both directions** — §11.7 |
| 8.8 matcher and extraction drift | **inherited** — §11.8 |
| 8.9 Bloomberg loses its haystack | **inherited** — §11.9 |

Plus three this project introduces:

**11.10 — description-borne text changes what a page reads as.** §3. Three
directions, and the third is the one to watch:

- `unreachable` → `supported` where the description carries the claim (the
  truthsocial mechanism).
- `unsupported` → `supported` where chrome already cleared the floor.
- **`unreachable` → `unsupported`** where a description pushes a sub-floor page
  over 4,500 and its claims are not in that description — a manufactured
  accusation. §3.5 calls this the movement report's primary question, and an
  earlier draft of this class omitted the direction its own §3.5 was written
  about.

**11.11 — content-negotiated PDFs.** The legacy gate tests the URL alone
(`fetchSourceText` calls `isPdf(url)` with one argument, so its content-type
branch is dead there). PDF bytes at 200 pass `classify2xxBody`, every claim
misses, `unsupported`. testimonium N5-vetoes and re-routes one `pdftotext`
attempt (`read-source.ts:118-138`) → `supported`.

**11.12 — stored claims below the claim floor** become structural refusals
(§9), where the legacy arm verified them.

**And 11.7 has two directions**, which is the half the first draft missed:

- **11.7a — gain.** A non-2xx serving full text: origin `unreachable`,
  testimonium `supported`. The origin's own corpus pins this as correct
  (`issue-check.test.ts:206`, "shape 7").
- **11.7b — new accusation.** A readable non-2xx body that misses the claims:
  origin `unreachable`, testimonium `unsupported`. A new accusation route, and
  the one to watch.

**Anything outside these twelve is a defect until shown otherwise.**

---

## 12. Acceptance criteria

1. testimonium 0.5.0 published with description-borne extraction and a
   verdict-movement report against the 618-URL corpus, answering **both** §3.5
   threshold questions explicitly.
2. The shared core is extracted, and **the construction is pinned directly** —
   sec.gov's UA resolves to the declared identity, `loadRules().hosts` is
   consulted, and the CLI and shared core make the same call. Project 2's
   fourteen shapes also still pass, but they do not discharge this.
3. `checkPost` returns structured results and writes nothing.
4. A fixture corpus covers each class in §11 that a fixture can express, plus
   every behaviour in §8 and §9. (§11's legacy-non-determinism analogue is the
   stability pass's job, not a fixture's.)
5. The reconciliation runs record/replay over every post with stored rows, legacy
   recorded twice, with the §10.2 mappings declared, and every behavioural
   difference adjudicated in writing against §11's twelve classes.
6. **No `supported` gain goes unadjudicated.** Every row the new arm marks
   `supported` that the legacy arm did not must be assigned in writing to a named
   class AND the claim confirmed present by hand. (The first draft forbade such
   gains outright, which would have failed the cutover on behaviour the origin's
   own tests pin as correct.)
7. **humain rows show no verdict movement.** §4.
8. `citation-check.mjs` contains no fetch ladder, no challenge check, no curl
   retry.
9. The exit rule is unchanged, including exit 2 (§9), and `unreachable` does not
   fail.
10. `checker_version` bumps to `"2"`.
11. `source-fetch.mjs`'s dead exports go only after (5), (6) and (7) clear.

---

## 13. Open questions

**How many posts have stored citation rows, and how many stored claims fall
below the 16-character floor?** Neither is reachable from this session. The first
sizes the reconciliation; the second sizes §11.12 and may change its policy. The
executing session reports both before starting.

**Does the description fix move any live page across either threshold?** Zero of
37 fixtures do. §3.5 makes this the movement report's primary question.

**Does `moved` deserve a testimonium analogue?** Probably not — it is footnote
renumbering, not source drift, and `recheck` answers a different question.
Recorded so project 4 does not assume it was overlooked.

---

## 14. What review changed

| finding | change |
| --- | --- |
| the description fix does not close humain | §3.1 corrected; §4 added — humain keeps its own reader behind `CheckOptions.fetcher`, with no-movement as an acceptance criterion |
| criterion 6 forbade correct behaviour | §12.6 restated as "no gain unadjudicated"; the routes it wrongly excluded are now classes 11.7a, 11.10, 11.11 and 11.8 |
| §6.1 misdescribed the origin in both directions | §7.1 rewritten — `classify2xxBody` already vetoes shells and walls at 2xx; the residual population is narrow; the non-2xx accusation route added as 11.7b |
| the ECB fixture is not vetoed by signature | §3.4 corrected; the conclusion survives, the explanation did not |
| the fixture corpus cannot prove the extraction safe | §5 and §12.2 — every shape stubs the fetcher, so the construction is pinned directly instead |
| `not_applicable` has two paths | §8 — the internal-link auto-write named, and the branch order pinned |
| sub-floor stored claims were unspecified | §9 — per-footnote structural refusal, never a run-aborting throw; counted in §13 |
| the patch comparison had no declared mappings | §10.2 — rung vocabulary, excluded timestamps, `fetch_recipe` reconstruction |
| exit 2, the write response check, and `checker_version` were unnamed | §9, §12.9, §12.10 |
| six classes were too few | §11 rebuilt against project 2's nine with dispositions, plus three new |
| the population sentence was wrong | §3.5 — the bulletin corpus is right for the floor question; the posts set is this project's population |
| the semver reasoning was backwards | §2 — minor because `^0.4.0` excludes 0.5.0, not because the output is committed |
| the parse was unspecified where it breaks | §3.3 — `property=` vs `name=`, attribute order, quoting, deduplication, append-don't-prepend |
| replay misses had no stated rule | §10.1 |
