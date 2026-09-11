# SDD ledger — plan: docs/superpowers/plans/2026-09-06-plan-1-core.md

Spec: docs/superpowers/specs/2026-09-06-testimonium-design.md (read; binding authority)
Worktree: C:\users\noaho\testimonium-plan1 on feat/plan-1-core, from main @ 3c6c0cf
16 tasks.

**Withheld 2026-09-10.** The origin repository's name is withheld for publication; the Task 3 minor below now reads "origin-repository path" where it named that repository. A mechanical substitution: no finding, verdict, severity or count in this ledger changed.

## Pre-flight conflict scan

### Cross-task: shared files and interfaces

| Producer | Consumer | Produces / consumes | Finding |
|---|---|---|---|
| T2 normalize.ts | T6, T9 | `norm`, `phraseFound` | OK |
| T3 extract.ts | T4, T6 | `toText` | OK |
| T3 fixtures/corpus.json | T4, T6(3b) | corpus manifest | OK |
| T4 thresholds.ts | T6, T8, T14 | `THRESHOLDS`, `proseVolume`, `slugTitleOverlap` | OK — T8 and T14 both import `THRESHOLDS.minProseChars`; T4 precedes both |
| T5 challenge.ts | T6, T15 | `matchesChallengeSignature/Path`, `Rule`, `CHALLENGE_*` | OK |
| T5 hosts.ts | T7, T15 | `HostRule`, `HOST_RULES`, `hostRuleFor` | OK — real module after draft-2 fix; T7 imports from `../rules/hosts.js` |
| T6 signals/verdict | T13 | `computeSignals` -> `{signals,text,matchedClaims,missedClaims,firedRule}`, `verdict` | OK — T13's `best.computed.*` matches the returned shape |
| T7 fetch/types.ts | T8, T9, T13, T14 | `RawResponse`, `Fetcher`, `RungId`, `EMPTY_RESPONSE` | OK — T9 imports `RungId` only as a type |
| T7 pdf.ts | T13, T14 | `isPdf` | OK |
| T8 ladder.ts | T13, T14 | `nextAction`, `Attempt` | OK |
| T9 excerpt.ts | T12, T13 | `Evidence`, `excerptFor`, `dedupeEvidence` | OK — no import cycle (excerpt imports fetch/types as type-only) |
| T10 claims.ts | T14 | `parseClaimsFile`, `joinClaims`, `normalizeUrl` | OK downstream |
| **T11 adapters/types.ts** | **T10 claims.ts** | **`Footnote`** | **CONFLICT — see C1** |
| T11 gfm-footnotes.ts | T14 | `parseGfmFootnotes` | OK |
| T12 evidence.ts | T13, T14, T15 | `buildResult`, `CitationResult`, `writeEvidenceFile` | OK |
| T13 check.ts | T14 | `check` | OK |
| T13 index.ts | T14 | exports `reachability` before T14 creates it | Known, documented in the task; omit the line in T13, restore in T14 |
| T14 bin.ts | T15 | `classifyRun`, flags | OK |

### Per-task: does each task's text agree with itself?

| Task | Finding |
|---|---|
| 1 | OK — exports test matches the package.json written; no `dependencies` key, test asserts `{}` |
| 2 | OK — 8 assertions verified against this implementation during plan review |
| 3 | **CONFLICT — see C2** (corpus count assertion vs. the classification instruction) |
| 4 | OK — `calibrate.mjs` calls `slugTitleOverlap` with 3 args; 4th has a default. Margin arithmetic is satisfiable: shells max 982, floor 2000, documents must clear 2200 |
| 5 | OK — 10 signatures+paths+hosts vs. "10 tests PASS"; the no-personal-identity regex needs an `@`, and the sec.gov note contains none |
| 6 | **CONFLICT — see C4** (Step 3b's second corpus test) |
| 7 | **CONFLICT — see C3** (file-count assertion) |
| 8 | OK — `read` fixture clears `minProseChars` so the stop branch fires |
| 9 | Re-ported in draft 2 and NOT yet executed by anyone. Highest-risk task in the plan; the review is the net |
| 10 | See C1 |
| 11 | OK |
| 12 | `BASE` spread with `available as never` may need a looser annotation; leave to the implementer's typecheck |
| 13 | OK |
| 14 | OK — `bin.test.ts` imports `classifyRun`; under vitest `process.argv[1]` is vitest's own path, so the entry guard stays false |
| 15 | OK |
| 16 | OK — no code |

### Rulings (made before execution)

- **C1. Ruling: execute Task 11 BEFORE Task 10.** `src/io/claims.ts` imports `Footnote` from `src/adapters/types.ts`, which Task 11 creates. Task 10's own tests would pass on structural literals, but its `tsc --noEmit` gate cannot resolve the import. Swapping is cheaper than duplicating the type or weakening the import. Task numbering in the plan is unchanged; only dispatch order moves. *Cost if wrong:* none identified — the two tasks share nothing else.
- **C2. Ruling: Task 3's corpus assertion drops from `>= 20` challenge fixtures to `>= 15`.** Draft 2 told Task 3 to classify the 23 battery cases individually because several are false-positive probes rather than walls, which can leave fewer than 20 in the challenge bucket. The real gate is Task 4's acceptance test, not a headcount. `>= 8` documents is unchanged. *Cost if wrong:* a thinner bestiary than intended; visible in the corpus manifest and cheap to top up later.
- **C3. Ruling: Task 7's `expect(files.length).toBeGreaterThanOrEqual(6)` becomes `>= 5`.** At Task 7 `src/fetch/` holds types, node, curl, pdf, default-fetcher — five files. `ladder.ts` arrives in Task 8. The assertion exists to stop the scan silently matching an empty directory, and 5 does that. *Cost if wrong:* negligible; the directory scan itself is what enforces the constraint.
- **C4. Ruling: replace Task 6 Step 3b's second corpus test.** As written it asserts documents return `unclaimed` when given no claims — trivially true for every input including challenge fixtures, so it asserts nothing. Replaced with a self-generating positive test: take a ~60-character substring from the middle of each document fixture's own extracted text as a synthetic claim; the verdict must be `supported`. This exercises the real pipeline in the direction the trivial test did not. *Cost if wrong:* a document whose extracted text has awkward internal whitespace could fail spuriously; the fix is to pick the substring on word boundaries.

---

## Progress

Pre-flight: 4 conflicts found, all ruled (C1-C4 above). Plan corrections for C2/C3/C4 committed 9c56cb4. C1 is a dispatch-order ruling: Task 11 runs before Task 10.
Task 1: dispatched (haiku, transcription task), BASE=3c6c0cf
Task 1: implemented db353a1 (7 files, 3/3 tests pass, tsc clean). Deps resolved: @types/node 26.4.1, typescript 6.0.3, vitest 3.2.7 — all semver-compatible with the pins.
Task 1: review dispatched (sonnet), package review-9c56cb4..db353a1.diff
Task 1: minor (deferred): test 2 "does not expose internals as subpath exports" is logically subsumed by test 1's exact-equality check on Object.keys(pkg.exports) — cannot fail independently. Plan-dictated content, not an implementer choice. Triage at final review.
Task 1: complete (commits 9c56cb4..db353a1, review clean — spec compliance verified byte-for-byte, all four gate commands re-run by the reviewer)
Task 2: dispatched (haiku, transcription), BASE=db353a1
Task 2: implemented 466d2ff (norm + phraseFound, 8/8 tests, tsc clean)
Task 2: review dispatched (sonnet), package review-db353a1..466d2ff.diff — asked for byte-level check that \uXXXX escapes did not round-trip into raw characters
Task 2: minor (deferred): "does not match paraphrase" test is weak against the shipped substring implementation — it discriminates only against a hypothetical future fuzzy matcher. Brief-authored, not implementer. Triage at final review.
Task 2: complete (commits db353a1..466d2ff, review clean — byte scan confirms 0 non-ASCII bytes, escapes stored as backslash-u; 11/11 suite green)
Note: reviewer corrected my premise that comma-strip and zero-width-strip order matters for the asserted vectors — they commute on disjoint code-point classes. No code impact; clause order is verbatim regardless.
Task 3: dispatched (sonnet, judgment: classification + live capture), BASE=466d2ff
Task 3: implemented c04b760 (toText + 32 fixtures: 23 challenge, 9 document; 19/19 suite, tsc clean). Corpus separates on prose volume: challenge max 2,154, document min 6,858, valid floor range [2,354, 6,658].
Task 3: review dispatched (sonnet), package review-466d2ff..c04b760.diff (5.3MB, mostly fixture HTML — reviewer told to use targeted git commands)

**C5. Ruling: restore the omitted ECB 404 capture as a `challenge` fixture, and rewrite Task 4's acceptance test to assert the ACCUSATION GATE (prose volume AND slug/title overlap) rather than prose volume alone.**
Task 3 omitted an ECB 404 page extracting 13,221 chars of nav chrome — more than 2 of the 9 real documents — because including it makes prose-volume separation impossible. Omitting it hid a real, measured finding: prose volume ALONE does not separate documents from non-documents. My plan's Task 4 test asserted P2 separation, which is stronger than spec 6.3 requires (the spec phrases separation through the VERDICT, and the verdict's accusation branch is the conjunction) and is now measurably false. Amended: 4 assertions over the conjunction, each population needing margin on at least one dimension. If no threshold pair satisfies them, Task 4 stops and reports — that is a real design gap, and dropping the fixture again to get green is forbidden.
*Cost if wrong:* if C1 rejects the ECB page only by luck on this corpus, we ship thresholds that misfire on a similar fixture added later. The per-dimension margin assertions are the mitigation. If instead the conjunction genuinely cannot separate, that surfaces at Task 4 as a stop — which is the correct outcome and cheap here, versus discovering it after the reducer and its tests exist.
Task 3: review returned spec ❌ + 1 Important — the ECB omission, found independently by the reviewer, which also confirmed 13,221 > 6,858 (no single length threshold separates) and caught the inconsistency with the 128-char soft-404 filed as challenge in the same pass.
Task 3: minor (deferred): `export const cases` in challenge-battery.mjs is exported but unused (YAGNI).
Task 3: minor (deferred): a comment in challenge-battery.mjs still contains the literal old origin-repository path as inert history — a grep-based provenance check would false-positive on it.
Task 3: minor (deferred): BLS fixture title carries an embedded \r inherited from the site's malformed <title>; cosmetic, no logic impact.
Task 3: fix round 1/5 dispatched (resumed original implementer) — restore ECB capture as kind:"challenge", nothing else. FIX_BASE=c04b760
Task 3: fix round 1/5 implemented 01e71a5 (ECB filed as challenge; 24 challenge / 9 document; 8/8 extract tests, tsc clean). Scoped re-review dispatched (haiku), package review-c04b760..01e71a5.diff — asked to confirm no OTHER entry was silently reclassified.
Ruling C5 committed to the plan as 3a20836. Task 4 brief regenerated against the amended text.
Task 3: fix round 1/5 (1 addressed, 0 open; commits c04b760..01e71a5). Re-review confirmed ECB filed correctly, no silent reclassification elsewhere, 19/19 suite, tsc clean.
Task 3: complete (commits 466d2ff..01e71a5, 3 minors parked for final review)
Task 4: dispatched (opus — THE GATE; a wrong call here is expensive and hard to detect later), BASE=01e71a5
Task 4: BLOCKED at e98c371 (suite committed red on purpose — the failing test WAS the finding). Exhaustive search over 24,915 threshold pairs: 0 solutions with the ECB fixture, 249 without. ECB scores prose 13,221, overlap 1.00 (tied corpus max; lowest real document 0.75).

**C6. Ruling: drop the fetched <title> from C1, rename to slugLabelOverlap, and add N4 (HTTP 404/410 veto).**
Root cause was a spec error of mine, not a corpus artifact: C1 drew content words from the document's own <title>, which arrives in the SAME RESPONSE as the body, so every page contains its own title by construction. Measured: all 12 fixtures carrying a title scored title-only overlap of exactly 1.00, challenge and document alike — zero discriminating power, disguised by pinning every score to the ceiling. My spec's own justification ("the label is authored rather than fetched, but so is a URL — neither is circular") holds for those two inputs and was wrong for the title.
(a) C1 -> slugLabelOverlap, authored inputs only: URL path + author's footnote label.
(b) N4 added: HTTP 404/410 vetoes. The one place status is consulted. Asymmetry justifies it — a server is not authoritative about presence (400 serving 253KB, 404 serving 112KB) but IS authoritative when it says a resource does not exist. Spec draft 2 deferred this to recheck; calibration proved check must act on it.
(c) C1 documented as weak, calibrated against the DOCUMENT population only, since 21 of 24 challenge fixtures have no URL/title and their 0.00 is an absent input rather than a measurement.
*Cost if wrong:* N4 trusts the origin's own 404. A misconfigured host serving 404 alongside a real document would have its citations read as unreachable — renders nothing, fails nothing, so it degrades safe. C1 stays weak: a prose-rich wrong-document served at 200 from a generic URL with no author label could still be accused. That residual goes in the README at Task 16.
Committed 499a6a8. Task 4 brief regenerated.
Task 4: fix round 1/5 dispatched (resumed original implementer). FIX_BASE=e98c371
Task 4: fix round 1/5 -> BLOCKED again at 24f6ee8 (correct call; refused to ship a negative threshold). minProseChars 4500 LICENSED (gap 1,180 -> 6,858). Round 2: 33,165 pairs, 414 solutions, all at negative minSlugOverlap, none at V>=0. Cause: blog.mozilla.org/en/ path "/en/" is under the 4-char content-word floor -> vacuous 0.00, identical to the Federal Register wall; populations share their C1 minimum.

**C7. Ruling: withdraw C1 from the verdict entirely. slugLabelOverlap stays computed and reported; it does not gate.**
Two calibration rounds each proved infeasibility rather than failing to search. With the fetched title in, every page scored 1.00 by construction; with it out, a real blog index scored the same vacuous 0.00 as an anti-scraping wall. And where measurable the ordering is INVERTED — highest challenge 0.80 outranks lowest document 0.75. C1 is anti-correlated on this evidence, not merely weak. A gate that does no work while implying safety is worse than no gate.
Separation is carried by prose volume + the four vetoes, N4 doing the work on padded error shells. Floor licensed at 4,500 with 3,320 clear below and 2,358 above.
*Cost if wrong:* the wrong-document-at-200 case (site redesign serving a prose-rich listing at the cited URL) can now be accused, where C1 was nominally meant to deny it. C1 could not actually do that — vacuous for generic paths, anti-correlated where measurable — so the protection was notional. The residual goes in the README at Task 16 with the other two.
Also corrected two errors of mine the implementer caught: challenge-battery.mjs declares no statuses, and capture-fixtures.mjs logged status without persisting it (now patched).
Committed 89bdeea. Task 4 brief regenerated.
Task 4: fix round 2/5 dispatched (resumed original implementer). FIX_BASE=24f6ee8
Task 4: fix round 2/5 -> DONE at 61e50b1. All 4 assertions PASS, 23/23 suite, tsc clean. minProseChars 4500; minSlugOverlap removed from the built artifact. Floor robustness: 5,279 satisfying integer values, range [1380, 6658]; every fixture clears its margin by >=2,358 chars against a 200-char requirement. N4 load-bearing — the two 404 fixtures (2,154 and 13,221 chars) are rejected on status before any body analysis. All 33 calibration rows cross-checked against live measurement, 0 mismatches.
Correction to my ledger (implementer's, and it is right): the 0.80/0.75 C1 inversion is a ROUND-1 measurement using the title-inclusive metric, not round 2 as I recorded in C7. Both metric definitions invert, via different fixtures — which strengthens C7 rather than weakening it.
Task 4: minor (deferred): assertion 3/4 test names and passesAccusationGate's comment still describe a two-dimensional gate that no longer exists ("with margin on at least one dimension", "clears both thresholds", "This conjunction - not prose volume alone"). My wording, carried through deletion-only rounds. Assertions themselves are correct.
Task 4: minor (deferred): maxChallengeChars 800 is carried in THRESHOLDS but uncalibrated and unexercised by any test — belongs to Task 5, whose battery already contains the 982-char Turnstile-plus-boilerplate fixture built to defeat it.
Task 4: review dispatched (sonnet), package review-01e71a5..61e50b1.diff
Task 4: review returned spec ✅, quality Approved, 0 Critical/Important, 3 Minor. Reviewer independently recomputed all 33 fixtures and swept every integer 1-200,000: range [1380, 6658] / 5,279 values CONFIRMED; largest non-vetoed challenge 1,180 and smallest document 6,858 CONFIRMED.
Task 4: N4 PROVEN load-bearing — reviewer reran the sweep with N4 removed and found 0 satisfying values, because the ECB fixture (13,221 chars, 404) passes any floor <= 6,658. Not overfitting to one fixture.
Task 4: status honesty verified three independent ways — Task 3 capture log, calibration-doc provenance markers (17 daggers, only on constructed rows; 3+4+17+9=33), and a LIVE re-fetch of both 404 URLs during the review. Exactly 2 fixtures at 404, 0 at 410, 31 at 200; no url/title/kind/path was altered, so nothing was reclassified to manufacture a veto.
Task 4: minor (deferred, tracked): N4 fires only on 404/410, so a heavy-chrome error page served at 200 with no recognizable challenge text would evade both N4 and the prose floor. No such fixture in this corpus. Flagged for Task 5 signature coverage and future corpus growth.
Task 4: Ruling — fixing 2 of the 3 Minors now rather than deferring, because one is a latent trap: the plan doc shows capture-fixtures.mjs persisting `status` but the real script was never edited, so a maintainer re-running it silently reproduces the status-loss bug. Batched with the stale test names into one cheap dispatch. *Cost if wrong:* negligible; prose and a one-field addition, with the suite count as the guard.
Task 4: minor fixes at 55d625a (status persisted in capture script; stale two-dimension prose corrected). Verified by diff that ZERO logic lines changed — only comments and it() strings; 23/23 unchanged.
Task 4: complete (commits 01e71a5..55d625a, review clean, 1 minor tracked for Task 5 / future corpus). THE GATE IS LICENSED: minProseChars 4500.
Task 5: dispatched (haiku, transcription), BASE=55d625a
Task 5: implemented a3f1d48 (challenge.ts + hosts.ts + 10 tests; 33/33 suite, tsc clean)
Task 5: review dispatched (sonnet), package review-55d625a..a3f1d48.diff
Task 5: review returned spec ✅, quality Approved, 0 Critical/Important, 4 Minor. Reviewer independently re-ran every regex, confirmed the inflection and insertion cases match, and verified hostRuleFor rejects notsec.gov / sec.gov.evil.com / evilsec.gov while resolving www.sec.gov — the leading-dot guard is correct.
Task 5: Ruling — fixing 3 of the 4 Minors now rather than deferring. Minor 1 is a real bug in MY rule data: /press (and hold|&) hold/ requires a doubled "hold", so it does not match the actual PerimeterX phrasing its own note claims to catch (reviewer verified: returns false). A rule that does not do what its note says is worse than no rule, even in an optimization-only list. Bundled with the two vacuous-if-empty metadata loops and the missing look-alike-domain test.
Task 5: fix instructed to update BOTH the source and the plan document's embedded copy — the drift trap found at Task 4 Minor 2.
Task 5: minor (deferred): the "matches through normalization" test uses a curly apostrophe that sits OUTSIDE the matched span, so it exercises case-folding rather than smart-quote defeat. Brief-authored. Not vacuous (fails a case-sensitive stub), just narrower than its name.
Task 5: fixes at 1526099 (PerimeterX regex corrected; 3 vacuous loops guarded; look-alike domain test added and PASSED first run). 34/34, tsc clean. Source and plan document updated in sync.
Task 5: complete (commits 55d625a..1526099, review clean, 1 minor parked)
Task 6: dispatched (sonnet — the keystone becomes code), BASE=1526099
Task 6: implemented 75fae68 DONE_WITH_CONCERNS. 48 tests, 47 pass, 1 failing BY DESIGN — the implementer found verdict.test.ts #10 contradicts the task mandate, implemented per the mandate, left the test red, and altered neither side. Correct behaviour. corpus-verdict.test.ts passes on all 33 fixtures.
Task 6: third independent confirmation of the C7 inversion, this time on the live corpus through the shipped pipeline: Federal Register (unvetoed, status 200) scores 0.80 overlap vs MDN document at 0.75.

**C8. Ruling: replace verdict.test.ts #10 rather than delete it.** The test asserted that low slug overlap forces `unreachable` — a C1-gating behaviour that ruling C7 withdrew. It is my stale test, same class as the stale test names at Task 4. Deleting it would leave nothing guarding the ruling, so it becomes a REGRESSION GUARD asserting that slugLabelOverlap does not influence the verdict at all: same input at overlap 0.0 and 1.0 must yield the same result. Anyone re-adding C1 to the gate now fails loudly.
*Cost if wrong:* none identified — it pins a property the spec states explicitly and that two calibration rounds established.
Task 6: fix round 1/5 dispatched (resumed original implementer). FIX_BASE=75fae68
Task 6: fix round 1/5 -> DONE at 64c303c. 48/48, tsc clean. Reducer verified untouched (git diff --stat empty); only the test and the plan's embedded copy changed.
Task 6: review dispatched (sonnet), package review-1526099..64c303c.diff — asked for a fuzz over the Signals space to prove the keystone invariant holds for ALL inputs, not just the enumerated cases.
Task 6: review returned spec ✅, quality Approved, 0 Critical/Important, 1 Minor (disclosed dead-code removal — good practice, not a defect).
Task 6: KEYSTONE INVARIANT PROVEN. Reviewer enumerated 3,360 Signals combinations via vite-node against the real .ts sources: (1) verdict==="unsupported" implies proseChars>=4500 AND no veto AND total>0 — 0 counterexamples; (2) any veto with total>0 implies "unreachable" regardless of every other field including a full match — 0 counterexamples. Veto always beats a full match.
Task 6: corpus counts independently re-derived outside the test file — 24/24 challenge return unreachable, 9/9 documents return supported, 0 fell into the claim-length skip path (so the positive test is not vacuously green).
Task 6: verified the four deliberate properties in code, not just by assertion — slugLabelOverlap and headMarkers appear nowhere in verdict()'s body; documentGone is checked before the full-match branch; the challenge-signature length conjunction confirmed empirically (82-char body vetoes, 1,609-char article quoting identical wording does not).
Task 6: complete (commits 1526099..64c303c, review clean)
Task 7: dispatched (sonnet — IO layer, subprocess and header parsing), BASE=64c303c
Task 7: implemented 3a8cfd7 DONE_WITH_CONCERNS. 55/55, tsc clean. Both rungs present on this machine: curl 8.17.0, pdftotext 4.00 — so the missing-binary truncation branches were NOT exercised locally.
Task 7: concern was a real plan defect of mine — the default-fetcher sample imported hostRuleFor from ../rules/challenge.js, but Task 5's split moved it to ../rules/hosts.js. Compile error as written. Implementer fixed the source and reported rather than reconciling silently. Plan corrected to match; drift closed.
Task 7: enforcement test verified working — comment-stripping correctly excludes types.ts's own doc-comment prose mentioning ok/http2xx.
Task 7: review dispatched (sonnet), package review-64c303c..3a8cfd7.diff
Task 7: review returned spec ✅, quality Issues — 1 Important, 1 Minor. Reviewer live-exercised every function rather than reading: parseHeaderDump against real curl -D dumps including a github.com 301->200 chain (final hop returned, no intermediate Location leak), malformed/empty dumps return {} without throwing; curlFetch and pdfFetch temp cleanup verified on success AND forced-failure paths; userAgentFor verified to warn and fall back rather than fabricate an identity; unknown rung id throws rather than falling through to pdfFetch.
Task 7: enforcement test verified CAN still fail — reviewer replayed the comment-stripping regexes against three synthetic violations (ok field on RawResponse, http2xx variable in a fetch function, ok: literal in a returned object); all three caught, while types.ts's own doc comment does not trip it.
Task 7 IMPORTANT: pdftotextAvailable() false negative. Xpdf's `pdftotext -v` exits 99, not 0, so execFileSync throws and the probe reports absent. Verified live: defaultFetcher({}).rungs === ['node','curl'] while direct pdfFetch() succeeds on the same machine. PDF sources would silently never verify on any Xpdf-derived install. Inherited verbatim from my brief. Also caught that the implementer's report CLAIMED three rungs — inferred from version text, not from calling .rungs.
Task 7: minor (deferred -> folding into this fix, cheap): the directory-wide enforcement scan uses /\bok\s*:/ and would miss an `ok?:` optional declaration; test 1's types.ts-only check already uses /\bok\s*[?:]/.
Task 7: cannot-verify-from-diff (resolved by me): "PDF rung selected by URL shape before any fetch" is enforced by ladder.ts in Task 8; isPdf() is exported but not yet called anywhere. Correct — that property is Task 8's to demonstrate, and its brief carries it.
Task 7: fix round 1/5 dispatched (resumed original implementer). FIX_BASE=3a8cfd7
Task 7: fix round 1/5 (2 addressed, 0 open; commits 3a8cfd7..a12e817). Re-review confirmed ENOENT discrimination correct in BOTH directions (missing binary still reports unavailable; non-zero exit reports available), .rungs now ['node','curl','pdftotext'], regex widened in both places, plan doc in sync, 55/55.
Task 7: complete (commits 64c303c..a12e817, review clean)
Task 8: dispatched (haiku, transcription), BASE=a12e817
Task 8: implemented 2e998d9 (ladder.ts + 8 tests; 63/63, tsc clean)
Task 8: review dispatched (sonnet), package review-a12e817..2e998d9.diff — asked for exhaustive enumeration of the reducer's state space, since it is small enough to prove rather than sample.
Task 8: review returned spec ✅, quality Approved, 0 findings. Reviewer enumerated 230,800 cases via vite-node against the real source: never-repeats, never-invents, PDF-ordering, fall-through — 0 counterexamples each. Termination proven by adversarial BFS branching over all 8 outcome fields per step, 192 (state,branch) evaluations, max depth to stop = 2. Purity confirmed: imports only THRESHOLDS and the RungId type.
Task 8: complete (commits a12e817..2e998d9, review clean)
Task 9: dispatched (sonnet — HIGHEST-RISK REMAINING TASK: re-ported after the plan review found the first version returned passages not containing their claim; the re-port has never been executed by anyone), BASE=2e998d9
Task 9: implemented 5280df1 (excerpt.ts + 12 tests; 75/75, tsc clean). Long-document contract test PASSED on first run — the index-map re-port holds where the counting version drifted 443 chars.
Task 9: review dispatched (sonnet), package review-2e998d9..5280df1.diff — asked for a RANDOMISED FUZZ of the contract, since this is the file where green unit tests previously hid a real defect.
Task 9: review returned spec ✅, quality Issues — 1 Important, 1 Minor. Fuzz: 3,500 trials (2,500 random-offset + 500 near-start + 500 near-end), 0 contract violations, 0.29% null rate. Contract holds.
Task 9: REGRESSION GENUINELY CAUGHT — reviewer reconstructed the historical counting-cursor bug, measured 854-char drift on the REALISTIC fixture, and ran the 12 shipped assertions against it: 9 pass, 3 FAIL including both regression guards. Against the real implementation 12/12. The old 207-char LONG fixture alone would not have caught it, exactly as the plan claimed.
Task 9 IMPORTANT: FOLD table incomplete relative to norm(). norm() folds the whole Unicode dash range (U+2010-U+2015, U+2212 = 7 chars); excerpt.ts's FOLD reproduces only em and en dash. All are 1:1 length-preserving so there is no structural reason for the gap. Verified: source with U+2011 vs claim with ASCII hyphen -> phraseFound TRUE but excerptFor returns null. Verdict says supported, reader sees no passage. Safe direction, but it silently drops evidence for the exact case norm()'s own comment documents (OpenAI model names). Inherited from my brief.
Task 9: minor (plan typo, mine): Task 9 Step 4 says "8 tests PASS" but the brief's own Step 1 block contains 12.
Task 9: fix round 1/5 dispatched (resumed original implementer). FIX_BASE=5280df1
Task 9: fix round 1/5 (1 addressed, 0 open; commits 5280df1..39f1d7e). Re-review confirmed all seven dashes present AND behaviourally working — excerptFor returns non-null and phraseFound holds for every one. 76/76, tsc clean, valid UTF-8, no NULs. Index-map contract unaffected: all entries are 1:1 length-preserving.
Task 9: complete (commits 2e998d9..39f1d7e, review clean). Plan test-count typo corrected to 13.
Task 11: dispatched (haiku, transcription) — running BEFORE Task 10 per pre-flight ruling C1, since claims.ts imports Footnote from adapters/types.ts. BASE=39f1d7e
Task 11: implemented 6f206e7 (adapters/types.ts + gfm-footnotes.ts + 8 tests; 84/84, tsc clean)
Task 11: review dispatched (sonnet), package review-39f1d7e..6f206e7.diff — flagged a SUSPECTED bug for it to confirm: BARE_LINK excludes ')' from the URL character class, so a Wikipedia-style URL with a parenthesised disambiguator would be truncated mid-URL. The corpus already contains a Wikipedia fixture.
Task 11: review returned spec ✅ (byte-for-byte transcription) but quality Issues — 3 CRITICAL, 1 Important, 1 Minor. All in MY plan code; the implementer deviated in nothing. Reviewer confirmed the suspected paren bug AND found two more on its own initiative.

**C9. Ruling: amend the adapter for all three Criticals plus the fenced-code Important.**
(1) Paren truncation — confirmed, and MD_LINK had the same flaw, so the markdown-link form truncated too. Fixed by allowing parens and trimming only UNBALANCED trailing ones; the prose-aside case "(see https://example.com/x)" still strips correctly because balance, not exclusion, separates them.
(2) CRLF continuation — JS regex `.` never matches \r, so on EVERY CRLF document the continuation failed silently and the URL vanished to url:null with no error signal. Windows project. Fixed by normalising line endings before parsing.
(3) Lazy continuation — the rule excluded blank lines and "[^" but never required indentation, so an ordinary following paragraph was absorbed and ITS url attributed to the citation. The tool would fetch and verify claims against a source the author never cited. This is the exact failure URL-keyed claims exist to prevent, reintroduced one layer earlier. Fixed by requiring indentation plus non-whitespace.
Plus fenced code blocks now blanked before parsing — a syntax sample otherwise yields a phantom citation with a real fetchable URL, and this repo's own briefs contain such samples.
Six regression tests added, including a strengthened replacement for a test the review showed would also pass against a parser that merely scanned for https://.
*Cost if wrong:* the balanced-paren trim could mis-handle a URL ending in a genuinely unbalanced paren (rare, and it degrades to the old behaviour); requiring indentation could drop a continuation an author wrote flush-left, which GFM does not sanction anyway. Both are covered by the new tests.
Committed a2b26e3. Task 11 brief regenerated; expected count now 14 tests, suite 90.
Task 11: fix round 1/5 dispatched (resumed original implementer). FIX_BASE=6f206e7
Task 11: fix round 1/5 -> 4 addressed, 1 NEW defect introduced by my own fix. Re-review confirmed all four originals fixed and probed the new code: trimUrl termination traced (monotonically shrinking, exits), body contract intact (\r\n preserved), differing fence types / list-indented / unterminated fences all correct.
Task 11 NEW: blankFencedCode truncated the opening marker to 3 chars, so an inner ``` closed a ```` fence early. Double failure — trapped example leaked out as a live phantom citation, AND the real ```` closer became a new opener that never closed, silently swallowing every footnote after it. CommonMark closes only on the same character at >= the opener's length. Fixed and pinned by a 15th test. Latent in this repo (no 4-tick fences in docs/) but a normal shape for markdown-about-markdown.
Task 11: fix round 2/5 dispatched (resumed original implementer). FIX_BASE=74c7cdc
Task 11: fix round 2/5 implemented ae85c2a. 15/15 adapter, 91/91 suite, tsc clean. Implementer verified all three named risks: unterminated fence blanks to EOF, tilde/backtick fences do not cross-close, list-indented fence still works.
Task 11: fix round 2/5 (1 addressed, 0 open; commits 74c7cdc..ae85c2a). Re-review ran all 6 cases including the two OVERSHOOT checks — a 5-tick fence is not closed by a 4-tick inner line, and a 3-tick fence IS closed by a longer 4-tick run per CommonMark. No fence that previously closed now fails to.
Task 11: complete (commits 39f1d7e..ae85c2a, review clean after 2 fix rounds). Five review passes on this adapter found: a truncated URL, a silently dropped URL, a wrongly-attributed URL, a phantom URL, and a swallowed URL. Proportionate — it is the component that decides which page the whole tool checks.
Task 10: dispatched (sonnet — URL normalization is subtle and its failure mode is silent), BASE=ae85c2a. Running AFTER Task 11 per pre-flight ruling C1; the Footnote type it imports now exists.
Task 10: implemented 5183321 (claims.ts + 16 tests; 107/107, tsc clean). Implementer reported my stated count was wrong (15 vs actual 16) instead of matching it — plan corrected.
Task 10: review dispatched (sonnet), package review-ae85c2a..5183321.diff
Task 10: review returned spec ✅, quality Issues — 1 Important, 2 Minor. Normalization probed exhaustively: path case preserved, default ports stripped and non-default kept, utm stripping leaves no stray "?", surviving param order preserved, fragment preserved, percent-encoding unchanged through round-trip, IDN punycodes (native URL behaviour, now documented), malformed input returns unchanged. Join probed: two footnotes citing one URL both land checkable and it is not orphaned; a tracking-param-only difference joins.

**C10. Ruling: refuse colliding claims keys (hard error), warn on embedded credentials.**
parseClaimsFile had no duplicate check, so two authored keys normalizing alike collided silently and the later won — an entire footnote's claims vanishing with no error. That is the exact quiet-failure class URL keying exists to remove, sitting one step upstream of the join it protects. A warning would be too quiet for a defect of this shape, so it throws and names both keys.
Credentials: warned, redacted in the message, deliberately NOT stripped — stripping would silently break access to a source that needs them, trading disclosure for availability.
Four tests added: collision refusal, an over-fire guard (/a/ vs /a must still coexist), and the wrong-value-shape branch which had zero coverage.
*Cost if wrong:* the collision check could refuse a file an author wrote deliberately with two spellings of one URL — but that file was already broken, since only one set of claims survived. The over-fire guard pins the boundary.
Task 10: for README (Task 16): normalizeUrl preserves fragments, so a citation carrying #section must mirror it in the claims file or read as unclaimed. Not a defect — consistent with fail-loud — but a user will meet it.
Committed. Task 10 brief regenerated; expected 20 tests, suite 111.
Task 10: fix round 1/5 dispatched (resumed original implementer). FIX_BASE=5183321
Task 10: fix round 1/5 implemented 2ee68c0. 19/19 file, 110/110 suite, tsc clean. Over-fire guard passed (/a and /a/ coexist). No unexpected console.warn anywhere in the suite — the credentials regex is not over-matching. Plan-doc copy already correct at HEAD.
Task 10: my count was wrong AGAIN (said 4 new tests, actually 3). Third miscount this plan, caught each time by an implementer counting rather than matching. Noting the pattern: I should not assert counts I have not counted.
Task 10: fix round 1/5 (3 addressed, 0 open; commits 5183321..2ee68c0). Re-review confirmed the collision throws naming both keys, ALL over-fire guards hold (/a vs /a/, differing query, fragment, port all coexist; tracking-param-only difference correctly collides), credentials warning redacts the password, _-keys skipped before the collision check, empty file parses to size 0.
Task 10: complete (commits ae85c2a..2ee68c0, review clean after 1 fix round)
Task 12: dispatched (sonnet — the render half of the keystone, enforced structurally), BASE=2ee68c0
Task 12: implemented 8190138 (evidence.ts + 9 tests; 119/119, tsc clean). Fourth miscount of mine (said 6, real 9 — 7 it() with one it.each over 2). The `as never` annotation I flagged typechecked cleanly; nothing to loosen.
Task 12: review dispatched (sonnet), package review-2ee68c0..8190138.diff — asked to verify the renderable-field guarantee holds through JSON serialization and is ABSENCE rather than undefined, and to check isLadderTruncated across all four quadrants.
Task 12: review returned spec ✅, quality Approved, 0 Critical/Important, 2 Minor. Structural absence VERIFIED REAL — conditional spread, not key:undefined; Object.keys() identical before and after JSON round-trip for all four verdicts, so the guarantee holds for the on-disk representation a consumer actually reads. ladderTruncated enumerated over all 16 quadrants: HTML truncated iff not(node AND curl), PDF truncated iff no pdftotext, rungsAttempted confirmed to have zero influence. Round-trip and missing-file behaviour verified.
Task 12: minor (deferred): "always records rung provenance" passes against an identity stub — it only checks a value already present in BASE. Brief-authored.
Task 12: minor (deferred): `excerpt` in the RENDERABLE list checks a top-level field that never exists on CitationResult (only nested under evidence[].excerpt), so that sub-check is trivially true. Makes the guard look stronger than it is. Brief-authored.
Task 12: complete (commits 2ee68c0..8190138, review clean, 2 minors deferred to the final-review fix wave)
Task 13: dispatched (sonnet — the front door, owns the verdict), BASE=8190138
Task 13: implemented 507addd DONE_WITH_CONCERNS. 127 total, 126 pass, 1 red BY DESIGN. reachability export omitted from index.ts as instructed. Implementer found a genuine internal contradiction in my plan and refused to reconcile it — left the test verbatim, did not touch verdict.ts, asked for a ruling.

**C11. Ruling: the stale test loses; N4 stands.**
"ignores HTTP status entirely - a document under a 404 still reads" asserted supported, but the shipped reducer vetoes 404/410. The test was written in plan draft 2, BEFORE ruling C6 added N4. N4 is load-bearing and proven twice: calibration found zero satisfying thresholds without it (a real ECB 404 served 13,221 chars of nav chrome and cleared every body-derived test), and Task 6's review proved over 3,360 combinations that any veto beats a full match.
Replaced with two tests pinning what the design actually holds: (a) status is not consulted OUTSIDE the veto set — 400/418/500/503 with a matching document all return supported, which is the property the stale test was reaching for, correctly scoped; (b) 404/410 veto even a full match, exercised end-to-end through check() rather than only at the reducer, asserting no evidence field survives.
*Cost if wrong:* a misconfigured host serving a real document under a 404 loses its evidence — degrades to unreachable, renders nothing, fails nothing. Already recorded and accepted under C6.
Task 13: fix round 1/5 dispatched (resumed original implementer). FIX_BASE=507addd
Task 13: fix round 1/5 -> DONE at 832e6a8. 9 it() blocks in check.test.ts, 128/128 suite, tsc clean. verdict.ts confirmed untouched by git diff --stat. reachability still omitted from index.ts for Task 14.
Task 13: full task review dispatched (sonnet), package review-8190138..832e6a8.diff — first pass went implementer-found-contradiction straight into a fix round, so this is the first reviewer to see the front door.
Task 13: review returned spec ✅, quality Approved, 1 Important (doc gap), 1 Minor (cosmetic). All four behaviours verified by construction — notably, to test rung attribution the reviewer had to build a document matching its claim but UNDER the prose floor, since the ladder otherwise stops at the first good rung. verdict() called from exactly one place in src/. verdict.ts confirmed untouched by git log, stronger than a net-zero diff.
Task 13: gap probes — empty claims -> unclaimed; empty rungs list terminates sane (unreachable, ladderTruncated true); normalization-only match returns an excerpt showing the SOURCE's original characters; check() never reaches the network except through the injected fetcher.

**C12. Ruling: document AND enforce the Fetcher throw contract.**
A throwing fetcher propagated out of check() and aborted the run, with nothing saying whether that was deliberate. Bring-your-own-reader is spec 12's named mitigation for the fetch treadmill, so an undocumented failure contract undermines the one escape hatch the design offers. Interface now states it must not throw (an unreachable source is a RESULT, not an error); check() catches anyway and degrades that rung to unread, because one bad rung must not abort a document with nineteen other citations; and it WARNS rather than swallowing — a silently vanishing rung is the exact failure shape found four times in this plan already.
*Cost if wrong:* a genuinely broken third-party fetcher now produces warnings and unreachable verdicts rather than a loud crash. Mitigated by the warning naming the rung, the URL and the error.
Task 13: fix round 2/5 dispatched (resumed original implementer). FIX_BASE=832e6a8
Task 13: fix round 2/5 implemented fade5eb. 10 it() in check.test.ts, 129/129 suite, tsc clean. Exactly 2 console.warn lines, both from the new throwing-fetcher test (one per rung); no other test emitted stderr. verdict.ts untouched; reachability still omitted.
Task 13: fix round 2/5 (2 addressed, 0 open; commits 832e6a8..fade5eb). Re-review confirmed the try wraps ONLY fetcher.fetch (computeSignals deliberately unprotected, so a genuine bug still throws), EMPTY_RESPONSE produces sane signals, verdict.ts untouched, exactly the new test warns.
Task 13: I independently ran the one case the re-review asserted by INFERENCE rather than execution (throw on node, succeed on curl) — the case I had flagged as mattering most. Result: warn names rung and error, that rung alone degrades, curl succeeds, verdict supported, evidence attributed to curl, both rungs in rungsAttempted. Confirmed by running, not reasoning.
Task 13: complete (commits 8190138..fade5eb, review clean after 2 fix rounds)
Task 14: dispatched (sonnet — reachability + CLI + exit codes), BASE=fade5eb
Task 14: implemented 4324a39 DONE_WITH_CONCERNS. 139/139 (3 reachability + 7 bin), tsc clean, build clean, reachability export restored.
Task 14: another arithmetic error of mine — the brief's LONG fixture, meant to represent a READABLE document, extracted to ~4,208 chars, below the calibrated 4,500 floor, so it failed for the right reason. Implementer changed only the fixture's repeat count (120->140), never an expect() or a constant, and reported it. Correct direction: fix the fixture, not the threshold.
Task 14: implementer resolved an internal inconsistency in my brief — it demanded "URL and rung history, always" while the sample code printed no rung history. Added rungsAttempted to the unreachable/unreadable output lines. Correct call; no test covers console output either way.
Task 14: the load-bearing Windows check passed — no-args run prints usage and exits 2, proving the pathToFileURL guard actually fires main(). That is the bug that made bin.js a silent no-op under the old file:// comparison.
Task 14: review dispatched (sonnet), package review-fade5eb..4324a39.diff
Task 14: review returned spec ✅, quality Approved, 0 Critical/Important, 2 Minor. Exit-code matrix: 864 combinations, 0 violations, against an INDEPENDENTLY-derived expected function written from the contract rather than copied from the implementation. All five named invariants hold, including infrastructure:true -> 2 even with every tally maxed and all failOn false.
Task 14: Windows guard PROVEN — `node dist/bin.js` prints usage and exits 2 (literal exit code confirmed), not a silent no-op exiting 0.
Task 14: both implementer judgment calls upheld. The fixture change is correctly scoped (only the magic number and a comment; no expect(), no src/ constant) and the test STILL DISCRIMINATES — reviewer ran the shipped assertions against an always-readable stub and both correctly failed. The rungsAttempted addition correctly let the brief's explicit MUST control over its own contradictory sample code.
Task 14: minor (deferred): FailOn.orphanedClaims vs RunTally.orphaned field-name asymmetry, inherited from my brief.
Task 14: minor (resolved by Task 15): --explain-fetch and --rules appear in the usage string but are unimplemented — that is Task 15's scope.
Task 14: complete (commits fade5eb..4324a39, review clean)
Task 15: dispatched (sonnet — local rules override, additive-only), BASE=4324a39
Task 15: implemented 5545da7 DONE_WITH_CONCERNS. 145/145 (6 new in load.test.ts, matching my stated count for once), tsc clean.
Task 15 concern 1 (significant): implementer extended scope beyond my 3-file instruction — also touched challenge.ts, signals.ts, index.ts — because otherwise --rules would LOAD A FILE AND CHANGE NOTHING. My brief specified loading but never wired the result into classification. Reported with rationale and an offer to revert. Sent to review for assessment rather than accepted on my own say-so.
Task 15 concern 2: loadRules validates signatures/paths against the lastConfirmed/note contract but NOT local `hosts` entries — a gap in my code, untested.
Task 15 concern 3: --rules wired into check but not reachability, which uses the same fetch ladder.
Task 15: review dispatched (sonnet), package review-4324a39..5545da7.diff
Task 15: review returned spec ❌, 2 Critical, 2 Important, 2 Minor. Everything proven by running the built CLI against a real local HTTP server, not by reading.

**C13. Ruling: wire host rules through to the fetcher, and cover the functional core.**
Critical 1 — RuleSet.hosts was entirely unconsumed. hostRuleFor() read the module-level constant and never saw the merged set: a local host rule with requiresIdentity:true produced no warning, sent the plain browser UA, exited 0. The identical "loads correctly, changes nothing" failure the implementer had diagnosed and fixed for signatures/paths, left standing for hosts. Fixed: hostRuleFor takes the list to search, FetcherOptions carries merged hosts, userAgentFor consults them, check() builds its default fetcher with them.
Critical 2 — zero automated coverage of the functional core. All 6 tests exercised loadRules' pure validation; nothing asserted --rules changes a verdict, so a regression turning it into a no-op would leave 145/145 GREEN. Two integration tests added: a local signature flipping supported -> unreachable, and firedRule pinned as provenance on a non-supported verdict carrying no excerpt.
Important — local hosts now validated against the same lastConfirmed/note discipline (moot only while inert); reachability accepts the same rule set, since it walks the same ladder and a preflight disagreeing with the gate is worse than no preflight.
*Cost if wrong:* the hosts wiring touches userAgentFor, which every fetch goes through — a mistake there would change requests for all hosts, not just overridden ones. Mitigated by the default parameter preserving prior behaviour and by existing host tests.
Task 15: the implementer's unrequested scope extension was adjudicated NECESSARY and PROVEN — without --rules the CLI returned supported, with it unreachable plus the explain-fetch line. Well-executed for signatures/paths; incomplete only for hosts, which this ruling closes. verdict.ts byte-for-byte untouched throughout.
Task 15: fix round 1/5 dispatched (resumed original implementer). FIX_BASE=5545da7
Task 15: fix round 1/5 implemented 7a0cf6f. load.test.ts 9 it() (+3), check.test.ts 12 it() (+2), suite 150/150, tsc and build clean. Host rule verified reaching userAgentFor end to end against a real local HTTP server — identity warning fires only when rules is passed. reachability wired identically and verified with a readable->unreadable flip.
Task 15: fix round 1/5 (4 addressed, 0 open; commits 5545da7..7a0cf6f). Re-review BUILT a regressed check() ignoring opts.rules and confirmed both new integration tests fail against it — they discriminate the exact regression they were written for. userAgentFor(url,{}) prior behaviour confirmed identical for sec.gov, bloomberg.com and an ordinary host; look-alike-domain guard intact; verdict.ts untouched; signals.ts not touched at all this round.
Task 15: complete (commits 4324a39..7a0cf6f, review clean after 1 fix round)
Task 16: dispatched (sonnet — the ONLY task that touches the live web), BASE=7a0cf6f
Task 16: implemented eb856e8. Reachability 4/4 = 100% (all via node rung). Clean run exit 0, 4/4 supported. Broken-claim run exit 1 with MISS printed, restored and reconfirmed exit 0. README + docs/first-run-2026-09.md + example/ written.
Task 16: implementer correctly caught that my brief's "opaque URL reads unreachable" limit was STALE relative to shipped code (C1 withdrawn by ruling C7) and excluded it from the README rather than propagating a false claim into user-facing docs.

**CRITICAL FOUND BY THE LIVE RUN — space before punctuation causes a FALSE ACCUSATION.**
toText leaves a space before punctuation that followed a stripped inline tag: "<i>404 file not found</i>." extracts as "404 file not found ." An author copying a phrase VERBATIM from the rendered page therefore MISSES, and a miss on a read document is `unsupported`. The tool would publicly report an accurate citation as unsupported — exactly the failure the keystone rule exists to prevent, arising from the tool's own extractor.
Verified by me directly: phraseFound(toText("<p>The server replies <i>404 file not found</i>. That is...</p>"), "404 file not found.") === false.
The implementer hit this on its FIRST honest run, before any deliberate sabotage, and worked around it by copying from the extractor's output instead of the page. That workaround is not available to a real user, who has no reason to know the extractor exists.
Proposed fix for the final wave: norm() drops whitespace before punctuation, AND foldWithMap in excerpt.ts drops the same, so the index map stays aligned with the matcher and excerptFor can still locate. Dropping a character is safe for the map, which records surviving characters only.
Task 16: complete (commits 7a0cf6f..eb856e8)
ALL 16 TASKS COMPLETE. Final whole-branch review dispatched (opus).

## FINAL WHOLE-BRANCH REVIEW (opus) — DO NOT MERGE YET, 3 Critical + 10 Important
Structural finding, and the most useful sentence in the whole build: all three Criticals are the same shape — the reducer is sound, and every false accusation enters through a decision made AROUND it. Which rung wins (C1), what the extractor hands it (C2), which veto it is allowed to see (C3). Fifteen task-level reviews could not see any of them because none is inside a module.
CRITICAL 1 (NEW, not in ledger): check() picks the winning rung by prose volume alone, discarding a rung that matched EVERY claim. A short real article + a larger block page on curl -> the tool names as unsupported claims it had already located. Partial case is quieter and worse. Fix: a rung whose verdict is `supported` settles it; `missed` becomes the intersection across rungs.
CRITICAL 2 (confirmed + widened): space-before-punctuation. `,` works only by accident (norm deletes commas); `. ; : ! ? % ) ]` all miss. Reviewer supplied a proven patch incl. the foldWithMap lookahead my proposal glossed, and swept the corpus: 33 fixtures, 61 comparisons, 0 verdicts moved.
CRITICAL 3: maxChallengeChars=800 means a wall carrying TWO bundled signatures returns `unsupported` once padded past ~5,000 chars. signals.ts's own comment ("the prose floor catches anything this misses") is false above 4,500. The ECB fixture is already this shape at 200.
Ledger bookkeeping gap the review caught: Task 15's review returned 2 Critical + 2 Important + 2 MINOR; C13 addressed four and I recorded "4 addressed, 0 open" — the two Minors were never itemised. Recover from the Task 15 review artifact.
Final fix wave dispatched (opus, ONE dispatch per the skill).
BOOKKEEPING CORRECTION (closing the gap the final review flagged). Task 15's review returned 2 Critical + 2 Important + 2 Minor; ruling C13 addressed the first four and I recorded "4 addressed, 0 open" without itemising the Minors. Recovered from the review artifact:
Task 15: minor (deferred): load.test.ts's "requires lastConfirmed and note" only ever reaches the lastConfirmed branch — it runs first in toRule(), so a rule missing both throws there and the `note` error path has no independent test. Reviewer confirmed by hand that it works.
Task 15: minor (deferred): load.test.ts tests 1-2 assert only .length against the bundled arrays rather than content/identity. Reviewer independently confirmed the values match.
My Task 15 fix dispatch did ask for both "if cheap"; the fix landed 3 new tests in that file but I did not verify WHICH. The final fix-wave re-review will settle it.
Lesson recorded: "N addressed, 0 open" is only true if every finding was itemised first. A count is not a list.
FINAL FIX WAVE: implemented 42d21e5. 190/190 (from 150), tsc + build clean, live `check example/sample.md` still exit 0. Corpus sweep 34 fixtures / 63 comparisons / 0 verdicts moved, 29 matched claims / 0 null excerpts — index map stayed aligned with the matcher.
Fix wave corrected MY framing: the ECB page carries NO bundled challenge signature, so it demonstrates heavy-chrome-at-200 with N4 as sole rejecter; maxChallengeChars is a SEPARATE path to the same outcome. Written up separately rather than conflated.
Fix wave judgment calls: (a) known-gap fixture needed a third `kind` — filing it as `challenge` would fail the acceptance test, which is the point; (b) empty-claim guard THROWS, a behaviour change for programmatic callers passing [""]; (c) isBlocked shared by verdict() and reachability only — check()'s ladder `challenged` flag still excludes documentGone, since folding N4 there would change escalation no finding asked for.
Both deferred Task-15 minors settled: already covered in load.test.ts (independent note-branch test; toEqual against bundled arrays, not .length).
Scoped re-review of the fix wave dispatched (opus).

## FINAL FIX-WAVE RE-REVIEW (opus) — both Criticals fixed, 4 blocking items left
Independently reproduced every figure: corpus sweep 34/63/0 verdicts moved, 118,677-pair differential fuzz with 0 null excerpts and 0 contract failures, 400k-pair false-match hunt finding nothing reachable from a whole-phrase claim. Also corrected the fix report's REASONING: norm() feeds challenge signatures too (challenge.ts calls norm before every signature test), so "normalization only feeds claim matching" was false — the measured result stood, its stated justification did not.

**C14. Ruling: fix the four blocking items rather than surfacing them, then finish.**
Two are load-bearing: (NEW-1) the empty-claim guard tests .trim() not norm(), so a claim of "," normalizes to empty, matches every document, and mints `supported` with a null excerpt — reachable from the CLI, since parseClaimsFile shares the predicate. That is a false ATTESTATION, the second-worst outcome in this design. (NEW-2) `unsupported` with an empty `missed`: when the union of located claims covers everything but no single rung does, CI fails red with no reason printed — worse in one respect than the Critical it replaced.
Two are false statements in user-facing docs about the keystone path: (README-1) the rewritten "no model" bullet claims none of the unreachable inputs is a prose search, but N3 runs twelve regexes over norm(toText(body)) and feeds isBlocked — the sentence replaced a false claim with another false claim; (README-2) the README credits the ECB fixture with pinning the maxChallengeChars route, when it carries ZERO bundled signatures and pins the heavy-chrome route — contradicting this branch's own calibration doc, which says the corpus has no fixture for the other route.
The NEW-2 fix keeps verdict() the single decision point by handing the reducer a union-aware match count rather than re-implementing the decision in check().
*Cost if wrong:* the union-aware count changes what `matched` means at the reducer's boundary — if wrong it could attest across rungs that should not combine. Mitigated by two required tests and the unchanged reducer.

### Parked with rulings (real, deferred, NOT fixed)
- NEW-3: I-2's drift is only half removed. reachability ORs vetoes across ALL rungs (sticky), check() evaluates only the winning read. Measured harmful direction: node challenged / curl clean 200 -> preflight says "challenge interstitial", gate says `unsupported` on the same URL. Ruling: real, deferred — it needs a design decision about which aggregation is correct, not a patch, and the preflight is advisory. Belongs in plan 2 or a README note.
- NEW-4: `proven` enlarged the false-attestation surface — a short unrecognised stub carrying the claim now outranks a 100x larger document read on a later rung. The design's chosen safe direction and the README discloses the paywall-stub case, but the wave enlarged it silently and no test covers it. Ruling: accept, record, add a test in plan 2.
- README-3: the truncated-ladder suffix prints only inside the `unreachable` branch, so a `supported` verdict from a truncated ladder — the case the bullet is about — prints nothing.
- README-4: --explain-fetch listed as global; reachability accepts and ignores it.
- NEW-5: CitationResult.missed became optional — correct by doctrine, breaking for TS consumers of r.missed.length. Changelog line at 0.1.0.
- NEW-6: the punctuation set is duplicated across four it.each arrays with no single source of truth; deleting an entry is silent.

## FABLE PRE-MERGE REVIEW (two agents, at Noah's direction)

### Fable A — the fixes: NOT SAFE AS-IS, one new keystone defect
Round two's union fix introduced a regression I had flagged in C14's cost-if-wrong and then wrongly declared mitigated. `locatedBy` was built from EVERY read's matchedClaims with no check of that read's veto signals, so a match inside a body the classifier itself identified as not-the-document counted as proof. Reproduced: node reads a genuine sub-floor article carrying claim A; curl returns a short cf-mitigated wall whose boilerplate carries claim B -> `supported`, with the WALL'S OWN SENTENCE published as evidence. Pre-fix this was `unreachable`. Spec 6.2 says a challenge body cannot be the document.
My mitigation claim was false: both required tests used a NON-vetoed block page, so the vetoed path was never exercised. Fix dispatched (exclude isBlocked reads from the union; also fixes first-match mis-attribution; plus zero-widths into excerpt.ts DROP).
Fable A also found, deferrable: the punctuation clause can glue "Model 5 | .05" in a table into "model 5.05" so a claim "5.05" attests (mirror of the guarded "1. 5 things" case — space-after was guarded, space-before-a-digit was not); and U+00AD soft hyphen is stripped nowhere, a false-miss class.

### Fable B — parked findings and rulings: reverse NONE, amend two
Independently reran calibration; every number in the doc reproduced. Would reverse no ruling; called C5 (refusing to drop the ECB fixture — no green by omission) the best call in the ledger.
- NEW-3: DEFER confirmed, and Fable VERIFIED the contradiction is ONE-DIRECTIONAL — preflight-readable provably implies the gate reads the page, so it only ever errs pessimistic. No false verdict flows through it. Add one README sentence. Also judged check()'s aggregation almost certainly correct over reachability's sticky OR, since the ladder exists BECAUSE rungs differ.
- NEW-4: DEFER on merits but PIN NOW, not plan 2 — and it is larger than I recorded: a proven stub at 200 beats a later rung's N4 veto (gate `supported` while preflight says the document is gone). ~20 lines of characterization test, no src change. The branch's own method for accepted exposures is a characterization test (it did exactly that for the ECB known-gap), so leaving this unpinned is inconsistent with its own discipline.
- README-3 and README-4: **FIX NOW, not defer.** My C14 parking drew the README boundary at "keystone path", but C14 itself blocked on README-1/2 because false user-facing statements are blocking. Same standard applies. Both are one-line edits.
- NEW-5: defer, but no CHANGELOG file exists, so the promised landing place does not exist.
- NEW-6: defer.

### Process failures Fable B found in MY bookkeeping
- Task 11's review returned 3 Critical + 1 Important + 1 MINOR; C9 addressed four; the Minor is itemised nowhere and there is NO artifact to recover it from. It is lost. Worse than the Task 15 case.
- The final review's "10 Important" is a count with no list.
- Task 13's "1 Minor (cosmetic)" was addressed-by-count, never named.
- **Task 16 is the ONLY task with no review dispatched at all** — and it is the only task that touched the live web and wrote the README. The final review then found five-plus false README statements there. Direct causal line.
- Lesson: store reviewer findings as artifacts, not ledger summaries.

### Fable B's sharpening of the integration observation
All three final Criticals PLUS NEW-3 and NEW-4 live in ONE seam: cross-rung aggregation, which the spec never specifies. Spec 6.2's verdict table is per-read; which read feeds it — proven-first, union-matched, intersection-missed — is entirely implementation invention. A probe-pass task finds such defects late; a NORMATIVE SPEC SECTION on aggregation semantics would prevent them, and is where NEW-3's pending design decision belongs.
Categories this process would still miss: (a) live hostile-web behaviour — everything is fixtures plus four friendly URLs, and spec 10's scheduled live-probe suite does not exist; (b) adversarial ATTESTATION — every probe on this branch attacked the accusation direction, nobody tried to make a page MINT `supported`; (c) comment drift inside src — signals.ts still says "The prose floor catches anything this misses", false above 4,500 by the branch's own analysis.
- Also: spec section 8 still mandates `--fetcher` as a global CLI flag; the plan de-scoped it and the README says so, but the binding authority was never amended. The one spec/ship divergence with no ruling marker.
