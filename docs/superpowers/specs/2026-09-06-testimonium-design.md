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
**Amended again:** 2026-09-09, twice, both for plan 3. First, new section 8.3
(`recheck` and the archive as a control arm), the archive paragraph in 8
superseded, and Q4 resolved. Second, the same day and before any of it was built,
Fable's review of 8.3 (preserved at
`docs/superpowers/plans/2026-09-09-plan-3-drift-fable-spec-review.md`) returned
APPROVE WITH CORRECTIONS: 8.3's decision table is
deleted and replaced by a decision procedure, its `CheckOptions` sink is withdrawn
for a CLI-side recording fetcher, the PDF ruling and the archive's on-disk format
are pinned, and 6.2, 6.3, 8, 8.1 and Q4 take the corrections that follow from
those. Plan 3 implements 8.3 as amended, including the README sentence 8.3 now
requires rather than asserts.
**Language:** TypeScript, Node >= 20, npm.
**Sibling to:** `urtext`. Not a subcommand of it. See section 3.
**Withheld:** 2026-09-10, for publication. The origin repository this spec draws
on is named only as "the origin repository (private)", its absolute path is
removed, and the commit 7.3's freeze pinned is withheld. Mechanical
substitutions; no section, ruling, number or resolved question changed.

---

## 0. Provenance of this document

This spec draws on code in the origin repository (private), which is read-only to
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
the origin repository (`src/lib/documents/artifact.ts:47-51`): "the evidence moved" must
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
per the origin repository's design spec section 2]` - **must not be quoted as a general
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
throw `ERR_PACKAGE_PATH_NOT_EXPORTED`. **Amended in 0.2.0:** `norm` and
`defaultFetcher` are now runtime exports (`src/index.ts`) - `norm` as a
documented compatibility surface, `defaultFetcher` so a caller can wrap or
compose the bundled ladder through `CheckOptions.fetcher` instead of
hand-rolling one. `toText`, `isPdf`, and the per-host helpers stay genuinely
unavailable to consumers, not merely advised against. The test suite imports
source modules by path (`../src/...`); there is no internal entry point for
the sealed primitives, and `test/exports.test.ts` pins the exports map
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
Both the pre-fix and post-fix implementations in the origin repository are a **blocklist
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

      Added 2026-09-09: the deferred half is now discharged too. Section
      8.3 gives recheck its own category for a gone document - "gone since
      <archivedAt>", reported apart from transient unreachability and
      failing a run only under --fail-on-gone - so "information recheck
      will want" names a shipped requirement rather than an intention.

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
6546176 and at every commit since - the union machinery is unchanged from it -
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
Membership changes a verdict only below the cap, and the boundary is exact -
measured 2026-09-09 on a claims-PRESENT pair, at 799 extracted characters the
listed wall reads `unreachable` where its unlisted twin reads `supported`, and
at 800 both read `supported`. (Amended 2026-09-09: this clause named no
population, and the pair the sentence before it measures is a claims-MISSING
one, which reads `unreachable` on BOTH sides at 798 through 801 and never
reads `supported`. The flip holds only where the claims are present; the
sentence changed population silently.) That is the known gap
carried as a fixture in `fixtures/corpus.json` and measured in
`docs/calibration-2026-09.md`. It is NOT why draft 1's "never truth" was
wrong: a complete list would not have closed this gap either, because no entry
can fire here at all. What makes "never truth" wrong is the pair of costs
below the cap, both stated above - an over-broad entry buys a false accusation,
and rot buys a false attestation. This paragraph asserted the opposite ("there
the list's completeness does bear on truth") from `0c85e07` until 2026-09-09.
It was false the day it was written: N3's length gate already shipped in
`6962163`, a verified ancestor of that commit. It survived four review rounds
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
above the floor a wall can mint an accusation no **signature**-list entry
could have prevented (above). The narrowing is the one the "Above the floor
neither protection applies" paragraph already carries, added here 2026-09-09
for the same reason: N3's signature list is gated on
`proseVolume < maxChallengeChars` and cannot fire above the cap, but N2's
path list has no length gate, so a `CHALLENGE_PATHS` entry does prevent
exactly that accusation - measured 2026-09-09, the same 5,005-character
padded wall returns `unsupported` at an ordinary `finalUrl` and
`unreachable` when the `finalUrl` lands on `/captcha/`.

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
`recheck` will want even though `check` does not act on it. (`check` does act on
it now: this sentence is draft 2's, kept because it is where the caveat was first
recorded, and N4 in 6.2 is what became of its first half.)

*Discharged 2026-09-09.* Section 8.3 makes the second half true rather than
aspirational: a live read vetoed by N4 against a `supported` baseline is reported
as its own category, "gone since `<archivedAt>`", never folded into transient
unreachability, and it fails a run only under `--fail-on-gone`. The sentence had
been a promise since draft 2, and 8.3's first form broke it - its unreachable
carve-out swallowed the gone case whole, which is what Fable's review of that
section found. `recheck` reads `documentGone` from the read's signals, not from
`CitationResult`, which carries no status at all; 8.3 says through what.

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
that the code at 6546176 answered "did we read this document?" three different
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
5.1). At 6546176 `check.ts` and `reachability.ts` each carried a copy of this
loop, the copies disagreed (next paragraph), and no test pinned either. The
plan 1.1 ledger parked the duplication for plan 2; the plan 2 design was
drafted without reading that item and claimed "zero behaviour change" for a
merge of two loops that do not behave the same.

**Escalation: climb unless the last read is readable.** The ladder stops when
the most recent read is readable, and otherwise tries the next rung until none
remain. **Amended in 0.2.0:** this stop rule now has one exception. `check`
may also escalate past a readable read when the verdict it would otherwise
issue is `unsupported` and an HTML rung remains untried - one more attempt
before this package accuses an author's citation. The exception is a flag on
the ladder's own stop condition (`nextAction`'s `exhaustive` parameter,
`src/fetch/ladder.ts`), but only `check` ever sets it true, via
`continueReading` (`src/fetch/read-source.ts`); `reachability` and `harvest`
never do, so their ladders stop exactly as before (0.2.0 section 4). At
6546176 `check` climbed on N1, N2, N3 or a sub-floor body, while
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
2. **Otherwise the readable read with the most prose wins.** At 6546176
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
   Unchanged from 6546176.
5. **`reachability` calls a URL readable iff some read of it is readable**, so
   that it agrees with `check`: a preflight that calls a host readable while
   the gate calls it unreachable, or the reverse, teaches the author the wrong
   thing about their corpus. At 6546176 it called a URL readable iff its
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
final fix wave (`4c81090`); this sentence had not. Corrected 2026-09-08: it
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
layout has not changed what it says; at 6546176 the soft hyphen survived `norm`
and defeated `phraseFound`, a false-miss route.

**Claims have a length floor.** `THRESHOLDS.minClaimChars` is 16, the fifth
entry in `THRESHOLDS`, applied to `norm(claim).length`. A shorter claim is
refused - by the claims-file loader, by `check()`'s front door, and by harvest's
first filter - with a message that names the claim, its length, the floor, and
the remedy: extend it to take in the surrounding words. The licence is a priori
before it is measured: a bare number, a year, a token like "the report" attests
nothing about a source, and a match on one is a coincidence the checker cannot
tell from evidence. Re-derived on 2026-09-09 by
`node scripts/calibrate-claim-floor.mjs` against the 208 distinct real claims
frozen in `fixtures/claims/` - the origin repo's four files, three from its
working tree and one from
a pinned commit (withheld), copied in so the number
reproduces without it. Chance matches against unrelated fixtures occurred at
3 and 12 normalized characters and never above 12; 16 is that ceiling plus
margin, and it refuses 18 of 208 (8.7 percent), each a number, a name or a
fragment that states no proposition. (This paragraph said "203 distinct real
claims" and "18 of the 203" until 2026-09-09: the ceiling has not moved, the
population has - the origin repo's working-tree files changed between the two
measurements, which is why plan 2 froze them.) (Corrected 2026-09-10:
`fixtures/claims/` no longer exists. It was deleted when this repository was
made public, because the claim text discloses what the unpublished drafts it
came from are about, and `fixtures/claim-lengths.json` - the lengths and the
two spurious matches, no claim text - replaced it. The population, the
distribution and the 18-of-208 refusal still re-derive from that file and were
re-derived on 2026-09-10 before the deletion; the ceiling does not, because
re-running the matcher needs the strings, so "3 and 12 normalized characters
and never above 12" is from here on a dated measurement rather than a
reproducible one. docs/calibration-2026-09.md's "Correction, 2026-09-10" sets
out both halves.) This resolves Q3 in
section 13: a **refusal, uniform across the three sites, calibrated** - not a
warning, because a warning that a claim proves nothing leaves it proving nothing
while the run still passes. It is a breaking change for `check` against an
existing claims file that carries such a claim, and it is meant to be: the file
asserted something the tool could never have verified. Plan 2 implemented it,
after its calibration task re-derived the number from a committed script. The
re-run did not move the ceiling - 12, against a floor of 16 - so the floor is
unchanged; what moved was the population, and this paragraph is amended above
to match, which is the clause this sentence promised.

### 7.4 The output schema cannot express an accusation

**Non-`supported` results carry no renderable fields at all** - no excerpt, no
`retrievedAt`. The render half of the keystone rule becomes structural rather
than promised.

**Amended 2026-09-12, testimonium 0.2.0 section 2.** The clause above is now
false of `unsupported`: it carries `evidence` and `retrievedAt` for the claims
that DID match, so an author fixing four-of-five claims does not lose the one
passage that already landed. `unreachable` is unaffected and stays exactly as
stated above - bare, because we did not read the page and there is nothing
honest to render. The keystone rule this section names is unchanged; only
`unsupported`'s render surface widens.

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
testimonium recheck <doc>        drift, against the archive
testimonium reachability <doc>   preflight. no claims needed
```

Global flags: `--json`, `--rules <path>`. `check` additionally takes
`--explain-fetch` (not global: `reachability` and `harvest` have no fired-rule
provenance to print).

**Amended 2026-09-09, plan 3.** Two command-scoped flags join them, for the same
reason `--explain-fetch` is not global - the other commands have nothing to apply
them to. `check` takes `--no-archive`, which suppresses the baseline write so the
gate can be run without adding a new output (section 8.3). `recheck` takes
`--fail-on-gone`, which turns a source the origin reports deleted into an exit 1;
without it a gone source is reported and contributes 0, mirroring
`--fail-on-unreachable`. The `recheck` line in the table above also said "against
stored evidence and the archive" until this amendment: it is against the archive
alone, because 8.3 makes the archive self-contained and `recheck` never
reconciles two files.

**Amended 2026-09-07, plan 1:** `--fetcher <id>` above was never shipped as a
CLI flag. Plan 1 de-scoped it to a programmatic option only -
`CheckOptions.fetcher` - because a CLI fetcher registry (resolving an `<id>`
string to a loaded plugin, validating it, reporting a bad id) is a
plugin-resolution design nothing in this plan required. The README documents
the programmatic option and the absence of a CLI equivalent. Reintroducing
`--fetcher <id>` at the CLI needs that design done first, not just a flag
added.

**`check`** is the gate. Adapters parse the document; claims join by URL; each
source goes through `check()`; results write to the evidence file. From plan 3 it
also writes the archive entry for every source that reads `supported`, unless
`--no-archive` (8.3); `check()` itself still writes nothing.

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

**Archive on success** is what makes `recheck` interpretable. When a source reads
cleanly, store the bytes that were read. On a re-check, run the same pipeline over
the stored copy: a live read that positively FAILS to find a claim while the
stored bytes still positively prove it is source drift, and every other
disagreement is either ours or confounded. Section 8.3 carries the procedure and
is the authority. Without stored bytes, every drift alarm is confounded with the
pipeline's own evolution, and the fetch layer's history guarantees it will evolve.
Archiving must never fail a run.

*Corrected 2026-09-09, with 8.3's decision table:* this paragraph used to say
that "if the live bytes and the stored bytes now judge differently, the source
changed (real drift)". That is the same both-directions-alike error 8.3 deletes
from its own table. It calls a citation the live gate PASSES today source drift
whenever the stored bytes happen to fail - which is the signature of a change in
our code, not in the source - and an author told to fix a citation their own
green build just verified is the false accusation this tool exists to refuse.

**Amended 2026-09-09, plan 3.** This paragraph said the archive was a snapshot
pushed to web.archive.org, and that archiving "belongs with `recheck`, not with
`check`" because "it sits in `check`'s hot path only if it is free, and it is
not." Both halves are superseded, and the second followed from the first: the cost
that kept archiving out of `check` was entirely web.archive.org's - authenticated,
rate-limited well below one call per source per run, and asynchronous. Section 8.3
replaces the remote snapshot with bytes stored locally and content-addressed,
which costs a gzip and a file write, so the reason to keep it out of `check` is
gone and running `check` writes the baseline on `supported` - through the CLI,
not from inside `check()`, which section 8.3 keeps storage-agnostic. The change
is not a
convenience: reading a control arm back through web.archive.org would introduce
that service's own transformations - URL rewriting, an injected banner, a
different render - into the one comparison whose entire purpose is to isolate
changes in *this* pipeline. The remote snapshot confounded what the control arm
exists to de-confound. What is lost is third-party durability, a credibility
property rather than a debugging one, and not what this section ever claimed the
archive was for.

### 8.1 This spec is three implementation plans, not one

The commands above are one release, but they are not one plan. Attempting them as
a single plan front-loads unresolved questions onto work that does not depend on
them.

| Plan | Contents | Blocked on |
|---|---|---|
| 1. Core | TS port of the fetch ladder, header/finalUrl capture, pure classifier, verdict reducer, claims and evidence files, one adapter, `check`, `reachability` | Q1, Q2 - both resolved below |
| 1.2 Reader | `isReadable`; one `readSource` loop under `check` and `reachability`, with section 6.6's escalation and aggregation rules and the tests that pin them; the `foldWithMap` offset-map repair; U+00AD deleted by `norm`; the corrections the header lists | Nothing. Lands before plan 2 |
| 2. Harvest | `harvest` per section 8.2: calibration of `minClaimChars` and `harvestSeedChars` first, then `Document.prose`, `commonSpans`, the four filters, the draft file | Plan 1.2. Q3, Q5 - both resolved below |
| 3. Drift | `recheck` per section 8.3: the recording fetcher `bin.ts` wraps so `check` writes the archive on `supported`, the replay fetcher, the three-value comparison, archive-as-control-arm, and the README sentence 8.3 requires | Nothing. Plan 2 shipped; Q4 resolved below |

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
<doc>.evidence.json      written by check; rewritten by recheck with its LIVE arm's results
<doc>.archive/           written by check on `supported`, and by nothing else; the bytes recheck controls against
```

The claims file, the evidence file and the archive are committed. The draft is
transient: the author edits its proposals into the claims file and deletes it. A
re-check's output is then a **diff** - which `urtext` can review, closing the
family loop.

The archive is committed for the same reason the evidence file is: a control arm
that only exists on the machine that wrote it cannot control anything on a fresh
clone or in CI, and `recheck` there would degrade to comparing a live answer
against a number in a file - the confounded alarm this section says is worthless.
Section 8.3 gives its layout and its cost.

### 8.2 Harvest

Added 2026-09-07. This section, not the paragraph in section 8, is the
authority for plan 2. Fable's review of the first design (findings F1 to F18,
preserved at `docs/superpowers/plans/2026-09-08-plan-2-harvest-fable-design-review.md`,
alongside the plan review at `2026-09-08-plan-2-harvest-fable-plan-review.md`
in the same directory) is where each choice below was forced. Plan 2 is
blocked on plan 1.2 (section 6.6), which supplies the reader, the readability
predicate and the offset-map repair harvest depends on.

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
4. **Self-validation, per proposal.** Three assertions, each of which drops
   the span it fails: `phraseFound(sourceText, span)`, so the checker will
   find it; `phraseFound(docProse, span)`, so it is in the author's own draft; and
   `foldWithMap(span).folded === matchedFoldedSpan`, so the offset map did not
   shift. The third is the one `phraseFound` cannot stand in for: a map that
   is off by one yields a slice the source still contains, one character
   over, and `phraseFound` says yes to it. `foldWithMap` at 6546176 pushed one
   map entry per *input* unit while a code unit whose lowercase is two units
   (U+0130) added two to the folded text, shifting every offset after it; plan
   1.2 repairs it to one entry per *output* unit and pins `folded.length ===
   map.length` on U+0130, final sigma and an astral letter.

   *Amended 2026-09-09.* This paragraph said "three assertions, each a bug if
   it fails". That is FALSE of the first and only half true of the second,
   measured in plan 2: `norm()` rewrites a digit followed by "billion",
   "million", "bn" or "mn" into the compact form ("6 billion" becomes "6bn"),
   four length-changing rules `foldWithMap` deliberately omits because an
   offset map cannot survive them, and their input can straddle a span's
   edge on a page that is working perfectly - a source reading "6 billion"
   against a draft reading "7 billion" snaps the left boundary onto
   "billion", and `norm(span)` is then absent from `norm(sourceText)`, which
   holds "6bn". The DROP is correct either way: a span `phraseFound` cannot
   locate could never be verified by `check` either, so proposing it would set
   the author up for a false accusation against her own citation. What was
   wrong was the LABEL, and the cost was that a real offset-map fault sat
   invisible inside a routine boundary effect. Assertion 3 is a bug; the
   fold-drift half of assertion 2 is a bug; assertion 1 is not.
   `src/harvest/spans.ts`'s `normBoundaryNote` and `documentMismatchNote`
   carry the shipped wording, and `test/harvest.test.ts` pins both readings.
5. **Filters**, in order, each reporting per URL how many spans it dropped:
   1. *Floor.* `norm(span).length >= THRESHOLDS.minClaimChars` (section 7.3).
   2. *Frequency.* For any *other* normalized URL V in the document with at
      least one readable read, if `phraseFound(norm(text_R), span)` for any
      readable read R of V, the span is boilerplate - the outlet's name, a
      cookie notice, a shared byline, or a wire story reprinted by two cited
      outlets - and is dropped. A URL's own reads never vote against its own
      spans. With fewer than two URLs holding a readable read the filter is
      vacuous, and the report says so in words. Plan 2's calibration did NOT
      count how many real claims appear in two cited sources of the same
      draft: the reprint cost - how many REAL claims this filter would eat -
      is a disclosed gap, not a number. Recorded 2026-09-09, where this
      sentence previously said the count would be made. The measurement needs
      readable reads of the frozen drafts' OWN cited sources, which the frozen
      corpus does not hold and which only live network reads could supply - a
      network dependency inside the one task whose purpose is that its numbers
      reproduce from frozen fixtures. What was measured instead is in
      `docs/calibration-2026-09.md`: the floor against unrelated document
      fixtures, and the seed noise across unrelated fixture pairs. That
      document's "What was NOT done" section carries this gap beside the
      host-same gap.
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
   its `_note` is byte-identical to a marker harvest could have written -
   every byte outside the version and the date must match. (Amended
   2026-09-09: this said "the marker harvest would write", under which a draft
   written yesterday could never be overwritten today, because the marker
   carries the date. The rule exists to detect the author's edits, and every
   byte outside those two fields carries that signal.) A missing
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
precision knob. Measured across the 45 unrelated pairs of the 10 document
fixtures by `scripts/calibrate-harvest-seed.mjs`, committed in plan 2 and
re-run 2026-09-09: the mean count of above-floor spans emitted per pair was
2.0 at L = 13, 2.2 at 16, 1.2 at 20, 0.9 at 21 and 0.3 at 25. Those figures
count what `commonSpans` EMITS - after extension, word-boundary snapping and
containment dedupe - because that is what an author reviews. (This paragraph
previously quoted 24.8 / 5.0 / 0.9 / 0.2 at L = 13 / 16 / 20 / 25 and called
them "chance L-gram matches per pair". Those came from a script written during
the design review that was never committed and is in no git history, so
nothing could reproduce them, and they counted seeds rather than emitted
spans. Corrected 2026-09-09 against the committed script's own run.) The value
chosen by the selection rule that script states - the smallest L in 20 to 25
whose above-floor mean is below 1.0 - is 21, and it is recorded in
`docs/calibration-2026-09.md` with the command that produced it.

**Plan 2's first task is calibration**, before any harvest code: commit the
probe as `scripts/calibrate-claim-floor.mjs` (its walker skips `notApplicable`
objects, which the probe's did not); freeze the claims it measures under
`fixtures/claims/` so the numbers reproduce without the origin repo (that
freeze was deleted on 2026-09-10 when the repository was made public, and
`fixtures/claim-lengths.json` replaced it - the script now reports that file
rather than measuring a corpus, and no longer calibrates anything; see
docs/calibration-2026-09.md's "Correction, 2026-09-10");
hand-classify every cross-fixture common span as chance or boilerplate; and
bind the result with an acceptance test at `test/classify/claim-floor.test.ts`,
the discipline section 6.3 imposed on the prose floor. The floor's licence is a
priori; the measurement is its sanity check, not its derivation, and a re-run
that moves the observed ceiling above the floor is a finding to act on, not a
number to explain away.

**CLI.** `bin.ts` gains `draftPathFor` beside `claimsPathFor` and
`evidencePathFor`, and the usage string names the third command.

---

### 8.3 Recheck, and the archive as a control arm

Added 2026-09-09. This section, not the paragraph in section 8, is the authority
for plan 3, and it resolves Q4. Plan 3 is blocked on nothing: plans 1, 1.1, 1.2
and 2 have all shipped.

**Corrected 2026-09-09, the same day it was written and before any of it was
built.** Fable's review of this section - preserved at
`docs/superpowers/plans/2026-09-09-plan-3-drift-fable-spec-review.md`, which owns
its own correction numbers 1-14 - returned APPROVE WITH CORRECTIONS with
fourteen findings, three of them blocking. Thirteen are folded in below and
marked where they land; the fourteenth is 7.1's stale `RungId` snippet, which
predates this section and is parked rather than fixed here.

**Corrected again 2026-09-09, from Fable's review of PLAN 3** - its corrections
1 and 2, applied before the first task was dispatched. Two sentences of this
section were wrong in ways only a plan drafted from them exposed: the index
would have churned on every green run, and the gone row sat below the named
confounds, which silently disables `--fail-on-gone` for any URL whose claims
were edited. Both are corrected in place and marked where they land, in the same
voice, because a section that has now been found false by two separate reviews
is the last place to start editing quietly. Neither changes the format: no
version bump.

Two of the three
blockers were present-tense
claims about shipped code that were false when written: a `CheckOptions` sink
that cannot be built, because the bytes are discarded before `check()` ever sees
them, and a stored blob called "raw bodies" that is `pdftotext`'s output for
every PDF. The third was a decision table that would have minted false
accusations. Each is corrected in place, with what it claimed left legible,
because section 0's rule for this document is that a withdrawn claim stays
visible: this project has now found shipped prose false in each of its last three
plans, and a silent rewrite is how the next one gets written.

**What it is.** `recheck <doc.md>` re-runs each claim against the live source
*and* against the bytes stored when that source last read `supported`, and
reports what changed. It is the instrument, not a policy: no cron, no rot score,
no staleness badge, because the drift rate is unmeasured (section 12).

**Why an archive at all.** The fetch layer and the extractor evolve - that is
this project's whole history - so a bare "the verdict changed since last time"
cannot distinguish a source that was edited from an extractor that was improved.
The archive supplies the control: the same code, run over the same bytes, must
still reach the same verdict. Where it does not, the change is ours.

**The comparison is three values, not two.** For each cited URL:

- **L** - `check()` over the live source, with the current claims and the
  current code.
- **A** - `check()` over the archived bytes, with the current claims and the
  current code.
- **R** - the verdict recorded in the archive at the time it was written.

L against A is the primary signal, and it is stronger than comparing a live
answer against a recorded one because both sides run today's code over today's
claims and today's rules. *Corrected 2026-09-09:* this paragraph said "the only
variable left is the bytes", and that is not true of any rung. What a fetcher
returns as `rawBody` is already a decoded string - `await r.text()` on the node
rung, a UTF-8 read of what curl wrote under `--compressed` on the curl rung, and
`pdftotext -layout`'s output on the PDF rung (`src/fetch/`) - so the archive
stores what the classifier saw, and every decode upstream of that sits outside
the comparison in both arms. For the two HTML rungs that residue is small and no
version is recorded for it: the transform is a standard character decode of a
byte stream, and a change in it would have to come from the Node runtime or from
curl itself. For `pdftotext` it is a separate binary doing layout
reconstruction, it is not stable across builds, and it gets a recorded version
for exactly that reason - the ruling is below. If an HTML decode ever proves
unstable in the same way, the same remedy applies to it.

**R is always `supported`.** The archive is written only when a URL reaches
`supported`, so `R` has exactly one value and "A differs from R" means precisely
"A is not `supported`". The invariant is load-bearing and was never stated, and
stating it is what collapses the comparison into something an implementer can
code without inventing the missing halves.

**Corrected 2026-09-09: the decision table is deleted, not adjusted.** This
section shipped, for one day, a three-row table keyed on "L vs A: same or differ"
and "A vs R: same or differ", whose second row read **differ / - / source drift /
1**. It is recorded here rather than quietly replaced, because it would have
issued the one thing this tool exists to refuse - a false accusation against
accurate work - and because a plan drafted from it would have cited it as
authority.

- **It conditioned on whether the two arms differ without ever saying WHICH
  WAY.** `L = supported, A = unsupported` - the live gate passing today, the
  stored bytes failing - is "differ", so the table called it source drift, exit
  1, and instructed that "the author verifies the page and updates or removes the
  claim". That combination is the signature of a change in OUR code: a new
  challenge signature that matches the archived template, a `norm()` change that
  breaks a phrase the live page no longer carries. The author would have been
  told to fix a citation their own green `check` had just verified.
- **`L = unreachable, A = unsupported` is "differ" too**, so the table issued an
  accusation out of a read that never happened - the thing `verdict()`
  categorically refuses, since every veto returns `unreachable` and `unsupported`
  is reachable only through `isReadable` (`src/classify/verdict.ts`).
- **It contradicted its own carve-out, two paragraphs below itself.** `L =
  unreachable` against `A = supported` is "differ"; the table said source drift,
  exit 1, while the prose said "not source drift ... listed, never failed". An
  implementer coding from the table ships the accusation the prose forbids, and
  nothing in the section said which of the two won.

**The decision procedure.** Condition on `L` first. `A` is read only to attribute
the difference, and `R` is the invariant above.

```
no baseline                                            -> reported, 0
L = unreachable, documentGone                          -> "gone since <archivedAt>", 0
                                                          (1 under --fail-on-gone;
                                                           any confounds computed for
                                                           this citation are named on
                                                           this row's report line)
named confound (claimsHash, pdftotext version,
                local --rules file)                    -> reported, 0
L = unreachable, otherwise                             -> listed, never 1
L = supported,   A = supported                         -> clean, 0
L = supported,   A != supported                        -> pipeline drift, 2
L = unsupported, A = supported                         -> SOURCE DRIFT, 1
L = unsupported, A != supported                        -> pipeline drift / confounded, 2
```

**Corrected 2026-09-09: the gone row is evaluated ABOVE the named confounds.**
This block shipped with the confound row first and the gone row two rows below
it, and the two paragraphs after it say the confounds short-circuit the
procedure without exception. That ordering is superseded. Under it,
`recheck --fail-on-gone` returns 0 for a genuinely deleted page whenever that
URL's claims were edited since archiving - the flag the author passed to catch
dead links, silently disabled by an unrelated edit, on the ordinary sequence
(edit a claim, `check` fails, run `recheck`). It is wrong because a named
confound explains a divergence between the ARMS, while gone-ness is the origin's
own statement about `L` (N4), and no confound can produce or explain it: a
claims edit cannot 404 a page, a local rule changes classification rather than
the wire status, and the `pdftotext` confound cannot co-occur with gone at all,
since that rung reports `status: 0` and N4 never fires on a PDF (the residue
disclosed below). This is the one deliberate exception to "a named confound
short-circuits everything", and it hides nothing: the confounds computed for a
gone citation are carried on its outcome and named in its report line. The
reorder cannot mint an unlicensed exit 1 either - the gone row's licence is the
origin's 404, it contributes 0 by default and 1 only under the explicit opt-in,
and it still sits below the no-baseline and R-invariant checks.

**Exit 1 iff `L = unsupported` AND `A = supported` AND no named confound**, and
it is worth saying plainly why that is the only row permitted to accuse.
`L = unsupported` already carries the keystone's own licence: `check()` cannot
return `unsupported` from a read it did not judge readable, because every veto
returns `unreachable` first and the final branch asks `isReadable`
(`src/classify/verdict.ts`), so the live arm positively read the page and
positively failed to find the claim there. `A = supported` certifies that today's
code, today's rules and today's claims still prove that same claim from the
stored bytes - so nothing on our side of the comparison can account for the
difference, and what changed is the bytes. Every other combination has an
explanation available that is not the author's fault, and contributes 0 or 2.

**`claimsHash`, and the named confounds, short-circuit the procedure.** The
archive records a hash of that URL's claims as they stood when it was written. If
they have changed since, `A` and `R` may differ for that reason alone, and the
report says so rather than accusing the extractor of a regression it did not
commit. **Its exit contribution is 0**, which the section did not say and which
the ordinary sequence makes load-bearing: the author edits a claim, `check`
fails, the baseline is therefore NOT refreshed (only `supported` writes it), and
the author runs `recheck` to ask whether the source moved as well. Answering that
question with a failing exit code would be answering a question with an
accusation. The baseline is refreshed by the next `supported` `check`, which is
the only writer.

Two further **named confounds** are evaluated in the same place, before `L` is
consulted, and are reported the same way with an exit contribution of 0: a
`pdftotext` version that differs from the one recorded for a read, and a local
`--rules` file whose hash differs from the one recorded. Both are specified
below. *Corrected 2026-09-09:* "in the same place, before `L` is consulted" is
superseded for one row - the gone row is evaluated ABOVE the confounds, for the
reason given under the procedure block, and the confounds computed for that
citation are carried on its outcome and named in its report line rather than
suppressing it. A named confound is **not** pipeline drift and must never be reported as
one: pipeline drift means a regression in THIS tool, and in both of these cases
what changed is the author's own machine or the author's own data. The mirror of
that rule matters as much - a change in the BUNDLED rules is ours, stays pipeline
drift, and is never demoted to a confound.

**Three outcomes carry no accusation, and none of them fails a run by default.**

- *Gone.* **Corrected 2026-09-09.** The live read is `unreachable` because the
  origin said 404 or 410 (N4), and the baseline is `supported`. The single
  "unreachable now" carve-out these three bullets replace swallowed this case
  whole, so a deleted page - the most common real drift there is - reported as a
  bare "unreachable now", indistinguishable from a flaky network, and never
  entered the drift number section 12 says this instrument exists to produce. It
  also left two sentences elsewhere in this spec false: 6.3 carries as a caveat,
  and 6.2 records as the deferral N4 came out of, that a 404 "distinguishes 'this
  document is gone' from 'this document was read', which is information `recheck`
  will want even though `check` does not act on it" - and as written, `recheck`
  did not want it.
  A gone source is now its own reported category - **"gone since
  `<archivedAt>`"** - kept apart from transient unreachability, which is what
  discharges those two sentences. It **contributes 0 by default and 1 under
  `--fail-on-gone`**, mirroring `--fail-on-unreachable` in `classifyRun`
  (`src/bin.ts`). Failing by default would accuse over a transiently misconfigured
  404, which is the same false accusation in a new costume; a genuinely dead link
  is nonetheless the author's to fix, which is why the opt-in exists at all and
  why it contributes 1 rather than 2.
- *Unreachable otherwise.* A transient 500, a new wall, a flaky network. This is
  **not** source drift. The page may be perfectly intact, and reporting it
  as drift the author must fix would be a false accusation of a citation that is
  probably still good - the error section 6 exists to prevent, arriving through a
  different door. It is listed, never failed, exactly as `unreachable` is under
  `check`.
- *No baseline.* The URL has never read `supported`, so nothing was ever stored
  and there is nothing to control against. `recheck` reports the live verdict for
  information and exits 0 even when that verdict is `unsupported`. `check` is the
  gate; `recheck` detects change. A `recheck` that also gated would let an author
  skip `check` and receive a worse version of it.

**Where `recheck` reads "gone" from**, since the obvious place does not have it.
`CitationResult` carries no status and no signals - by design: section 7.4 keeps
the schema structurally unable to express an accusation, and it carries only
`url`, `verdict`, the rung lists, `ladderTruncated`, and the gated
`missed`/`evidence`/`retrievedAt`/`firedRule` (`src/io/evidence.ts`).
`documentGone` is a signal on the read (`src/classify/signals.ts`, `status === 404
|| status === 410`), and the CLI can see the status only because it owns the
fetcher: the recording wrapper specified below is used on `recheck`'s live arm
too, for exactly this, and reads nothing the fetcher did not already hand back.
**Residue, disclosed:** the `pdftotext` rung reports `status: 0` and no headers
(`src/fetch/pdf.ts`), so N4 can never fire on a PDF URL and a deleted PDF is
reported as transiently unreachable rather than gone. `--fail-on-gone` is silent
on PDFs, and that is a property of the rung rather than a policy choice.

**Archive on success: the CLI records, `check()` stays pure.** Running `check`
writes the baseline, but `check()` does not write it. Section 11's first coupling
makes the core storage-agnostic - `(document, claims) -> verdicts + excerpts`,
with the CLI persisting to files - and `writeEvidenceFile` is already called from
`bin.ts`, not from `check()`. The archive follows the same seam.

**Corrected 2026-09-09: the `CheckOptions` sink is withdrawn.** This section
first specified that `CheckOptions` "gains an optional sink, called only when a
URL reaches `supported`, carrying that URL's reads and the verdict they
produced", and claimed that this "avoids a second fetch to recover bytes the
first one already had". It cannot be built as described, and it should not be
built in another form either.

- **The reads do not contain the bytes.** A `Read` is `{ rung, computed }`, and
  `computed` is a `SignalResult`: the signals, the extracted `text`, `finalUrl`,
  the matched and missed lists, the fired rule (`src/fetch/read-source.ts`,
  `src/classify/signals.ts`). No raw body, no headers, no status. Each
  `RawResponse` is dropped inside `readSource` the moment `computeSignals` has
  run on it. The fetch had the bytes; `check()` never does. A sink handed "that
  URL's reads" would receive post-extraction text and none of what the archive
  needs, and honouring the sentence as written would mean widening `Read` and
  `SourceReads` to carry every `RawResponse` through the core.
- **A public sink IS a public raw-reads surface.** Section 6.6 keeps `readSource`
  off `src/index.ts` "because a consumer holding raw reads can assemble a verdict
  `verdict()` never issued", and 5.3 seals the primitives structurally rather
  than by advice. An option on the exported `CheckOptions` that hands a caller
  per-rung bodies, headers and statuses reopens that door, inside the one options
  bag every programmatic caller already builds. The withdrawn paragraph never
  noticed the tension, and cited 7.4 as though keeping bodies off
  `CitationResult` settled it.

**What plan 3 builds instead: a recording fetcher in `bin.ts`.** The CLI builds
`defaultFetcher` itself, wraps it in a fetcher that keeps each `(rung,
RawResponse)` pair it hands back, and passes the wrapper through the
`CheckOptions.fetcher` option that already exists. When `check()` returns
`supported`, the CLI writes that URL's archive entry from the tee's buffer plus
the returned verdict. This is section 7.1 paying off: `Fetcher` is a public
two-member interface whose output is facts only - there is no `ok` and no
`http2xx` to get wrong - so a wrapper can neither fabricate a verdict nor lose
one, and recording is the same shape as the bring-your-own-reader escape hatch
the interface was designed for.

It reaches every goal the sink was reaching for, at no cost to the core:

- `check()` is untouched and stays pure. A programmatic caller gets today's
  behaviour exactly, with no new option to misuse and no new way to be handed
  raw reads.
- Raw bodies stay off `CitationResult` (section 7.4) and off the public surface
  entirely. `bin.ts` is inside the package and imports `defaultFetcher` by path,
  so the exports map stays `.` and `./package.json` alone, as `test/exports.test.ts`
  pins it (section 5.3).
- No second fetch: the tee holds what the live fetch already returned.
- `--no-archive` means "do not wrap", so the unwrapped path is byte-for-byte
  today's - the strongest form the flag can take.
- "Archiving must never fail a run" (Q4) becomes one `try`/`catch` around the
  write in `bin.ts`, warning and continuing. That is a guarantee about ten lines
  of CLI code rather than about a callback the core invokes mid-run.

**One detail the plan must not drop.** Today `check()` constructs the default
fetcher when `opts.fetcher` is absent, and it passes the loaded host rules into
it: `defaultFetcher(opts.rules ? { hosts: opts.rules.hosts } : {})`
(`src/check.ts`). A CLI that builds its own fetcher and omits that argument
silently loses local host rules - a `--rules` file that loads, validates and is
never consulted, which is precisely the silent no-op that unwired `hostRuleFor`
already cost this project once. The wrapper is built over
`defaultFetcher({ hosts: rules.hosts })`, and a test pins that a local host rule
still reaches the fetcher through the CLI path.

**Every attempted read is archived, not the winning one.** The verdict is
computed from a union across every non-vetoed read (section 6.6), and each read's
veto is decided from its own headers (N1, N5), its `finalUrl` (N2) and its status
(N4). A single archived body cannot reproduce that union, so the replay arm would
be answering a question the live arm was never asked.

*Corrected 2026-09-09:* the rule is right and the sentence justifying it was
wrong twice. It said `recheck` "would then report pipeline drift on every
citation that took more than one rung". The symptom is not confined to pipeline
drift, and is worse than the sentence claims: the ordinary shape is a live arm
still `supported` against a single-body replay that reads `unsupported`, which is
`L = supported, A != supported` - and under the deleted table that was L-vs-A
"differ", **source drift, exit 1**, a false accusation rather than a spurious 2.
And "every citation that took more than one rung" overstates it: a citation whose
winning body alone carries every claim and satisfies the ladder replays clean,
because the union it needs is a subset of that one read.

`--no-archive` suppresses the write for a read-only invocation; `check` is a
gate, and a gate must be runnable without side effects.

*Corrected 2026-09-09, plan 3 Task 11.* "Read-only invocation" and "without side
effects" are both too strong, and were when this section was written: `check`
writes `<doc>.evidence.json` unconditionally from `bin.ts`, `--no-archive` or
not. Measured on this machine - `check <doc> --no-archive` over a citation at a
closed port left no `<doc>.archive/` and wrote `<doc>.evidence.json` all the
same. What the flag actually guarantees is narrower and is what section 8.3
needs: it does not wrap the fetcher, so the run adds no output plan 3 did not
have, and the invocation is byte-for-byte the pre-plan-3 one. A gate that must
be runnable without touching the archive is the true claim; a gate that writes
nothing has never been this tool.

**PDFs: the archived blob is `pdftotext`'s output, and the local poppler build
sits inside the live arm.** *Corrected 2026-09-09.* This section called the
stored blobs "raw bodies", which for this rung they have never been, and the
sentence corrected above - "the only variable left is the bytes" - fails hardest
here. `pdfFetch` downloads the file with curl, runs `pdftotext -layout` over it,
and returns the extracted TEXT as `rawBody`, with `status: 0` and no headers
(`src/fetch/pdf.ts`). What is archived for a PDF is therefore already
tool-transformed, and the transform is a declared system dependency of whichever
machine ran it (section 11's third coupling). A poppler upgrade - or, the
ordinary case, CI's poppler differing from the laptop that wrote the archive -
changes hyphenation, ligatures and column layout; a claim stops matching; `L =
unsupported` against `A = supported` is exit 1. The tool's own dependency would
have failed the author's build over a PDF nobody touched.

**Ruling: record the version, and do NOT archive the downloaded PDF.**
`index.json` records the `pdftotext` version string for every read taken through
that rung. A version that differs at recheck time is a **named confound**: the
report names it, and that citation cannot reach exit 1. Archiving the downloaded
PDF bytes as a second blob was considered and rejected. Archiving the extracted
text is exactly what lets the replay arm run on a machine with no `pdftotext` at
all; requiring poppler to replay would break `recheck` on precisely the CI and
serverless runners section 7.1 commits this design to serving, and it would put
the whole PDF into the committed store on top of the text - gzip buys almost
nothing on a PDF - to purchase an attribution the recorded version already
names.

**Residue, disclosed.** For a PDF, a genuine source change and a poppler change
are distinguishable only by the recorded version, and two different poppler
builds reporting the same version string are not distinguishable at all. The
version is what `pdftotext -v` prints. `pdftotextAvailable` already spawns that
exact command and discards its output (`src/fetch/pdf.ts`, `stdio: "ignore"`), so
capturing it is a small change in a place that already exists - but the plan
pins it with a fixture rather than assuming, because that function also documents
a real build (Xpdf's) that exits non-zero on `-v`, and a version probe that
throws on a working install would silently record nothing.

**Layout**, beside the evidence file:

```
<doc>.archive/
  index.json                  version, and per URL what was seen and what it produced
  blobs/<aa>/<hash>.gz        each read's body AS THE CLASSIFIER SAW IT, gzipped,
                              content-addressed. For pdftotext that is extracted
                              text, not the PDF - see the ruling above.
```

`index.json` records, per URL: `archivedAt`, the verdict those bytes produced,
`claimsHash`, the provenance pair below, and one entry per attempted read -
`rung`, `status`, `headers`, `finalUrl`, the blob's hash, and for a `pdftotext`
read the recorded version string. The archive is **self-contained**: it holds
both the bytes and the verdict they produced, so `recheck` never reconciles two
files and the evidence file and the archive cannot drift apart and be compared as
a mismatched pair. The evidence file keeps its own job - what was concluded, for a
reader. The archive holds what was seen, for the tool.

**The format is pinned here, not left to the plan**, because these files are
committed: the archive is a compatibility surface the moment the first one lands
in someone's repository, and every one of these five was a gap Fable's review
found in a format the plan would otherwise have chosen by accident.

- **`version`.** `index.json` carries `"version": 1` at its top level, exactly as
  `<doc>.evidence.json` already does (`writeEvidenceFile`, `src/io/evidence.ts`).
  A committed file with no version field cannot be migrated later without
  guessing what wrote it.
- **The key is `normalizeUrl(url)`, not the URL as cited.** This one is a trap
  with a live mechanism: `joinClaims` keys claims by `normalizeUrl(fn.url)` but
  hands `check()` the AS-CITED spelling, which is what lands on
  `CitationResult.url` (`src/io/claims.ts`, `src/bin.ts`). An archive keyed off
  the result would file two spellings of one resource - a trailing slash, a
  `utm_` parameter - under two entries, and the baseline would be silently
  missed: `recheck` would report "no baseline" forever and exit 0 while doing
  nothing at all. The archive key MUST be the join key, and a test pins the two
  together.
- **The blob hash is computed BEFORE gzip**, over the UTF-8 encoding of the body
  being stored. SHA-256, lower case hex; the first two hex characters are the
  `<aa>` shard. Hashing the `.gz` would make the digest a function of the zlib
  version and break idempotency across machines for identical content - every CI
  runner with a different zlib would add a blob for a source nobody edited.
- **`claimsHash` is SHA-256 over that URL's claims, `norm()`-normalized, sorted,
  newline-joined.** `norm()` because it is what the MATCHER runs, so the hash
  tracks exactly the text a verdict depends on and an invisible whitespace edit
  does not read as a claims change (the same reasoning as 7.3's floor: the
  predicate has to be the matcher's). Sorted because reordering the claims of one
  URL changes nothing about what is checked, and an order-sensitive hash would
  report a confound - and suppress the comparison - for a reordering.
- **Which headers are stored: all of them EXCEPT `set-cookie`.** Not an
  allowlist: the header vetoes are dated data that rot and get added to (7.2), so
  a set frozen today would leave a rule added tomorrow unable to fire on an
  archived read, and the control arm would answer with a veto the live arm no
  longer agrees with. `set-cookie` is never stored, in any form, because these
  files are committed and a session cookie in git is a credential leak. The
  residual is disclosed rather than solved: any other response header a host
  chooses to put a secret in is committed with the archive, so an author
  archiving an authenticated page is publishing whatever that host returns.

**Rules provenance, per index entry**, and the two halves are treated
differently. Each entry records the tool `VERSION` (`src/version.ts`), which
identifies the bundled rules because the bundled signatures, paths and host rules
compile into the package, and the SHA-256 of the `--rules` file's bytes when one
was passed, or `null` when none was.

- **A changed LOCAL rules file is a named confound**, exit contribution 0. A
  local signature or path rule feeds N2 and N3 directly and can turn a real
  document into `unreachable` - or into `unsupported`, when a later rung read it
  (6.3) - so a changed local file moves `A` against `R` for a reason that is not
  a regression in this tool. Local rules are the author's own data, and reporting
  their edit as our defect would name the wrong cause in the one report written
  to attribute causes.
- **A changed bundled snapshot is NOT a confound.** It is recorded and named in
  the report as the likely cause, and the citation is still pipeline drift, exit
  2, because the bundled rules are ours: a rule we added is exactly the kind of
  change the control arm exists to catch. Treating a version bump as a confound
  would suppress the comparison on every citation after every release, which
  would retire the instrument by upgrading it.

The bundled side is identified by package version rather than by a snapshot date
because the bundled rules carry one `lastConfirmed` per rule and no single date
for the set (`src/rules/challenge.ts`).

Content-addressing is what makes the write idempotent across runs: re-running
`check` against an unchanged source rewrites the same hash and stores no new
blob. *Corrected 2026-09-09:* this paragraph also said the `node` and `curl`
rungs "usually return byte-identical bodies and collapse to one blob". They
usually do not, because the ladder does not usually run both - `nextAction`
climbs to `curl` only when node's read was NOT readable (`src/fetch/ladder.ts`)
- so an archived (that is, `supported`) URL with two recorded reads usually holds
a wall or a stub AND the document: different bytes, two blobs. Two costs the
paragraph owed and did not pay:

- A page with per-request bytes - a CSRF token, a nonce, a timestamp in the
  markup - hashes differently on every run and adds a blob on **every `check`**,
  not "when a source genuinely changes".
- **Nothing prunes.** Re-archiving a URL at a new hash overwrites its index entry
  and orphans the old blob, which stays. Growth is monotonic in a committed
  store. Orphans are GC-able later - every live hash is named in `index.json`, so
  the set of unreferenced blobs is computable - and no GC ships in plan 3.

**Corrected 2026-09-09: an entry that changed in nothing material is
PRESERVED.** The paragraph above discloses idempotency of the BLOBS only, and as
this section stood the INDEX churned: every `check` stamps a fresh `archivedAt`
into each entry it stages and stores that read's response headers, and the node
rung's `date` header differs on every response - so a committed
`<doc>.archive/index.json` would diff on EVERY green `check` of an unchanged
corpus, leaving a dirty tree in the store this section requires committed. That
is superseded. The writer keeps the EXISTING entry, byte for byte, when the
incoming one differs in nothing material, where material means the reads'
`(rung, status, finalUrl, hash)` tuples in order, `claimsHash`, `toolVersion`,
`localRulesHash`, and each read's `pdftotextVersion`. The comparison ignores
`headers` as well as `archivedAt`, and it must: a predicate that compared
headers would never fire on the node rung, and the churn would survive its own
fix. Keeping the whole old entry - old headers, old date - is coherent, because
the entry is a record of what was seen at `archivedAt`. So `archivedAt` means
"when this baseline was established or last materially changed", and "gone since
`<archivedAt>`" reads "gone since at least that date"; a material change - a
`toolVersion` bump included - rewrites the entry with a fresh `archivedAt`, so
the bundled-version note self-heals on the next green `check`. This is writer
behaviour, not shape: no format-version bump.

**`recheck` runs `check()` twice.** Once with the recording fetcher over the live
source, and once with a fetcher that replays the archive. `CheckOptions.fetcher`
already exists for this (section 7.1), so no second judgement path is written,
and the control arm is *provably* the same code as the live arm. That is not an
economy: a control that ran through different code could not isolate a change in
the code.

**The replay fetcher, specified.** The section said only "a fetcher that replays
the archive", and the natural implementation of that sentence manufactures drift.
It reads local blobs and needs no binaries at all:

- **Its `rungs` are the rungs recorded in that URL's index entry**, never what
  the machine can run. `defaultFetcher` probes for `curl` and `pdftotext` and
  advertises what it finds; a replay fetcher that did the same would make the
  control arm a fact about the recheck machine. Concretely: a PDF archived where
  `pdftotext` exists and rechecked where it does not attempts NOTHING in either
  arm, because `nextAction` stops a PDF URL immediately when the rung is
  unavailable (`src/fetch/ladder.ts`), giving `L = A = unreachable` against
  `R = supported` - spurious drift on every PDF citation on every runner without
  poppler, produced by the instrument built to remove it. Advertising the
  recorded rungs also keeps `ladderTruncated` honest, since it is computed from
  `fetcher.rungs` (`isLadderTruncated`, `src/io/evidence.ts`).
- **It returns each recorded read verbatim**: `rawBody` from the blob, with the
  recorded `status`, `headers` and `finalUrl` - including a recorded empty
  `finalUrl`, so that `readSource`'s `response.finalUrl || url` default
  reproduces what `computeSignals` originally saw rather than substituting a URL
  the classifier never had.
- **It returns `EMPTY_RESPONSE` for any rung with no recorded read**, and it
  never throws, per the `Fetcher` contract (section 7.1): an unread rung is a
  result, not an error.

**What `recheck` writes.** It writes `<doc>.evidence.json` with the **live** arm's
results - what is true of the source today, which is the same thing `check`
writes there and the only arm whose verdicts describe the world. The replay arm's
verdicts exist to attribute a difference and are report-only; writing them would
put a verdict computed from bytes on disk into the file a reader's renderer
consumes. `recheck` **never** writes into the archive and never refreshes a
baseline: `check` is the only archive writer, so a drifted source cannot silently
become its own new baseline, and there is no way to "fix" a drift report by
running `recheck` again. `notApplicable`, `unclaimed` and orphaned claims are
reported exactly as `check` reports them, from the same `joinClaims` output.

**Exit codes.** `0` clean, or nothing to compare. `1` source drift - the author
verifies the page and updates or removes the claim. `2` infrastructure failure,
**and pipeline drift**. Pipeline drift is a regression in this tool, not a defect
in the author's document.

*Corrected 2026-09-09 (a).* This paragraph went on to say that failing the
author's build for pipeline drift "would put the cost of our limitations onto
them". That overclaims, in the section that is plan 3's authority: exit 2 fails
every naive `set -e` gate exactly as exit 1 does, so the split does not spare
anyone a red build. What 1-versus-2 delivers is **attribution** - the author is
never told to fix their document for a defect that is ours, and a pipeline that
wants to treat the two differently can, because the codes differ. That is worth
having and it is less than the sentence claimed.

**(b) Precedence at the run level: for `recheck`, 1 dominates 2.** With one URL
in source drift and another in pipeline drift, the run exits 1. Infrastructure
failure is still 2 and still dominates both. This deliberately differs from
`classifyRun`'s precedent, where infrastructure is tested first and 2 wins
outright (`src/bin.ts`): under `check` a 2 means the tool could not do its job
and the run is void, so there is nothing author-actionable to preserve. Under
`recheck` both signals are real results about different citations, and letting
our own regression mask genuine source drift at the exit code would be this
tool's defect suppressing the author's news. Both are named in the report either
way; only the code is forced to choose.

**What the archive cannot tell you.** It detects *change*, never *correctness*. A
source that was already wrong when it first read `supported` is archived wrong,
and `recheck` will call it clean for as long as it stays wrong.

*Corrected 2026-09-09 (c).* This paragraph ended: "The README says so in those
words, beside the exposures section 8.2 discloses for harvest." It does not. The
README carries no sentence about change versus correctness anywhere, and its only
mention of `recheck` is under the heading "What's not here", where it says the
command "is a separate plan, not a missing feature of this one". (It carries both
now - see the discharge below. This sentence is kept in the present tense it was
written in, because it is the evidence that forced the requirement, and rewriting
it would erase the record of the defect.) A present-tense
factual claim about another document, false when written, in the section built to
be plan 3's authority - the defect class section 0 exists to catch, committed
inside the section correcting two others of the same kind. It becomes a
requirement instead: **plan 3 MUST add that sentence to the README in those
words**, beside the exposures 8.2 discloses for harvest, and MUST replace the
"What's not here" paragraph when `recheck` ships. That is a plan task with an
acceptance check, not a claim about a file.

*Discharged 2026-09-09, plan 3.* The README now carries the sentence, in those
words, in its own `Recheck` section beside the harvest exposures, and the
"What's not here" paragraph no longer says `recheck` is a separate plan.
`test/readme.test.ts` pins the sentence itself, and pins that the README names
every command `USAGE` names - so the half of this requirement that a future
edit is most likely to delete is structural rather than promised. The replaced
paragraph is **not** separately pinned: measured, restoring "`recheck` is a
separate plan" to "What's not here" leaves both tests green. That half rests on
review, and this sentence says so rather than claiming a coverage it does not
have - which is the whole reason correction (c) exists.

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

And one added in 0.2.0, stated as a design goal with its own named exception
rather than as an absolute - because publishing the absolute form would state
as always-true something the code records as a known, accepted gap:

- **testimonium does not defeat paywalls, bot walls, or consent walls.** Its
  design goal is that a source it cannot legitimately read reads
  `unreachable`, never `unsupported`, enforced by the five vetoes (section
  6.2) and the prose floor. A caller with legitimate access - a
  subscription, an institutional proxy, an authenticated session - supplies
  it through `CheckOptions.fetcher` (section 7.1). The goal is stated as a
  goal, with a known gap named, because `src/classify/signals.ts:167-179`
  already records the counterexample: a wall matching a signature but
  padded past roughly 4,500 characters is caught by neither the signature
  (`maxChallengeChars` is 800, `thresholds.ts:62`) nor the floor - "a known,
  accepted gap", with a `known-gap` fixture. 6.6's escalation exception
  closes it only where the other rung serves the document; a fat wall on
  both rungs still returns `unsupported`.

  Two capabilities were considered and declined on this ground, recorded so
  a later reader does not helpfully complete the port:

  - **A publisher-specific body extractor** recovering full article text
    from a page's embedded JSON state, defeating paywall truncation. In a
    private tool, checking one's own citations against a publication one
    subscribes to is a defensible gray area. Distributing it in a free
    public package is not: it ships circumvention for a named publisher to
    everyone, against that publisher's terms - and it contradicts this
    package's own stance, since a tool arguing that citations must be
    verifiable should not ship a bypass for the one case where the honest
    answer is "I could not read this."
  - **A publisher-pinned user agent** for the same host. Identifying as a
    browser is general and already supported; pinning an old browser
    version at one publisher is defeat-shaped. It is also dead capability -
    that host has been a hard block since 2026-08-24 (`rules/hosts.ts:26-34`).

  Both remain available to a caller with legitimate access: the extractor
  through `CheckOptions.fetcher` (section 7.1), and the user agent through a
  local `--rules` host entry (`rules/hosts.ts:3`) - no custom fetcher
  required for the latter.

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

**Amended 2026-09-12, testimonium 0.2.0 section 2.** This property test is now
false of `unsupported`, which is non-`supported` but carries `evidence` and
`retrievedAt` for the claims that DID match (section 7.4's amendment). The
property 0.2.0 still enforces mechanically is narrower: no `unreachable` or
`unclaimed` result may carry a renderable field.

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
   and the measurement: 208 real claims, chance matches at 3 and 12 normalized
   characters and none above, 18 of 208 refused, re-derived 2026-09-09 against
   the population frozen in `fixtures/claims/`. This line said "203 real
   claims" and "18 of 203" until then; 7.3 says why the population moved.
   (Corrected 2026-09-10: that population was deleted when this repository was
   made public and `fixtures/claim-lengths.json` replaced it. The counts still
   re-derive; the chance matches at 3 and 12 are from here on a dated
   measurement. 7.3 and docs/calibration-2026-09.md say what that costs.)
   Implemented in plan 2, whose calibration task re-derived the number before
   any code depended on it.
4. ~~**Archive failures.**~~ **RESOLVED 2026-09-09: local bytes, content-addressed,
   written by `check`.** The question asked how to survive web.archive.org's
   authentication, its rate limit well below one call per source per run, its
   asynchronous save-page-now, and the queueing and backoff those imply. None of
   that is answered, because none of it is needed: the archive exists to be a
   control arm, and for that job a remote snapshot is the wrong instrument. It
   would carry web.archive.org's own transformations into the one comparison
   built to isolate changes in this pipeline, and the bytes it returns are a
   near-neighbour of what was actually judged rather than those bytes. Storing
   them locally costs a gzip and a content-addressed file write, which is why
   archiving also moves back into `check` (section 8.3) - the cost that kept it
   out was the remote service's, not the archive's. "It must never fail a run"
   stands and is now nearly free to honour. Third-party durability is given up
   deliberately; it is a credibility property, and section 8 never claimed it.
   One transform survives locally and 8.3 discloses it rather than claiming
   otherwise: for a PDF the bytes `check` judges are `pdftotext`'s output, not
   the downloaded file, so the local poppler build sits inside the live arm. The
   local archive still stores exactly what was judged - which is the thing
   web.archive.org could not do, and the whole argument above - but for that one
   rung the transform upstream of it is *recorded*, as a version string, rather
   than eliminated. Section 8.3 is the authority.
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
| **Amended 2026-09-12, testimonium 0.2.0 section 5.3:** `norm` and `defaultFetcher` are now runtime exports from `src/index.ts` - `norm` as a documented compatibility surface, `defaultFetcher` so a caller can wrap or compose the bundled ladder; `toText`, `isPdf`, and the per-host helpers stay genuinely sealed | 5.1, 5.3 |
| Three layers: fetcher, pure classifier, pure ladder reducer | 5 |
| Burden-of-proof inversion; a veto withholds an accusation from the read it vetoes, and can supply one from a later readable read through the union | 6, 6.3 |
| Accusation requires body-derived proof; head markers never license one | 6.2 |
| Every N-signal vetoes, including over P1 | 6.2, 13 Q2 |
| Prose volume, not text-to-markup ratio | 6.5 |
| Calibration precedes the verdict reducer, bound by an acceptance test | 6.3 |
| `unreachable` is silent to the reader, never to the author | 6.4 |
| One readability predicate (`isReadable`), one reader (`readSource`), one aggregation; the ladder climbs unless the last read is readable | 6.6 |
| **Amended 2026-09-12, testimonium 0.2.0 section 4:** `check` may climb past a readable read when the verdict it would otherwise issue is `unsupported` and an HTML rung remains untried, via `continueReading`; `reachability` and `harvest` never set the exception and stop exactly as before | 6.6 |
| Harvest proposes only from readable reads, and only readable reads vote | 6.6, 8.2 |
| Claims below `minClaimChars` are refused, uniformly, at every entry | 7.3, 13 Q3 |
| Harvest filters: floor, cross-source frequency, author rules, already-claimed, in that order | 8.2, 13 Q5 |
| Harvest inherits the checker's exposures; "never a false `supported`" withdrawn | 8, 8.2 |
| Fetcher output type has no `ok` or `http2xx` field | 7.1 |
| Host rules are dated, additive-only, locally overridable data | 7.2 |
| Claims key by URL, with declared join semantics | 7.3 |
| Non-`supported` results carry no renderable fields | 7.4 |
| **Amended 2026-09-12, testimonium 0.2.0 section 2:** `unsupported` now carries `evidence` and `retrievedAt` for the claims that DID match; `unreachable` stays bare - we did not read the page, so there is nothing honest to render | 7.4 |
| v1 commands: `check`, `harvest`, `recheck`, `reachability` | 8 |
| Three implementation plans, not one; archive belongs to plan 3 | 8.1 |
| `recheck` exits 1 only on `L = unsupported` with `A = supported`; the "the arms differ" table is withdrawn | 8.3 |
| The archive is written by the CLI through a recording fetcher; `check()` gains no sink and stays pure | 8.3 |
| The archive stores what the classifier saw, keyed by `normalizeUrl`, hashed before gzip, and never stores `set-cookie` | 8.3 |
| No GitHub Action in v1 | 13 Q6 |
| No model in any command | 9 |
| No renderer, no cron, no storage backend in v1 | 8, 9 |
