# testimonium: making "sourced" mean "supported"

**Date:** 2026-09-06
**Status:** Draft 2 - Fable review returned REVISE with five blockers; all five are
addressed below. Awaiting editor review, then `writing-plans`.
**Amended:** 2026-09-07, twice. First, section 6.2 only, adding a fifth veto (N5,
"the body is not text at all"), authorised by
`docs/superpowers/plans/2026-09-07-plan-1-1-extraction.md`. Second, after Fable's
REWORK of the plan 2 (`harvest`) design: new sections 6.6 (reads, readability and
aggregation across rungs) and 8.2 (harvest); a claim-length floor and the soft
hyphen in 7.3; corrections to 5.3, 8, 8.1 and 14, which had gone false; Q3 and Q5
resolved. Authorised by `docs/superpowers/plans/2026-09-07-plan-1-2-reader.md`,
which declares the amendment in its own header. Plan 1.2 implements 6.6 and the
corrections; plan 2 implements 7.3's floor and 8.2.
**Language:** TypeScript, Node >= 20, npm.
**Sibling to:** `urtext`. Not a subcommand of it. See section 3.

---

## 0. Provenance of this document

This spec draws on code in `<origin repo path withheld>`, which is read-only to
this project and had uncommitted work in flight while it was written.

- Claims about that code were verified by direct read at HEAD `3eaf353`
  (2026-09-06) unless marked otherwise.
- `[reported]` marks a claim taken from another session's handoff and not
  independently verified here.
- `[measured]` marks an empirical result, with its method named.

Line numbers move. Where a line number appears, the behavioural claim attached to
it was checked, not merely the line's existence.

**Draft 2 note.** Every citation in draft 1 was independently re-verified during
review at HEAD `3eaf353`, and all resolved with their behavioural claims intact -
with one exception. Section 6.3 cited two pages as large readable documents
served under error statuses; re-fetching them showed both to be large *error
shells* extracting to 12 and 522 characters respectively. That is precisely the
failure this section exists to prevent, committed in the document that declares
it. The claim is withdrawn and the correction is kept visible in 6.3 rather than
quietly deleted.

The `[measured]` battery result was independently rerun during review and its
headline number confirmed: 11 of 17 realistic walls evade the shipped signature
list, zero false positives. One precision error was corrected (PerimeterX). The
`[reported]` EUR-Lex account is corroborated by the origin repo's commit history
but remains same-author testimony rather than independent confirmation.

---

## 1. What this is

`testimonium` verifies that each footnote's cited URL actually carries that
footnote's claims. It is not a link checker. A link checker asks whether the
server answered; this asks whether the page says what the citation says it says.

The premise, inherited verbatim from the gate it extracts:

> HTTP 200 is necessary and NOT sufficient. A live link under an unsupported
> claim is worse than a dead one, because nothing flags it.

The name is the thesis. In classical scholarship a *testimonium* is a passage in
a source that attests to a fact or to another text. This tool's output is a set
of testimonia: for each claim, the passage in the cited source that carries it,
recorded with the date it was read.

**Origin.** A reader's comment on X, on one of the pieces this was built for:

> "'Sourced' and 'supported' aren't quite the same. For a serious claim, I'd want
> the exact passage or artifact that supports it, plus a check that the source
> still says that today. Citation presence alone is a weak test."

The comment is correct. This is the mechanism that concedes it.

---

## 2. The rule this inherits, and why it shapes everything

> **`unsupported` requires positive proof we read the real page.**

A source we could not read must never render to a reader as a claim we could not
support. `unreachable` is an availability fact about us, not a credibility fact
about the claim. It does not fail a run and it renders nothing - not a badge, not
a bare date, not an empty container. Only `supported` renders.

Breaking this makes the system publish false accusations against its own accurate
work. That is a worse failure than the one the tool exists to prevent, because it
is self-inflicted and it is aimed at the author's own honest citations.

This is the outward-facing form of a rule already applied internally in
origin-repository (`src/lib/documents/artifact.ts:47-51`): "the evidence moved" must
never render as "the model fabricated this."

**Section 6 is the operational form of this rule and everything in this document
is subordinate to it.**

---

## 3. Why a sibling to urtext, and not part of it

Same conviction expressed twice. `urtext` tiers findings `verified` / `inferred` /
`model`. `testimonium` tiers citations `supported` / `unsupported` / `unreachable`.
Both exist to stop an assertion masquerading as a proof, and both refuse to let
the tool's own failure read as the subject's fault.

But `urtext` reviews code by static analysis; `testimonium` verifies prose against
live network sources. Different domain, different user, different failure modes.
`urtext`'s tier credibility rests on "an analyzer proved this," which does not
extend to a network fetch that can be bot-walled. Folding this in would blur what
`urtext` is.

**The family rule is one tool, one epistemic contract.** `urtext`'s contract is
"every claim labeled by its evidence tier." `testimonium`'s is "mechanical or
silent." They share design language - deterministic default, tiers that mean
something, `--json`, no telemetry, the same README voice - so they read as a
family without sharing a binary.

---

## 4. Positioning, and the honest audience

**The README leads with the argument, not the audience.** Sourced is not
supported; here is a mechanism that tells the difference. The quickstart is a CI
gate with exit codes.

**AI-drafted prose gets a named, honest section - not the headline.** The
temptation is to lead with it: teams publishing model-drafted work have a live
citation-fabrication problem and are the only segment with a growth vector.
The reason not to is that the tool cannot back the claim that framing implies.

`testimonium` checks whether a cited page contains a phrase. It does **not** check
whether that phrase supports the sentence it is attached to. An author who writes
lazy phrases gets a weak check. For model-drafted prose, lazy phrases are the
*default* failure mode - a model cites a real page, quotes a real sentence, and
the sentence does not establish the point. `testimonium` returns `supported`.

So the "gate against AI citation failure" pitch is weakest exactly where its
audience is weakest. Leading with it would reproduce, in this tool's README, the
gap this project exists to close: promising more than the mechanism delivers.

**The honest audience is small.** Direct adopters as designed: people who already
keep verbatim source quotes and are willing to maintain a claims file. That is
tens of people, not thousands. Academics have Zotero and paywalled PDFs this
cannot reach; legal writers have perma.cc and authenticated databases; newsroom
fact desks verify inside closed CMSes with people, not Node CLIs. Say this in the
README as a limit, the way `urtext` says three of seven analyzers find nothing in
a Python repo - a limit, not a roadmap item.

The reachability figure from the origin corpus - **121 of 125 (96.8%) of published
citation URLs still re-fetch cleanly** `[measured; probe over the 15 newest posts,
per the origin-repository design spec section 2]` - **must not be quoted as a general
number.** That corpus was filtered at authoring time for sources the author could
read. A new user's first honest experience is *their* number, which will be lower.
This is why `reachability` is a v1 command (section 8).

---

## 5. Architecture

```
  adapters ---> document { footnotes: [{ n, url, label }] }
  claims file (keyed by URL) ---> Map<url, phrase[] | NotApplicable>
                    |
                    v
        check(url, claims, opts)        <-- THE FRONT DOOR. Owns the verdict.
                    |
      +-------------+---------------------+
      v             v                     v
   fetcher      classifier          ladder reducer
  (IO, dumb,     (pure)                 (pure)
   pluggable)   readEvidence()   attempts[] -> next | final
                    |
                    v
      { verdict, evidence[], provenance }
```

Three layers, not two. The pure/IO split alone is insufficient: "challenged at
the fetch rung, so try curl" is a decision *about* a classification made *inside*
IO code, and that is where untested epistemic literals accumulate. The current
`fetchSourceText` still carries `ok: !!text, http2xx: !!text` inline in its PDF
branch (`source-fetch.mjs:302`) and hand-built booleans in its final return
(`:347`) - two branches of the exact shape `classify2xxBody` was created to
eliminate. In `testimonium`, **every `ok` and `http2xx` in the codebase is
produced by tested pure code and none by an IO branch.**

### 5.1 The front door owns the verdict

The public entry point is:

```ts
check(url: string, claims: string[], opts?: CheckOptions): Promise<CitationResult>
```

Not `fetchAndClassify(url)`. A fetch-level entry point leaves the keystone
mapping - result to `supported`/`unsupported`/`unreachable` - in every caller,
and that is precisely how the origin repo failed.

**The evidence for this is not hypothetical.** `scripts/lib/source-fetch.mjs`
opens by stating that per-host rules must go in the module and never in a caller,
"because two divergent copies of that list is the failure this module exists to
prevent." But the module has two callers and only one goes through the ladder:
`scripts/bulletin-srccheck.mjs` imports only primitives and runs its own inline
fetch ladder. The ladder itself was the divergent copy.

Worse, the same-day patch that added challenge handling to that inline ladder
introduced three fresh divergences from `fetchSourceText`, verified here by
direct read:

1. On a challenge at the fetch rung it prints "NOT READ" and `continue`s
   (`bulletin-srccheck.mjs:102-106`), so the `curlText` retry further down
   (`:122`) is gated on a `viaFetch` flag that was never set. The module's own
   ladder falls through to curl in this case, because some hosts challenge node
   fetch and hand curl the document.
2. Its fetch rung sends `user-agent` and `accept-language` but no `Accept`
   (`:72-76`) - the axios lesson, present in the module and absent from the copy.
3. It logs `FAIL non-200` without a `continue` (`:85-88`), then extracts and
   claim-matches the wall's bytes, reporting one unreachable source as N+1
   separate problems.

A fifty-line inline ladder, patched by the same author on the same day the rule
landed, in the same repo, under a module header that forbids exactly this - and
it still diverged three ways. **Comments do not bind. The ladder must be
un-copyable.**

### 5.2 Epistemics mandatory, policy parameterized

Callers go around a front door that does not fit, and `bulletin-srccheck`
diverged partly for *legitimate* reasons: it wants `unreachable` to fail its run,
wants per-claim provenance tags, wants item-level logging. Those are policy, and
policy differences must be expressible or they become forks.

- **Non-negotiable, inside the package:** the verdict ladder, the keystone rule,
  what counts as positive proof of a read.
- **Caller-chosen, through declared options:** `failOn: { unreachable?, unclaimed? }`,
  reporting hooks, concurrency and politeness delays, fetcher selection.

The result shape must be rich enough - extracted text, method, status, rung
history, which rule fired, matched and missed per claim - that no caller has a
*reason* to reach underneath.

### 5.3 Primitives are sealed, not discouraged

Node's `package.json` `exports` map makes a deep import of an internal module
throw `ERR_PACKAGE_PATH_NOT_EXPORTED`. The primitives (`norm`, `toText`,
`isPdf`, per-host helpers) are genuinely unavailable to consumers, not merely
advised against. The test suite imports source modules by path (`../src/...`);
there is no internal entry point, and `test/exports.test.ts` pins the exports map
to `.` and `./package.json` alone. (This paragraph said "exported to the test
suite through a separate internal entry point" from draft 2 until 2026-09-07;
no such entry point ever existed.)

The residual leak is vendoring or forking, which no packaging prevents. The
defence is to make the blessed path cheapest and to say plainly in the docs that
a hand-rolled ladder forfeits the keystone guarantee, citing this history.

---

## 6. The verdict ladder, and the burden-of-proof inversion

**This section is the heart of the spec.**

### 6.1 The defect being corrected

The keystone rule says `unsupported` requires *positive proof we read the page*.
Both the pre-fix and post-fix implementations in origin-repository are a **blocklist
of known walls**: `isChallengePage` matches a body against a signature list, and
anything unmatched is treated as read. That makes `unsupported` require the
*absence of proof we did not* read the page. Those are different rules, and every
wall not yet on the list falls in the gap.

EUR-Lex was one instance of a permanent class. `[reported]` A 202 bot-check
interstitial of 159 characters set `http2xx: true`, so seven hand-verified claims
were marked `unsupported`.

The signature list is the fastest-rotting artifact in the system:

- It shipped stale. It missed bloomberg.com's "are you a robot?" wall, which the
  module's own header documents at lines 18-27 - the module contradicted itself.
  Its only Cloudflare entry was the retired pre-2023 wording. `[reported]`
- It rotted again the same day it was repaired. `[measured; Fable battery of 23
  constructed cases against the shipped `isChallengePage`, 2026-09-06]` **11 of 17
  realistic walls evade it.** Cloudflare's automatic challenge says "Verify**ing**
  you are human" - not a superstring of the signature `verify you are human`, so
  the repair caught the Turnstile checkbox variant and missed the automatic
  variant of the same vendor. "Enable JavaScript **and cookies** to continue"
  defeats `enable javascript to continue`. Also through: Amazon's robot check,
  DataDome's abbreviated "Please enable JS", Anubis, PerimeterX's press-and-hold
  variant (its block page *was* caught), Imperva, Google's sorry page, Vercel's
  checkpoint, EUR-Lex's own wording **in French**, and a genuine Turnstile page
  padded past the 800-character cap by ordinary cookie boilerplate. **Zero false
  positives** - the exposure is entirely on the false-negative side.
  `[independently rerun and confirmed during review, 2026-09-06]`
- Several of those evasions are currently harmless only because those vendors
  happen to serve non-2xx. **The keystone guarantee is presently underwritten by
  Cloudflare's HTTP conventions**, a fact outside the tool's control.

Signature matching through `norm` fixes typography. Wording is what rots.

### 6.2 The inversion

`testimonium` requires positive evidence of a read before it will accuse.

**The tool is uniquely equipped to do this, because it arrives already carrying
phrases known to have been on the page.** The claims are an oracle no generic
fetcher has.

```
PROOF OF READ - BODY-DERIVED ONLY
  P1  At least one claim phrase matched in the extracted body.
  P2  Extracted prose volume above a calibrated floor.
      NOT a text-to-markup ratio. See 6.5 for why the ratio is the wrong
      instrument. Measured separation on real pages: challenge and error
      shells extract 12-600 characters; real articles extract 7,000-33,000.
      This is the origin's CHALLENGE_MAX_CHARS cap generalized from a
      signature-gated special case into the primary instrument.

REPORTED, NEVER LICENSING - neither of these can permit an accusation
  C1  Slug correlation IN THE BODY: content words from the URL path and
      from the author's footnote label appear in the extracted text.

      **WITHDRAWN FROM THE VERDICT. Measured, twice, and it does not
      work.** Draft 2 made it a required half of the accusation gate.
      Calibration killed that in two rounds:

      Round 1 - it drew words from the document's own <title>, which
      arrives in the SAME RESPONSE as the body, so every page contains
      its own title by construction. All 12 fixtures carrying a title
      scored exactly 1.00, challenge and document alike.

      Round 2 - with the title removed, a real blog index at
      blog.mozilla.org/en/ scored a vacuous 0.00, because "en" is two
      characters and falls under the content-word floor. That is the
      identical score to a Federal Register anti-scraping wall. The two
      populations share their minimum, so no threshold separates them:
      414 threshold pairs satisfy the assertions and every one of them is
      NEGATIVE, which is C1 switched off wearing a number.

      And the ordering is inverted where it is measurable at all: the
      highest challenge overlap (0.80, Federal Register) OUTRANKS the
      lowest real document (0.75, MDN). C1 is not merely weak on this
      evidence, it is anti-correlated.

      It stays computed and reported, because it is useful diagnostics
      under --explain-fetch and it is the natural place to start if
      someone finds a corpus where it does discriminate. It does not
      gate. A gate that does no work while implying safety is worse than
      no gate.
  C2  Head markers: og:type=article, json-ld articleBody or datePublished.
      REPORTED, NEVER LICENSING. These prove a page exists at that URL.
      They do not prove its body was read - a paywall stub keeps the
      article's whole head. See 6.5.

VETO - overrides everything, including P1
  N1  A vendor challenge header. `cf-mitigated: challenge` is Cloudflare's
      own documented marker, present on every Challenge Page type, in every
      language, at any body length. Cloudflare's challenge page REPLACES the
      resource, so a body carrying this header cannot be the document -
      which makes the veto cost-free.
      [verified: developers.cloudflare.com/cloudflare-challenges/ detect-response,
      updated 2026-05-05, read as raw page rather than as a fetch summary]
  N2  finalUrl after redirects lands on a declared challenge or consent
      path. The path list is dated data under 7.2, not a constant.
  N3  Challenge signature match AND body under the length cap.
  N4  HTTP 404 or 410. The document is gone.

      This is the ONE place status is consulted, and the asymmetry is the
      whole justification. A server is not authoritative about PRESENCE -
      6.3 records a 400 serving 253KB and a 404 serving 112KB - which is
      why 2xx is never proof of a read. But a server saying 404 or 410 IS
      authoritative about ABSENCE: it is the origin stating that the
      resource it was asked for does not exist. Refusing to believe that,
      while also refusing to believe 2xx, would leave nothing believable.

      Draft 2 deferred this, noting only that "a 404 distinguishes 'this
      document is gone' from 'this document was read', which is
      information recheck will want even though check does not act on
      it." Calibration proved check must act on it: a real ECB 404 serving
      13,221 characters of navigation chrome (13,216 since plan 1.1's entity
      decoding) cleared every body-derived test - prose volume above two of
      nine real documents, overlap 1.00 - and no threshold pair could reject
      it. Exhaustive search over 24,915
      pairs returned zero solutions with that fixture and 249 without it.
      Body shape cannot see what the status line says plainly.

  N5  The body is not text at all. Two independent triggers, either one
      sufficient:
        (a) the response `content-type` falls outside the accepted set: any
            `text/*`, plus `application/xml`, `application/xhtml+xml`,
            `application/json`, and any type ending `+xml` or `+json`. The
            type is compared case-insensitively with parameters (`charset`)
            dropped. An ABSENT content-type is
            treated as textual, which is forced rather than merely
            defensible: the pdftotext rung returns no headers at all
            alongside real extracted text, so the opposite choice would
            veto every PDF the tool CAN read;
        (b) the raw body, before any tag-stripping, is dense with U+FFFD
            replacement characters and C0 control bytes. Prose is not, and
            no script is - CJK, emoji and mathematical notation all sit
            above U+0020.

      **AMENDMENT, 2026-09-07, from plan 1.1
      (`docs/superpowers/plans/2026-09-07-plan-1-1-extraction.md`).** N1-N4
      all ask whether a server or a wall stopped us. N5 asks whether what
      came back is prose in the first place, and nothing in draft 2 asked
      that. Without it a content-negotiated PDF - an arxiv or DOI link with
      no `.pdf` in the path - decodes to a megabyte of "prose", clears
      every threshold, and turns a claim the document genuinely contains
      into an accusation. [measured: a real paper extracted 1,037,512
      characters, 230x the floor, with no veto firing]

      The two constants behind (b) - the density and the sample window -
      are NOT calibrated against the corpus the way 6.3's prose floor is.
      See `src/classify/thresholds.ts`, which says so, and
      `docs/calibration-2026-09.md` for the gaps this veto is known to
      leave open.

VERDICT
  claims.length == 0                          -> unclaimed   (never supported)
  N1 | N2 | N3 | N4 | N5                      -> unreachable
  matched == claims.length                    -> supported
  P2                                          -> unsupported
  otherwise                                   -> unreachable
```

Accusation rests on P2 and the five vetoes. Measured separation on the
fixture corpus: largest non-vetoed challenge 1,180 characters, smallest
real document 6,394 - a gap of 5,214, with the floor licensed at 4,500.
N4 removes the padded error shells that prose volume cannot see, and N5
the bodies that are not prose at all; nothing else needs removing.

*(Amended 2026-09-07 with N5, per plan 1.1. The document figure was 6,858
when this paragraph was written; it is 6,394 as of the current corpus -
re-measured 2026-09-07 with `node scripts/calibrate.mjs`, and the reason
for the change is recorded in `docs/calibration-2026-09.md`. Both N4 and N5
are load-bearing on this corpus: without N5 a fixture extracting 6,221
characters sits inside the 1,180-to-6,394 gap and collapses most of it.)*

**Read the table's shape, because it is the whole correction.** Attestation and
accusation have different burdens. A full match is its own proof of a read and
needs nothing further. An accusation requires body-derived evidence that we read
a document - prose volume - plus no veto. `matched > 0` no longer licenses an
accusation on its own.

That asymmetry is what closes the two false-accusation paths this scheme had in
draft 1:

- **The paywall stub.** Head intact, `og:type=article`, no challenge involved,
  body a stub. C2 is now reporting-only and P2 fails, so the verdict is
  `unreachable` rather than a red CI failure against hand-verified work.
- **Partial match inside a wall.** One boilerplate phrase - a cookie-policy
  sentence in a padded challenge page - matching while the real claims miss.
  Under draft 1 that gave `matched > 0 -> unsupported`: an accusation *minted by
  the wall*, failing the run. P2 now gates it to `unreachable`.

### 6.3 What the inversion buys, and what remains to be proved

**The signature list stops being able to mint an accusation from the read it
vetoes.** N3 vetoes when a signature matches AND the body is under the length
cap, and that veto stands even where the claims would otherwise have matched in
full: the vetoed read is never judged as a document, and no `unsupported` is
ever computed from a wall's signals. What no veto withholds is an accusation
supplied by a LATER read, and the mechanism is not particular to N3: `isBlocked`
ORs all five vetoes together (N1, N2, N3, N4, N5), and `src/check.ts`'s union
loop (`locatedBy`) excludes a read on that same check, whichever veto fired it.
A claim that only the excluded read carried is named in `missed` when a
readable later rung is judged, and the veto - whichever of the five it was -
is then the but-for cause of an `unsupported` that the same two responses
would not have produced without it. Measured 2026-09-08 against the shipped
build: a signature-carrying body under the cap holding claim A, followed by a
readable body holding claim B and not A, returns `unsupported` with A missed;
the same body with the signature phrase removed returns `supported`. The same
holds for status: a 404 read holding A, paired with the same readable read,
returns the identical `unsupported`; the same body at 200 returns `supported`
- the mechanism the N4 paragraph below now names directly, rather than as a
residual of rule 2 alone. This paragraph said "Every verdict it decides is a
withheld accusation, never a supplied one" until 2026-09-08. That was false at
3974d27 and at every commit since - the union machinery is unchanged from it -
and it is the twin of the false status claim the N4 paragraph below has now
corrected twice. It is corrected here rather than left standing, for the
reason given there: this document is the authority every ruling resolves
against, so a sentence in it that has gone quietly false is worse than one in
the code. Pinned for the signature case by `test/check.test.ts`, "N3 through
the cross-read union"; the veto-wide mechanism is measured above.

The rot argument survives below the prose floor in the accusation direction
only, and draft 1 stated it without either condition. N3 fires only where
`proseVolume` is under `maxChallengeChars` (800), which sits far below
`minProseChars` (4,500) on the same measured quantity. So beneath the floor
rot can never mint an accusation:
an unnamed wall is not excluded from the cross-rung union, so nothing it fails
to name can turn a present claim into `missed`. It is not free of cost,
though - an unvetoed wall that matches every claim, alone or completed through
a later read, never reaches this floor at all, because `verdict()` returns
`supported` on a full match before the floor is consulted, quoting the wall's
own text as evidence (test/check.test.ts:501 pins the union shape). An
over-broad entry costs an attestation where the vetoed read is the only read -
a real document that matches it and is short reads `unreachable` where it
would have read `supported`. Where a later rung produced a readable read the cost
is larger than an attestation: the vetoed read's matches leave the union, so a
claim only it carried is named in `missed` and the citation reads `unsupported`.
Corrected 2026-09-08 with the paragraph above; the same mechanism, stated where
the cost is claimed.

Above the floor neither protection applies. A wall padded past ~4,500 extracted
characters is vetoed by neither the signature, which only applies below 800, nor
the floor, which only blocks an accusation on a short body. There nothing the
signature list says can bear on the verdict - N3 is gated on `proseVolume <
maxChallengeChars`, so an entry naming this wall could not fire on it - and a
wall can mint an accusation against an author who did nothing wrong. Measured
2026-09-09 against the shipped build: a 5,005-character padded wall carrying a
bundled signature phrase and its unlisted twin both return `unsupported`, the
listed one with `challengeSignature` false though its phrase is in the list.
Membership changes a verdict only below the cap, and the boundary is exact - at
799 extracted characters the listed wall reads `unreachable` where its unlisted
twin reads `supported`; at 800 both read `supported`. That is the known gap
carried as a fixture in `fixtures/corpus.json` and measured in
`docs/calibration-2026-09.md`. It is NOT why draft 1's "never truth" was
wrong: a complete list would not have closed this gap either, because no entry
can fire here at all. What makes "never truth" wrong is the pair of costs
below the cap, both stated above - an over-broad entry buys a false accusation,
and rot buys a false attestation. This paragraph asserted the opposite ("there
the list's completeness does bear on truth") from `551e8da` until 2026-09-09.
It was false the day it was written: N3's length gate already shipped in
`75fae68`, a verified ancestor of that commit. It survived four review rounds
because the tests run against it varied the WALL and held the LIST fixed -
round 4 did measure the falsifying pair, a listed and an unlisted padded wall
both returning `unsupported`, and recorded it as confirmation. The structural
half of this needs no measurement; the exposure above the floor has been
measured, and the thresholds were left alone deliberately.

Draft 1 called the list "an optimization" that "may rot freely; the cost is
latency and reach, never truth". N3 made that false. It is the same false claim
plan 1.1 found in `src/rules/challenge.ts`'s own comment and corrected there, and
it is corrected here for the same reason: this document is the authority every
ruling resolves against, so a sentence in it that has gone quietly false is worse
than one in the code.

**Below the floor, an accusation stops depending on the list naming a
wall.** Every wall in the battery - listed or not, English or not, inflected
- fails P2: none of them clears the floor (measured,
`fixtures/challenge-battery.mjs`: 23 cases, longest 982 characters, all under
`minProseChars` 4,500). The defence there is a property of what a wall *is*,
not of what we have written down about it. The converse is not free: a
complete list can still supply an accusation through the union (above), and
above the floor a wall can mint an accusation no list entry could have
prevented (above).

**What is NOT yet established, and must not be claimed until it is.** Draft 1 of
this spec asserted that all 11 evading walls "degrade to `unreachable`." That was
unverifiable when written and is withdrawn. The battery exercises
`isChallengePage` only; P2, C1 and the N-signals do not exist yet, so the
property depends entirely on thresholds nobody has calibrated.

> **Acceptance test, binding on the implementation plan.** Over the fixture
> corpus - every challenge and error shell on one side, every real article and
> PDF on the other - the verdict reducer must return `unreachable` for 100% of
> non-documents and must not return `unreachable` for any real document whose
> claims are present. The calibration that achieves this, and the thresholds it
> yields, are recorded in the repo. Until that test is green, "all walls degrade
> safely" is a design intention, not a property.

**On HTTP status.** The origin spec's section 2 concluded that a status code is
unreliable in both directions. That conclusion still holds in the direction that
protects the author: no status is ever read as proof the real page was reached, so
a 200 licenses nothing by itself and a document served under a 400 is judged by
its body like any other.

The scheme does consult status, in one direction only. N4 (section 6.2)
reads 404 and 410 as evidence the document is gone and vetoes that read;
since plan 1.2 the ladder climbs past it (6.6, "Escalation") and the citation
reads `unreachable` only when no rung produced a readable read and none
matched in full. A status therefore withholds an accusation from the read
it vetoes - but, as 6.3 now states for the veto set generally, it does not
withhold one from the cross-rung union: a claim that only the N4-vetoed read
carried is named in `missed` when a readable later rung is judged, and N4 is
then the but-for cause of an `unsupported` the same two responses would not
have produced without it (6.3 measures the 404-vs-200 pair). Separately, by
sending the ladder to the next rung a veto can also relocate the judgement
onto a different document, which is the ACCEPTED EXPOSURE 6.6 rule 2 and the
README both carry. This paragraph previously said the scheme
"consults no status" - true when it was written, and falsified by N4 when
N4 landed during plan 1. It is corrected here rather than left standing,
because a spec that has gone quietly false is the failure this tool exists
to catch. It went false a second time when plan 1.2's escalation made
"forces `unreachable`" a statement about a read rather than the citation,
and was corrected again in that plan's final review.

Draft 1 supported that point with two examples and both were wrong, in the exact
manner section 0 of this document warns against. `www.meta.com`'s 253KB under an
HTTP 400 extracts to **12 characters** of visible text under the title "Error |
Meta"; `news.skhynix.com`'s 112KB 404 extracts to 522 characters of "404, Page
Not Found." They are large *error shells*, not readable documents. The origin
spec said "rendered HTML under a 400" and was accurate; draft 1 escalated that to
"readable document" and made it false. Neither page is rescued by this scheme -
both stay `unreachable`, exactly as before - the
404 now by N4, before prose volume is consulted at all, and the 400 by P2 on its
12 characters of text.
`[verified: both URLs re-fetched and extracted, 2026-09-06]`

The honest form of the claim is therefore a-priori rather than empirical: status
is not consulted because body evidence is strictly better evidence, and the cases
where a real document sits under an error status - a misconfigured SPA, a
mis-routed CMS - are then handled by the same rule as everything else. **One
caveat to carry into implementation:** a 404 is the one status that distinguishes
"this document is gone" from "this document was read," which is information
`recheck` will want even though `check` does not act on it.

### 6.4 What it costs, stated plainly

Fabricated claims cited to a walled host pass as `unreachable` rather than
failing the run. This is not a new weakening: `unreachable` does not fail a run
**by default**, by the keystone rule. The inversion does not change that policy;
it makes the implementation match the policy it already claims.

Two things must be said rather than smuggled:

**"Does not fail a run" is a default, not an invariant.** Section 5.2 exposes
`failOn: { unreachable? }`, and a caller may switch it on - the origin's bulletin
does exactly that. The keystone rule constrains what `unreachable` may *render to
a reader*, not what a caller may choose to gate its own pipeline on.

**`unreachable` is silent to the reader, never to the author.** `check` MUST list
every unreachable citation in its author-facing output, with its URL and the rung
history that produced it. Without that requirement a fabricated citation to a
walled host becomes invisible rather than merely non-failing, and the tool would
be hiding the case it most needs a human to look at. The origin gate already
prints "Read each one and decide"; that behaviour is mandatory here, not
incidental.

**Residual risk, and it is narrower than draft 1's but real.** A wall padded with
enough genuine prose to clear P2, whose padding also happens to carry the
document's slug or title words (clearing C1), and which serves no vendor
challenge header - Anubis, PerimeterX press-and-hold and Google's sorry page all
send no `cf-mitigated` - would be treated as a read document. If a claim matched
in that padding, the result is `supported` with a nonsense excerpt; if none
matched, `unsupported` against possibly accurate work.

Draft 1 named only the first half of this and called it benign. The second half
is the one that matters, because it is the false accusation the whole design
exists to prevent. It is now gated behind three conditions rather than one, but
it is not closed. Closing it further is a calibration question for the fixture
corpus (6.3's acceptance test), and any residue must be documented in the README
rather than discovered by a user.

### 6.5 Why prose volume and not a markup ratio

Draft 1 specified P3 as text-to-markup ratio plus sentence density on raw HTML,
reasoning that challenge shells are script-dominant. **Measurement inverted it.**
`[measured: raw-HTML ratios computed over live pages, 2026-09-06]`

| Page | text:markup |
|---|---|
| skhynix article | 0.048 |
| Cloudflare blog article | 0.061 |
| The Verge homepage | 0.020 |
| Vercel blog index | 0.009 |

Modern real pages are script-dominant. Meanwhile the walls that most need
catching - Google's sorry page, Amazon's robot check, Anubis - are short prose
with minimal markup, so they score *at or above* the band real articles occupy.
The ratio discriminates in the wrong direction, and a P3 built on it would fire
on prose-shaped walls and hand back `unsupported`: the inversion reintroducing
the very failure it was designed to remove, with the defence rotating back to the
signature list section 6 exists to demote.

What separated the sample cleanly was **absolute extracted-prose volume** -
shells 12 to 600 characters, real articles 7,000 to 33,000. That is the
instrument, and it is not a new idea: it is the origin's `CHALLENGE_MAX_CHARS`
promoted from a signature-gated special case to the primary test.

### 6.6 Reads, readability, and aggregation across rungs

Added 2026-09-07, after Fable's review of the plan 2 (`harvest`) design found
that the code at 3974d27 answered "did we read this document?" three different
ways. Plan 1.2 implements this section. Nothing in it is an optimization.

**A read** is one rung's fetch of one URL, classified: `{ rung, computed }`,
where `computed` is `computeSignals`'s output for that response. `check` keeps
every read of a URL, not the longest, and must: the rung that read the document
is often not the last one attempted.

**Readability has one definition.** A read is *readable* when no veto fires and
its prose volume clears the floor:

```
isReadable(s) = !isBlocked(s) && s.proseChars >= THRESHOLDS.minProseChars
```

`isBlocked` is a statement about the wall: some N-signal says this body is not
the document. `isReadable` is a statement about the document: nothing says it
is not, and there is enough of it to have been read. The two are not
interchangeable, and treating them as if they were was the plan 2 design's
first blocking defect: 22 of the 25 challenge fixtures pass every veto and fail
only the floor (`docs/calibration-2026-09.md`, "Read together"), and so does
every paywall stub. "Not vetoed" is not "read". `isReadable` lives in
`src/classify/verdict.ts` beside `isBlocked`; `verdict()`'s final branch uses
it; every other site that needs the notion imports it. A private restatement
of the predicate anywhere else is the defect the export exists to prevent.

**One reader, three callers.** The fetch-classify-escalate loop lives once, in
`src/fetch/read-source.ts`:

```
readSource(url, claims, { fetcher, sourceLabel?, rules? })
  -> { reads: Read[], attempted: RungId[], pdfUrl: boolean }
```

`check`, `reachability` and, in plan 2, `harvest` call it. It is
module-internal: not re-exported from `src/index.ts`, because a consumer
holding raw reads can assemble a verdict `verdict()` never issued (section
5.1). At 3974d27 `check.ts` and `reachability.ts` each carried a copy of this
loop, the copies disagreed (next paragraph), and no test pinned either. The
plan 1.1 ledger parked the duplication for plan 2; the plan 2 design was
drafted without reading that item and claimed "zero behaviour change" for a
merge of two loops that do not behave the same.

**Escalation: climb unless the last read is readable.** The ladder stops when
the most recent read is readable, and otherwise tries the next rung until none
remain. At 3974d27 `check` climbed on N1, N2, N3 or a sub-floor body, while
`reachability` climbed on any of the five vetoes or a sub-floor body; so a URL
whose first rung returned a 404 carrying 13,216 characters of navigation
chrome (N4), or a PDF served as bytes (N5), stopped climbing in `check` and
kept climbing in `reachability`. The unified rule is the wider of the two. It
reaches strictly further than either and never less, and its cost is extra
fetches against documents that are genuinely gone. Pinning tests assert
`rungsAttempted` for a first read vetoed only by N4, and for one vetoed only by
N5, each with a body over the floor, in both callers. Written first, against
the inline `check` loop, they fail; that failure is the proof the suite was
silent on this before.

**Aggregation, in order.** Given a URL's reads:

1. **A full match proves a read.** The first read whose signals alone yield
   `supported` wins, whatever its prose volume and whatever a later rung
   returned. This is the sub-floor-stub exposure `test/check.test.ts` pins and
   section 6.2 accepts: a short real article followed by a fat block page is
   the ordinary case, not an exotic one.
2. **Otherwise the readable read with the most prose wins.** At 3974d27
   the largest read won regardless of readability, so a large vetoed wall
   on the first rung followed by a smaller readable page on the second,
   matching in part, returned `unreachable`. It now returns `unsupported`,
   naming the claims the readable read did not carry (rule 4: located by
   no non-vetoed read): that read is the positive proof the keystone rule
   demands, exactly as it would be had it been the only read. This is a
   behaviour change in a case the shipped ladder produces, and plan 1.2
   pins it.
3. **Otherwise `unreachable`.** No read is readable and none matched in full.
   `unclaimed` when there were no claims to match, as before.
   `check` still issues this through `verdict()`, applied to the largest
   read's signals with the union match count from rule 4; so two unvetoed
   sub-floor reads that between them locate every claim return `supported` -
   rule 1's exposure reached from a second direction, pinned in
   `test/check.test.ts` as accepted. A vetoed largest read is `unreachable`
   whatever the union says.
4. **`missed` is the set of claims located by no non-vetoed read.** A match
   inside a vetoed body is the wall's text; it neither proves the claim nor
   clears it. Each claim's evidence is quoted from the read that located it.
   Unchanged from 3974d27.
5. **`reachability` calls a URL readable iff some read of it is readable**, so
   that it agrees with `check`: a preflight that calls a host readable while
   the gate calls it unreachable, or the reverse, teaches the author the wrong
   thing about their corpus. At 3974d27 it called a URL readable iff its
   largest read cleared the floor *and no read at all was vetoed*, so a site
   that walled the node rung and served curl the document was readable to
   `check` and unreadable to `reachability`.

**Harvest reads only what is readable.** Plan 2's `harvest` proposes spans
only from readable reads and lets only readable reads vote in its frequency
filter (section 8.2). A wall's text, a paywall stub's text and a 404's
navigation chrome propose nothing.

---

## 7. Contracts

### 7.1 The fetcher plugin interface

**The fetcher cannot set `ok` or `http2xx`. Those fields do not exist on its
output type.** It reports facts; the classifier derives epistemics. This is what
makes it impossible for a naive plugin author to break the keystone - not
documentation, but the absence of the field.

```ts
type RungId = "fetch" | "curl" | "pdftotext" | string;

interface RawResponse {
  rawBody: string;              // pre-extraction, so prose-shape can be computed
  status: number;
  headers: Readonly<Record<string, string>>;
  finalUrl: string;             // after redirects; the chain is a signal
  bytes: number;
}

interface Fetcher {
  readonly rungs: readonly RungId[];   // what this fetcher can attempt
  fetch(url: string, rung: RungId): Promise<RawResponse>;
}
```

The output contract widens *before* the purity boundary. The current classifier
is starved: it sees post-extraction text plus `{method, status, bytes}`, so
headers, the redirect chain, and raw HTML structure - the three most durable
challenge signals - die upstream.

**`headers` and `finalUrl` are new code with no precedent in the origin, and N1
depends on them.** `curlWithStatus` captures neither: it uses `-o` for the body
and `-w %{http_code}` for the status, and nothing else. Capturing headers across
a `-L` redirect chain means parsing `curl -D` multi-block dumps - one block per
hop, plus `100 Continue` blocks, plus duplicate keys - and getting the *final*
hop's headers rather than the first. This is genuinely new work in the layer
least covered by tests, and it is a dependency of the most durable veto in
section 6. Plan it as its own task with its own fixtures, not as a field added to
a return type.

**Rung availability is provenance.** A serverless caller has no `curl` and no
`pdftotext`, so its ladder is truncated and it will produce more `unreachable`
results. That degrades safely, but it must be *disclosed*: the result carries
which rungs were available, so an `unreachable` renders as "ladder truncated:
curl unavailable" and never as a fact about the host. This is also the mechanism
that unblocks the origin site's serverless gate.

### 7.2 Host rules and challenge signatures are data

**A HOST rule may add a fetch attempt. It may never subtract one, and it may
never decide a verdict.** The generic ladder always runs in full. Under that
contract a stale host rule costs one wasted request - latency, not correctness.
**Signature and path rules are not under that contract**: they feed N2 and N3,
which veto a read, so an over-broad entry can cost correctness - 6.3 says what
that cost is. `src/rules/load.ts`'s own comment has said so since plan 1's
final fix wave (`e4d9f46`); this sentence had not. Corrected 2026-09-08: it
generalised a host rule's contract to all three lists, and was false for two
of them.

The origin module violates this in one place: its Bloomberg comment says "treat
bloomberg.com as UNREADABLE: source to a carrier instead." That is editorial
advice sitting in a code path. It belongs in output, dated: "this host has been
observed hard-blocked since 2026-08-24; consider a syndication carrier."

Every rule carries a `lastConfirmed` date, and `--explain-fetch` reports which
rule fired and how old it is. Rules ship as a default snapshot inside the package
and are overridable by a local file in the user's repo, because the bundled rules
were learned against one corpus and other users will meet different hosts.
Without local override from day one, every serious user maintains a private fork
of the fetch layer - the same divergence failure, replayed at ecosystem scale.

`SEC_UA` is a shipping blocker as it stands: `source-fetch.mjs:44` embeds a
personal email address. The SEC's declared-identity requirement is durable
published policy; the identity string is per-user configuration. `testimonium`
warns, and declines the sec.gov rule, when no identity is configured.

### 7.3 The claims file, keyed by URL

Claims belong to *sources*, not to footnote ordinals. "This URL carries these
phrases" is true or false regardless of where the footnote sits.

```json
{
  "_note": "keys beginning with _ are human notes and are skipped",
  "https://example.gov/report-2026": [
    "a phrase drawn verbatim from the source",
    "another"
  ],
  "https://example.com/internal": { "notApplicable": "rests on the filing, not the outlet" }
}
```

This cures by construction the defect the origin gate can only detect. There,
claims key on `(post_id, footnote_number)`, so inserting a source mid-list
reattaches every downstream claim to a different URL - and could pass against it.
The gate needs a `FOOTNOTE MOVED` refusal (`citation-check.mjs:124-133`) to catch
that. Under URL keying, renumbering is harmless, and the refusal shrinks to a
much smaller check: a claimed URL is no longer cited in the document.

The object form answers the origin spec's open question 1: `notApplicable` carries
an author-facing reason rather than being a silent omission.

**URL keying needs declared join semantics, or it reintroduces the failure it
cures.** If the document cites `https://Example.gov/report?utm_source=newsletter`
and the claims file says `https://example.gov/report`, an exact-string join
misses and the citation is never checked. The normalization is therefore part of
the contract, not an implementation detail: lowercase scheme and host, strip a
default port, strip a trailing slash on a **pathless** URL, strip a declared list
of tracking parameters (`utm_*` and kin), preserve everything else including case
in the path and the fragment. Two URLs that normalize equal join; anything else
does not.

**A trailing slash on a path is deliberately preserved**, so `/report/` and
`/report` do not join. They can be different resources, and joining two
different resources would attach claims to a source nobody checked them
against - the precise failure URL keying exists to prevent. The cost of the
conservative rule is that such a mismatch surfaces as `unclaimed`, and
`unclaimed` fails the run by default: loud, and fixable by the author in one
edit. That is the right trade. The alternative fails silently and wrongly.

A claimed URL that appears in no footnote is a **warning by default**, listed in
the output and settable to a failure through `failOn: { unclaimedInDocument? }`.
It usually means the citation was removed from the prose and the claims file was
not updated.

Phrases must come from what the **source** says, not from what the article says
about it. Matching normalizes typography and the billion/bn and million/mn
renderings; paraphrase does not match and is not meant to.

Invisible formatting characters - the zero-width spaces and joiners, the
directional marks, the word joiner, the byte-order mark and, from plan 1.2, the
soft hyphen U+00AD - are deleted before matching. A source that breaks a word for
layout has not changed what it says; at 3974d27 the soft hyphen survived `norm`
and defeated `phraseFound`, a false-miss route.

**Claims have a length floor.** `THRESHOLDS.minClaimChars` is 16, the fifth
entry in `THRESHOLDS`, applied to `norm(claim).length`. A shorter claim is
refused - by the claims-file loader, by `check()`'s front door, and by harvest's
first filter - with a message that names the claim, its length, the floor, and
the remedy: extend it to take in the surrounding words. The licence is a priori
before it is measured: a bare number, a year, a token like "the report" attests
nothing about a source, and a match on one is a coincidence the checker cannot
tell from evidence. Measured on 2026-09-07 against the 203 distinct real claims
in the origin repo's four claims files, chance matches against unrelated
fixtures occurred at 3 and 12 normalized characters and never above 12; 16 is
that ceiling plus margin, and it refuses 18 of the 203 (9 percent), each a
number, a name or a fragment that states no proposition. This resolves Q3 in
section 13: a **refusal, uniform across the three sites, calibrated** - not a
warning, because a warning that a claim proves nothing leaves it proving nothing
while the run still passes. It is a breaking change for `check` against an
existing claims file that carries such a claim, and it is meant to be: the file
asserted something the tool could never have verified. Plan 2 implements it,
after its calibration task has re-derived the number from a committed script; if
the re-run moves the ceiling, the number moves with it and this paragraph is
amended to match.

### 7.4 The output schema cannot express an accusation

**Non-`supported` results carry no renderable fields at all** - no excerpt, no
`retrievedAt`. The render half of the keystone rule becomes structural rather
than promised.

This generalizes a deliberate omission the origin gate already makes on its
unreachable write path (`citation-check.mjs`, the unreachable branch, which
withholds evidence and `retrieved_at` precisely so a merge cannot leave a reader
a bare "Read <date>" under a claim that was fine). Making it a property of the
type means the tool's first downstream integrator cannot render `unreachable` as
a red badge and break the premise the tool exists for.

A reference renderer lives in `examples/`. No render surface ships in v1.

---

## 8. Commands, and what lives on disk

```
testimonium check <doc>          the gate. exit 0 clean, 1 author-fixable, 2 infra
testimonium harvest <doc>        propose claims. writes a draft claims file
testimonium recheck <doc>        drift, against stored evidence and the archive
testimonium reachability <doc>   preflight. no claims needed
```

Global flags: `--json`, `--rules <path>`. `check` additionally takes
`--explain-fetch` (not global: `reachability` has no fired-rule provenance to
print).

**Amended 2026-09-07, plan 1:** `--fetcher <id>` above was never shipped as a
CLI flag. Plan 1 de-scoped it to a programmatic option only -
`CheckOptions.fetcher` - because a CLI fetcher registry (resolving an `<id>`
string to a loaded plugin, validating it, reporting a bad id) is a
plugin-resolution design nothing in this plan required. The README documents
the programmatic option and the absence of a CLI equivalent. Reintroducing
`--fetcher <id>` at the CLI needs that design done first, not just a flag
added.

**`check`** is the gate. Adapters parse the document; claims join by URL; each
source goes through `check()`; results write to the evidence file.

**`harvest`** attacks the real cost centre without crossing the refusal line. It
fetches each cited source and proposes, as candidate claims, spans that appear
**verbatim in both the draft and the source**, normalized, above a minimum
length, excluding boilerplate. It proposes; the author confirms. **No model.**

Everything harvest emits goes through the same checker, so a proposal the source
does not carry produces a visible miss. *Corrected 2026-09-07:* this paragraph
used to say harvest is "safe by construction" because a bad harvest produces
"never a false `supported`". That was false. A span common to draft and source
is, by construction, one `check` will find in that source, so harvest inherits
every exposure the checker has and adds one of its own; section 8.2 is the
authority for harvest and names them. Phrase matching remains the sole arbiter.

**`recheck`** is the instrument, not a policy. It re-runs each claim against the
live source and against the archived copy, and reports what changed. It ships
with no cron, no rot score, and no staleness badge, because the drift rate is
unmeasured - see section 12.

**`reachability`** needs no claims file. It fetches every cited URL and reports
what is readable, so a new user gets their own number before investing in a
claims file at all. This is the antidote to the 96.8% figure being mistaken for a
general property of the web.

**Archive on success** belongs with `recheck`, not with `check`. When a source
reads cleanly, push a snapshot to web.archive.org and record the URL. This is not
a nicety: it is what makes `recheck` interpretable. On a failed re-check, run the
same pipeline over the archived copy - if the archive still matches, the source
changed (real drift); if the archive also misses, the extractor changed (a
`toText` regression, a site redesign). Without stored bytes, every drift alarm is
confounded with the pipeline's own evolution, and the fetch layer's history
guarantees it will evolve. Archiving must never fail a run.

It sits in `check`'s hot path only if it is free, and it is not: web.archive.org's
save-page-now is authenticated, rate-limited well below "every source on every
green run," and asynchronous - a job to poll, not a call to make. Its cost is
carried by the plan that needs it.

### 8.1 This spec is three implementation plans, not one

The commands above are one release, but they are not one plan. Attempting them as
a single plan front-loads unresolved questions onto work that does not depend on
them.

| Plan | Contents | Blocked on |
|---|---|---|
| 1. Core | TS port of the fetch ladder, header/finalUrl capture, pure classifier, verdict reducer, claims and evidence files, one adapter, `check`, `reachability` | Q1, Q2 - both resolved below |
| 1.2 Reader | `isReadable`; one `readSource` loop under `check` and `reachability`, with section 6.6's escalation and aggregation rules and the tests that pin them; the `foldWithMap` offset-map repair; U+00AD deleted by `norm`; the corrections the header lists | Nothing. Lands before plan 2 |
| 2. Harvest | `harvest` per section 8.2: calibration of `minClaimChars` and `harvestSeedChars` first, then `Document.prose`, `commonSpans`, the four filters, the draft file | Plan 1.2. Q3, Q5 - both resolved below |
| 3. Drift | `recheck`, archive-on-success, archive-as-control-arm | Q4 |

`reachability` rides nearly free on plan 1's fetch layer, which is why it stays
there rather than waiting: it is the command that stops a new user misreading
their own corpus, and it costs almost nothing once the ladder exists.

Plan 1.1 (extraction fidelity, N5) and plan 1.2 (the reader) were inserted after
plan 1 shipped. Each corrects plan 1 in a way the next plan would otherwise
build on; neither is a fourth command.

**Files, versioned beside the prose:**

```
<doc>.claims.json        authored, reviewed with the piece
<doc>.claims.draft.json  written by harvest; the author folds it into the claims file
<doc>.evidence.json      written by check and recheck
```

The first and last are committed. The draft is transient: the author edits its
proposals into the claims file and deletes it. A re-check's
output is then a **diff** - which `urtext` can review, closing the family loop.

### 8.2 Harvest

Added 2026-09-07. This section, not the paragraph in section 8, is the
authority for plan 2. Fable's review of the first design (findings F1 to F18,
kept in the git-ignored SDD workspace for plan 2) is where each choice below
was forced. Plan 2 is blocked on plan 1.2 (section 6.6), which supplies the
reader, the readability predicate and the offset-map repair harvest depends
on.

**What it is.** `harvest <doc.md>` fetches every URL the document cites and,
for each, proposes as candidate claims the spans that appear verbatim in both
the document's prose and the source, normalized. It writes them to a draft
file the author edits into `<doc>.claims.json`. It never writes the claims
file itself. No model. Phrase matching remains the sole arbiter, and every
proposal is afterwards judged by `check` exactly as a hand-written claim is.

**What it is not.** Harvest is not safe by construction. A span common to the
draft and a source is, by definition, a span `check` will find in that source,
so harvest carries the checker's exposures unreduced: an above-floor,
un-vetoed wall (the ECB known-gap fixture, served at 200), and a redirect to a
homepage that shares a sentence with the draft. It adds one of its own: it
proposes what the author *copied*, which is not always what the author
*claims*. A harvested span is evidence that a sentence was lifted from this
source; it is not evidence that the sentence is the point of the citation.
The draft's `_note` says so, and the author's confirmation is the step that
makes a proposal a claim.

**Pipeline, per document.**

1. **Document prose.** The adapter's `Document` gains `prose`: the markdown
   with footnote definitions removed by the same `DEFINITION` regex the parser
   uses (definitions are multi-line; a second regex would drift) and fenced
   code blanked by the same `blankFencedCode`, so a URL or a code sample is
   never proposed as a claim. Citations are grouped by `normalizeUrl`; a URL
   cited under two spellings is read once and keyed by the first spelling
   seen. A URL whose existing claims entry is `notApplicable` is skipped and
   listed in the report.
2. **Read.** Each URL goes through `readSource` (section 6.6). Only readable
   reads propose or vote. A URL with no readable read is reported as
   unreachable with its `rungsAttempted`, and nothing is proposed for it.
   Where a readable read's `finalUrl` differs in path from the URL asked for,
   the report says so beside the proposals: a redirect to the homepage is the
   exposure the author has to look at.
3. **Common spans**, `commonSpans(docProse, sourceText)`. Both texts are
   folded with `foldWithMap`, which returns the folded text and one source
   offset per folded code unit. Seeds are the L-grams of the folded source that
   occur in the folded document, L = `harvestSeedChars`; each seed is extended
   left and right while the two texts agree, snapped to word boundaries, its
   whitespace runs collapsed; spans contained in a span already emitted are
   dropped, and the scan skips past the span just emitted, so the pass is
   linear in the source. Proposals are cut from the **source's** typography
   through the offset map, because a claim must be what the source says
   (section 7.3). `norm(text)` is computed once per read and reused by every
   filter; it is not recomputed per span.
4. **Self-validation, per proposal.** Three assertions, each a bug if it
   fails: `phraseFound(sourceText, span)`, so the checker will find it;
   `phraseFound(docProse, span)`, so it is in the author's own draft; and
   `foldWithMap(span).folded === matchedFoldedSpan`, so the offset map did not
   shift. The third is the one `phraseFound` cannot stand in for: a map that
   is off by one yields a slice the source still contains, one character
   over, and `phraseFound` says yes to it. `foldWithMap` at 3974d27 pushed one
   map entry per *input* unit while a code unit whose lowercase is two units
   (U+0130) added two to the folded text, shifting every offset after it; plan
   1.2 repairs it to one entry per *output* unit and pins `folded.length ===
   map.length` on U+0130, final sigma and an astral letter.
5. **Filters**, in order, each reporting per URL how many spans it dropped:
   1. *Floor.* `norm(span).length >= THRESHOLDS.minClaimChars` (section 7.3).
   2. *Frequency.* For any *other* normalized URL V in the document with at
      least one readable read, if `phraseFound(norm(text_R), span)` for any
      readable read R of V, the span is boilerplate - the outlet's name, a
      cookie notice, a shared byline, or a wire story reprinted by two cited
      outlets - and is dropped. A URL's own reads never vote against its own
      spans. With fewer than two URLs holding a readable read the filter is
      vacuous, and the report says so in words. Plan 2's calibration counts
      how many real claims appear in two cited sources of the same draft, so
      the reprint cost is a number, not a guess.
   3. *Boilerplate rules.* `RuleSet` gains `boilerplate: Rule[]`, the same
      dated `LocalRule` shape as signatures (`pattern`, `lastConfirmed`,
      `note`), each tested as a regex against `norm(span)`. Ships empty. The
      author's own rules are the only cure for a phrase that recurs across
      one outlet's pages when the draft cites that outlet once.
   4. *Already claimed.* A span contained in, or containing, an existing claim
      for that URL in `<doc>.claims.json` is dropped. The existing file is
      read by `parseClaimsFile`, with no lenient variant: a file the loader
      refuses is exit 2 with the loader's own message. The README's migration
      note therefore reads: fix the claims `check` names first, then run
      `harvest` for more.
6. **Output.** `<doc>.claims.draft.json` in the claims-file shape, keyed by
   the first citation spelling of each normalized URL, each entry's claims in
   source typography, plus `_note`: the tool's version, the date, and the
   sentence "every claim below is unconfirmed; harvest proposes what was
   copied, not what was meant". An existing draft is overwritten only when
   its `_note` is byte-identical to the marker harvest would write; a missing
   or edited `_note` means the author has touched the file, and harvest exits
   2 naming the path and asking for a rename or delete. `--json` prints the
   draft to stdout instead of writing it, the convention `reachability
   --json` already follows (and `check --json` does not: that inconsistency
   is plan 1's, recorded here rather than resolved).

**Exit codes.** 0 when the draft was written or printed, including a draft that
proposes nothing; 2 for a refused input, a refused existing claims file, or an
edited draft in the way. There is no exit 1: harvest has no verdict to fail on.

**Thresholds.** `harvestSeedChars` is the seed length for step 3, distinct from
`minClaimChars`: the seed sets what extension can find, the floor sets what may
be proposed, and `harvestSeedChars >= minClaimChars` is asserted by a test. A
seed below the floor finds the same maximal spans plus shorter ones the floor
then refuses, so it buys nothing and costs noise; a seed above the floor is the
precision knob. Measured across unrelated fixture pairs, the mean count of
chance L-gram matches per pair was 24.8 at L = 13, 5.0 at 16, 0.9 at 20 and 0.2
at 25; the value is chosen in plan 2's calibration task from that script's
re-run, in 20 to 25, and recorded in `docs/calibration-2026-09.md` with the
command that produced it.

**Plan 2's first task is calibration**, before any harvest code: commit the
probe as `scripts/calibrate-claim-floor.mjs` (its walker skips `notApplicable`
objects, which the probe's did not); freeze the claims it measures under
`fixtures/claims/` so the numbers reproduce without the origin repo;
hand-classify every cross-fixture common span as chance or boilerplate; and
bind the result with an acceptance test at `test/classify/claim-floor.test.ts`,
the discipline section 6.3 imposed on the prose floor. The floor's licence is a
priori; the measurement is its sanity check, not its derivation, and a re-run
that moves the observed ceiling above the floor is a finding to act on, not a
number to explain away.

**CLI.** `bin.ts` gains `draftPathFor` beside `claimsPathFor` and
`evidencePathFor`, and the usage string names the third command.

---

## 9. What this does not do

Carried from the origin spec's section 6, because it is already the right README
section:

- It does not verify that a claim is **true**, only that the cited source says it.
- It does not stop an author citing a source that is itself wrong.
- It does not police whether the claim in the body matches the phrase in the
  claims file. An author who writes lazy phrases gets a weak check.
- It makes no originality or paraphrase judgment.
- It contains **no model**, anywhere, in any command.

And one addition specific to being a package rather than an in-repo script:

- It does not guarantee that a `supported` verdict from a truncated ladder means
  the same thing as one from a full ladder. It reports which rungs ran instead.

---

## 10. Testing

The durable/perishable cut has a criterion: **what can be unit-tested without the
network is durable; what cannot is perishable.** This dissolves the coverage
asymmetry in the origin repo - it was never negligence, it was the definition.

**Durable, pinned by pure unit tests:** the `ok`/`http2xx` split; the verdict
ladder including every branch of section 6.2; `norm()` - whose *discovery stories*
are perishable but whose *clauses* are properties of Unicode and HTML that never
rot (U+2011 will be a hyphen forever; zero-width stripping and entity decoding
are permanent); the classifier; the ladder reducer; adapters; the claims-file
parser; the output schema.

**A property test the schema must pass:** no non-`supported` result may carry a
renderable field. This is the keystone enforced mechanically rather than by
review.

**The fixture bestiary.** Every recorded challenge body becomes a test. This is
the one commons a small community can realistically sustain: a behavioural rule
("axios 403s UA-only curl, intermittently") is hard to verify and easy to get
wrong, while a recorded body - "here are the 159 bytes EUR-Lex served me at HTTP
202" - is trivially verifiable. **Community contributions target fixtures, not
rules.** The suite seeds from the 23-case battery at
`fixtures/challenge-battery.mjs`, already committed. It is not yet portable - it
hard-codes an absolute path into the origin repo - so turning it into the first
real fixture set is a task in plan 1, not a completed step.

The corpus needs both halves. The battery supplies challenge and error shells;
6.3's acceptance test also requires real articles and PDFs on the other side,
captured as fixtures, so that P2's floor and C1's threshold are calibrated
against something rather than guessed.

**Perishable, tested only by a scheduled live-probe suite in this tool's own CI -
never on a user's machine.** Its output is precisely the `lastConfirmed` dates the
rules file needs. The probe suite and the rules metadata are the same artifact.

**A module-load check is not a test.** Run the thing against a real URL. A helper
reference dangling inside a loop body survives an import.

---

## 11. Extraction: the couplings to break

1. **Storage.** Verdicts and evidence currently write to Postgres via PostgREST
   with credentials in `.env.local`. The core becomes storage-agnostic:
   `(document, claims) -> verdicts + excerpts`, and the CLI persists to files.
2. **Input.** The origin parses one author's convention, `<li id="fn-N">`
   containing an `<a href>`. `testimonium` needs an adapter layer: Markdown
   footnotes at minimum, plus generic HTML `<ol>`. **Footnotes are not
   CommonMark**, so the flavour must be named: plan 1 targets GitHub-Flavored
   Markdown's `[^1]` definition syntax, which pandoc also accepts. Other
   flavours are adapters someone writes later, not a v1 obligation.
3. **System dependencies.** `curl` and `pdftotext` become declared rungs. Their
   absence truncates the ladder and is reported as provenance, rather than
   crashing or silently degrading.
4. **Identity.** `SEC_UA` moves to configuration (section 7.2).
5. **Editorial advice in code paths.** The Bloomberg rule moves to dated output.

**Port risk.** The fetch layer is 348 lines, 182 excluding comments and blanks,
and nearly every one of those 182 records a specific defeat. Translating it to TypeScript is where behaviour gets
silently changed. The fixture suite must be green before and after, and the port
is not a read-and-retype: each per-host rule carries its comment across intact,
because the comment is the evidence for the rule.

---

## 12. Risks

**An unlisted wall marks accurate work `unsupported` in a user's CI.** The most
likely death. A user hits a consent shell or a localized interstitial, the gate
fails their release, they verify by hand, and they discover the tool published -
in red, in their pipeline - the accusation its own README says it must never
make. For a tool whose entire pitch is that its verdicts can be trusted, one
public incident is close to fatal. *Mitigation:* section 6's inversion, which is
the reason it is not optional.

**Non-adoption from the authoring tax.** A user points it at their corpus, sees a
wall of `unreachable`, and concludes it is broken. *Mitigation:* `harvest`
collapses the tax to review for quote-dense drafts, and `reachability` sets
expectations before any investment.

**The maintainer treadmill.** Per-host knowledge under one maintainer, decaying
continuously. *Mitigation:* the inversion makes decay cost latency rather than
truth; pluggable fetch lets users on hostile corpora bring their own reader
(headless browser, paid proxy) behind the interface.

**Drift is unmeasured and must not be oversold.** The origin spec's section 7 is
explicit that nobody knows the drift rate, that reachability was measured but
support-over-time was not, and that the decision procedure is to re-check once
roughly ten evidenced documents exist and read the number. `testimonium` ships
the instrument that produces that number. It must not ship the apparatus that
presumes the answer.

**Calibrating P2 and C1 after the verdict reducer is built.** The most expensive
mistake available, and the one this spec came closest to making. Draft 1
specified a metric that measurement showed to be inverted (6.5); had that been
discovered mid-plan rather than mid-review, it would have reshaped the ladder,
its whole test suite, and the README's central safety claim. *Mitigation:*
calibration is the first task of plan 1, gated by 6.3's acceptance test, before
the reducer exists.

**Header capture in the curl rung.** N1 is the most durable veto in section 6 and
it depends on plumbing with no precedent in the origin. See 7.1.

**P1 no longer dominates, but the residual is not closed.** See section 6.4.

**Port fidelity.** See section 11.

---

## 13. Open questions

**Q1 and Q2 were pre-plan blockers and are now resolved. They are recorded here
with their resolutions rather than deleted, so the reasoning survives.**

1. ~~**Thresholds for P2 and P3.**~~ **RESOLVED at spec level, 2026-09-06.** The
   problem was the metric, not the threshold: text-to-markup ratio discriminates
   in the wrong direction (6.5). P3 is withdrawn and replaced by P2, extracted
   prose volume. What remains is genuine calibration - the floor for P2 and the
   threshold for C1 - and it is bound by 6.3's acceptance test as the first task
   of plan 1, before the verdict reducer is written. Calibrating after the
   reducer and its tests exist is the single most expensive mistake available
   here.
2. ~~**P1 versus N1.**~~ **RESOLVED: N1 vetoes P1.** Cloudflare's documentation
   states that the `cf-mitigated: challenge` header is present on every Challenge
   Page type, and that the challenge page *replaces* the requested resource. A
   body carrying that header therefore cannot be the document, so the veto costs
   nothing and closes the Cloudflare slice of 6.4's residual. Generalized in the
   verdict table: every N-signal vetoes, including over P1.
   `[verified: developers.cloudflare.com/cloudflare-challenges/ detect-response,
   updated 2026-05-05, read as the raw page rather than as a fetch summary]`
3. ~~**Minimum claim length.**~~ **RESOLVED 2026-09-07: refuse, uniform,
   calibrated.** `THRESHOLDS.minClaimChars` = 16 on `norm(claim).length`,
   refused by the claims-file loader, by `check()`'s front door and by harvest's
   first filter, with the same message at each. Section 7.3 carries the licence
   and the measurement: 203 real claims, chance matches at 3 and 12 characters
   and none above, 18 of 203 refused. Implemented in plan 2, whose calibration
   task re-derives the number before any code depends on it.
4. **Archive failures.** web.archive.org's save-page-now is authenticated,
   rate-limited well below one call per source per run, and asynchronous - a job
   to poll rather than a request to make. Confirmed: it must never fail a run.
   Open, and larger than draft 1 assumed: API key configuration, job polling,
   queueing and backoff. Belongs to plan 3, which is why archive moved out of
   `check`.
5. ~~**Harvest boilerplate exclusion.**~~ **RESOLVED 2026-09-07: cross-source
   frequency, primary.** A span found in a readable read of any *other* cited
   source (other by `normalizeUrl`) is boilerplate; a URL's own reads never vote
   against it; with fewer than two readable sources the filter is vacuous and
   the report says so. The length floor runs before it and author-maintained
   `boilerplate` rules after it. Position in the document and stopword ratio
   were considered and dropped: each needs a threshold nobody has measured, and
   frequency needs none. Section 8.2, filters 1 to 3.
6. ~~**GitHub Action in v1?**~~ **RESOLVED: cut.** It is a second distribution
   surface with its own versioning and release discipline, and nothing in plan 1
   depends on it. `npx testimonium check` in a workflow step is the on-ramp until
   the CLI's interface has stopped moving.

---

## 14. Decisions already taken

Recorded so they are not relitigated without new information.

| Decision | Section |
|---|---|
| Sibling to `urtext`, not a subcommand | 3 |
| TypeScript, npm, Node >= 20 | header |
| README leads with the argument; AI-drafted prose is a named section, not the headline | 4 |
| `check()` owns the verdict; primitives sealed behind `exports` | 5.1, 5.3 |
| Three layers: fetcher, pure classifier, pure ladder reducer | 5 |
| Burden-of-proof inversion; a veto withholds an accusation from the read it vetoes, and can supply one from a later readable read through the union | 6, 6.3 |
| Accusation requires body-derived proof; head markers never license one | 6.2 |
| Every N-signal vetoes, including over P1 | 6.2, 13 Q2 |
| Prose volume, not text-to-markup ratio | 6.5 |
| Calibration precedes the verdict reducer, bound by an acceptance test | 6.3 |
| `unreachable` is silent to the reader, never to the author | 6.4 |
| One readability predicate (`isReadable`), one reader (`readSource`), one aggregation; the ladder climbs unless the last read is readable | 6.6 |
| Harvest proposes only from readable reads, and only readable reads vote | 6.6, 8.2 |
| Claims below `minClaimChars` are refused, uniformly, at every entry | 7.3, 13 Q3 |
| Harvest filters: floor, cross-source frequency, author rules, already-claimed, in that order | 8.2, 13 Q5 |
| Harvest inherits the checker's exposures; "never a false `supported`" withdrawn | 8, 8.2 |
| Fetcher output type has no `ok` or `http2xx` field | 7.1 |
| Host rules are dated, additive-only, locally overridable data | 7.2 |
| Claims key by URL, with declared join semantics | 7.3 |
| Non-`supported` results carry no renderable fields | 7.4 |
| v1 commands: `check`, `harvest`, `recheck`, `reachability` | 8 |
| Three implementation plans, not one; archive belongs to plan 3 | 8.1 |
| No GitHub Action in v1 | 13 Q6 |
| No model in any command | 9 |
| No renderer, no cron, no storage backend in v1 | 8, 9 |
