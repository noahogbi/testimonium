# Plan 3 (drift) - execution ledger

Preserved from `.superpowers/sdd/2026-09-09-plan-3-drift/progress.md`, which is
git-ignored scratch and does not survive worktree cleanup, as plans 1, 1.1, 1.2
and 2 preserved theirs. It is the record of what was decided and why: the
pre-flight seam scan, every ruling made during execution with its cost-if-wrong,
each task's review and fix rounds, the manual verification transcripts that
exist in no other committed file, and what was parked and why. Read it alongside
`2026-09-06-plan-1-core-ledger.md`, `2026-09-07-plan-1-1-extraction-ledger.md`,
`2026-09-07-plan-1-2-reader-ledger.md` and
`2026-09-08-plan-2-harvest-ledger.md` before touching this repository.

**What plan 3 shipped.** `testimonium recheck <doc.md>`, which re-runs every
claim twice - once against the live source and once against bytes `check`
stored when the citation last read `supported` - and reports what changed and
whose fault it is. With it: `<doc>.archive/` (`index.json` plus
`blobs/<aa>/<hash>.gz`, hashed over the raw bytes before gzip, keyed by the same
`normalizeUrl` the claims join uses, `set-cookie` never stored in any form),
written by the CLI through a recording fetcher so `check()` itself stays
storage-agnostic and gains no option; a replay fetcher that advertises the
rungs the entry recorded rather than the ones the recheck machine can run; the
three-value comparison over `L`, `A` and `R` whose exit-1 outcome was proven
exclusive across 48,960 spec-derived combinations; `pdftotextVersion()`; the
`--no-archive` and `--fail-on-gone` flags; and an exit policy where, for
`recheck` alone, 1 dominates 2. **No verdict moved**: `check()` is not modified
by this plan at all, and `recheck` runs both of its arms through it. 485 tests
at the end of Task 10, 487 with this task's two.

**Test totals, measured at the end of each task** - not a ladder predicted in
advance. Ruling T7-R1 and then T10-R1 are why: a cached line range into the plan
file went stale when the corrections commit landed, and a count derived from a
brief's own `it()` blocks cannot see a test that REPLACES an existing one.

| Task | End of task | After its fix round |
|---|---|---|
| (start) | 361 | - |
| 1 | 361 | - |
| 2 | 372 | - |
| 3 | 378 | 381 |
| 4 | 394 | 395 |
| 5 | 410 | - |
| 6 | 421 | 421 (empty diff) |
| 7 | 432 | - |
| 8 | 458 | 458 (comment only) |
| 9 | 468 | 470 |
| 10 | 479 | 485 |
| 11 | 487 | - |

**The machine, and the one measured environment value that matters.** All of
plan 3 was executed on `WORK-LAPTOP`, Windows 11 Pro 10.0.26200, in Git Bash
(`MINGW64_NT-10.0-26200 ... x86_64 Msys`), Node `v22.18.0`. The `pdftotext` on
this machine's PATH is **Xpdf's, not poppler's**, and
`pdftotextVersion()` returns **`"pdftotext version 4.00"`** here. That value is
recorded because it is a named confound: the archived blob for a PDF rung is
`pdftotext`'s own output, so an archive written here and rechecked against a
poppler build compares two different extractions. Xpdf's `pdftotext -v` exits
**99** and prints the version on **stderr**, which is why the probe treats "ran,
non-zero exit" as present and only `ENOENT` as absent - the same trap that once
cost this repository its PDF rung, sprung on the same binary. Nothing in the
automated suite depends on either value; both are disclosed provenance. The
full transcript is preserved below.

**Two environment gotchas, both carried between tasks rather than
rediscovered.** `$!` after a backgrounded `node ... &` in this Git Bash captures
the MSYS launcher's PID, not the `node.exe` holding the socket, so
`kill "$(cat server.pid)"` reports success while the server keeps listening;
`netstat -ano` plus `taskkill //F //PID <winpid>` is the working fallback, and
every manual step from Task 6 onward used it (ruling T6-R2). And `git checkout`
restores files here as CRLF, so an `\n`-anchored Python replace matches zero
times - caught by its own count assertion, and hit again in this task.

**Parked for a future plan**, each carried with its argument rather than
dropped:

- **Spec 7.1's stale `RungId` snippet** - Fable's finding 14, PARKED. The
  snippet reads `type RungId = "fetch" | "curl" | "pdftotext" | string;` where
  the shipped builtin is `"node"` (`src/fetch/types.ts`: `BuiltinRung = "node" |
  "curl" | "pdftotext"`, and `RungId = BuiltinRung | (string & {})`). It is
  pre-existing, named in 8.3's own correction preamble, and not plan 3's to fix:
  correcting it means editing the interface section that plan 1 owns, in the
  same commit as a doc-truth sweep, which is how a small true edit becomes an
  unreviewed one. Carried forward here so the next plan that opens section 7.1
  finds it named.
- **The command-agnostic flag gap, re-parked a second time.** `validateFlags`
  has never known which command accepts which flag, so `harvest doc.md
  --fail-on-unreachable`, `reachability doc.md --no-archive` and `check doc.md
  --fail-on-gone` are all accepted and then silently ignored. Plan 3 widened the
  gap rather than closing it: there are now **five** non-global flags
  (`--allow-unclaimed`, `--fail-on-unreachable`, `--explain-fetch`,
  `--no-archive`, `--fail-on-gone`) across **four** commands. Per-command flag
  tables would change all four, and neither spec 8.2 nor 8.3 licenses that. It
  is characterized rather than closed, by three CHARACTERIZATION tests in
  `test/bin.test.ts`, so closing it later is a deliberate edit to a red test. A
  fourth characterization in the same file covers the separate single-dash gap
  (`-j` passes as a positional).
- **No archive GC ships.** Re-archiving a URL at new bytes overwrites its index
  entry and leaves the old blob behind; growth is monotonic in a committed
  store. 8.3 excludes GC from plan 3 explicitly, and Task 5 characterizes the
  orphaning instead of fixing it. Every live hash is named in `index.json`, so
  the unreferenced set is computable whenever someone wants it. Disclosed to
  users in the README's `Recheck` section, in full.
- **`bin.ts`'s `main()` still has no automated coverage** - parked as ruling
  T9-R1 in plan 2's ledger and not reopened here. Plan 3 pulled two pure
  functions out from under it where the risk was concentrated (`renderOutcome`,
  ruling T10-R2, and `archiveUnreadableNotice`), because a formatter extraction
  changes no control flow; the CLI branch's control flow, exit codes and process
  I/O stay untested and stay verified by manual transcript. The two things that
  rest on manual verification alone are recorded below verbatim for that reason.
- **T5-R1**, deferred not promoted: the version-99 refusal test asserts the
  throw but not that the on-disk bytes are untouched, unlike its JSON-parse
  sibling. Both refusal routes share one throw point that is the first statement
  in `writeArchive`, and the sibling pins the property. Cost if wrong: if
  someone later splits the two routes so they no longer share a throw point, the
  version-99 route loses its bytes-untouched evidence.
- **T8-R2**, deferred: `confounds: []` on the R-violated `noBaseline` row. The
  entry's fields are present and computable, so the report could say "and your
  claims changed too", but 8.3 does not require it and the row is non-accusing
  either way. Contestable rather than wrong.
- **T9-R3's residual:** `recheck.ts` duplicates `check.ts`'s host-rule wiring
  verbatim, fixed with a comment naming the pairing rather than by extracting a
  shared helper, because `src/check.ts` is off-limits to this plan. A future
  edit to one copy and not the other stays visible but is not prevented.
- **`CHANGELOG.md`'s "harvest is a second consumer of the reader plan 1.2
  built"** - parked by ruling F-1 in plan 2 and surfaced to this repository's
  owner rather than fixed here. Untouched by this task, deliberately.
- **The README Quickstart's "Two files live beside your prose, both meant to be
  committed"** - found by this task's sweep and LEFT. It has understated the
  committed set since plan 1, when `check` began writing `<doc>.evidence.json`;
  plan 3 makes it understate by one more (`<doc>.archive/`) without making it
  newly false, and the `Commands` section two screens down now says "Commit all
  three" explicitly. It belongs to whichever plan next rewrites the Quickstart,
  and the rule this project has kept is to fix what a plan falsified and record
  what belongs to another.
- **`test/bin.test.ts`'s test title `"CHARACTERIZATION: the command-agnostic gap
  now covers a third command"`** - the gap now covers a fourth. The title is a
  non-comment line and Task 11 is licensed for comments plus two specified
  tests, so the comment beneath it was corrected and the title was not. Whoever
  next edits that block should rename it.

**Three notes on this file as an artifact.** The source ledger below ends with
Task 10 complete at 485 tests; Task 11's own record is the section immediately
following this preamble, because the source is written by the controller and
Task 11 is the task that preserves it. The source's **one** em dash is written
here as a hyphen, and the em dashes, arrows, check marks and multiplication sign
in the task reports quoted below are likewise transliterated to ASCII (`-`,
`->`, `[ok]`, `x`) - the Task 10 report needed none, having been written in
ASCII already - so this file is pure ASCII as plan 2's ledger is; nothing else
in any quoted text is altered. And the transcripts reproduced under
"Manual verification transcripts" are quoted from
`.superpowers/sdd/2026-09-09-plan-3-drift/task-3-report.md`,
`task-6-report.md` and `task-10-report.md`, which the same cleanup destroys -
they are the only record of the two verifications this plan has that no test
can perform.

---

## Task 11: the doc-truth sweep, and this ledger

Executed 2026-09-09 at BASE `f60c512`, 485 tests green, `tsc` clean, `dist/`
built, tree clean. Two `it()` blocks specified, both written failing first and
watched to fail (`grep -c "detects change, never correctness" README.md` -> 0,
and `testimonium recheck <doc.md>` absent from the commands block) before any
README edit. Final: **487 tests**, reconciled by both instruments ruling T10-R1
requires - the brief's own count of 2, and `git diff` added-minus-removed
`it(` lines over the test tree, which is +2/-0 with the comment edits to
`test/bin.test.ts` contributing 0 of each.

Discharged from the brief's list: the commands block (three commands to four,
in `USAGE` order), the "All three read" paragraph (four, and the archive named
as a third committed artifact), the global-flags paragraph (three non-global
flags to five, across four commands), the new `Recheck` section, the "What's not
here" paragraph, spec 8.3's correction (c), spec 8.1's plan-3 row, and the
`CHANGELOG` entry. Confirmed rather than assumed: `package.json` declares no
`dependencies` key at all, and every non-relative import under `src/` is a
`node:` builtin - `node:crypto` and `node:zlib`, plan 3's two additions,
included - so "zero runtime dependencies" still holds.

**Ruling T11-R1 - the brief's own discharge sentence was false, and is
corrected rather than copied.** It read "`test/readme.test.ts` pins both", of
the required sentence AND the replaced "What's not here" paragraph. Measured:
with `"`recheck` is a separate plan"` restored to that paragraph (anchor
asserted present exactly once before the replacement, and the mutation printed
its own confirmation), **both tests stay green**. Only the sentence and the
four command names are pinned. The alternative was a third test, which would
have put the total at 488 against a plan whose expected total is 485 plus the
brief's two; so the spec now says exactly what is pinned, what is not, and that
the unpinned half rests on review. Shipping "pins both" would have been a false
coverage claim inside the paragraph recording the correction of a false claim -
which is what happened to spec 6.3 twice, and precisely the repeat this task
exists to prevent. **Cost if wrong:** the discharge is four sentences longer and
sounds weaker than the brief intended, in exchange for being true.

**Ruling T11-R2 - "run the gate with no side effects" is false, was false when
plan 3 wrote it, and is corrected in every place it appears.** `--no-archive`
suppresses only the archive write: `bin.ts` calls `writeEvidenceFile(...)`
unconditionally, outside every `--no-archive` branch. Measured rather than read
off the source - `node dist/bin.js check <doc> --no-archive` over a citation
pointed at a closed local port (no network, no server) exited 0, created no
`<doc>.archive/`, and wrote `<doc>.evidence.json` all the same; transcript
below. Four sites carried the claim, all four written by plan 3, and all four
are fixed as a set rather than one at a time: the README's code-block comment,
the `CHANGELOG` bullet the brief specified, spec 8's 2026-09-09 amendment
("without side effects" -> "without adding a new output"), and spec 8.3's
"`--no-archive` suppresses the write for a read-only invocation", which keeps
its sentence and gains a dated correction beneath it in the section's own voice.
The README also gains one new paragraph saying plainly what the flag does and
does not suppress. **Cost if wrong:** an author reads "no side effects", runs the
gate expecting a read-only invocation, and finds `<doc>.evidence.json` rewritten
in a clean tree - the smallest possible version of this tool telling somebody
something untrue about itself. Plan 2's ledger records its doc-truth task
half-fixing a twin; this is the same shape at four sites, so all four moved
together.

**Ruling T11-R3 - the README's one pre-existing non-ASCII byte is converted,
reversing plan 2's leave-it ruling.** `README.md` carried a single U+2265 (3
bytes) since a plan-1-era commit, `42d21e5`. Plan 2's ledger records its
implementer flagging it and correctly leaving it, on the reasoning that "the
ASCII constraint binds source and test files". Task 11's own byte check names
`README.md` explicitly and expects zero, and this task rewrites a large part of
that file, so the byte is now in scope: "does not imply a >=4,500-character
document" is now "does not imply a 4,500-character-or-longer document". No claim
changed - the threshold, the direction and the floor are identical. **Cost if
wrong:** a prior ruling is reversed without the reviewer who made it, for one
character of typography; recorded here so the reversal is visible rather than
silent.

**Ruling T11-R4 - three source comments the sweep found are corrected, and
nothing executable is touched.** `src/bin.ts`'s `--rules` comment said the flag
"applies to all three commands" (four now). `test/bin.test.ts` carried a twin
pair - one comment saying closing the per-command flag gap "would change check
and reachability too", and a second saying the same thing in the harvest
characterization - both now naming `recheck` and both pointing at the two
plan-3 characterizations as their twins, since the three move together. And the
`draftPathFor` comment's "All three replace the document's extension" gains the
fourth helper `archivePathFor` and the reason the block still asserts over
three: the archive is a directory, not a file. Proven comment-only by filtering
the diff of `src/` and `test/bin.test.ts` for changed non-comment lines - **0**,
against a positive control of **87** from running the identical filter over the
README's diff, so the filter demonstrably emits output when a non-comment line
changes. **Cost if wrong:** a comment edit reaches a line that runs; the filter
plus a green 487 and a clean `tsc` are what rule that out.

**Ruling T11-R5 - what the sweep found and did NOT change.** Spec 8.3's
correction-(c) preamble ("The README carries no sentence about change versus
correctness anywhere") is present-tense and now false; it keeps its tense and
gains a parenthetical in spec 6.3's exact voice, because it is the evidence that
forced the requirement and rewriting it would erase the record of the defect.
`docs/first-run-2026-09.md` is a dated transcript of a run on 2026-09-07 and is
left as a record of that run, the same way plan 2 left superseded plan documents
alone. `docs/calibration-2026-09.md` is untouched: plan 3 changed no threshold,
no fixture and no verdict. Every "three" surviving in the live docs was checked
individually and is about something other than the command count - the three
claim-floor doors, the three N5 evasions, the three committed artifacts, the
three-of-seven `urtext` analogy.

**Instruments, proved before they were trusted.** The NUL and non-ASCII checks
were made to fail first (`1` and `2` from the two positive controls) on every
run. The dangling-citation check was given a negative control that printed
`DANGLING docs/no-such-file.md` before its clean result was believed - during
the sweep it reported **13** resolving `docs/*.md` citations and exactly one
dangling, this ledger, cited by the plan file before it existed; with the ledger
written it reports **14** resolving and none dangling. Plan 2 shipped 27
citations into git-ignored scratch, and this is the check that stops the
twenty-eighth. The comment-only filter was given a
positive control. And an early `\n`-anchored Python mutation of `README.md`
matched **zero** times and said so through its own `assert`, because the file is
CRLF - the same instrument failure the reviewer of Task 9 hit, caught the same
way, and the reason every mutation in this task asserts its anchor count before
replacing anything.

---

# Manual verification transcripts (preserved verbatim from the task reports)

These exist in no other committed file. Quoted from
`.superpowers/sdd/2026-09-09-plan-3-drift/task-3-report.md`, `task-6-report.md`
and `task-10-report.md`, with non-ASCII transliterated to ASCII and nothing else
altered.

## Task 3, Step 6: the real `pdftotext` on this machine

## Measured transcripts (Step 6, for the ledger)

Machine: this development machine, 2026-09-09, same session as the brief's original measurement.

```
raw -v first line: pdftotext version 4.00
raw -v exit code:  99
probe returned:    "pdftotext version 4.00"

probe with no PATH: null
```

These match the brief's original measurement (`status = 99`, `error = undefined`, stderr carries `pdftotext version 4.00\r\nCopyright 1996-2017 Glyph & Cog, LLC\r\n`, stdout empty) and confirm the implementation agrees with the real binary on both the present-and-non-zero-exit case and the genuinely-absent (ENOENT) case. Nothing in the automated suite depends on either value - both are disclosed provenance only.

(Re-run unchanged after the `toVersionProbe` extraction in Task 3's fix round: same three lines, same values.)

---

## Task 6, Step 8: `check` writes the archive, end to end

## Manual end-to-end verification (Step 8) - RAN, all six transcripts below

**8a - server up, readiness proven:**
```
listening on 8765
server.pid: 134750
bytes the server returned: 6781
```
(five-thousand-plus, not `NO SERVER:` - matches expectation)

**8b - `check` exit code:**
```
  [1] supported (1 claims) - http://127.0.0.1:8765/report

0 unsupported, 0 unreachable, 0 without claims
EXIT=0
```

**8c - archive contents, credential check:**
```
/tmp/tm-e2e/doc.archive/blobs/c8/c86b85e326d09a3dbd4bcc7ceaa5273d813b0612659875e9ae9bcaf7ea299574.gz
/tmp/tm-e2e/doc.archive/index.json
--- index ---
{
  "version": 1,
  "urls": {
    "http://127.0.0.1:8765/report": {
      "archivedAt": "2026-09-10T04:01:30.379Z",
      "verdict": "supported",
      "claimsHash": "784383fcef337d7a545097fb4f81ad799cde0972ba5a18233723346b56a14c3c",
      "toolVersion": "0.1.0",
      "localRulesHash": null,
      "reads": [
        {
          "rung": "node",
          "status": 200,
          "headers": {
            "connection": "keep-alive",
            "content-type": "text/html",
            "date": "Thu, 10 Sep 2026 04:01:30 GMT",
            "keep-alive": "timeout=5",
            "transfer-encoding": "chunked"
          },
          "finalUrl": "http://127.0.0.1:8765/report",
          "hash": "c86b85e326d09a3dbd4bcc7ceaa5273d813b0612659875e9ae9bcaf7ea299574",
          "pdftotextVersion": null
        }
      ]
    }
  }
}
POSITIVE CONTROL, matches in the server source: 2
matches in index.json:                          0
```
One `index.json`, exactly one `blobs/<aa>/<hash>.gz`, all fields matching the
brief's expectation. Positive control = 2, index line = 0: no `set-cookie` /
`SECRET123` leaked into the committed file.

**8d - `--no-archive` writes nothing:**
```
files under doc.archive after a normal check: 2
  [1] supported (1 claims) - http://127.0.0.1:8765/report

0 unsupported, 0 unreachable, 0 without claims
EXIT=0
files under doc.archive after --no-archive:   0
```

**8e - unchanged source leaves the index byte-identical:**
```
index.json sha, first run:  d2d3cb285607d9184194ae99ec3c6a6919118641fcaa1d33651b6d86b6218c50
index.json sha, second run: d2d3cb285607d9184194ae99ec3c6a6919118641fcaa1d33651b6d86b6218c50
blob files: 1
```
Identical shas across two runs with a fresh `archivedAt` and a fresh `date`
header each time - the preservation branch in `writeArchive` is doing its job.

**8f - stop the server, clean up - FINDING, worked around:**
```
server still answering? YES - STILL UP, kill it before re-running
cleaned
```
`kill "$(cat server.pid)"` did NOT stop the server: in this Git Bash/MSYS
environment, `$!` after `node server.mjs & ` captures the MSYS launcher's PID
(134750), not the Windows PID of the actual `node.exe` process holding the
socket. `netstat -ano | grep 8765` showed a live LISTENING socket owned by PID
28640, a different process. I killed it explicitly with
`taskkill //F //PID 28640`, confirmed via `netstat` (only `TIME_WAIT` rows
remained) and a fresh probe (`no - port is free`). `/tmp/tm-e2e` was then
removed and confirmed absent; no `.archive` directory and no `/tmp` path
appear in `git status --short` afterward.

This is a real environment gap in the brief's kill-by-PID instruction (not a
defect in the code under test), worth carrying forward: on this machine,
`$!` from a backgrounded `node ... &` in Git Bash is not reliable for killing
the process later; `netstat -ano` + `taskkill //F //PID <winpid>` is the
working fallback.

---

## Fix round 1 (1 item): step 8g - "archiving must never fail a run" exercised directly

Reviewer finding: no unit test and no step of the original manual script exercised
`writeArchive`'s throw inside `main()`'s try/catch (`bin.ts:427-431`). Added step 8g
to the manual verification (not a unit test - `main()` is not exported and has had
no automated coverage since plan 1, parked as ruling T9-R1; the step's comment in
`task-6-brief.md` says so explicitly). Ran it:

**Setup - fresh server on port 8766, readiness proven, real Windows PID captured
via `netstat` up front (carrying forward the 8f finding):**
```
listening on 8766
readiness bytes: 6781
real winpid via netstat: 24784
```

**First `check` - establishes a valid baseline to corrupt:**
```
  [1] supported (1 claims) - http://127.0.0.1:8766/report

0 unsupported, 0 unreachable, 0 without claims
EXIT=0
```
(index.json written with one `supported` entry, as in 8a-8c.)

**Corrupt `index.json` with invalid JSON, sha before the second run:**
```
corrupt index.json sha, BEFORE second check: 4e0c3249b91d46cb9a7e1f79b88585d1158ae5fb598812f2ea866116d1249e02
```
Content: `not valid json at all { [ garbage`. Blob count before: 1.

**Second `check` against the still-live, still-`supported` source, with the
corrupt index in place:**
```
EXIT=0
--- stdout ---
  [1] supported (1 claims) - http://127.0.0.1:8766/report

0 unsupported, 0 unreachable, 0 without claims
--- stderr (the warning) ---
warn archive not written: refusing to overwrite the archive: C:\Users\noaho\AppData\Local\Temp\tm-e2e-8g\doc.archive\index.json is not valid JSON: Unexpected token 'o', "not valid j"... is not valid JSON
corrupt index.json sha, AFTER second check:  4e0c3249b91d46cb9a7e1f79b88585d1158ae5fb598812f2ea866116d1249e02
blob files after second check: 1
--- index.json content, confirmed untouched ---
not valid json at all { [ garbage
```

**EXIT=0 asserted explicitly** (not merely a warning grep) - the citation's own
verdict is unaffected by the archive refusal, exactly as spec 13 Q4 requires.
The corrupt file's sha256 is **byte-identical** before and after, and the blob
count is unchanged (1, not 2): `writeArchive` throws immediately on
`readArchive`'s refusal, before any blob or index write is attempted, so
nothing downstream of the refusal ever runs.

**Cleanup**, using the `netstat`/`taskkill` fallback from the 8f finding rather
than `kill $!`:
```
SUCCESS: The process with PID 24784 has been terminated.
port 8766 listener remaining: none
server still answering? no - port is free
```
`/tmp/tm-e2e-8g` removed and confirmed absent. `git status --short` in the
worktree shows no leaks (no `.archive` directory, nothing under `/tmp`).

**Code changes: none.** The existing `bin.ts` implementation (committed at
f341183) already satisfies spec 13 Q4 exactly as the reviewer's manual
reproduction found - this fix round added verification coverage, not a
behavior change. `task-6-brief.md` (step 8g) and this report were updated;
both live under `.superpowers/sdd/2026-09-09-plan-3-drift/`, which
`.superpowers/sdd/.gitignore` excludes wholesale (`git check-ignore -v`
confirms; `git log --all -- .superpowers/sdd` has zero commits ever, in this
repo's history) - so there is nothing to `git add` or commit on top of
f341183 for this fix. `git status --short` remains clean and HEAD is still
f341183822b668fa62aa0c96130d6a919030511e; `npm test` (421/421) and
`npx tsc --noEmit` were re-confirmed unaffected (no source touched).

---

## Task 10, Step 7: `recheck` from the CLI, five transcripts

## Step 7: manual end-to-end verification (not a vitest test)

Ran in Git Bash on this machine, using `process.argv` (not `node -e` program
text) for every server/inspector path, and `netstat -ano` + `taskkill //F
//PID` to kill the server, deviating from the brief's own step 7a/7e, which
prescribe capturing the PID with `echo $! > server.pid` and killing it with
`kill "$(cat server.pid)"`. The brief does not document this as unreliable -
it was flagged as a known failure mode for this environment by the task's
own instructions, and I measured it directly before committing to the
netstat/taskkill approach: on this machine `$!` after `node ... &` captures
the MSYS bash launcher's PID, not the `node.exe` process holding the socket,
so `kill "$(cat server.pid)"` would report success while `node.exe` keeps
listening. `tasklist //FI "PID eq <pid>"` on the PID `netstat -ano` reported
for port 8766 confirmed it as `node.exe` before I trusted it, and the final
`taskkill //F //PID` plus a second `netstat` check (no LISTENING row) is
what proves the server is actually gone rather than merely unresponded-to.

### 7a. Build, fixture, server start
```
listening on 8766, toggle dir C:/Users/noaho/AppData/Local/Temp/tm-drift
```
(native Windows path - MSYS argv conversion confirmed working)
```
server.pid (real node.exe PID via netstat): 27164
Image Name                     PID Session Name        Session#    Mem Usage
node.exe                     27164 Console                    1     46,636 K
occurrences of [spending rose sharply]: 120
```
`netstat -ano | grep ":8766" | grep LISTENING` -> PID 27164, confirmed via
`tasklist //FI "PID eq 27164"` to actually be `node.exe` before trusting it.

### 7b. Archive a baseline, recheck it clean
```
  [1] supported (1 claims) - http://127.0.0.1:8766/report

0 unsupported, 0 unreachable, 0 without claims
CHECK EXIT=0
  [1] clean - http://127.0.0.1:8766/report

0 source drift, 0 pipeline drift, 0 gone since archiving
recheck detects change, never correctness: a source that was already wrong when it was archived is archived wrong.
CLEAN RECHECK EXIT=0
```

### 7c. Flip the source, prove the flip, recheck
```
occurrences of [spending rose sharply]: 0
occurrences of [procurement practices were reviewed]: 120
  [1] SOURCE DRIFT - http://127.0.0.1:8766/report
        archived 2026-09-10T05:06:28.550Z: the stored bytes still prove this claim and the live page does not
        MISS: "spending rose sharply"

1 source drift, 0 pipeline drift, 0 gone since archiving
recheck detects change, never correctness: a source that was already wrong when it was archived is archived wrong.
DRIFT RECHECK EXIT=1
```
Order confirmed: the two occurrence-count proofs (0, then 120) printed
before the recheck result was read, as the brief requires.

### 7d. Archive untouched, evidence carries the live arm
```
index entries: 1
  http://127.0.0.1:8766/report verdict=supported archivedAt=2026-09-10T05:06:28.550Z reads=1
evidence results: 1, first verdict=unsupported
blob files: 1
```
`archivedAt` matches 7b's baseline timestamp exactly - the drifted recheck
in 7c did not touch the archive. `blob files: 1` - no new blob for the
drifted body.

### 7e. No baseline, unknown flag, kill by real PID
```
occurrences of [spending rose sharply]: 120
  [1] no baseline - http://127.0.0.1:8766/report (live: supported)

0 source drift, 0 pipeline drift, 0 gone since archiving
recheck detects change, never correctness: a source that was already wrong when it was archived is archived wrong.
NO BASELINE EXIT=0
unknown flag --fail-on-unrechable
TYPO EXIT=2
```
Then:
```
SUCCESS: The process with PID 27164 has been terminated.
NO SERVER: connect ECONNREFUSED 127.0.0.1:8766
```
Confirmed with a second `netstat -ano | grep ":8766" | grep LISTENING`
(exit 1, no match) that the port is actually free, not just that the probe
happened to fail once. Fixture directory removed afterward.

All five transcripts match the brief's expected output exactly.
`DRIFT RECHECK EXIT` was `1` after both occurrence counts confirmed the
flip; the archive did not change. No finding to stop on.

---

## Task 10, fix round 1: the archive-unreadable notice

Manual verification (this is main()'s own behavior, not reachable by a unit
test per the project's `main()`-is-not-exported convention, so verified the
same way Step 7 was): built a fixture at `/tmp/tm-archive-check` with a
claims-worthy citation pointed at `http://127.0.0.1:1/report` (a closed local
port, so `check()` fails fast to `unreachable` without needing a real
listener) and a hand-corrupted `doc.archive/index.json` (`not valid
json{{{`). First run used stale `dist/` and silently reproduced the
pre-fix behavior (no notice) - caught this, rebuilt (`npm run build`), reran:
output now leads with

```
warn C:\...\doc.archive\index.json is not valid JSON: ... - every citation will report "no baseline"

ARCHIVE UNREADABLE: C:\...\doc.archive\index.json is not valid JSON: Unexpected token 'o', "not valid json{{{" is not valid JSON
Every citation below reports "no baseline" because of that - not because check was never run.
  [1] no baseline - http://127.0.0.1:1/report (live: unreachable)
```

confirming the notice reaches stdout distinctly from `recheck()`'s existing
stderr warn. Fixture removed afterward.

---

## Task 11: `--no-archive` is not a read-only invocation (ruling T11-R2)

Run against the rebuilt `dist/`, in Git Bash on this machine. No network and no
server: the citation points at `http://127.0.0.1:1/report`, a closed local port,
so `check()` fails fast to `unreachable` and the run still reaches every write
site. The fixture is two files under `/tmp`, removed afterward.

```
files before: doc.claims.json doc.md
  [1] unreachable - http://127.0.0.1:1/report (tried: node, curl)

0 unsupported, 1 unreachable, 0 without claims
Unreachable is not a failure and is never shown to a reader. Read each one and decide.
EXIT=0
files after:  doc.claims.json doc.evidence.json doc.md
doc.archive present? no
evidence file size: 309 bytes
fixture removed: yes
```

`doc.evidence.json` appears in a run passed `--no-archive`. `doc.archive/` does
not - correctly, both because the flag was passed and because nothing read
`supported` here, so this run is evidence about the evidence file only and is
not claimed as evidence about the archive. The archive half is pinned by Task
6's step 8d above, which measured `files under doc.archive after --no-archive: 0`
against `2` on the same source without the flag.

That is what falsifies "run the gate with no side effects" and "`--no-archive`
suppresses the write for a read-only invocation": `writeEvidenceFile` is called
unconditionally from `bin.ts`, outside every `--no-archive` branch, and has been
since plan 1.

---

## Task 11: the discharge sentence's coverage claim, tested (ruling T11-R1)

The brief's spec text asserted that `test/readme.test.ts` "pins both" the
required README sentence and the replaced "What's not here" paragraph. Rather
than assert it back, the second half was mutated and the tests re-run. The
mutation is anchored and asserts its own application first, because an
`\n`-anchored replace over this CRLF file had already matched zero times once in
this task and reported success:

```
REVERT-SHAPED MUTATION APPLIED
occurrences of 'is a separate plan': 1
      Tests  2 passed (2)
```

Both tests green with "`recheck` is a separate plan" restored to the README. The
paragraph is not pinned; only the sentence and the four command names are. The
file was restored from a pre-mutation copy and `diff` reported IDENTICAL, with
the occurrence count back to 0 and the two tests still green.


---

# SDD ledger - plan: docs/superpowers/plans/2026-09-09-plan-3-drift.md

Worktree `C:/Users/noaho/testimonium-plan3`, branch `feat/plan-3-drift`, base
`main @ 84202d3`. Spec: `docs/superpowers/specs/2026-09-06-testimonium-design.md`,
**section 8.3 is the authority**.

Provenance: 8.3 written 2026-09-09 (`8a681e7`), Fable-reviewed (APPROVE WITH
CORRECTIONS, 1 BLOCKING / 6 MAJOR / 7 MINOR), all 13 applied (`e66ed34`). Plan
drafted by Opus (`c4eefd4`), Fable-reviewed (APPROVE WITH CORRECTIONS, 1
BLOCKING / 2 MAJOR / 4 MINOR), corrections 1-7 plus 3 self-found twins applied
(`bd43fc0`). User approved execution 2026-09-09.

Starting state: **361 tests**, 29 files, `tsc` clean, tree clean.

**No test ladder in this ledger, deliberately.** Each task's expected total is
the current actual plus that task's own specified `it()` count, read fresh
before the task starts. Plan 2's ladder went stale the moment a fix round added
a test and cost a round (ruling T6-R1); the plan's Global Constraints say so.

## Pre-flight scan

Fable's plan review already checked the seams and reported them joining, and the
112 new tests recounted. This is a second, independent pass: one row per pair of
tasks sharing a file or an interface, one row per task against itself.

| # | Pair / task | Produced vs consumed | Found |
|---|---|---|---|
| 1 | T2 -> T4 | `ArchiveEntry`, `ArchivedRead`, `blobHash`, `claimsHashFor`, `withoutSetCookie` | agrees, names and shapes match |
| 2 | T2 -> T5 | `ARCHIVE_VERSION`, `blobRelPath`, `ArchiveEntry`, `ArchiveIndex` | agrees |
| 3 | T2 -> T7 | `ArchiveEntry`, `ArchivedRead` | agrees |
| 4 | T2 -> T8 | `ArchiveEntry`, `claimsHashFor` | agrees |
| 5 | T2 -> T9 | `archiveKeyFor` | agrees; the key is `normalizeUrl`, matching `joinClaims` |
| 6 | T3 -> T6 | `pdftotextVersion` | agrees; T6 is the only caller |
| 7 | T3 -> T4/T8/T9 | T3 says "for Tasks 4, 6, 8 and 9" but T4/T8/T9 consume the *value* via `EntryInput`/`CompareInput`, not the function | **not a defect** - T3's wording is loose, the data flow is right |
| 8 | T4 -> T5 | `StagedEntry` | agrees |
| 9 | T4 -> T6 | `recordingFetcher`, `buildArchiveEntry`, `StagedEntry` | agrees |
| 10 | T5 -> T6 | `writeArchive` (throws; T6 catches) | agrees, and the throw/catch contract is stated on both sides |
| 11 | T5 -> T9 | `readArchive`, `readBlob` | agrees |
| 12 | T5 -> T10 | T5 says "for Tasks 6, 9 and 10"; T10's Consumes omits it | **checked** - T10 needs `archiveIndexPath` only in its manual verification step, not in code. Loose wording, no gap |
| 13 | T6 -> T10 | `archivePathFor`, `archiveContextFor` | agrees |
| 14 | T7 -> T9 | `replayFetcher(entry, loadBlob)` | agrees; T9 supplies `loadBlob` from T5's `readBlob` |
| 15 | T8 -> T9 | `compareCitation`, `CitationOutcome` | agrees |
| 16 | T8 -> T10 | `CitationOutcome.category` feeds `RecheckTally` | agrees |
| 17 | T9 -> T10 | `recheck`, `RecheckCitation`, `RecheckReport` | agrees |
| 18 | T10 -> T11 | `USAGE`, for the README test | agrees |
| 19 | **T6 and T10 both edit `src/bin.ts`** | T6 adds `--no-archive` to `KNOWN_FLAGS`/`USAGE`; T10 adds `--fail-on-gone` | sequential, no conflict, **but** T10 must ADD to that set rather than rewrite it - carried into T10's dispatch |
| 20 | **T1 and T11 both edit the spec** | T1 repoints 8.3's citations of the two reviews; T11 adds the discharge notes and the 8.1 row | different passages, sequential, no conflict |
| 21 | T11 vs `test/exports.test.ts` | the 8-name allowlist pin | no task adds a public export - every new module is imported by path. If one leaks, the pin fires on add/remove/rename |
| 22 | Every task against itself | tests specified vs code specified; files created vs later touched | consistent in all eleven; each task's `it()` count is stated in its own text rather than in a header ladder |

Nothing in the plan mandates something the review rubric treats as a defect. The
Global Constraints affirmatively require the opposite: every load-bearing test
names its mutation, each must be proven applied, and checks must emit counts
rather than verdicts.

Two rows carried into dispatches rather than ruled on, because neither is a
conflict - row 19 (T10 adds to `KNOWN_FLAGS`, never rewrites it) and row 12
(T5's exports reach T10 only through a manual step).

## Task log

Task 1: dispatched (sonnet) at BASE bd43fc0; DONE at f0f1deb. 361 tests
unchanged, tsc clean, tree clean. Both Fable reviews preserved into
docs/superpowers/plans/ with F-range headers, and 8.3's citations repointed
(3 files, 570 insertions).
Controller verified byte-fidelity independently: each preserved copy differs
from its scratch original by EXACTLY 7 added lines - the header block - and
nothing else. The F-range headers disambiguate: the spec review owns
"corrections 1-14", the plan review names its own range, which matters because
both documents number from F1 and the spec review's F6 collides with the plan
review's correction 6.
This is plan 2's 27-dangling-citations defect prevented rather than repaired.
Task 1 review dispatched (sonnet) with an instruction to run its fidelity check
against a deliberately altered copy first - a fidelity check that cannot fail
has told nobody anything.

Task 1: review (sonnet) - spec PASS, quality APPROVED, ZERO findings. Every
verification method was reproduced independently and agreed with the report:
tail-and-diff plus an independent MD5 comparison, both clean; headers proven
character-exact against the brief's own text; both spec citations resolving;
no src/ or test/ file touched; 361/361; NUL sweep finding only the deliberate
pdf-binary fixture; non-ASCII sweep finding exactly the three standing
exceptions.
Disambiguation verified on three REAL citations rather than argued: bare
"Fable F1" at src/bin.ts:249 and test/check.test.ts:513 resolves to plan 2 (both
plan-3 headers disclaim it), 8.3's preamble resolves to the spec review, and the
plan's own preamble to the plan review. Reviewer's fair caveat: the F6/correction-6
collision is avoided by CONVENTION (path-qualification and phrasing), not by
number uniqueness - inherent to the header wording, not an implementer defect.

WORTH KEEPING - THE NEGATIVE CONTROL CAUGHT A BROKEN NEGATIVE CONTROL. The
reviewer's first attempt to prove its fidelity check could fail ran
`sed -i 's/CONFIRMED/ALTERED/'` on a line that did not contain that string. It
silently no-op'd, and the check duly reported MATCH - a passing result from a
mutation that never happened. The reviewer noticed, built a guaranteed-effective
control (`sed '50s/$/ZZZ/'`), and got a real diff and a mismatched MD5. That is
the FIFTH sed-mutation-that-did-not-apply in this project, and the first caught
by the practice of running a control at all. The lesson compounds: a negative
control needs its own proof that it fired.

Task 1: complete (commits bd43fc0..f0f1deb, review clean). 361 tests.

Task 2: dispatched (sonnet) at BASE f0f1deb; DONE at 4387db9. 372 tests
(361 + 11, matching the it()-derived count), tsc clean, tree clean, two new
files only, both 0 non-ASCII / 0 NUL, public surface untouched.
Controller verified the three decisions with silent failure modes before
review: archiveKeyFor imports and calls normalizeUrl from io/claims.js - the
same function joinClaims keys by at claims.ts:141, so the archive and the claims
join cannot file one resource under two spellings; set-cookie is excluded with
its reasoning carried in the docstring; and the module is imported by path, not
exported.
Task 2 review dispatched (sonnet), told to check the key against joinClaims
rather than against the spec, to require a realistically-CASED set-cookie
fixture rather than a lowercase one, and - since a control failed silently
yesterday - to prove any negative control it runs actually fired.

Task 2: review (sonnet) - spec PASS, quality APPROVED, ZERO findings. All five
pinned format decisions verified against LIVE SOURCE rather than the brief's
claim about it: archiveKeyFor = normalizeUrl matching joinClaims' key at
claims.ts:141, and independent of checkable[].url staying as-cited at :147;
blobHash over raw UTF-8, never gzip; claimsHashFor = map(norm).sort().join;
withoutSetCookie a case-INSENSITIVE denylist, not an allowlist.
Three mutations, each PROVEN APPLIED by git diff --numstat plus a grep before
its result was trusted, each reverted and the restore verified byte-identical:
archiveKeyFor -> identity fails exactly the two key tests; blobHash over gzip
fails exactly the pre-gzip test; a case-SENSITIVE set-cookie compare fails
exactly the any-casing test. The reviewer disclosed honestly that it did not
re-run the fourth (claimsHashFor) and trusted the implementer's triple-checked
evidence given the pattern held on the three it did run - which is the right
way to report partial verification.
Task 2: complete (commits f0f1deb..4387db9, review clean). 372 tests.

Task 3: dispatched (sonnet) at BASE 4387db9; DONE at c7f107c. 378 tests
(372 + 6), tsc clean, tree clean, two files, mutation caught exactly the three
predicted failures, and the implementer additionally ran the REAL binary as a
manual check and got the brief's measured shape (exit 99, version on stderr)
plus the ENOENT branch.
Controller verified before review: pdf.ts now imports spawnSync alongside the
pre-existing execFileSync, the probe reads [stderr, stdout] in that order at
:137, and - the one I most wanted to see - the new function AGREES with the
pre-existing pdftotextAvailable at :60-71, whose catch already inspects
`e.code !== "ENOENT"` and whose comment records the defect that produced it:
"Probing on exit code alone reported a working install as absent and silently
disabled the PDF rung." Confirmed live: pdftotextAvailable() returns true on
this machine despite `pdftotext -v` exiting 99.
That pre-existing comment is the strongest available evidence the brief's
framing is right - the same trap has already been sprung once in this repo, on
the same binary, and cost the PDF rung.
Task 3 review dispatched (sonnet), told the question is not "does it work" but
"would we know if it didn't", since a probe capturing nothing returns "" on
every machine and compares equal everywhere.

Task 3: review (sonnet) - spec PASS, quality APPROVED with one Important.
Confirmed explicitly and independently: pdftotextVersion AGREES with
pdftotextAvailable (both treat "ran, non-zero exit" as present, only ENOENT as
absent). Three mutations, each proven applied by grep + numstat: stdout-only
failed exactly the three named tests; the fixture string appears zero times
outside tests and comments; both byte instruments proven non-trivial.

THE FINDING THAT MATTERS MORE THAN ITS SIZE. The `?? ""` coalescing at
pdf.ts:112-113 has NO test coverage - mutating both away leaves tsc clean and
the suite 18/18 - and the brief claimed a test covered it while the report said
"Concerns: None". But the reviewer went further and mutated `missing` from
`r.error !== undefined` to `r.status !== 0`: ZERO unit tests failed, because
every test injects its own VersionRunner and none exercises the real spawn
mapping. On the actual binary that mutation makes pdftotextVersion() return null
while pdftotextAvailable() returns true - the exact silent disagreement this
task exists to prevent, and the one the implementer's manual Step 6 caught only
because it ran it by hand. NOTHING IN CI WOULD.
That is a new variant of this project's signature defect: not a test that
cannot fail, but a whole code path the suite structurally cannot reach, sitting
underneath an injectable seam that exists for good reasons.

Ruling: T3-R1 - EXTRACT the spawnSync-result-to-VersionProbe mapping into a
pure function taking `{ status, error, stdout, stderr }`, and test it directly:
undefined streams coalescing to "", non-zero status with no error giving
missing:false, ENOENT giving missing:true. Chosen over documenting the coalesce
as unverifiable - because the same extraction converts the task's most
dangerous silent regression (non-zero-exit-as-missing, invisible to 18 green
tests) into a red one, and closes the coalesce gap as a side effect rather than
apologising for it. No binary is spawned, so the no-binaries constraint holds.
- Cost if wrong: one more exported-by-path function and a handful of tests, in
a module the plan already owns.

Task 3: fix round 1/5 dispatched (resumed implementer).

Task 3: fix round 1/5 complete (commits c7f107c..0b9149b). 381 tests (378 + 3),
tsc clean, both files 0 non-ASCII / 0 NUL, toVersionProbe exported by path with
zero hits in src/index.ts.
Ruling T3-R1 landed, and the second half landed BETTER than ruled. I asked for
a test covering the coalesce; the implementer made dropping it a COMPILE ERROR
instead - typing SpawnResultLike.stdout/stderr as `string | undefined` under
exactOptionalPropertyTypes, so the mutation now fails tsc with TS2322 twice
rather than passing silently. A type-level defence makes the defect
unrepresentable rather than merely detected, which is strictly stronger than
the test I asked for.
The dangerous mutation (r.status !== 0) is now caught by a dedicated unit test:
1 failed / 20 passed under mutation, count-verified before and after.
Task 3: round 1 re-review dispatched (sonnet), told to REPRODUCE the TS2322
claim rather than accept it - a type-level defence asserted is worth nothing
until someone has watched the compiler refuse.

Task 3: round 1 re-review (sonnet) - ADDRESSED. Every point reproduced rather
than accepted. The TS2322 claim held verbatim: dropping both `?? ""` produces
exactly TS2322 at pdf.ts(133,5) and pdf.ts(134,5). The dangerous mutation
(missing -> r.status !== 0) now fails exactly one named test, "a non-zero status
with no error is NOT missing - Xpdf's own exit code", 380 passing. Agreement
with pdftotextAvailable re-derived from both implementations rather than from
either's comment. Export surface clean, off-limits files untouched, all
mutations restored and re-verified.
Task 3: complete (commits 4387db9..0b9149b, review clean after 1 fix round).
381 tests. The lesson recorded for the remaining tasks: an injection seam that
makes code testable can leave the code BEHIND it unreachable, and the reachable
side passing tells you nothing about the other.

Task 4: dispatched (sonnet) at BASE 0b9149b; DONE at 6efec58. 394 tests
(381 + 13), tsc clean, tree clean, two new files only, both 0 non-ASCII / 0 NUL.
Controller verified the diff touches NO off-limits file: check.ts,
read-source.ts, classify/, io/evidence.ts, index.ts and exports.test.ts all
absent from it.
The implementer answered the seam question I carried from Task 3 rather than
ignoring it: it reports the only unreachable path is recordingFetcher wrapping
the REAL defaultFetcher inside bin.ts, and argues that is Tasks 5/6/9's job per
the interface spec rather than a gap in this one. Handed to the reviewer to
JUDGE rather than accept - the same claim shape as Task 3's, where "the tests
cover it" turned out to mean "the tests cover the side of the seam they can
reach".
Task 4 review dispatched (sonnet).

Task 4: review (sonnet) - spec PASS, quality APPROVED, one Minor. SIX mutations,
each proven applied via numstat or grep before its result was trusted, all six
discriminating: tee collapsed to the last read, blobHash salted with the rung,
withoutSetCookie dropped, pdftotextVersion stamped unconditionally, a fallback
substituted for an empty finalUrl, and the tee made to catch-and-rethrow. The
reviewer noted that last one proves the non-catching contract DIRECTLY where the
report had hedged it as indirect - the implementer undersold its own evidence.
The seam claim I asked to be judged rather than accepted was UPHELD, with a
distinction worth keeping: Task 3's unreachable code was real-subprocess-specific
mapping logic buried in a closure and reachable only through a real spawnSync,
whereas record.ts is thin and shape-generic and behaves identically whether a
RawResponse comes from a stub or from defaultFetcher. Genuinely deferred to
Tasks 5/6/9, not a Task-3 repeat.

Ruling: T4-R1 - the Minor (the two describe blocks never compose; every
buildArchiveEntry test hand-builds RecordedRead fixtures, so nothing proves an
actual Recorder.reads feeds it) is PROMOTED into a fix round rather than
deferred - because Recorder.reads -> buildArchiveEntry is the archive's central
data path and Tasks 5, 6 and 9 all build on it, so a mismatch surfaces three
tasks downstream with its cause two tasks behind; and because "the types
guarantee it" is precisely the shape of claim Task 3 showed can be hollow, types
pinning shape rather than semantics. - Cost if wrong: one assertion in a test
file the task already owns.

Task 4: fix round 1/5 dispatched (resumed implementer) - one composition
assertion using the real Recorder rather than a hand-built fixture.

Task 4: fix round 1/5 complete (commits 6efec58..bfed104, 20 lines, test file
only). 395 tests (394 + 1), tsc clean, tree clean, 0 non-ASCII / 0 NUL.
RULING T4-R1 VINDICATED BY THE FIX ITSELF. The composition test is
mutation-proven to catch a defect INVISIBLE TO ALL 13 PRIOR TESTS: a status
zeroed only in the RECORDED copy - the tee passing one thing through while
recording another. Because every buildArchiveEntry test hand-built its inputs,
a divergence between what the wrapper returns and what it stores was
structurally undetectable, no matter how many fixture-based tests were added.
That is the seam lesson in its purest form: the two halves were each correct
and each well-tested, and the defect lived only in the join.
Task 4: round 1 re-review dispatched (sonnet), told to check specifically WHICH
tests fail under the reproduction - if the prior 13 also fail, the defect was
not invisible to them and the report overstates.

Task 4: round 1 re-review (sonnet) - ADDRESSED, and the invisibility claim
confirmed EXACTLY. Mutating the tee to record `{...response, status: 0}` while
passing the real response through fails 1 test - the new composition test,
[+0,+0] against expected [202,200] - and leaves 13 passing, INCLUDING the
hand-built test named "records the status of each read, because N4 is decided
from it". A test explicitly about recording status could not see status being
corrupted, because its input was hand-built rather than teed. That is the
sharpest illustration of the seam lesson this project has produced.
Task 4: complete (commits 0b9149b..bfed104, review clean after 1 fix round).
395 tests.

Task 5: dispatched (sonnet) at BASE bfed104; DONE at 3b34545. 410 tests
(395 + 15), tsc clean, tree clean, two new files, both 0 non-ASCII / 0 NUL, no
off-limits file touched. Both mutation probes (merge-seed removal,
preservation-branch disable) isolated exactly the predicted tests.
Controller verified Fable's BLOCKING correction landed correctly before review:
materiallyEqual compares claimsHash, toolVersion, localRulesHash and the
per-read (rung, status, finalUrl, hash, pdftotextVersion) tuples, and compares
NEITHER headers NOR archivedAt. That asymmetry is the whole fix - a predicate
including headers could never fire, because node's `date` differs on every
response, so the churn would have survived its own repair.
Task 5 review dispatched (sonnet), with the decisive question named: does the
idempotency test vary BOTH archivedAt and the headers between writes? Fable's
correction was that the plan's original could not detect the churn it was named
for, so a test varying only archivedAt would inherit that defect.

Task 5: review (sonnet) - spec PASS, quality APPROVED, one Minor. All three
hard properties verified by independent mutation, each proven applied and each
restore diff-verified byte-identical. Merge-to-{} fails MERGES and PRESERVES;
disabling the preservation branch fails ONLY preserves, with both negative
controls staying green, proving they do not cover for it. Refusal throws before
any write as the FIRST statement, so a partial write is structurally impossible
rather than merely untested.
THE DECISIVE ANSWER: the idempotency test varies BOTH fields - second write uses
archivedAt "2026-12-25T11:22:33.000Z" AND date "Fri, 25 Dec 2026 11:22:33 GMT",
both differing from the first. Fable's blocking finding is FIXED, not repeated.
And the lesson from Task 4 propagated without being asked for: this task's tests
are built from real buildArchiveEntry output rather than hand-built ArchiveEntry
literals, closing exactly the gap flagged one task earlier.

Ruling: T5-R1 - the Minor (the version-99 refusal test asserts the throw but not
that on-disk bytes are untouched, unlike its JSON-parse sibling) is DEFERRED to
the ledger, not promoted - because unlike Task 4's composition gap, the defect
class here IS covered: both refusal routes share one throw point that is the
first statement in writeArchive, the sibling test asserts the bytes-untouched
property directly, and a future reordering that broke it would fail that
sibling. Promoting a one-assertion gap whose property is already pinned
elsewhere would be indiscriminate; I promote where a guard cannot fire or a
seam is unpinned, and neither holds here. - Cost if wrong: if someone later
splits the two refusal routes so they no longer share a throw point, the
version-99 route loses its bytes-untouched evidence.

Task 5: complete (commits bfed104..3b34545, review clean, 1 deferred minor).
410 tests.

Task 6: dispatched (sonnet) at BASE 3b34545; DONE at f341183. 421 tests
(410 + 11), tsc clean, tree clean, only bin.ts and bin.test.ts touched - no
off-limits file in the diff. --no-archive present in KNOWN_FLAGS at :59 and in
USAGE at :67.
Controller verified the silent-no-op risk before review: the `{ hosts }`
argument IS passed at bin.ts:164 as `(deps.make ?? defaultFetcher)({ hosts:
rules.hosts })`, and test/bin.test.ts:221 pins THE ARGUMENT ITSELF
(`expect(seen?.hosts).toEqual([RULE])`) rather than downstream behaviour -
which is the right shape, because omitting it looks identical until an author's
local host rule matters. The docstring at :143-144 states why it is load-bearing.
Manual verification ran all six steps and matched: supported verdict, exit 0,
one index.json and one blob with correct fields, --no-archive writing nothing,
and an unchanged-source rerun producing a byte-identical index.json. The
credential-leak check fired correctly in both directions - positive control 2,
index 0 - so it is a real check rather than a zero that means nothing.

NEW ENVIRONMENT FINDING, carried to Task 10: the brief's PID-file kill FAILED
SILENTLY here. `$!` captured the MSYS launcher's PID, not the real node.exe
Windows PID holding the socket, so `kill "$(cat server.pid)"` reported success
while the server kept running. The implementer found the true PID via
`netstat -ano`, killed it with `taskkill //F //PID`, and confirmed the port free
and the temp dir gone before committing. Worth noting that this is the SECOND
failure of the same manual script: Fable's correction 3 already rewrote it from
`kill %1` to a PID file because the original leaked both servers, and the
replacement leaks them differently. Task 10 has a script of the same shape.
Handed to the reviewer to judge whether Task 10's needs the same treatment.

Task 6: review (sonnet) - spec PASS, quality APPROVED, one Important. The
reviewer verified the off-limits set DIRECTLY rather than accepting my claim,
confirmed --no-archive genuinely skips wrapping by checking that check.ts:74
builds the identical defaultFetcher when opts.fetcher is undefined, reproduced
the host-rules mutation (exactly 1 failure, the argument pin at :221), and
confirmed --no-archive was APPENDED to KNOWN_FLAGS/USAGE rather than rewriting
them - which matters because Task 10 adds --fail-on-gone to the same structures.

Ruling: T6-R1 - the Important ("archiving must never fail a run" has no test,
unit or manual, exercising writeArchive's throw inside main()'s try/catch)
enters a fix round as a MANUAL step 8g rather than a unit test - because the
try/catch lives inside bin.ts's non-exported main(), which has had no automated
coverage since plan 1 and whose extraction was deliberately parked by ruling
T9-R1 in plan 2's ledger. The step must assert the EXIT CODE and the corrupt
file's bytes, not merely that a warning appeared: a check greping for the
warning would pass even if the throw killed the run. - Cost if wrong: spec 13
Q4's binding constraint is pinned only by a manual step nobody repeats in CI,
which is weaker than a test but stronger than the two ad-hoc reproductions that
are its current entire evidence.

Ruling: T6-R2 - the PID-kill failure is an ENVIRONMENT gotcha, not a product
defect - the reviewer hit the identical failure independently ($! returning the
MSYS launcher PID while netstat -ano showed the real node.exe under a different
Windows PID). Task 10's script has the same shape and the same failure mode, so
the netstat/taskkill fallback is carried into its dispatch EXPLICITLY rather
than left to be rediscovered. This is the same manual script failing for the
SECOND distinct reason - Fable's correction 3 already rewrote it from `kill %1`
to a PID file because the original leaked both servers. - Cost if wrong: a
stray node.exe holds a port after a manual run, visible immediately to whoever
runs it next.

Task 6: fix round 1/5 dispatched (resumed implementer) - step 8g.

Task 6: fix round 1/5 complete WITH NO CODE DELTA - HEAD stays f341183. The
finding was a coverage gap, not a defect, so the fix was to run the missing
verification and record it.
STEP 8g TRANSCRIPT (the durable record; the Global Constraints require manual
verifications to live in this ledger, since the brief is git-ignored scratch):
a valid baseline was written, index.json was then corrupted with invalid JSON,
and `check` was re-run against the still-supported source. Result: EXIT=0
asserted explicitly rather than inferred; the warning fired ("warn archive not
written: ... is not valid JSON"); the corrupt file's sha256 was byte-identical
before and after; blob count unchanged at 1. writeArchive throws at
readArchive's refusal, before touching anything.
So spec 13 Q4's "archiving must never fail a run" now has TWO independent
reproductions - the reviewer's own during the review, and this one - where
before the round it had none at all.

Ruling: T6-R3 - NO scoped re-review is dispatched for this round, against the
skill's default that every fix round ends with one - because the round produced
an empty diff: there is nothing for a re-reviewer to read, and the "fix" was
itself a verification. Its trustworthiness rests on two independent agents
reproducing the same result by different routes, which is stronger than a third
agent reading a diff that does not exist. - Cost if wrong: a manual transcript
enters the ledger without a second reader, mitigated by the reviewer having
already reproduced the same guarantee independently before the round was
dispatched.
Cleanup used the netstat/taskkill fallback rather than `kill $!`, per T6-R2.
Task 6: complete (commits 3b34545..f341183, review clean after 1 fix round).
421 tests.

Task 7: dispatched (sonnet) at BASE f341183; DONE at b5114c6. 432 tests
(421 + 11), 33 files, tsc clean. Both mutation pins - rungs-from-machine and
finalUrl-fill-in - proven to discriminate before restore.

CONTROLLER ERROR, and the implementer caught it. My dispatch said "3 it()
blocks, total 424". Wrong: the brief specifies 11 and expects 432. The cause is
that I derived task line ranges from the plan as it stood at c4eefd4, BEFORE
the corrections commit bd43fc0 added ~230 lines - so every range after the
insertion point is shifted. Task 7 actually spans 2201-2510, not 1971-2280.
Tasks 2-6 matched by luck rather than by method.
The implementer FLAGGED the conflict and followed the brief, which is
authoritative, rather than silently obeying either number - the same instinct
that caught my bad count in plan 2's Task 6.

Ruling: T7-R1 - for every remaining task the expected total is derived from the
EXTRACTED BRIEF's own it() count, never from a line range into the plan file.
The brief is regenerated per task by scripts/task-brief and cannot go stale;
cached line ranges silently can, and did. - Cost if wrong: none, this is
strictly the better instrument; the cost was already paid once by a dispatch
carrying a wrong number into an otherwise clean task.

Task 7: review (sonnet) - spec PASS, quality APPROVED, ZERO findings. Both
mutation pins reproduced with EXACT matches to the implementer's claimed failure
sets: hardcoding ["node","curl","pdftotext"] fails 5 of 11; adding `|| _url` to
finalUrl fails exactly the one named test. ladderTruncated honesty is genuinely
exercised rather than assumed - the reviewer traced fetcher.rungs through
check.ts:161's rungsAvailable into isLadderTruncated at evidence.ts:90, and test
3 covers it. ArchiveEntry inputs come from buildArchiveEntry via entryOf, never
hand-written literals: the Task 4/5 lesson carried forward without being asked.
Task 7: complete (commits f341183..b5114c6, review clean). 432 tests.

Task 8: dispatched (sonnet) at BASE b5114c6; DONE at bbbd9cf. 458 tests
(432 + 26, derived from the BRIEF per ruling T7-R1), tsc clean, tree clean, two
new files. All three targeted mutations - the deleted-table row, the R-invariant
degrade, and the gone/confound reorder - failed exactly the tests the brief
named and no others, with the post-restore diff byte-identical.
Controller inspected the accusing route before review: `sourceDrift` occurs
exactly TWICE in compare.ts - once in the DriftCategory union, once at a single
return site (:194), reached only when L === "unsupported" and the replay is
supported, after the no-baseline, gone, confound and unreachable guards have all
returned. Structurally one route.
Task 8 review dispatched (OPUS - the highest-stakes task in the plan) with the
instruction that a single return site is STRUCTURE, NOT PROOF: it must
enumerate the whole input space (every L verdict x every A verdict x baseline
present/absent x each confound x gone/not-gone), drive compareCitation across
it, and report which combinations actually reach sourceDrift. Also to confirm
the near-misses do NOT accuse, since a procedure that accuses correctly in the
licensed case AND in a neighbouring one is worse than one that never accuses -
the correct accusations lend credibility to the wrong ones.

Task 8: review (OPUS) - spec PASS, quality APPROVED, NO Critical, NO Important.
THE STRONGEST VERIFICATION IN THIS PROJECT SO FAR. The reviewer built an oracle
transcribed from spec 8.3 DIRECTLY - not from the code - and drove 48,960
combinations through compareCitation: L(4) x A(5 incl null) x 33 entry configs
x 8 status shapes, with each confound varied independently. ZERO mismatches
against the oracle. sourceDrift returned in exactly 64 cases whose projection is
a SINGLE POINT ON EVERY AXIS: L=unsupported, A=supported, R=supported, zero
confounds, baseline present. And the arithmetic closes - 64 = 8 confound-free
input configs x 8 status shapes - so no combination is unaccounted for. That
last step is what turns a count into a proof.
Every near-miss returns something else (claims/rules/pdftotext confounds ->
confounded; A not supported -> pipelineDrift; no baseline or R violated ->
noBaseline; L unreachable -> unreachable; L supported -> clean; 404/410 -> gone).
Zero confound-carriage leaks: confounds carried with the exact expected count on
gone and confounded, empty everywhere else - Fable's correction 2 holds.
All three mutations reproduced with proof-of-application; two fail EXACTLY ONE
test apiece, which the reviewer rightly reads as those tests being the sole
guardians of their invariants rather than passengers.
Accusing rows do appear under [404]/[410] status shapes, and that is CORRECT per
Fable's correction 5: with L=unsupported a rung positively read the document, so
the 404 rung was vetoed and liveGone is false.

Ruling: T8-R1 - the Minor false comment at compare.ts:39-40 ("what is left for
this flag is the noBaseline row and mixed-status unreachable rows") is PROMOTED
into a fix round rather than deferred - liveGone is PROVABLY always false on the
unreachable row, since :171's gone return precedes :179, and the exhaustive
drive found no counterexample. One clause, but documentation gone quietly false
is this repo's worst defect class, and this instance sits in the module where a
wrong belief mints false accusations. - Cost if wrong: one comment edited in a
file the task already owns.

Ruling: T8-R2 - `confounds: []` on the R-violated noBaseline row is DEFERRED,
not fixed: the entry's fields are present and computable so the report could say
"and your claims changed too", but spec 8.3 does not require it and the row is
non-accusing either way. Contestable rather than wrong. - Cost if wrong: a
noBaseline report is slightly less informative than it could be.

TWO ITEMS CARRIED INTO TASK 9's DISPATCH, both about how the reporter consumes
Task 8's output rather than about the output itself:
(a) `missed: input.liveMissed` is carried unconditionally on EVERY row,
including noBaseline and gone. Task 9 must not print it as an accusation off a
non-accusing row - that would manufacture exactly the accusation the whole
decision procedure exists to withhold.
(b) console.warn at compare.ts:147 puts CLI-shaped IO in a core-side module.
Brief-specified and test-pinned, so not a defect to fix here, but Task 9's
reporter must not double-report the same line.

Task 8: fix round 1/5 complete (commits bbbd9cf..56b9e97, 3 lines, comment
only). 458 tests unchanged, tsc clean. The implementer verified the claim
against control flow BEFORE editing rather than after: liveGone can only be true
on the noBaseline row, which returns before :171's gone-check, and every other
returned row has already passed that check.
Round 1 re-review dispatched (sonnet) despite the diff being three comment
lines - because the base rate of "a correction introduces a fresh falsehood" is
high in this repo, the previous comment was also written in good faith, and the
neighbouring sentence in the same block was never re-checked. The re-review is
told the point is whether the NEW sentence is true, and to check the sentence
BEFORE it as well.

Task 8: round 1 re-review (sonnet) - ADDRESSED. Control flow traced with actual
line numbers rather than argued: liveGone computed at :121, both noBaseline
returns (:142 entry-absent, :151 R-violated) precede the gone-check at :172, and
every other returned row (:178 confounded, :183 unreachable, :189 unclaimed,
:192/:195 the L-grid) is reached only after :172 has run and returned false. The
reviewer added a second, independent reason the new sentence holds: liveGone
requires liveVerdict === "unreachable" at :121, so it is structurally false on
every non-unreachable row anyway.
AND THE NEIGHBOURING SENTENCE HELD. The claim I asked to be re-checked - that
the flag "fires on a node rung that 404s before a curl rung that reads the
document" - was verified against signals.ts:62 and documentGone at :181: a
single 404/410 among reads vetoes the whole verdict to unreachable regardless of
a later rung succeeding, while liveStatuses still carries that 404. Not
falsified by the fix. That check is the one this repo's history most demanded
and the one a smaller review would have skipped.
Comment-only confirmed by filtering the diff for changed non-comment lines and
getting nothing.
Task 8: complete (commits b5114c6..56b9e97, review clean after 1 fix round).
458 tests. The decision procedure is shipped, and its exclusivity is proven
across 48,960 combinations against a spec-derived oracle.

Task 9: dispatched (sonnet) at BASE 56b9e97; DONE at 4231d54. 468 tests
(458 + 10), tsc clean, tree clean, two new files.
Controller verified the never-writes-the-archive invariant properly before
review: the store import is `{ readArchive, readBlob }` ONLY, and recheck is
absent from src/index.ts (0 hits).

A SEVENTH INSTRUMENT FAILURE, and a NEW VARIANT: THE CHECK'S OWN DOCUMENTATION
DEFEATED IT. The brief's Step 6 greps src/recheck.ts for "writeArchive" to prove
the import is absent - but the file's doc comment at :54 says "This module does
not import `writeArchive`", so the grep always matches and the `|| echo FAIL`
branch can never fire. The invariant is real and holds; the check for it proved
nothing. The implementer caught it and substituted an import-line-restricted
grep. Controller confirmed: the bare word appears exactly once in the file, in
that comment.
This one is worth naming separately from the other six, because the defeating
text is the very sentence documenting the property. Any grep-for-absence over a
file that explains the absence has this bug, and the more carefully the code is
commented, the more certainly the check is broken.
Task 9 review dispatched (OPUS - a composition task, where the joins are the
risk) with per-join verification required by driving rather than by reading
types, and with a judgement asked on whether Task 10 could plausibly misread
`missed` off a non-accusing row.

Task 9: review (OPUS) - spec PASS, quality APPROVED with findings. Every join
DRIVEN rather than read: a baseline built from a REAL recordingFetcher through
buildArchiveEntry -> writeArchive -> readArchive -> readBlob -> replayFetcher ->
check(), including a two-rung sub-floor-then-curl escalation, reproducing all
seven categories. Both arms confirmed to receive the same check(), the same url
and claims REFERENCES, identical option key sets, and `rules` as the SAME OBJECT
BY REFERENCE - and no spurious `rules: undefined` when there are none. The
archive-write prohibition is enforced three ways and the behavioural test was
proven to fail when a real writeArchive call is injected.

Ruling: T9-R1 - Important 1 (deleting `sourceLabel: c.label` from the replay arm
leaves all 10 tests green) is FIXED, not deferred, even though it is
verdict-inert today - because it is inert ONLY because C1's slugLabelOverlap is
computed and deliberately not consulted at verdict.ts:104, and the moment C1 is
consulted or a rule reads it, L-vs-A silently becomes two different questions
with nothing objecting. That is the invariant the entire control arm rests on;
an unguarded founding invariant is worse than an unguarded derived one. - Cost
if wrong: one test pinning a property that is currently unobservable.

Ruling: T9-R2 - Important 2 is FIXED, AND IT CORRECTS MY OWN CARRY-FORWARD. I
warned Task 9 that `missed` rides on noBaseline, gone, unreachable and
confounded. Driven, gone and unreachable CANNOT carry a non-empty missed -
check.ts:167 gates it on v === "unsupported". The real danger is one I did not
name and the brief does not either: pipelineDrift CAN carry it, and pipelineDrift
and sourceDrift are the two arms of the same L === "unsupported" branch at
compare.ts:195, so one render function for that branch prints an accusation on
both. My warning pointed at the two rows that were already safe and missed the
one that is not. - Cost if wrong: Task 10 renders an accusation on a row that
blames this tool rather than the source.

Ruling: T9-R3 - Minor 3 (recheck.ts:64 duplicates check.ts:74's host-rule wiring
verbatim) is fixed with a COMMENT naming the pairing, not by extracting a shared
helper - because src/check.ts is off-limits to this plan and extraction would
touch it. Two copies of the expression whose omission already cost this project
once should at least be visibly paired. - Cost if wrong: a future edit changes
one copy and not the other, which the comment makes visible but does not
prevent.

Ruling: T9-R4 - Minor 4 (no test that per-citation liveStatuses cannot leak) is
promoted: the code is right, the recorder being constructed inside the loop at
:80, but a 404 on citation 1 marking citation 2 `gone` would be a false report
about a live document, and test 8 nearly covers it already.

EIGHTH INSTRUMENT FAILURE, self-caught by the reviewer: `git checkout` restores
this file as CRLF, so its \n-anchored Python replace matched ZERO times. Its own
count assertion caught it. That is the practice paying for itself in the tool
that enforces the practice.
Task 9: fix round 1/5 dispatched (resumed implementer) with 4 items.

Task 9: fix round 1/5 complete (commits 4231d54..aa1a455). 470 tests (468 + 2),
tsc clean, tree clean, two files.
Controller read the Important-2 fix before dispatching the re-review: the
RecheckReport.outcomes docstring now says missed is the live arm's list "on
EVERY row - present even on rows that do not accuse - and is an ACCUSATION only
when category === 'sourceDrift'", naming pipelineDrift and confounded
explicitly and saying what each actually blames. That is the sentence Task 10
needs, and it names the row I got wrong rather than the two I wrongly warned
about.
Round 1 re-review dispatched (sonnet), told to reproduce both mutations
(sourceLabel deletion, recorder hoisted out of the loop) and to answer YES/NO on
whether a Task 10 implementer reading only that comment would gate correctly -
because the fix for a documentation finding is only as good as its readability
to the person it was written for.
It was also warned NOT to grep plainly for writeArchive when re-checking the
never-writes invariant: the file's own doc comment contains the string, which is
exactly how the plan's Step 6 check became unfalsifiable. And warned to check
its own mutation anchors against the file's real line endings, since the
previous reviewer's \n-anchored replace matched zero times on a CRLF-restored
file.

Task 9: round 1 re-review (sonnet) - ALL FOUR ADDRESSED. Both mutations
reproduced with proof-of-application: deleting sourceLabel from the replay arm
fails exactly the new parity guard ("expected undefined to be 'The Committee
Report'"), and hoisting the recorder out of the loop fails exactly the new leak
test ("expected 'gone' to be 'unreachable'"). The never-writes invariant was
re-checked on IMPORT LINES ONLY, not by the plain grep the file's own comment
defeats.
On the yes/no I asked for: YES, sufficient - with a caveat that is really a
compliment to the fix. noBaseline can ALSO carry a non-empty missed and the
comment does not name it, but the stated rule is CATEGORICAL ("an ACCUSATION
only when category === 'sourceDrift'") rather than enumerative, so an
implementer following it gates correctly regardless of the incomplete list. A
rule of the form "only X licenses this" survives an incomplete list of what does
not; a rule that enumerates exceptions does not. Worth carrying as a drafting
principle.
Task 9: complete (commits 56b9e97..aa1a455, review clean after 1 fix round).
470 tests.

Task 10: dispatched (sonnet) at BASE aa1a455; DONE at e039e92. 479 tests, tsc
clean, tree clean, only bin.ts and bin.test.ts touched.

MY COUNT WAS WRONG A SECOND TIME, for a NEW reason, and the implementer caught
it again. I derived 480 from the brief's it() count per ruling T7-R1. But one of
the brief's ten it() blocks REPLACES an existing usage-string test rather than
adding one, so the net delta is +9 and the correct total is 479. Controller
confirmed: +10 added, -1 removed in the test diff. The it()-count-from-the-brief
method is blind to replacements, exactly as the line-range method was blind to
the corrections commit.
Ruling: T10-R1 - the expected total is derived from the brief's it() count AND
sanity-checked against `git diff` added-minus-removed it() lines once the commit
exists. Neither instrument alone is sufficient: a brief count cannot see a
replacement, and a diff count cannot be known before the work is done. - Cost if
wrong: an implementer reconciles against a number that is stale in a third new
way; mitigated by every implementer so far refusing to pad to my number.

Controller verified before review: the accusation is gated CATEGORICALLY at
bin.ts:429 on `o.category === "sourceDrift"` rather than on an enumeration of
exclusions; exit-1 dominance sits at :83; and both --no-archive and
--fail-on-gone survive together in KNOWN_FLAGS and USAGE (4 occurrences), so
Task 6's flag was appended to rather than rewritten.
Manual verification ran all five transcripts with the netstat/taskkill fallback
per T6-R2, and - the part that makes the rest meaningful - PROVED THE DRIFT
TOGGLE FIRED (0 -> 120 occurrences) before reading the recheck result. A toggle
that silently failed to fire would have made the entire exit-1 transcript
meaningless, which is precisely how the pre-correction version of this script
printed exit 0 while verifying nothing.
Task 10 review dispatched (OPUS - the reporter can undo a proof made two tasks
ago) with the reporter to be DRIVEN across every category, including a
pipelineDrift and a noBaseline each carrying a non-empty missed.

Task 10: review (OPUS) - spec PASS, quality APPROVED, one Important + one Minor
+ two flagged. The reviewer DROVE the reporter across all eight categories with
every outcome carrying a non-empty missed: exactly ONE MISS line, on
sourceDrift. pipelineDrift printed only the regression notice; noBaseline only
its own line. Task 8's proof survives the reporter. End-to-end exit sweep: no
route returns 1 from a pipeline-drift-only run; all three pre-comparison
infrastructure 2s reachable and returning before any tally; no prose anywhere
claims exit 2 passes a build.
The manual transcript was judged SOUND and the toggle proof VALID for a reason
worth recording: the two probes are chained with && ahead of the recheck in one
invocation, so the 0-then-120 ordering is STRUCTURAL rather than asserted, and
the probe is an independent instrument (raw node:http, not the tool's ladder) so
it cannot mask a tool defect. The archive-untouched claim is proven not by 7b
but by a 7c-to-7d cross-match on the same archivedAt value.

Ruling: T10-R2 - the unprotected accusation gate at bin.ts:429 is FIXED, NOT
covered by ruling T9-R1's park. T9-R1 parked the CLI BRANCH's untestability -
control flow, exit codes, process I/O - where extraction would be a design
change the spec does not license. This is a PURE FORMATTER, and extracting it
changes no control flow; it is the same shape as Task 3's toVersionProbe
extraction, where an injection seam had left the real logic unreachable. And
what the line guards is the single thing this plan exists to prevent: mutating
it to `missed.length > 0` prints SOURCE DRIFT on pipelineDrift, noBaseline AND
clean while the suite stays green at 479. An exclusivity proven over 48,960
combinations cannot rest on a line no test touches. - Cost if wrong: one
exported pure function and two tests in a file the task already owns.

Ruling: T10-R3 - the unreadable-archive case is surfaced in the report rather
than left to a console.warn. It degrades every row to noBaseline and exits 0, so
an author reads "you never ran check" when the truth is "your archive is
corrupt" - materially different, and RecheckReport.archiveUnreadable already
carries the fact. - Cost if wrong: one line of report output.

Task 10: fix round 1/5 dispatched (resumed implementer) with 3 items.

Task 10: fix round 1/5 complete (commits e039e92..f60c512, +173/-49). 485 tests
(479 + 6, verified by the controller as +6/-0 in the test diff per ruling
T10-R1's two-instrument rule), tsc clean, tree clean, two files.
renderOutcome extracted as an exported PURE function at bin.ts:113 and correctly
absent from src/index.ts (0 hits), so the public surface is unchanged. The
implementer added a `clean` twin beyond the ask, and caught its own STALE dist/
during manual verification of the archive-unreadable notice - the tenth
instrument failure recorded in this project, and the second where the instrument
was a build artefact rather than a command.
Task 10: round 1 re-review dispatched (sonnet), told to re-apply the gate
mutation and report exactly WHICH tests fail, to judge whether the extraction is
behaviour-preserving rather than accept the claim, and to check the corrected
report citation against the brief's ACTUAL text rather than accept the
correction - a false citation corrected by another false citation would be this
repo's signature failure at one remove.

Task 10: round 1 re-review (sonnet) - ALL THREE ADDRESSED. The gate mutation
re-applied with count proof now fails EXACTLY the three named tests
(pipelineDrift, noBaseline, clean) while the sourceDrift positive stays green,
and the full suite goes 3 failed / 482 passed - not green. The extraction is
behaviour-preserving by line-for-line diff read, with the one apparent change
(rungsAttempted default [] versus the old `?? ""`) shown semantically identical.
The corrected citation was checked against the BRIEF'S ACTUAL TEXT as instructed:
its only $! mention at :365 prescribes `echo $! > server.pid` and :320 discusses
killing by a captured PID - the brief never documents $! as capturing the wrong
PID, so the restatement is now accurate. A false citation corrected by another
false citation would have been this repo's signature failure at one remove, and
it was checked rather than assumed.
Honest caveat recorded by the reviewer rather than glossed: the report's claim
that the manual drift transcript is "byte-identical" to the original is asserted
by inspection, not by a saved-and-diffed comparison, so it is not independently
checkable from what was recorded. The static equivalence check stands on its own.
Task 10: complete (commits aa1a455..f60c512, review clean after 1 fix round).
485 tests. recheck is reachable from the CLI.

---

## Final whole-branch review, fix wave, and close-out

Final whole-branch review (opus) over 84202d3..e4b5a13, 20 commits: READY WITH
FIXES - 3 Important, 3 Minor, none touching the keystone.
THE KEYSTONE HOLDS, PROVED END TO END THROUGH THE DELIVERY PATH. The reviewer
transcribed spec 8.3 into an independent oracle and drove 86,400 combinations
through the REAL compareCitation -> renderOutcome -> classifyRecheckRun
pipeline: 0 category mismatches, 0 accusation leaks, exit 1 on exactly the 108
sourceDrift rows and nothing else; --fail-on-gone adds only the 2,000 gone rows.
The harness was proved FALSIFIABLE FIRST - reinstating the deleted table gave
324 mismatches, removing the reporter's gate 648 leaks, disabling the confound
short-circuit 10,912. Ten source-level mutations, each with a proven anchor
count, all red.

Its three Important findings, two of them the same defect at new sites:
(1) src/bin.ts:155-157 REINTRODUCED A SENTENCE ALREADY MEASURED FALSE. The
liveGone clause was found false by Task 8's reviewer and corrected in
compare.ts at 56b9e97 - and e039e92 restored it VERBATIM in the reporter two
commits later, where Task 11's whole-document sweep missed the twin. The
correction was durable; the phrasing travelled.
(2) recheck --json WAS AN UNGATED ACCUSATION SURFACE. The terminal reporter was
gated, tested and mutation-proven so that missed renders only on sourceDrift.
The JSON emitted the whole outcome list. Measured: a confounded citation printed
"not compared" to the terminal while the payload carried
missed: ["committee spending rose sharply during the fourth quarter"]. Spec
7.4's doctrine is that the schema CANNOT EXPRESS an accusation - structural, not
promised - and one of its two channels was not structural at all. Same lesson as
plan 2's BUG:-prefix near-miss: a gate protects one path, and the display layer
has more than one.
(3) test/bin.test.ts:381-383 stated its own coverage BACKWARDS, claiming a
broken gate would pass its tests when that gate in fact fails 3 of the 4 - worse
than silence, because it invites a reader to "strengthen" tests that work.

Final fix wave (sonnet, single dispatch): commit 844b4ef, all five applied.
491 tests (487 + 4, reconciled both ways), tsc clean, four files.
Scoped re-review (opus) over e4b5a13..844b4ef: ALL FINDINGS ADDRESSED, driven
rather than read. It rebuilt dist/ first and found it WAS stale (bin.js 23:13
against bin.ts 23:16), so that warning was live. Driving recheck --json over a
fixture yielding all four categories with non-empty live missed: the fixed build
emits missed ONLY on sourceDrift, the other three empty, and no claim phrase
appears anywhere in the payload. Re-driving the same fixture through the pre-fix
line reproduced the leak exactly. Both --json gate mutations each fail 3 of the
4 named tests.
It judged the dated-records boundary carefully rather than accepting it: all six
.superpowers/ copies are untracked scratch that ship with nobody; the three
tracked copies in docs/ are all legitimate dated records - a verbatim preserved
review, the ledger quoting the clause INSIDE ruling T8-R1 which is the record of
it being found false, and the as-dispatched plan headed with its own correction
note. NO LIVE DOCUMENT ASSERTS THE FALSE CLAUSE.

Ruling: F3-1 - the re-review's one soft spot is PARKED: plan:83 carries the
superseded clause as prose in the plan's own voice without an IN-PLACE
superseding marker, unlike spec 8.3:1383's "Corrected 2026-09-09: the decision
table is deleted, not adjusted", which is this repo's stronger convention. Not
fixed, because the plan is an as-dispatched artifact already headed with a
correction note and citing base facts (HEAD e66ed34, 361 tests) that are
visibly stale, so a reader knows its era - and the skill allows exactly one fix
wave. - Cost if wrong: a reader quoting the plan's prose out of context repeats
a clause the shipped source contradicts.

Ruling: F3-2 - the re-review's observation that `results` still carries `missed`
on unsupported rows is NOT a finding and needs no change: that is the live arm's
ordinary `check --json` output, it carries no drift category, and it is
7.4-compliant (measured: no excerpt, no retrievedAt). `missed` on an
`unsupported` verdict is the licensed case - it is what unsupported means. -
Cost if wrong: none identified; the alternative would strip information the
schema exists to carry.

Close-out at 844b4ef: 21 commits over main @ 84202d3, 491 tests (from 361), tsc
clean, build clean, tree clean. THE PLAN'S CENTRAL PROMISE VERIFIED BY HASH, not
by inspection: src/check.ts, src/fetch/read-source.ts, src/io/evidence.ts,
src/index.ts and test/exports.test.ts are BIT-IDENTICAL to main by blob hash,
and the whole src/classify tree is identical by tree hash (f349065). Twenty-one
commits, and the verdict machinery never moved.
Bytes: the three standing ASCII exceptions unchanged at 57/45/3, README and
CHANGELOG at 0, the only NUL the deliberate PDF fixture.

THIRTEEN INSTRUMENT FAILURES are now on record across this project, three of
them hit by the final reviewer inside the review that produced these findings.
The list, because the variety is the point: a sed pattern with a backslash-u
escape that matched nothing and reported a passing test against unmutated code;
a decoded-char byte metric reading 19 where the byte count was 57; git diff over
an untracked file; a mutation anchor written with LF against a CRLF working
file; a grep-for-absence defeated by the very comment documenting the absence;
a verification run against a stale dist/; a negative control that itself
silently no-opped; and a check whose failure branch was unreachable because its
success branch always matched. Every one was caught by requiring that a check be
shown able to fail before its pass is believed.
