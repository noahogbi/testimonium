> **Preserved 2026-09-09** out of git-ignored `.superpowers/sdd/` scratch, which
> does not survive worktree cleanup, as plan 2 preserved its two reviews.
> **Numbering owned by this document: corrections 1-14**, of which 1-3 are
> blocking and 14 is parked. A citation like "(Fable C4)" in `src/`, `test/` or
> `docs/` means this document. It is the review of spec section 8.3 ONLY; the
> plan-2 reviews beside it own their own F1-F18 and F1-F12.

# Fable spec review: section 8.3 (recheck, archive as control arm)

Reviewed at `8a681e7` on `feat/plan-3-drift`, worktree green (361/361, run 2026-09-09).
Scope: spec 8.3 (lines 1258-1378), the amended "Archive on success" paragraph (~1016),
Q4's resolution (~1520), the plan 3 row and file list in 8.1. Every factual claim about
shipped behaviour was checked against the code, not the citation.

## VERDICT: APPROVE WITH CORRECTIONS

Corrections 1-3 block plan-drafting: the plan's task structure depends on the decision
table (1), the core/CLI seam (2), and the PDF ruling (3). 4-7 must land in the same
amendment pass. 8-14 are wording and format pins the amendment should carry.

The control-arm concept is right and Q4's resolution is sound. What is wrong is the
decision table at the heart of 8.3, one seam that cannot be built as written, and a
cluster of factual sentences of exactly the defect class this repo keeps shipping.

---

## Correction 1 - BLOCKING, CONFIRMED: the three-value table is unsound and contradicts its own carve-out

The table conditions only on "L vs A same/differ", never on WHICH verdicts. It also
never states the load-bearing invariant that collapses it: **R is always `supported`**,
because the archive is written only when a URL reaches `supported`. So "A vs R differ"
just means "A is not supported". Three mis-attribution routes fall out:

- **(a) L=supported, A=unsupported (or unreachable).** Row 2 fires: "source drift",
  exit 1, "the author verifies the page and updates or removes the claim" - for a
  citation the gate itself passes TODAY. The actual cause is a code/rules/threshold
  change that degrades on the OLD bytes only (a new N3 signature matching the archived
  template; a norm() change breaking an entity-spelled phrase the live page no longer
  uses). A false accusation with a live `supported` verdict standing beside it - the
  keystone's worst outcome, minted by the instrument built to prevent it.
- **(b) L=unreachable, A=unsupported.** Row 2 again: exit 1, an accusation issued from
  an unreachable live read - the thing `verdict()` categorically refuses. The carve-out
  paragraph only covers A=supported.
- **(c) The carve-out contradicts the table.** L=unreachable vs A=supported IS "differ";
  row 2 says source drift exit 1; the prose two paragraphs later says "not source
  drift... listed, never failed". An implementer coding from the table ships the false
  accusation the prose forbids. (Confirmed text-vs-text; `verdict()` semantics in
  `src/classify/verdict.ts`.)

**Cost if shipped:** exit-1 false accusations in an author's CI - the failure section 12
calls close to fatal - plus an ambiguous authority the plan cannot cite.

**Fix:** replace the table with a decision procedure conditioned on L first, and state
R = supported as an invariant. The rule that satisfies the keystone:

```
no baseline, or claimsHash changed  -> reported, exit 0 contribution
L = unreachable                     -> listed, never exit 1 (see Correction 4 for gone)
L = supported,   A = supported      -> clean (0)
L = supported,   A != supported     -> pipeline drift (2)
L = unsupported, A = supported      -> source drift (1)   <- the ONLY exit-1 row
L = unsupported, A != supported     -> pipeline drift / confounded (2)
```

Exit 1 iff L=unsupported AND A=supported AND claimsHash unchanged. L=unsupported already
carries the keystone's own licence (a readable read, positive proof), and A=supported
certifies today's code still proves the claim from the stored bytes - so the bytes are
what changed. Everything else is 0 or 2.

## Correction 2 - MAJOR, CONFIRMED: the CheckOptions sink cannot be built as specified, and it breaches the sealing doctrine

8.3: the sink carries "that URL's reads and the verdict they produced... avoids a second
fetch to recover bytes the first one already had." Two problems, both verified:

- **The reads do not contain the bytes.** A `Read` is `{rung, computed: SignalResult}`,
  and `SignalResult` carries extracted `text`, signals, finalUrl - no rawBody, no
  headers, no status (`src/fetch/read-source.ts`, `src/classify/signals.ts`). Each
  `RawResponse` is discarded inside `readSource` after `computeSignals`. The fetch had
  the bytes; `check()` never does. Implementing the sink as written requires widening
  `Read`/`SourceReads` to retain every `RawResponse` through the core.
- **A public sink hands consumers raw reads.** Spec 6.6: readSource is module-internal
  "because a consumer holding raw reads can assemble a verdict verdict() never issued
  (section 5.1)"; 5.3 seals primitives structurally. A `CheckOptions` member delivering
  per-rung raw bodies plus headers is that surface, reopened, and 8.3 never mentions the
  tension.

**Fix (preferred):** a CLI-side tee. `bin.ts` builds `defaultFetcher` itself, wraps it in
a recording fetcher (the `Fetcher` interface is public and designed for wrapping), passes
it via the existing `opts.fetcher`, and after `check()` returns `supported` writes the
archive from the tee's buffer plus the returned verdict. Achieves every stated goal -
`check()` untouched and pure, bodies off `CitationResult`, no second fetch - with zero
core change, no new public surface, `--no-archive` = don't wrap, and "archiving must
never fail a run" guarded by one try/catch in bin.ts. If the controller keeps the sink
instead, 8.3 must specify: the payload is per-rung RawResponses (not `Read`s), the
readSource widening, sink exceptions caught-and-warned inside check(), and an explicit
licence for the 5.1/5.3/6.6 exception.

## Correction 3 - MAJOR, CONFIRMED: for PDFs the archived bytes are pdftotext's output, so the control arm mis-attributes pdftotext drift to the source

`pdfFetch` returns the extracted text AS `rawBody` (`src/fetch/pdf.ts`: `rawBody: text,
status: 0, headers: {}`). So for the pdftotext rung, the blob 8.3 calls "raw bodies" is
already tool-transformed, and "the only variable left is the bytes" is false: the local
poppler/pdftotext build sits inside the live arm and outside the archive. A poppler
upgrade - or CI's poppler differing from the machine that archived, the ordinary case -
changes hyphenation/layout/ligatures, a phrase stops matching, L=unsupported vs
A=supported, exit 1: the tool's own system dependency fails the author's build for an
unchanged PDF. (The flip side is real too: archiving text is what lets the replay arm
work on machines without pdftotext.)

**Fix (controller must rule):** at minimum record the pdftotext version per read in
`index.json` and have recheck report the confound instead of exit 1 when it differs;
or archive the downloaded PDF bytes as a second blob so A-vs-R can isolate pdftotext
changes as pipeline drift. 8.3 must say which, and disclose the residue of whichever
is chosen.

## Correction 4 - MAJOR, CONFIRMED: the replay fetcher's rungs are unspecified, and the natural implementation manufactures spurious drift across machines

8.3 says only "a fetcher that replays the archive". If its `rungs` come from the machine
(as `defaultFetcher` probes binaries), then a PDF archived where pdftotext exists and
rechecked where it does not attempts nothing in BOTH arms (`ladder.ts` stops a PDF URL
with no pdftotext rung): L=A=unreachable, R=supported, exit 2 "pipeline drift" -
spuriously, on every PDF citation, on every serverless/CI machine. The replay fetcher
needs no binaries at all; it reads local blobs.

**Fix:** specify that the replay fetcher advertises the rungs recorded in that URL's
index entry, returns each recorded read verbatim (status, headers, finalUrl - including
finalUrl "" so `computeSignals`'s `finalUrl || url` default reproduces), and returns
`EMPTY_RESPONSE` for a rung with no recorded read.

## Correction 5 - MAJOR, CONFIRMED: the unreachable carve-out swallows documentGone, contradicting the spec's own twice-stated caveat

Sections 6.2 (N4, ~line 374) and 6.3 (~line 618) both say a 404/410 "distinguishes
'this document is gone' from 'this document was read', which is information recheck
will want even though check does not act on it" - and that the origin is authoritative
about absence. 8.3's recheck does not want it: a deleted page, the most common real
drift mode, reads as bare "unreachable now - listed, never failed", indistinguishable
from a flaky network, and never enters the drift number section 12 says this instrument
exists to produce. Two spec sentences are falsified, and link-rot is concealed.

**Fix:** when L is unreachable with `documentGone` and the baseline is supported, report
it as its own category ("gone since <archivedAt>"), distinct from transient
unreachability. Exit policy is the controller's ruling; recommend default 0 with
`--fail-on-gone` opt-in, mirroring `--fail-on-unreachable` - failing by default risks
accusing over a transiently misconfigured 404. Either way, 6.2/6.3's "recheck will
want it" must become true or be amended.

## Correction 6 - MAJOR, CONFIRMED (text): exit-code semantics underspecified in three places

- **(a)** "a regression in this tool must never fail the author's build" - exit 2 fails
  every naive `set -e` CI gate. What 1-vs-2 delivers is attribution ("never told to fix
  their document"), not a passing build. Say that plainly; the current sentence
  overclaims, in the section that is plan 3's authority.
- **(b)** Run-level precedence is unspecified: one URL source drift, another pipeline
  drift - exit 1 or 2? `classifyRun`'s precedent has 2 dominate; for recheck that lets
  a tool regression mask genuine source drift at the exit-code level. Rule it
  (recommend: 1 dominates for recheck, pipeline drift stays in the report; infra
  failure still 2).
- **(c)** The claims-changed row has no exit code. The ordinary sequence - author edits
  claims, check fails (baseline not refreshed on failure), author runs recheck to ask
  "did the source change?" - lands on A-vs-R-with-changed-claimsHash, and 8.3 says only
  "the report says so". Specify: reported, exit 0 contribution, baseline refreshed by
  the next supported check.

## Correction 7 - MAJOR, CONFIRMED: "The README says so in those words" is false today

8.3 closes: "It detects change, never correctness... The README says so in those words,
beside the exposures section 8.2 discloses for harvest." The README contains no such
sentence - its only recheck mention (lines 414-415) is "What's not here". A
present-tense factual claim about another document, currently false: the exact defect
class this repo names as its worst, in the section written to be plan 3's authority.
**Fix:** reword as a requirement ("the README must say, in those words...") and make the
README addition an explicit plan task.

---

## Minor corrections

**8. MINOR, CONFIRMED:** "Replaying one body could not reproduce the original `missed`
set, and recheck would then report pipeline drift on every citation that took more than
one rung." Two inaccuracies in the justification of a correct conclusion: (i) by 8.3's
own table the usual symptom would be L!=A (live still supported, single-body replay
unsupported) - spurious SOURCE drift, exit 1, worse than claimed; (ii) "every citation
that took more than one rung" overstates - a citation whose winning body alone carries
every claim and satisfies the ladder replays clean. Fix the sentence; keep the rule.

**9. MINOR, CONFIRMED:** "the node and curl rungs usually return byte-identical bodies
and collapse to one blob" misdescribes the shipped ladder: curl is attempted only when
node's read was NOT readable (`ladder.ts`: climb unless readable), so an archived
(supported) URL with two reads usually holds a wall/stub plus the document - different
bytes, two blobs. The dedup that actually pays is cross-run idempotency on unchanged
sources - and that fails for pages with per-request bytes (nonces, csrf tokens), which
grow the archive every check run, not "when a source genuinely changes". Also
undisclosed: index overwrite orphans old blobs and nothing prunes them - monotonic
growth in a committed store. Fix the sentence; disclose no-pruning and per-request
variance; optionally note orphaned blobs are GC-able later.

**10. MINOR, CONFIRMED:** section 8's command table (line 973), "recheck <doc> drift,
against stored evidence and the archive", contradicts 8.3's self-containment ("recheck
never reconciles two files"). R lives in the archive index. Amend to "against the
archive".

**11. MINOR, PLAUSIBLE (gaps on a committed format):** pin in the spec, not the plan:
a `version` field in index.json (the evidence file has `version: 1`; the archive is a
committed compatibility surface); the hash algorithm and that it is computed over the
raw bytes BEFORE gzip (hashing the .gz breaks idempotency across zlib versions); the
claimsHash canonicalization (which claims, what normalization, order-sensitivity); the
index key (cited URL vs `normalizeUrl` - it must match joinClaims' key or baselines
silently miss); and which headers are stored (set-cookie values would be committed).

**12. MINOR, PLAUSIBLE:** recheck's writes are unspecified. The 8.1 file list says
evidence.json is "written by check and recheck" but 8.3 never says which arm's results
recheck writes (presumably L's), nor whether recheck ever refreshes the baseline
(recommend: never - check is the only archive writer), nor how recheck reports
notApplicable/unclaimed/orphaned entries (presumably as check does). Also the Global
flags paragraph (~976) will need `--no-archive` added when plan 3 lands.

**13. MINOR, PLAUSIBLE:** a changed local `--rules` file shifts A vs R and reads as
"pipeline drift - a regression in this tool", but local rules are the author's data.
Recording rules provenance (bundled snapshot date + local file hash) per index entry
lets the report name the actual confound.

**14. MINOR, pre-existing - park, do not fold into plan 3:** spec 7.1's snippet still
reads `type RungId = "fetch" | ...` while the shipped builtin is `"node"`
(`src/fetch/types.ts`). Stale from before 8.3; surfaced by the sweep.

---

## Scope

One plan. The archive write, the replay fetcher, and the comparison are one seam;
splitting them would ship an archive no instrument reads. Sequence the archive write
(+ `--no-archive`) as the first wave so `check` starts accumulating baselines before
`recheck` exists.

## What is right - do not disturb

- **Q4's resolution.** Local, content-addressed, committed bytes instead of
  web.archive.org is correct and correctly argued: a remote snapshot's own transforms
  would sit inside the one comparison built to isolate this pipeline. Verified: nothing
  elsewhere in spec or README still claims the remote snapshot.
- **The L/A/R architecture itself.** Both arms through today's `check()` via the
  existing `CheckOptions.fetcher` (confirmed in `src/check.ts`) - the control arm is
  provably the same code. R's role as the separator is right; the table's rows, not
  its values, are the defect.
- **claimsHash** as the third-row disambiguator (needs only the exit code, Correction 6c).
- **Archive every attempted read.** The conclusion is correct and confirmed against
  `check.ts`'s union and per-read veto inputs; only the justifying sentence is off
  (Correction 8).
- **No-baseline exits 0; recheck never gates.** Right, and the "worse version of check"
  argument is the correct reason.
- **The unreachable carve-out's core instinct** (transient walls must not accuse) -
  it needs the gone-page split, not reversal.
- **Self-contained archive; evidence file untouched in role.** Right, and the
  fresh-clone rationale at 1080-1084 is sound.
- **Verified true as written:** `writeEvidenceFile` called from bin.ts only; `check()`
  writes nothing; non-supported results carry no renderable fields (`buildResult`);
  verdicts aggregate across non-vetoed reads; "no cron, no rot score, no staleness
  badge" consistent with sections 12 and 14; "detects change, never correctness"
  consistent with section 9.
