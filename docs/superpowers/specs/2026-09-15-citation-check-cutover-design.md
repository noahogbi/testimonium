# citation-check cutover — design

**Status:** draft, pending review
**Date:** 2026-09-15
**Project:** 3 of 4 in the testimonium cutover, scoped in
`2026-09-11-testimonium-0-2-0-design.md` §10.
**Spans two repositories.** testimonium (public, this repo) ships a package
change; omnisscientia (private origin) consumes it. **omnisscientia is
read-only from the authoring session** — designed and specced here, executed by
the session that owns that repo.

**Inherits from project 2** (`2026-09-12-bulletin-srccheck-cutover-design.md`):
the attribute-content requirement (§3.2), the `bloombergBody` decline (§3.1),
the class-ordering rule (§8.0), and the reconciliation instrument's two late
corrections (§9B).

---

## 1. What this is, and why it is not project 2 again

`scripts/citation-check.mjs` verifies that each footnote's cited URL carries
that footnote's recorded claims, and **writes the result into
`post_citations`**. That last clause is the whole difference. srccheck returned
an exit code; this writes a stored row.

**Only `supported` renders to readers.** Verified at
`src/lib/citations/inject-evidence.ts:76` — `if (!row || row.status !==
"supported") return whole;`. The schema enforces the vocabulary with a CHECK
constraint: `status in ('unverified','supported','unsupported','unreachable',
'not_applicable')`.

So the risk is asymmetric, and the asymmetry is the design's spine:

- A wrong **`supported`** publishes a passage to readers under a claim that is
  not supported. This is the outcome the keystone rule exists to prevent, now
  with a reader-facing consequence.
- Every other wrong status renders nothing. It costs the author a passage that
  should have shown, and it fails the gate. Recoverable.

**The one inviolable property: never write `supported` wrongly.**

---

## 2. Scope and sequencing

Two halves, strictly ordered.

### Half A — testimonium 0.5.0

`toText` learns text carried in `meta description`, `og:description` and
`twitter:description` attributes. One change, plus a verdict-movement report.
Minor bump: `toText`'s output became a compatibility commitment when 0.4.0
shipped declarations.

### Half B — the origin cutover, one branch

1. Extract the shared fetcher/tee core out of `scripts/lib/issue-check.mjs`.
2. Build `scripts/lib/post-check.mjs`.
3. Rewrite `citation-check.mjs` as a thin CLI over it.
4. Dry-run reconciliation across every post with stored citation rows.

### Out of scope

`bloombergBody` stays dropped and declined under 0.2.0 §7 — it defeats paywall
truncation, which is the circumvention that decline was written for. Unlike
humain, the live wall means both arms land on `unreachable` anyway. Project 4 is
untouched. `scripts/lib/source-fetch.mjs` may finally lose its now-dead exports,
but **only after the reconciliation clears**, and that deletion is the last step
rather than part of the cutover.

---

## 3. Half A: attribute-borne text

### 3.1 The hazard, stated precisely

From project 2 §3.2, sharpened by a real source: the hazard is **not
attribute-content as such — it is attribute-content on a page with enough
visible chrome to clear the prose floor.** Below the floor, the floor catches
it. Above it, nothing does, and the result is `unsupported` on a page that
plainly contains the claim.

| source | visible chrome | today | |
| --- | --- | --- | --- |
| truthsocial.com | 755 chars (measured) | `unreachable` | safe |
| humain.com | 6,824 chars (probed) | `unsupported` | **false accusation** |

Replacing `fetchSourceText` — which citation-check uses and srccheck did not —
would drop `humainBody` and **create** that exposure rather than inherit it.
Writing it into a stored row is worse than returning it as an exit code.

### 3.2 Why a general fix rather than a per-host extractor

It names no publisher. It reads bytes the server already returned in full — the
same text any link preview renders, so nothing is circumvented. And it closes
humain.com, truthsocial.com and every page of that shape at once, where a
per-host extractor closes exactly one and leaves the class open.

This is why the 0.2.0 §7 decline does not bind here. That decline was written
against **circumvention** — defeating a paywall's truncation. Parsing an
attribute of bytes the server sent in full is not that, and `bloombergBody`
remains declined precisely because it *is*.

### 3.3 What it changes, measured

`toText` today strips every tag with `<[^>]*>`, so attribute values are
discarded wholesale (`src/text/extract.ts:81`).

Measured across testimonium's 37 document and challenge fixtures: **8 gain
attribute text, and zero cross the prose floor because of it.** The one
challenge fixture that gains text was already at 13,194 characters and is vetoed
by signature, so its +235 is inert.

**Those fixtures are selected, so they are not the population that matters.**
0.5.0's verdict-movement report must run against the bulletin corpus's 618 live
URLs — the harness already exists from the 2026-09-13 sub-floor measurement, and
that is the population this actually operates on.

The movement to watch for is one direction in particular: **a challenge page
whose meta description pushes it over the floor** turns `unreachable` into
`unsupported` — a false accusation manufactured by the fix. Zero fixtures do
this; the report must confirm the same on live pages, and it is the report's
primary question rather than an incidental check.

### 3.4 A consequence in a gate shipped four days ago

`toText` is what srccheck's originality measure uses. Adding meta text means
originality also compares the drafter's prose against description attributes,
which often duplicate the lede. It is warning-only and cannot move a verdict or
an exit code, but it is a real behaviour change to a just-shipped gate and
belongs in the movement report rather than being discovered later.

---

## 4. The shared core

One new module owning exactly three things, because these are the three that
must not diverge:

- the **tee fetcher**
- the **`defaultFetcher({ hosts, identity })` construction**
- **which rung located each claim**

**Why this scope and no more.** The fetcher construction has already caused one
silent capability loss in this project: project 2's spec records the sec.gov
identity wire missing from one construction path, which would have flipped every
EDGAR filing to NOT READ. A second hand-written copy is a copy that will
diverge — `source-fetch.mjs` being copied into two callers and drifting three
ways is this project's origin story. Sharing the rest is incidental; sharing
this is the point.

The per-gate mapping stays separate. A printed `ok*` tag and a stored
`fetch_recipe` are genuinely different things, and forcing one shape on both
would distort each to serve neither.

**The refactor must prove `issue-check` is behaviourally unchanged** by
re-running project 2's fourteen-shape fixture corpus. That corpus exists for
exactly this, and it is what makes touching four-day-old verified code safe.

---

## 5. The adapter

```
checkPost(post, rows, opts) -> { footnotes[], tally }
```

**`checkPost` writes nothing.** The CLI owns the database. Same split as project
2, same reason: a fixture corpus asserting against returned objects is a
regression test; one scraping stdout is a smoke test.

Per footnote it returns the **intended patch** — `status`, `evidence`,
`fetch_recipe`, `retrieved_at` — plus the pre-check outcome where one applies,
and the per-claim detail the CLI prints. The CLI decides whether to write.

That separation is also what makes §7's reconciliation cheap: comparing intended
patches needs no database at all.

---

## 6. Status mapping

| testimonium verdict | stored status | renders? |
| --- | --- | --- |
| `supported` | `supported` | **yes** |
| `unsupported` | `unsupported` | no |
| `unreachable` | `unreachable` | no |
| `unclaimed` | `unverified` | no |
| *(pre-check, never reaches `check()`)* | `not_applicable` | no |

### 6.1 The origin's `unreachable` rule is weaker, and the cutover replaces it

Today: `if (!res.http2xx && evidence.length === 0) status = "unreachable"`.
Both conditions required. So a page returning **HTTP 200 that cannot be read** —
a JS shell, a consent wall, an attribute-content page — falls through to
`unsupported`. That is a false accusation, stored, rendering nothing to the
reader while telling the author their citation failed.

testimonium's vetoes and prose floor catch it. **This is the second defect this
cutover repairs rather than preserves.**

### 6.2 One behaviour must survive exactly

On `unreachable` the origin deliberately omits `evidence` and `retrieved_at`
from the patch. `merge-duplicates` would otherwise keep a stale date while
blanking the excerpts, leaving a reader "Read <date>" with no passage under a
claim that was fine.

It is a **partial** patch, not a full one, and it is the kind of subtlety a
rewrite loses silently.

### 6.3 Evidence shape

The renderer's `CitationEvidence` is `{ claims: string[]; excerpt: string |
null; method: string }`. testimonium's `Evidence` is `{ claims: string[];
excerpt: string | null; rung: RungId }`.

**Structurally identical but for one field name**, so the transformation is
`rung` → `method`. Both implementations also share the safety contract that
matters: a non-null excerpt always contains its own claim, or it returns null
rather than quoting a passage that does not say what it claims
(`scripts/lib/excerpt.mjs:154`).

The *values* may still differ — see §9.4.

---

## 7. Three origin-only behaviours, all of which stay

**`moved`.** If a stored row's URL differs from the footnote's current URL, the
footnote was renumbered and its claims belong to a different source entirely —
and could even pass against it. A pre-check before any fetch. No testimonium
equivalent and no reason for one. Fails the run.

**`not_applicable`.** Author-set by hand and respected. `check()` never sees it.

**The `unclaimed` write, which must not be optimised away.** A footnote with no
claims still writes an `unverified` row. The code carries the incident: skipping
the write let a partially-gated post report "6 of 6 sources supported" across
nine footnotes on 2026-09-12, because the pre-publish checklist rolls up the rows
that exist and had no way to see a footnote that produced none. An `unverified`
row renders nothing, so it costs the article nothing and gives the gate its
count.

**The exit rule differs from srccheck's, deliberately.** Here `unreachable` does
NOT fail — "not a failure and is not shown to readers". Failure is
`unsupported || moved || (unclaimed && !allowUnclaimed)`. Project 2 set
`failOn.unreachable: true`; **this gate must not.** Two gates, two policies.

---

## 8. The reconciliation

Both arms with `--dry-run`, over **every post that has stored citation rows**,
comparing **intended patches** rather than printed output.

Those posts are the only ones where a comparison means anything: a post with no
stored claims produces `unverified` from both arms and proves nothing. They are
also the full population the cutover will operate on, so nothing is sampled
away.

**Same instrument as project 2, including both of its late corrections:**

- **Record the legacy arm's bytes and replay them into the new arm**, so byte
  equality holds by construction and every difference is behavioural rather than
  drift.
- **Record the legacy arm twice.** Anything that disagrees with itself is marked
  legacy-unstable and excluded from behavioural adjudication rather than counted
  as a finding. citation-check has the same curl-retry non-determinism srccheck
  does.

`--dry-run` already exists in both arms and short-circuits every write
(`citation-check.mjs:74`), so nothing is at risk during the comparison.

**Classify differences using project 2's §8.0 ordering rule** — the vetoes
before the prose floor. A page that is both blocked and sub-floor is a challenge
difference, never a floor difference, and testing the floor first doubled
project 2's headline until it was corrected.

---

## 9. Difference classes

**Anything outside these six is a defect until shown otherwise.**

### Two are fixes

**9.1 — Pages returning 200 that cannot be read move `unsupported` →
`unreachable`.** §6.1. Today these are stored false accusations. Expect this to
be the largest class.

**9.2 — Attribute-content pages move `unsupported` → `supported`.** §3. The
claim was genuinely present; the extractor could not see it.

### Three are losses or drift

**9.3 — Bloomberg citations lose the JSON-state haystack.** §2, declared.

**9.4 — Stored excerpts may differ in content.** Same shape (§6.3), different
implementation. **This is the only class that is directly user-visible**, because
excerpts render. A `supported` row whose excerpt changes shows the reader a
different passage for the same claim.

**9.5 — Matcher drift.** The same two normalizers project 2 catalogued in its
§8.8: `norm`'s soft-hyphen and punctuation clauses, the `&mdash;` rendering, the
`Accept` header, `isPdf`'s differing rules, and PDF text passing through
`toText`.

### One is not a difference at all

**9.6 — Legacy non-determinism.** Bucketed under §8's stability pass, never
adjudicated as a behavioural difference.

---

## 10. Acceptance criteria

1. testimonium 0.5.0 published with attribute-borne extraction and a
   verdict-movement report measured against the 618-URL bulletin corpus, with
   the challenge-page-crossing-the-floor question answered explicitly.
2. The shared core is extracted and `issue-check` is proven behaviourally
   unchanged by project 2's fourteen-shape fixture corpus.
3. `checkPost` returns structured results and writes nothing.
4. A fixture corpus covers each of §9's classes plus the three origin-only
   behaviours in §7, with stated expectations.
5. The reconciliation runs record/replay over every post with stored rows, with
   the legacy arm recorded twice, and every behavioural difference adjudicated
   in writing against §9's six classes.
6. **No post gains a `supported` row that the legacy arm did not also mark
   `supported`, except where §9.2 explains it and the claim is confirmed present
   by hand.** This is the one-way check that matters; §1's inviolable property
   in operational form.
7. `citation-check.mjs` contains no fetch ladder, no challenge check, and no
   curl retry.
8. The exit rule is unchanged: `unreachable` does not fail.
9. `source-fetch.mjs`'s dead exports are removed only after (5) and (6) clear.

---

## 11. Open questions

**How many posts have stored citation rows?** Unknown from this session — the
origin's database is not reachable here. Determines the reconciliation's
duration and its live-fetch volume. The executing session must report it before
starting, the way project 2 confirmed its corpus existed first.

**Does the attribute fix move any live challenge page over the floor?** Zero of
37 fixtures do. §3.3 makes this the movement report's primary question rather
than an incidental one, because a yes would manufacture exactly the false
accusation the fix exists to prevent.

**Does `moved` have a testimonium analogue worth building?** Probably not — it
is about footnote renumbering rather than source drift, and testimonium's
`recheck` addresses a different question. Recorded so project 4 does not assume
it was overlooked.
