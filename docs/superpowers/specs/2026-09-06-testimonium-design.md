# testimonium: making "sourced" mean "supported"

**Date:** 2026-09-06
**Status:** Draft 1 - awaiting Fable review, then editor review, then `writing-plans`.
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
advised against. They are exported to the test suite through a separate internal
entry point.

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
  DataDome's abbreviated "Please enable JS", Anubis, PerimeterX, Imperva,
  Google's sorry page, Vercel's checkpoint, EUR-Lex's own wording **in French**,
  and a genuine Turnstile page padded past the 800-character cap by ordinary
  cookie boilerplate. **Zero false positives** - the exposure is entirely on the
  false-negative side.
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
POSITIVE-READ SIGNALS
  P1  At least one claim phrase matched.
      Strongest, and dominant: a challenge page does not contain the claim.
  P2  Slug/title correlation: content words from the URL path or <title>
      appear in the body above a threshold. Language-agnostic, no list to
      maintain. A challenge for /eli/reg/2024/1689 will not contain
      "artificial intelligence"; the document will.
  P3  Prose shape, computed on RAW HTML, not extracted text: text-to-markup
      ratio and sentence density above thresholds. Challenge shells are
      script-dominant with noscript fallbacks - a structural fact that
      survives every rewording and every language.
  P4  Document markers: og:type=article, json-ld with articleBody or
      datePublished.

NEGATIVE-READ SIGNALS (consulted only when P1 does not hold)
  N1  A vendor challenge header. cf-mitigated: challenge is Cloudflare's own
      documented machine-readable marker: it catches every CF variant, in
      every language, at any body length, and it is more durable than any
      copy string.
  N2  finalUrl after redirects lands on a challenge or consent path.
  N3  Challenge signature match AND body under the length cap.

VERDICT
  matched == claims.length                        -> supported
  matched >  0                                    -> unsupported   (P1 holds)
  matched == 0 && (P2|P3|P4) && !(N1|N2|N3)       -> unsupported
  matched == 0 && otherwise                       -> unreachable
```

### 6.3 What the inversion buys

**All 11 walls the battery got through degrade to `unreachable` without any of
them having been foreseen.** That is the property that matters: correctness stops
depending on the completeness of a list that provably cannot be completed.

**The signature list demotes to an optimization.** Its job becomes triggering the
curl fall-through early, not deciding a verdict. It may rot freely; the cost is
latency and reach, never truth.

**HTTP status stops mattering in both directions**, which is what the origin
spec's section 2 already concluded and the code never absorbed. `www.meta.com`
served 254,088 bytes of rendered HTML under an HTTP 400, and `news.skhynix.com`
serves a 404 as a 112,610-byte styled page. Today the curl rung refuses non-2xx
bodies outright (`source-fetch.mjs:335`), so that quarter-megabyte of readable
document is discarded. Under the inversion it becomes a confirmed read the moment
a claim matches in it.

### 6.4 What it costs, stated plainly

Fabricated claims cited to a walled host pass as `unreachable` rather than
failing the run. This is not a new weakening: `unreachable` already does not fail
a run, by the keystone rule. The inversion does not change the policy; it makes
the implementation match the policy it already claims.

**Residual risk, unresolved:** P1 dominance assumes a challenge page cannot
contain a claim phrase. A very short or generic claim could in principle match
inside a wall, producing `supported` with an excerpt drawn from a challenge page.
The excerpt would be visibly wrong to a human, and `--explain-fetch` would show
it, but nothing mechanical catches it. Mitigations to evaluate during
implementation: a minimum claim length, or refusing P1 when N1 holds. See
section 13.

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

**Rung availability is provenance.** A serverless caller has no `curl` and no
`pdftotext`, so its ladder is truncated and it will produce more `unreachable`
results. That degrades safely, but it must be *disclosed*: the result carries
which rungs were available, so an `unreachable` renders as "ladder truncated:
curl unavailable" and never as a fact about the host. This is also the mechanism
that unblocks the origin site's serverless gate.

### 7.2 Host rules and challenge signatures are data

**A rule may add a fetch attempt. It may never subtract one, and it may never
decide a verdict.** The generic ladder always runs in full. Under that contract a
stale rule costs one wasted request - latency, not correctness.

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

Phrases must come from what the **source** says, not from what the article says
about it. Matching normalizes typography and the billion/bn and million/mn
renderings; paraphrase does not match and is not meant to.

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

Global flags: `--json`, `--explain-fetch`, `--fetcher <id>`, `--rules <path>`.

**`check`** is the gate. Adapters parse the document; claims join by URL; each
source goes through `check()`; results write to the evidence file.

**`harvest`** attacks the real cost centre without crossing the refusal line. It
fetches each cited source and proposes, as candidate claims, spans that appear
**verbatim in both the draft and the source**, normalized, above a minimum
length, excluding boilerplate. It proposes; the author confirms. **No model.**

This is safe by construction: everything harvest emits goes through the same
checker, so a bad harvest produces visible misses, never a false `supported`.
Phrase matching remains the sole arbiter.

**`recheck`** is the instrument, not a policy. It re-runs each claim against the
live source and against the archived copy, and reports what changed. It ships
with no cron, no rot score, and no staleness badge, because the drift rate is
unmeasured - see section 12.

**`reachability`** needs no claims file. It fetches every cited URL and reports
what is readable, so a new user gets their own number before investing in a
claims file at all. This is the antidote to the 96.8% figure being mistaken for a
general property of the web.

**Archive on success.** When a source reads cleanly, push a snapshot to
web.archive.org and record the URL. This is not a nicety: it is what makes
`recheck` interpretable. On a failed re-check, run the same pipeline over the
archived copy - if the archive still matches, the source changed (real drift); if
the archive also misses, the extractor changed (a `toText` regression, a site
redesign). Without stored bytes, every drift alarm is confounded with the
pipeline's own evolution, and the fetch layer's history guarantees it will
evolve. Archiving must never fail a run.

**Files, versioned beside the prose:**

```
<doc>.claims.json      authored, reviewed with the piece
<doc>.evidence.json    written by check and recheck
```

Both are committed. A re-check's output is then a **diff** - which `urtext` can
review, closing the family loop.

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
rules.** The suite seeds from the 23-case battery already written
(`challenge-battery.mjs`, in this session's scratchpad), which must be carried
into the repo as the first fixture set.

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
   footnotes at minimum, plus generic HTML `<ol>`.
3. **System dependencies.** `curl` and `pdftotext` become declared rungs. Their
   absence truncates the ladder and is reported as provenance, rather than
   crashing or silently degrading.
4. **Identity.** `SEC_UA` moves to configuration (section 7.2).
5. **Editorial advice in code paths.** The Bloomberg rule moves to dated output.

**Port risk.** The fetch layer is roughly 285 lines in which nearly every line
records a specific defeat. Translating it to TypeScript is where behaviour gets
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

**P1 dominance.** See section 6.4.

**Port fidelity.** See section 11.

---

## 13. Open questions

1. **Thresholds for P2 and P3** are unmeasured. They must be calibrated against
   the fixture corpus - challenge bodies on one side, real articles on the other -
   before v1, and the calibration recorded.
2. **P1 versus N1.** Should a claim matching inside a body that carries
   `cf-mitigated: challenge` still produce `supported`? Simplicity says P1
   dominates; caution says a vendor challenge header should veto. Decide with a
   fixture, not an intuition.
3. **Minimum claim length.** A short generic phrase is both more likely to match
   spuriously and less useful as evidence. Is there a floor, and is it a warning
   or a refusal?
4. **Archive failures.** web.archive.org's save-page-now is rate-limited and
   sometimes refuses. Confirmed: this must never fail a run. Open: does a
   failed archive attempt get recorded, retried, or silently skipped?
5. **Harvest boilerplate exclusion.** Common substrings between a draft and a
   source will include navigation text, cookie notices, and the outlet's own
   name. What excludes them - a length floor, a stopword ratio, position in the
   document, or a fixture-calibrated heuristic?
6. **GitHub Action in v1?** It is the CI on-ramp and cheap, but it is also a
   second distribution surface with its own versioning discipline.

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
| Burden-of-proof inversion; signature list demoted to an optimization | 6 |
| Fetcher output type has no `ok` or `http2xx` field | 7.1 |
| Host rules are dated, additive-only, locally overridable data | 7.2 |
| Claims key by URL, not footnote ordinal | 7.3 |
| Non-`supported` results carry no renderable fields | 7.4 |
| v1 commands: `check`, `harvest`, `recheck`, `reachability` | 8 |
| No model in any command | 9 |
| No renderer, no cron, no storage backend in v1 | 8, 9 |
