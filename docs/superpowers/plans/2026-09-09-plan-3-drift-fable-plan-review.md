> **Preserved 2026-09-09** out of git-ignored `.superpowers/sdd/` scratch, which
> does not survive worktree cleanup. **Numbering owned by this document:
> corrections 1-7**, of which 1 is blocking, 2 and 3 are major, and 1 and 2
> amended spec 8.3 before the first wave was dispatched. A citation like
> "Fable's correction 5" in this plan or in `src/` means THIS document, not the
> review of 8.3 beside it, which owns corrections 1-14.

# Fable plan review: plan 3 (`recheck` and the archive)

Reviewed at `5cfbade` on `feat/plan-3-drift`, worktree green (361/361, 29 files,
re-run during this review), `dist/` built, tree clean. The plan (4,023 lines),
the drafter's report, the amendment report, spec 8.3 (1305-1800) plus sections
2, 6.6, 7.4, 8, 8.1, 11 and 12, and the plan-2 ledger were all read. Every
factual claim checked below was checked against the code or a command run on
this machine, not against the citation.

**Amendment check, done first as instructed:** the 8284691 amendment discharged
corrections 1-13 where its report says they landed - the decision procedure and
R-invariant in 8.3, the corrected "Archive on success" paragraph and command
table in section 8, the sink withdrawal with the `{ hosts }` detail, the PDF
ruling, the replay spec, the gone category with 6.2 (line ~385) and 6.3 (line
~637) discharged, the exit-code trio, the C7 requirement conversion, the five
format pins, C12's what-recheck-writes and the 8.1 file list, the C13 split.
C14 is parked and named in the preamble. The plan is faithful to an amendment
that actually landed.

## VERDICT: APPROVE WITH CORRECTIONS

One blocking, two major, four minor. Corrections 1 and 2 change the spec by a
sentence each and reshape parts of Tasks 5, 8 and 10; both must be applied
before the first wave is dispatched (Task 5 is in it). Correction 3 rewrites
the two manual verification scripts, which otherwise stall the executor on this
machine. 4-7 are test-quality and instrumentation fixes inside their tasks.

---

## Correction 1 - BLOCKING, CONFIRMED: `index.json` churns on every green run, and Task 5's idempotency test is named for a property it cannot check (drafter's question 1)

The drafter's own diagnosis is right and I verified it: Task 6 stamps
`archivedAt: new Date().toISOString()` into every staged entry on every run,
and every entry stores response headers, which for the node rung include
`date` and often `age`/`x-request-id`. So a committed `<doc>.archive/index.json`
diffs on **every** `check` of an unchanged corpus - a green CI run leaves a
dirty tree, in the store 8.1 requires committed. Task 5's test "is idempotent:
re-archiving unchanged bytes rewrites the same hash and stores no new blob"
holds `archivedAt` fixed in its fixture (`staged(["unchanged body"])` uses the
default timestamp in both writes), so it pins content-addressing of blobs and
**cannot** detect the index churn a reader of its name would assume it rules
out - exactly the plan-2 defect class ("a test that could not test what it
named").

**Cost if shipped:** every user of a committed archive gets a noisy diff and a
dirty tree per green run, forever; the fix later is a writer-behaviour change
made after users have formed expectations about `archivedAt`.

**Fix (adopt the drafter's proposal, with two sharpenings):**

- In Task 5, `writeArchive` keeps the EXISTING entry, byte-for-byte, when the
  incoming one differs in nothing material. Material = the reads' `(rung,
  status, finalUrl, hash)` tuples in order, `claimsHash`, `toolVersion`,
  `localRulesHash`, and each read's `pdftotextVersion`. **The comparison must
  ignore `headers` as well as `archivedAt`** - the drafter's list omitted
  headers, and node's `date` header differs on every response, so a predicate
  that compared headers would never fire and the churn would survive its own
  fix. Keeping the whole old entry (old headers, old date) is coherent: the
  entry is a record of what was seen at `archivedAt`. A material change (a
  toolVersion bump included) rewrites the entry with a fresh `archivedAt`, so
  the bundled-version note self-heals on the next green check.
- The Task 5 test the drafter says it cannot currently perform: write twice
  with DIFFERENT `archivedAt` values AND a different volatile header (vary
  `date`) over identical bodies, assert `index.json` byte-identical; negative
  control: change one body, assert the index changes and `archivedAt` is the
  second timestamp. Mutation proof, applied-and-verified per the plan's own
  doctrine: delete the preservation branch, watch this test go red, restore.
- One sentence in 8.3's content-addressing paragraph, since the spec is the
  authority and currently discloses idempotency of blobs only: the index
  preserves an entry that changed in nothing but `archivedAt` and headers, so
  `archivedAt` means "when this baseline was established or last materially
  changed", and "gone since `<archivedAt>`" reads "gone since at least that
  date". No format-version bump - this is writer behaviour, not shape.

## Correction 2 - MAJOR, CONFIRMED: the gone row must be evaluated above the named confounds; the `liveGone` report clause is not sufficient (drafter's question 2)

Ruling on the ordering itself, which the plan follows 8.3 in placing
confounds-first: **the ordering changes.** A named confound explains a
divergence between the arms - claims edited, local rules changed, a different
poppler. Gone-ness is the origin's own statement about `L` (N4: 404/410), and
no confound can produce or explain it: a claims edit cannot 404 a page, a
local rule changes classification, not the wire status, and the pdftotext
confound cannot co-occur with gone at all (the pdftotext rung reports
`status: 0`, so N4 never fires on a PDF - the disclosed residue). Under the
committed ordering, `recheck --fail-on-gone` returns 0 for a genuinely deleted
page whenever that URL's claims were edited since archiving - the flag the
author passed to catch dead links, silently disabled by an unrelated edit, on
the ordinary sequence (edit claim, check fails, recheck). The report clause
keeps the information visible but not the category, the drift number, or the
opted-in exit code.

The reorder cannot mint an unlicensed exit 1: the gone row's licence is the
origin's 404, it contributes 0 by default and 1 only under the explicit opt-in,
and it sits after the no-baseline and R-invariant checks either way.

**Fix:** amend 8.3's procedure block (move the gone row above the confound
row, one sentence of reason: no confound can explain an origin's 404; note the
deliberate exception to "a confound short-circuits everything"). In Task 8,
evaluate gone after the invariant/no-baseline checks and before
`namedConfounds`, and carry any computed confounds on the gone outcome so the
report still names them. Change the one test this falsifies - "a confounded
citation whose live read 404'd still reports liveGone" becomes "...is GONE,
with the confound named on the outcome" - and Task 10's clause printing
accordingly. `classifyRecheckRun` is untouched.

## Correction 3 - MAJOR, CONFIRMED: Task 10's manual verification cannot run on this machine as written, and both manual scripts leak their servers

Measured during this review, on this machine (Git Bash / MSYS):

- Bash's `/tmp` is `C:\Users\noaho\AppData\Local\Temp` (`cygpath -w /tmp`),
  and MSYS converts path ARGUMENTS to native binaries (`node x.js /tmp/p`
  arrives as `C:/Users/noaho/AppData/Local/Temp/p` - verified). So Task 6's
  Step 8 mostly works.
- But a path INSIDE a `node -e` program string is NOT converted:
  `fs.existsSync("/tmp/probe/MARKER")` resolved to `C:\tmp\...` and printed
  `false` against a file bash had just created (verified). Task 10 Step 7's
  server reads `fs.existsSync("/tmp/tm-drift/DRIFT")` inline - so `touch
  /tmp/tm-drift/DRIFT` never flips it, the drift run prints `clean`,
  `DRIFT RECHECK EXIT=0`, and the plan's own instruction is "stop: that is a
  finding". The executor stalls on an instrumentation artifact
  indistinguishable from a product defect. The two inspection one-liners
  (`require("/tmp/tm-drift/doc.archive/index.json")`, same for the evidence
  file) crash with MODULE_NOT_FOUND for the same reason.
- Both manual verifications split across several fenced blocks, each a fresh
  Bash invocation (the plan's own environment note says so), so the final
  block's `kill %1` has no job table: the throwaway servers on 8765/8766 leak
  past the task, and a re-run's `listen` fails against the stale one.

**Fix:** restructure each manual verification so it is runnable as written
here: pass every path the node server or inspector needs as an ARGV (which
MSYS converts) and read it from `process.argv` - or generate a `server.mjs`
under the scratch directory; capture the server PID at spawn
(`... & echo $! > "$DIR/server.pid"`) and kill by that PID in the final step;
prefer one self-contained invocation per verification phase. The assertions
themselves are right and should not be weakened.

## Correction 4 - MINOR, CONFIRMED: Task 3's "does not treat a non-zero exit as absence" test cannot fail unless its sibling fails

`VersionProbe` deliberately carries no exit status - good design - but that
means the test's input `probe({ missing: false, stderr: XPDF_STDERR })` is
identical to the first test's input (`missing: false` is the helper's
default). The line the name promises to pin - `missing` derived from
`r.error`, never from `r.status` - lives in the untested `probePdftotext`
closure and is covered only by the manual Step 6. That is an acceptable line
(no test spawns binaries; `pdftotextAvailable` already draws it), but the test
overclaims. **Fix:** fold it into the first test's comment, or keep it with a
comment saying the enforcement is structural (no status field exists to
consult) plus Step 6's transcript; and make Step 6's expectation explicit that
on THIS machine - a build measured to exit 99 - printing `null` is a failure
to stop on, not a value to record. (I re-ran the measurement:
`status 99, stdout "", stderr "pdftotext version 4.00\r\n..."` - the plan's
fixture, the stderr-first capture, and the `spawnSync` choice are all
correct; see ruling 3 below.)

## Correction 5 - MINOR, PLAUSIBLE: the `liveGone` clause prints on citations whose live arm read the page

`liveGone = liveStatuses.some(isGoneStatus)` is computed over every live read.
The ladder climbs past an N4-only veto, so a node rung that 404s followed by a
curl rung that reads the document yields `L = supported`, category `clean` -
and Task 10 prints "the live read was a 404 or 410, so this source may be
gone" under a citation that was just read. A UA-dependent 404 is a real shape.
Cost: a false-alarm clause, no exit effect. **Fix:** print the clause (and set
the outcome flag, if preferred) only when the live verdict is `unreachable` -
after Correction 2 that leaves it doing exactly its remaining job: flagging a
404 under `noBaseline` and mixed-status `unreachable` rows.

## Correction 6 - MINOR, CONFIRMED: Task 5 Step 6's leftover-tempdir check is vacuous on this machine

`ls "$TMPDIR" 2>/dev/null | grep -c ... || echo "0 leftover temp dirs"` -
`TMPDIR` is unset in this shell (verified: `echo ${TMPDIR:-UNSET}` prints
`UNSET`), so `ls` fails silently, `grep -c` reads empty input, and the check
reports success without ever looking at the directory `mkdtempSync(tmpdir())`
actually used - the reports-success-without-running shape this repo keeps
finding in its instruments. **Fix:** derive the directory the tests used:
`T=$(node -e "console.log(require('os').tmpdir())") && ls "$T" | grep -c
"testimonium-archive-"`, expecting `0`, with the `|| echo` branch removed so a
failure is loud.

## Correction 7 - MINOR, CONFIRMED: Task 6 Step 8's set-cookie check prints `0` twice

`grep -ci "set-cookie\|SECRET123" index.json || echo "0 (good)"` - on no
match, `grep -c` prints `0` AND exits 1, so the `||` fires and the transcript
reads `0` then `0 (good)`. The stated expected output ("must print `0 (good)`")
does not match what a correct run prints, which is exactly the kind of
discrepancy the plan elsewhere orders the executor to stop on. **Fix:** drop
the `-c` and invert: `grep -qi "set-cookie\|SECRET123" index.json && echo
"LEAKED - STOP" || echo "0 (good)"`, or state both lines as expected.

---

## The three rulings

**1. `index.json` churn - the drafter's fix is right, and its test currently
cannot detect the churn.** Confirmed in Task 6's wiring (`new Date()` per
entry) and Task 5's fixture (fixed `archivedAt` in both writes). Adopt
preservation with the two sharpenings in Correction 1: the equality must
ignore headers as well as `archivedAt` or it never fires, and the test must
vary both between writes, with a negative control and a proven-applied
mutation. `archivedAt` becomes "established or last materially changed" - one
sentence in 8.3, no version bump.

**2. Confound-before-gone - the ordering itself changes.** The `liveGone`
clause is a disclosure, not a detection: under `--fail-on-gone` the committed
ordering returns 0 for a deleted page whose claims were edited, which is the
opt-in flag silently disabled by an unrelated edit. No confound can explain an
origin's 404 (and the pdftotext confound cannot co-occur with gone at all,
since the PDF rung reports status 0). Move the gone row above the confound
row in spec and plan; carry the confounds on the gone outcome. Reordering
cannot mint an unlicensed exit 1. Correction 2 has the concrete edits.

**3. `pdftotext` version capture - the plan is correct; confirmed by
independent measurement during this review.** `spawnSync("pdftotext", ["-v"],
{ encoding: "utf8", stdio: ["ignore","pipe","pipe"] })` on this machine:
`status 99`, `error` undefined, `stdout ""`, `stderr "pdftotext version
4.00\r\n..."`. So: version on stderr (stderr-first read, stdout fallback -
right), `execFileSync` would throw on the exit AND returns stdout only (the
plan's two reasons - both true), `missing` from `r.error` only (matches
`pdftotextAvailable`'s ENOENT line), `?? ""` coalescing for the spawn-failure
case where both streams are undefined. The silent failure mode the controller
names - capturing `""` everywhere, comparing equal, disabling the confound -
is exactly what the stderr pin and the Step 5 stdout-only mutation exist to
refuse, and the mutation is proven-applied before its result is trusted. The
one soft spot is Correction 4 (the untestable duplicate), which does not
change the ruling.

## Answers to the drafter's remaining questions

- **Q3 (`recheck --json` shape and stream):** accept `{ version: 1, results,
  drift }` mixed on stdout. `check` and `recheck` both dump a file that
  already exists on disk beside a human report; `harvest`/`reachability`'s
  pure-JSON stdout exists because their JSON is the artifact itself.
  Converging the evidence-file commands on one convention is right; fixing
  `check`'s is a separately licensed change. Record in the ledger as the
  standing inconsistency's fourth instance, as plan 2 did for its third.
- **Q4 (exit 2 on unestablishable rules provenance):** accept the louder
  failure. A wrong `localRulesHash` feeds the one confound that gates the
  accusing row; a run that cannot establish it should not run the comparison.
- **Q5 (five modules):** accept. The split follows reviewable seams and each
  module carries its own mutation-proved tests; three files would blur the
  tee/store and store/replay seams this review had to check.
- **Q6 (Task 3 separate):** accept, for the reason given - independently
  rejectable, and its failure mode is silent.
- **Q7 (manual localhost only; T9-R1 stays parked):** accept the line.
  Extracting `runCheck`/`runRecheck` is a CLI redesign no spec section
  licenses - plan 2's argument holds. Correction 3 makes the manual scripts
  actually runnable, which is the condition for this answer.
- **Q8 (finding 14 parked):** confirmed - leave 7.1's stale `RungId` snippet
  parked and carried in the ledger, not fixed in Task 11.

## What is right - verified, not assumed

- **The plan's factual claims held up everywhere I opened the code.** The
  Task 6 splice quotes `bin.ts`'s check-branch preamble byte-for-byte
  (verified against the file); `grep -rn "rawBody" src/ | grep -v fetch`
  returns exactly 7 hits, all in `signals.ts`; `SignalResult` has exactly the
  six members claimed; the 361/29 baseline reproduces; the review file is 252
  lines; the 57/45/3 non-ASCII exceptions are exact; the README and CHANGELOG
  sentences Task 11 names as falsified exist at the quoted places;
  `.superpowers/sdd/.gitignore` is `*`; 8.1's plan-3 row and file list read as
  Task 11 assumes.
- **The decision procedure encodes exit-1-iff exactly.** `sourceDrift` is
  reachable only through entry-present, R-invariant-held, no-confound,
  `L = unsupported`, `A = supported`; `classifyRecheckRun` returns 1 only on
  that category or opt-in gone. I traced every other combination to 0 or 2; no
  route lets a citation the live gate passes today exit 1. The Step 5 mutation
  - reintroducing the deleted table's row - is the right single most important
  check, and its anchor-assert pattern fails loudly on a miss.
- **The tee is genuinely CLI-side.** No `CheckOptions` change anywhere;
  `check()`/`readSource`/`signals`/`evidence` on the not-touched list with a
  stop-and-rule instruction; per-citation recorder; the `{ hosts }` detail
  pinned by a spy with a proven-applied `make({})` mutation; `--no-archive`
  means do-not-wrap, so the unwrapped path is literally today's code.
- **The replay fetcher is right and its tests discriminate on any machine.**
  Rungs from the entry (I verified against `nextAction` that the
  machine-independent test - `rungsAttempted` equals `["curl"]` - fails under
  the machine-rungs mutation because `HTML_ORDER` tries node first); verbatim
  `finalUrl` including `""` with its own mutation; `EMPTY_RESPONSE` for
  unread rungs; never throws, per the `Fetcher` contract.
- **The seams join.** RecordedRead -> buildArchiveEntry -> StagedEntry ->
  writeArchive; entry.reads[].hash -> loadBlob -> readBlob -> blobPath (same
  sharding both sides); the eight `DriftCategory` strings are exactly what
  Task 10 switches on; `archiveKeyFor` is used on both the write (Task 6) and
  the lookup (Task 9), and the Task 2 key test pins it to `joinClaims` with a
  fixture I verified against `normalizeUrl` (host casing + `utm_` are folded,
  as the test requires).
- **Test quality is the best of the three plans.** 112 new tests (I recounted
  every file: 11+7+13+13+11+25+10+11+9+2; 361 -> 473), negative controls in
  every suite, every load-bearing pin with a mutation that must be PROVEN
  applied before its result is read - the plan-2 lesson, learned. The
  recheck-never-writes test pairs a behavioural assertion over a
  differing-body fixture with a structural import grep, which is the right
  answer to plan 2's deleted-filter incident.
- **Executability.** Each task carries complete code, exact commands, expected
  outputs, and failure instructions; the insertion anchors I checked
  (`if (command !== "check")`, the check-branch preamble, the Task 1 spec
  strings at lines 18 and 1312) all resolve. Aside from Correction 3, a
  competent implementer who has never seen this repo could finish each task
  from its text.
