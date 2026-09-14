# testimonium 0.4.0 — design

**Status:** draft, pending review
**Date:** 2026-09-13
**Scope:** four items. One widens the public surface permanently; three close findings carried from earlier releases.

---

## 1. Why this release exists

0.3.0 shipped `toText` and stopped two rungs swallowing failures. Its reviews
left three things open, and the cutover's first real measurement surfaced a
fourth. None is urgent; together they are one small release.

The one that needs real thought is types. The other three are closing work.

---

## 2. The package ships no type declarations

Measured against the published 0.3.0 tarball: **zero `.d.ts` files**, no `types`
field, and no `declaration` setting in either tsconfig. A TypeScript consumer
importing `check`, `CheckOptions`, or `toText` gets `any` with an implicit-any
error under `noImplicitAny`.

This is a contradiction the specs already carry: base spec §5.1/§5.3 and the
0.2.0 and 0.3.0 amendments all speak of "the existing types" as part of the
public surface. npm ships none of them.

### 2.1 Why this is a minor bump and not a patch

Shipping declarations where none existed **can break a working build**. A
consumer whose code compiles today because every import is `any` may find it
red the moment real types arrive — through no change of their own. That is
precisely what a patch bump promises will not happen, so this is 0.4.0.

### 2.2 What becomes committed

Every type reachable from `src/index.ts` becomes a compatibility commitment,
the same trade `norm` and `toText` already took, but across a much wider
surface. The current export list is **14 types**:

`CheckOptions`, `ReachabilityResult`, `ReachabilityOptions`, `CitationResult`,
`FiredRule`, `RuleSet`, `Verdict`, `Fetcher`, `RawResponse`, `RungId`,
`FetcherOptions`, `ClaimProblem`, `RunTally`, `FailOn`.

### 2.3 `Evidence` is reachable but unnameable — resolve it

`CitationResult.evidence` is typed `readonly Evidence[]`, and **`Evidence` is
not exported.** A consumer can receive the value and has no name for its type;
today they reach it only as `CitationResult["evidence"][number]`.

That is an accident of the surface never having been type-checked from outside,
not a decision. **Export `Evidence`.** It is a pure data shape
(`{ claims, excerpt, rung }`) and is already returned to callers on every
`supported` and `unsupported` result — exporting the name commits to nothing
that was not already committed by returning the value.

### 2.4 The sealed set must be verified, not assumed

The doctrine seals `readSource`, `computeSignals`, `Read` and `SignalResult`
because holding them lets a caller assemble a verdict `check()` never issued.

**Requirement, to be verified during implementation rather than asserted here:**
no type reachable from `src/index.ts` may transitively reference any of those
four. `check.ts:71` takes `readonly Read[]` in an internal signature, which does
not escape, but the full transitive closure has not been traced and this spec
does not claim it has. If a leak is found, the fix is to widen the returned type
into a public shape, never to export the sealed one.

Emitting `.d.ts` for internal modules is acceptable and not a leak: the
`exports` map admits only `.` and `./package.json`, and `moduleResolution:
NodeNext` honours it for types as well as for runtime, so a deep type import
fails the same way a deep runtime import does. The doctrine governs what a
caller can *do*, not what a tarball reveals.

### 2.5 How it ships

`declaration: true` in `tsconfig.build.json`, and the `exports` map gains a
`types` condition ordered before `default`. No bundler and no new runtime
dependency — `dependencies` stays `{}`.

### 2.6 The type surface gets pinned, like the runtime one

`test/exports.test.ts` pins the 14 runtime exports so an addition cannot land
unnoticed. **The type surface gets the same treatment** — a pinned list checked
against what `src/index.ts` actually exports.

The pin reads the source rather than `dist/`: `npm test` does not build, so a
dist-reading test would pass vacuously on a clean checkout, which is this
project's most-repeated failure. It must catch an addition as well as a removal
— a test that only type-checks a fixture importing each name catches deletions
alone.

---

## 3. The parity test cannot see CLI tally drift

From the 0.2.0 ledger, Task 14, deferred for triage and never closed:

> the parity test HAND-COPIES `bin.ts:634-648`'s tally logic rather than
> sharing it, because that logic is inline in an unexported `main()`. So a
> future edit to bin.ts's tally — a new field, a changed default, a flag that
> stops being wired to `classifyRun` — leaves this test green, since it never
> calls bin.ts's code.

The test catches a deleted export, which was proven. It does not catch the CLI
*gaining* behaviour, which is what it exists to prevent.

**The precedent is in the same file.** The recheck path already has
`classifyRecheckRun`, `renderOutcome` and `jsonOutcome` extracted as importable
pure functions that `test/bin.test.ts` calls directly. `check`'s tally has no
equivalent.

**Fix:** extract the tally into a pure, importable function beside the recheck
trio, have `main()` call it, and have the parity test call the same function
instead of its hand-copy. The extraction is internal — **not added to
`src/index.ts`**, so the runtime allowlist is unchanged.

**Acceptance:** with the extraction in place, mutating the tally logic must turn
the parity test red. Prove it by mutation, not by assertion — the finding is
precisely that the current test stays green under exactly that change.

---

## 4. A wording variance between two amendment sites

`docs/superpowers/specs/2026-09-06-testimonium-design.md:2189` says "per-host
rule machinery" where the §5.3 body now says "UA and host-rule machinery". Both
are truthful and name the same component. Parked during 0.3.0's final review
because the one fix wave was spent; closed here. One line.

---

## 5. The prose floor's evidence base does not describe at least one real corpus

`src/classify/verdict.ts` licenses `minProseChars: 4500` with:

> largest non-vetoed challenge 1,180 chars, smallest real document 6,394, floor
> licensed at 4,500

**That claim is true of testimonium's own calibration corpus and this release
does not dispute it.** What is new is a second, independent measurement.

On 2026-09-13 the omnisscientia bulletin corpus was measured: 618 distinct
source URLs from 99 published issues, 549 of them yielding a prose measurement.
**154 of those 549 — 28.1% — fall inside the band the calibration treats as
empty.** 68 (12.4%) are below the floor. The distribution rises into the line
rather than clustering away from it: 101 pages sit within ±1,500 characters of
4,500, and the largest sub-floor band is 4,000–4,500.

### 5.1 What this release does about it

**It does not move the floor.** Nothing here changes a threshold, and
`THRESHOLDS` stays frozen. Moving a calibrated boundary on one corpus's evidence
would repeat the error being recorded.

It **records the second measurement at the licensing site** — a note at the
calibration comment stating that an independent corpus has been measured, what
it found, and where the report lives. The existing sentence stays; this is
additive evidence, not a correction.

The reason it belongs in the code rather than only in a worklog: the comment is
the argument a future reader uses to decide whether the floor is safe to rely
on. A reader who sees only "an empty band" will conclude something different
from one who also sees "28.1% of one real consumer's sources sit in it."

### 5.2 What it explicitly leaves open

Whether 4,500 is right for consumers like this one. That decision needs the
*numerator* — sub-floor **and** not-all-claims-match — which needs the bulletin
cutover's reconciliation corpus, first files expected Monday 2026-09-14. 12.4%
is an upper bound on the affected class, not its size.

---

## 6. Acceptance criteria

1. The published tarball contains `.d.ts` files and the `exports` map resolves a
   `types` condition; a TypeScript consumer importing `check` and `CheckOptions`
   type-checks with no implicit any.
2. `Evidence` is exported and nameable.
3. The transitive closure of the public type surface is traced, and no type
   reaching `readSource`, `computeSignals`, `Read` or `SignalResult` is
   reachable from `src/index.ts`. The trace is recorded, not just concluded.
4. A pinned type-surface test fails on an unlisted addition AND on a removal,
   proven by mutation in both directions.
5. The CLI tally is a shared importable function; mutating it turns the parity
   test red, proven by mutation.
6. `dependencies` stays `{}`; `npm pack` ships only `dist/` plus standard
   metadata.
7. 550 tests still pass; the runtime export allowlist gains only `Evidence`'s
   type (no runtime name).

---

## 7. Out of scope

Moving or parameterising the prose floor (§5.1). The bulletin cutover's Half B,
which is blocked on its corpus. Projects 3 and 4. Any change to a verdict.
