# testimonium 0.4.0 — design

**Status:** draft, amended after review
**Date:** 2026-09-13
**Scope:** ship TypeScript declarations, and close four findings carried from earlier releases.

**§8 records what review changed.** Read it before trusting any memory of an earlier draft.

---

## 1. Why this release exists

0.3.0 shipped `toText` and stopped two rungs swallowing failures. Its reviews left
three things open, and the cutover's first real measurement surfaced a fourth.
None is urgent; together they are one small release.

The one that needs real thought is types — and it needs more of it than the first
draft of this spec gave it.

---

## 2. The package ships no type declarations

Measured against the published 0.3.0 tarball: **zero `.d.ts` files**, no `types`
field, no `declaration` setting in either tsconfig. A TypeScript consumer
importing `check`, `CheckOptions`, or `toText` gets `any`, and an
implicit-any error under `noImplicitAny`.

The cutover spec's §4.1 speaks of "the existing types" as part of the public
surface. npm ships none of them. (An earlier draft attributed that phrase to the
base spec's §5.1/§5.3 as well; it appears only in the cutover spec.)

### 2.1 Why this is a minor bump, not a patch

Shipping declarations where none existed **can break a working build**. A
consumer whose code compiles today because every import is `any` may find it red
the moment real types arrive — through no change of their own. That is precisely
what a patch bump promises will not happen, so this is 0.4.0.

### 2.2 What becomes committed

Every type reachable from `src/index.ts` becomes a compatibility commitment. The
current export list is **14 types**, verified by enumerating both export
syntaxes:

`CheckOptions`, `ReachabilityResult`, `ReachabilityOptions`, `CitationResult`,
`FiredRule`, `RuleSet`, `Verdict`, `Fetcher`, `RawResponse`, `RungId`,
`FetcherOptions`, `ClaimProblem`, `RunTally`, `FailOn`.

### 2.3 Nine types are reachable but unnameable — export all of them

`CitationResult.evidence` is typed `readonly Evidence[]` and `Evidence` is not
exported. The first draft of this spec found that one case and treated it as the
whole problem. **It is a class, and the class has nine members:**

| type | why it is unnameable today |
| --- | --- |
| `Evidence` | field type of `CitationResult.evidence` |
| `Rule` | field type of `RuleSet` |
| `HostRule` | field type of `RuleSet` and `FetcherOptions` |
| `Document`, `Footnote` | the adapter contract — what `parseGfmFootnotes` returns |
| `ClaimsFile`, `ClaimEntry` | what `parseClaimsFile` returns |
| `Joined` | what `joinClaims` returns |
| `BuiltinRung` | the named half of `RungId` |

**Export all nine.** `Rule`, `HostRule`, `Document`, `Footnote`, `ClaimsFile`,
`ClaimEntry` and `Joined` are worse than `Evidence`'s case, not better: several
are **parameter-side or return-side of already-public functions**, so a consumer
cannot write a typed variable to hold what the package hands them, or a typed
wrapper around what it takes. Naming a shape already crossing the boundary
commits to nothing that passing the value did not already commit to.

The first draft's suggested workaround — `CitationResult["evidence"][number]` —
does not compile: `evidence` is optional, so it needs `NonNullable<...>`. That
it took a review to notice is itself the argument for exporting the names.

### 2.4 The sealed set is safe — verified, not assumed

The first draft made this a requirement to check rather than a claim. It has now
been checked, twice and by different methods: by hand through every field type to
bottom, and mechanically over the emitted `.d.ts` import graph (20 reachable
files, scanned for sealed names).

**No EXPORTED TYPE references `readSource`, `computeSignals`, `Read`,
`SignalResult`, or `Signals`.** `check.ts:71`'s `readonly Read[]` is an internal
signature and does not escape into `check.d.ts`. The doctrine holds and this
release is not changed by a leak.

**Stated precisely, because the looser version is false.** The `.d.ts` *file
graph* reachable from `index.d.ts` does contain `Signals` — `classify/verdict.d.ts`
declares it and carries it in real type positions (`verdict(s: Signals)`,
`isBlocked(s: Pick<Signals, …>)`), and that file is in the graph because
`index.d.ts` imports `Verdict` from it. What matters is that `index.ts`
re-exports only `Verdict` from that module and the `exports` map blocks the deep
import, so no consumer can name or reach `Signals`. The distinction is between
what a tarball contains and what a caller can obtain; §6.3 fixes the trace to
measure the second.

Emitting `.d.ts` for internal modules is not a leak. Verified experimentally
rather than reasoned: under `moduleResolution: NodeNext` and under `bundler`, a
deep type import of a sealed module fails with TS2307, because the `exports` map
admits only `.` and `./package.json` and TypeScript honours it for types.

**One caveat, with its evidence.** Under legacy `moduleResolution: node10` the
deep import *succeeds* — nameability only, since types erase and the runtime
`exports` map still blocks the import. The doctrine governs what a caller can
**do**, and that is unchanged. Under node10 the bare root import also fails for
want of a top-level `types` field, which §2.5 adds.

### 2.5 How it ships

`declaration: true` in `tsconfig.build.json`; the `exports` map gains a `types`
condition **ordered before `default`**; and a **top-level `types` field** for
node10 consumers. No bundler, no new dependency — `dependencies` stays `{}`.

### 2.6 Two values must be widened BEFORE declarations ship

Found only by building. Both are free to fix now and **breaking to fix later**,
because the first published declarations are what consumers pin against.

**`VERSION` emits as a literal:** `export declare const VERSION = "0.3.0";`. A
consumer writing `VERSION === "0.5.0"` gets TS2367, "these types have no
overlap" — so **every future release is type-breaking**. Annotate it `: string`.

**`THRESHOLDS` emits all-literal** — through the `as const` at
`src/classify/thresholds.ts:215`, not through `Object.freeze`. The record is
written `Object.freeze({ ... } as const)`, and it is the assertion that pins the
values. That distinction matters for the fix: the freeze is what protects the
keystone at runtime and must stay; the `as const` is what must go or be
overridden. The emitted shape is:
`Readonly<{ readonly minProseChars: 4500; readonly maxChallengeChars: 800; ... }>`.

That one directly contradicts §5 of this spec. §5 records evidence that the
prose floor may need recalibrating for some consumers. **If `4500` ships as a
literal type, that recalibration becomes a semver-breaking change** — a
consumer comparing against `THRESHOLDS.minProseChars` breaks when the number
moves. Annotate the record's values `number` while keeping the runtime freeze,
which is what actually protects the keystone.

### 2.7 The type surface gets pinned, like the runtime one

`test/exports.test.ts` pins the runtime exports so an addition cannot land
unnoticed. The type surface gets the same treatment: a pinned list checked
against what `src/index.ts` actually exports.

The pin **reads the source, not `dist/`** — `npm test` does not build, so a
dist-reading test passes vacuously on a clean checkout, this project's
most-repeated failure. It must catch an **addition as well as a removal**: a
test that only type-checks a fixture importing each name catches deletions
alone.

It must also enumerate **both export syntaxes**. The first draft of this spec
was checked with a grep that matched only inline `type X` and reported 8 of 14,
which looked like a spec error and was an instrument error.

---

## 3. The parity test cannot see CLI tally drift

From the 0.2.0 ledger, Task 14, deferred and never closed: the parity test
hand-copies `bin.ts`'s tally rather than sharing it, so a future edit to that
tally leaves the test green.

**The finding is real. Two things the ledger said about it are not.**

**The ledger's stated cause is stale.** It says the tally is "inline in an
unexported `main()`". `main` **is** exported, at `src/bin.ts:315`. The real
obstacle is fetcher injection: `main` builds its own fetcher, so a test cannot
drive it with a stub. Fixing the wrong cause would have produced an extraction
that changed nothing.

**And the obvious fix would destroy the test it repairs.** The parity test's own
docstring says importing only `src/index.js` **is the thing under test** —
rewiring it to import `bin.ts`'s extracted internals guts that premise. Worse,
both parity scenarios carry `unclaimed`, `unreachable` and `orphaned` at zero,
so the ledger's own named drift cases — "a changed default", "a flag that stops
being wired to `classifyRun`" — **stay green even after the extraction**.

**Therefore:**
1. Extract the tally into a pure importable function beside the recheck trio
   (`classifyRecheckRun`, `renderOutcome`, `jsonOutcome` — the precedent is real
   and shaped as the ledger describes). **Not added to `src/index.ts`**; the
   runtime allowlist is unchanged.
2. **Leave the library-parity test alone.** It keeps importing only
   `src/index.js`, because that is its point.
3. Pin the extracted function in `test/bin.test.ts`, beside the recheck trio,
   with coverage **per tally field and per `failOn` flag** — scenarios where
   `unclaimed`, `unreachable` and `orphaned` are each non-zero.

**Acceptance:** mutating any single tally field or flag wiring turns a test red.
Proved by mutation per field, not by assertion — the whole finding is that the
current test survives exactly that change.

---

## 4. A wording variance: four occurrences, three to change

The phrase "per-host rule machinery" occurs four times. The §5.3 body of the
base spec says "UA and host-rule machinery" instead, and the two should agree.

| occurrence | disposition |
| --- | --- |
| `2026-09-06-testimonium-design.md:2188` | change — the 0.2.0 amendment row |
| `2026-09-06-testimonium-design.md:2189` | change — the 0.3.0 amendment row, **adjacent to the one above** |
| `2026-09-11-testimonium-0-2-0-design.md:64` | change the amendment text only |
| **this spec, §4** | **leave** — it quotes the phrase to describe the defect |

Two of them are **adjacent rows in the same file**. An earlier draft of this
spec named only `:2189` and missed `:2188` one line above it — the twin-site
failure this repository names as its most persistent defect, reproduced one row
apart inside the section that warns about it.

The fourth occurrence is this section quoting the wording under discussion.
Editing it would make the sentence describe a variance that no longer reads as
one. **"Make them all agree" is the wrong instruction**; three change and one is
a quotation.

`0-2-0-design.md:64` carries the same hazard in miniature: its first column
quotes the base spec's original clause as a historical record. Only the
amendment text in that row changes.

---

## 5. The prose floor's evidence base does not describe at least one real corpus

`src/classify/verdict.ts` licenses the floor with:

> Prose volume plus the five vetoes carry the whole separation: largest
> non-vetoed challenge 1,180 chars, smallest real document 6,394, floor
> licensed at 4,500.

**The numbers are true of testimonium's own calibration corpus and stay.** What
is new is a second, independent measurement.

On 2026-09-13 the omnisscientia bulletin corpus was measured: 618 distinct
source URLs from 99 published issues, 549 yielding a prose measurement. **154 of
those 549 — 28.1% — fall inside the band this comment treats as clear.** 68
(12.4%) are below the floor. The distribution rises into the line rather than
clustering away from it: 101 pages sit within ±1,500 characters of 4,500, and
the largest sub-floor band is 4,000–4,500.

Report: `docs/superpowers/worklogs/2026-09-13-subfloor-measurement.md` in
omnisscientia, committed at `947695a`, raw data alongside it.

**Measured against testimonium 0.2.0, and that does not weaken it.** Proven by
diff rather than by release notes: `git diff --stat v0.2.0..v0.3.0 -- src/` is
four files (two warn blocks, one export line, the version string), and the diff
restricted to `src/classify/`, `src/text/extract.ts`, `src/reachability.ts` and
`src/fetch/read-source.ts` is empty. All four paths exist at both tags (3/1/1/1),
so the empty diff means unchanged rather than mistyped, and a positive control
on `src/fetch/node.ts` returns 16 lines. The machinery the measurement exercised
is byte-identical across the two versions.

### 5.1 What this release does about it

**It does not move the floor.** No threshold changes and `THRESHOLDS` stays
frozen at runtime. Moving a calibrated boundary on one corpus's evidence would
repeat the error being recorded.

It **records the second measurement at both licensing sites** — the comment in
`verdict.ts`, and its twin at `src/classify/thresholds.ts:41-50`, where the
number is actually defined and which carries the same claim in the stronger
form "3,320 of clear air below". The first draft named only the first site;
that is §4's defect class appearing inside the section that describes it.

**The framing, stated precisely.** The measured numbers are true of their
corpus. But "carry the whole separation" is written **without bounds**, with
those numbers offered as its evidence — so a reader takes the separation to be
clean in general. It is not clean in this corpus. The second measurement
therefore **bounds a claim stated as unbounded**: more than additive evidence,
less than falsification. An earlier draft called it purely additive, which was
too generous to my own comment.

Why in the code and not only a worklog: the comment is the argument a future
reader uses to decide whether the floor is safe to rely on. A reader who sees
only "an empty band" concludes something different from one who also sees
"28.1% of one real consumer's sources sit in it."

### 5.2 What it leaves open

Whether 4,500 is right for consumers like this one. That needs the *numerator* —
sub-floor **and** not-all-claims-match — which needs the bulletin cutover's
reconciliation corpus, first files expected Monday 2026-09-14. 12.4% is an upper
bound on the affected class, not its size.

Note that §2.6 is what keeps this question answerable without a breaking change.

---

## 6. Acceptance criteria

1. The published tarball contains `.d.ts` files; the `exports` map resolves a
   `types` condition; a top-level `types` field exists. A TypeScript consumer
   importing `check` and `CheckOptions` type-checks with no implicit any under
   **NodeNext, bundler, and node10**.
2. All nine types in §2.3 are exported and nameable, and the §2.3 table's
   membership is re-derived rather than trusted — any public type whose field,
   parameter or return type is unexported is either exported or recorded.
3. The sealed-set trace of §2.4 is re-run against the final surface and
   recorded. **It traces the closure of the EXPORTED TYPES, not the file
   graph.** Measured: `classify/verdict.d.ts` both declares `Signals` and is
   reachable from `index.d.ts` (which imports `Verdict` from it), so a
   file-level scan for sealed names hits, and hits in real type positions —
   `verdict(s: Signals)`, `isBlocked(s: Pick<Signals, …>)`. That is not a leak:
   `index.ts` re-exports only `Verdict` from that module, and the `exports` map
   blocks the deep import. A trace that reports a hit here has measured the
   wrong thing.
4. `VERSION` types as `string`; `THRESHOLDS`'s values type as `number`; the
   runtime freeze still throws on assignment. A consumer comparing `VERSION`
   to another version string, or `THRESHOLDS.minProseChars` to another number,
   type-checks.
5. The type-surface pin fails on an unlisted addition AND on a removal, proven
   by mutation in both directions, and enumerates both export syntaxes.
6. The CLI tally is a shared importable function; mutating **each** tally field
   and **each** `failOn` flag turns a test red, proven per field. The
   library-parity test still imports only `src/index.js`.
7. The three changeable occurrences in §4's table agree with the §5.3 body;
   this spec's own quotation of the phrase is unchanged.
8. Both licensing sites in §5.1 carry the second measurement, naming the report
   path and the version it was measured on.
9. `dependencies` stays `{}`; `npm pack` ships only `dist/` plus standard
   metadata.
10. 550 tests still pass. The runtime export allowlist in `test/exports.test.ts`
    is **unchanged** — every addition in §2.3 is type-only and cannot appear in
    an `Object.keys` pin. (An earlier draft's criterion claimed the allowlist
    would gain an entry, which is incoherent.)

---

## 7. Out of scope

Moving or parameterising the prose floor. The cutover's Half B, blocked on its
corpus. Projects 3 and 4. Any change to a verdict.

---

## 8. What review changed

| finding | change |
| --- | --- |
| §2.4 was an open question | answered — sealed set traced twice, by hand and over the emitted `.d.ts` graph; nothing leaks |
| the unnameable-type class had 1 member | §2.3 — nine, several parameter-side and worse than the one found |
| `VERSION` and `THRESHOLDS` emit literal types | new §2.6 — widen before shipping; `THRESHOLDS` directly contradicts §5 otherwise |
| node10 consumers cannot resolve the root import | §2.5 — top-level `types` field added |
| §3's fix would have destroyed the test it repairs | §3 — extract, but leave library-parity importing only `src/index.js`; pin in `bin.test.ts` |
| the ledger's cause for §3 was stale | §3 — `main` IS exported at `bin.ts:315`; the obstacle is fetcher injection |
| §3's fix would not have caught the named drift cases | §3 — per-field and per-flag coverage; the zeroed scenarios stay green otherwise |
| §4 had two sites, not three | §4 — the third is `0-2-0-design.md:64` |
| §5 named one licensing site | §5.1 — `thresholds.ts:41-50` carries the same claim in stronger form |
| §5 called the measurement purely additive | §5.1 — it bounds a claim stated as unbounded |
| §5 did not say where the report lives or what it was measured on | §5 — path, commit, version, and the diff proof |
| §2.3's workaround does not compile | §2.3 — `evidence` is optional; needs `NonNullable` |
| "the existing types" was misattributed | §2 — it appears only in the cutover spec §4.1 |
| criterion 7 was incoherent | §6.10 — the allowlist cannot contain types and is unchanged |
| §4 and §5 had no acceptance criteria | §6.7, §6.8 |

Verified correct and now load-bearing: the semver call, the 550-test count, the
14-type enumeration, the parity finding and its precedent trio, §4's variance as
cited, §5's keystone-safety reasoning, criterion 9's packaging facts, and that
the `exports` map blocks deep type imports under NodeNext and bundler.
