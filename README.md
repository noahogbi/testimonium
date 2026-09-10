# testimonium

**Sourced is not supported.**

A footnote pointing at a real, live URL feels like proof. It usually is not
proof of anything except that the URL resolves. `testimonium` is a mechanism
for telling the two apart: it fetches the source a footnote cites, and checks
whether the phrase you claim it says is actually there, in the text a human
would read at that address. A claim checker, not a link checker.

It is a small, boring instrument. It does not use a model, it does not judge
truth, and it does not know what your sentence means. What it knows is
narrower and more useful than that: *this page, fetched just now, contains
this string.* Everything below is about what that narrow fact is worth, and
what it is not.

## Quickstart: a CI gate with exit codes

```
npm install
npm run build
```

Two files live beside your prose, both meant to be committed:

```
essay.md               your document, with GFM footnotes
essay.claims.json      phrases you copied, by hand, out of each cited source
```

`essay.claims.json` is keyed by the exact URL as it appears in the footnote,
each value an array of phrases that must appear verbatim (case- and
whitespace-insensitive) in the extracted text of that page:

```json
{
  "https://www.rfc-editor.org/rfc/rfc9110.html": [
    "The 404 (Not Found) status code indicates that the origin server did not find a current representation for the target resource or is not willing to disclose that one exists."
  ]
}
```

Each phrase has a floor: **16 characters once normalized**. A shorter one is
refused, by name, with its length and the floor, at every door a claim can
come through: the claims file's own loader, `check()`, and `harvest`'s first
filter, which drops such a candidate rather than proposing it. All three say
it in the same words. A bare number, a year, or a token like "the
report" is present on any page that happens to mention it, so a match on one
is a coincidence this tool cannot tell from evidence. Extend the phrase to
take in the surrounding words. The number and what licenses it are in
`docs/calibration-2026-09.md`.

Before you write a claims file at all, find out what your corpus can even
reach - this costs nothing and needs no claims:

```
node dist/bin.js reachability essay.md
```

Then run the gate:

```
node dist/bin.js check essay.md
```

```
exit 0   clean - every checkable footnote is supported
exit 1   author-fixable - something is unsupported, or unclaimed by default
exit 2   infrastructure failure - the document or claims file could not be read
```

Wire `check` into CI the way you'd wire a linter. A red run means a footnote's
claims file says something the cited page, fetched today, does not say. Fix
the phrase, fix the citation, or mark the footnote `{"notApplicable":
"<reason>"}` if it deliberately rests on something other than the cited
outlet.

Global flags: `--json`, `--rules <path>`. `check` additionally takes
`--allow-unclaimed`, `--fail-on-unreachable`, `--explain-fetch` and
`--no-archive`, and `recheck` takes `--fail-on-gone`; none of the five is
**global** - but the flag validator does not know that. It is
command-agnostic, so `harvest essay.md --fail-on-unreachable` and
`reachability essay.md --explain-fetch` are accepted and then silently
ignored: neither command consults them, and neither result type carries
fired-rule provenance to print. That gap is characterized by a test rather
than closed, because per-command flag tables would change all four commands
and nothing here yet requires them. There is no `--fetcher` flag - swapping the
fetcher (a headless browser, a paid proxy) is a programmatic option
(`CheckOptions.fetcher`), not a CLI one, because a CLI plugin registry is a
design nothing in this tool yet requires.

## A note on AI-drafted prose

This is not the headline, and that is deliberate.

Teams publishing model-drafted work have a real, live citation-fabrication
problem, and they are the most obvious audience for a tool like this. It would
be easy to lead with "catches AI citation hallucination" - and it would
overstate what the mechanism actually does.

`testimonium` checks whether a cited page contains a phrase. It does **not**
check whether that phrase supports the sentence it is attached to. For
model-drafted prose specifically, that gap is not an edge case - it is the
*default* failure mode: a model cites a real page, quotes a real sentence off
it accurately, and the sentence does not establish the point the surrounding
paragraph is making. `testimonium` will call that `supported`, because the
phrase is, in fact, on the page. The tool has no opinion on whether it belongs
in that sentence.

So: useful against fabricated URLs and invented quotes, useless against a
real quote doing the wrong job. Know which failure mode you're worried about
before you trust a green run to mean more than it does.

## What this does not do

- It does not verify that a claim is **true** - only that the cited source
  says it. A source can be wrong, and a `supported` verdict will not tell you.
- It does not stop you citing a source that is itself wrong. Garbage in,
  attested garbage out.
- It does not police whether your claim in the body matches the phrase in
  the claims file. If you write a lazy, generic phrase, you get a lazy,
  generic check - and lazy phrases are the default failure mode, especially
  for model-drafted prose (see above).
- It makes no originality or paraphrase judgment.
- It contains **no model**, anywhere, in any command. What it does *not*
  contain is the honest half of that sentence; the rest of it used to read
  "every verdict is a string search over fetched text, nothing more", and
  that was false. `supported` and the `missed` list are string searches.
  Whether a read is vetoed is decided from **seven** inputs: the HTTP status
  (404/410), a vendor challenge response header, the post-redirect URL, a
  length threshold on the extracted text, a match against the bundled
  challenge-signature list, the response's **`content-type`**, and whether
  the raw body looks like binary. The fifth of those *is* a search of the
  prose - twelve regexes over the normalized extracted text
  (`src/rules/challenge.ts`), and a hit feeds the blocked decision directly.
  The last two are **N5**, and they are independent of each other: either one
  alone vetoes the read. A vetoed read is never judged as a document; the
  ladder climbs past it, and the citation reads `unreachable` only when no
  rung produced a readable read and none matched in full (spec 6.6 rule 3;
  the ladder is under Measured limits below). A `content-type` outside the
  accepted set - any
  `text/*`, plus `application/xml`, `application/xhtml+xml`,
  `application/json`, and anything ending `+xml` or `+json` - is enough on its
  own, whatever the body turns out to contain; separately, a raw body dense
  with replacement characters and
  control codes - measured before any tag-stripping - is not prose in any
  script, since CJK, emoji and mathematical notation all sit above U+0020.
  Between them they are what stops a content-negotiated PDF from reading as a
  giant wall of "text" and turning an accurate citation into an accusation. A
  **missing** `content-type` counts as textual, and has to: the PDF rung
  returns extracted text with no headers at all, so the opposite choice would
  veto every PDF the tool can read. What none of the seven involve is a model.
- **A PDF cited from a URL carrying neither `.pdf` nor a `/pdf/` path
  segment reads as `unreachable`.** It reads that way because every
  HTML rung returns the raw bytes, N5 vetoes each read in turn, and the
  ladder runs out of rungs - where N5 fires at all: the third of N5's
  evasions, below, is an uncompressed PDF it does not catch, and that body
  is judged as text. The PDF rung has to be chosen before any fetch
  happens (see N5, above), and the URL is all that choice has to go on -
  `isPdf` recognizes a `.pdf` suffix and a `/pdf/` path segment, nothing
  else. That is a capability traded for a fix, not a free improvement:
  before N5 existed, a URL like this was fetched as HTML, a binary PDF
  stream decoded as a "document" of a million characters, and cleared every
  threshold - turning an accurate citation into a false accusation. Now the
  tool declines to judge a body it cannot first confirm is text at all. This
  does **not** mean PDFs are unsupported: `.pdf` URLs and `/pdf/`-segment
  URLs - including arxiv's content-negotiated `/pdf/<id>` links - are read
  normally. Recognizing more PDF URL shapes without a pre-fetch guess is
  future work, not done here.
- **A read whose response carries a non-textual `content-type` is vetoed,
  however readable the page.** This is the other half of the trade above,
  and it is the one that will surprise you, because nothing about the page
  looks wrong. N5's content-type trigger fires on the *header*, not on the
  body: a misconfigured server, a CDN that mislabels, or an origin that
  answers `application/octet-stream` for a document your browser renders
  happily gets declined rather than judged. Measured on the corpus's real
  Verge capture: at `text/html` it extracts 16,449 characters and reaches
  a verdict; the identical bytes under `application/octet-stream` read
  `unreachable`. The tool is refusing to accuse on a body it cannot first
  confirm is text, and the server told it the body is not text. If you
  hit this, the header is the thing to check - and `--fail-on-unreachable`
  is how you stop it passing quietly. The ladder climbs past such a read;
  if another rung returns the same bytes correctly labelled, the citation
  is judged from that read.
- **A claim that appears only inside an HTML comment can return
  `supported`.** `toText` strips tags but not comment bodies, and
  commented-out markup - which always contains a `>` - leaks into the
  extracted prose as a result. A claims-file phrase present only inside
  `<!-- ... -->`, never in anything a reader would see rendered, can
  therefore verify as `supported`: a false attestation from text no reader
  sees. Verified live on current `main`, and still open: closing it can only
  move a verdict *toward* `unsupported`, so it is a verdict change and not a
  repair, and no plan has yet taken it. It is disclosed here rather than
  promised to a plan. See `docs/calibration-2026-09.md` for how this was
  checked.
- **The audience is small**, and that is a limit, not a roadmap item - the
  way `urtext` says three of seven analyzers find nothing in a Python repo.
  Direct fit is people who already keep verbatim source quotes and are
  willing to maintain a claims file alongside their prose. That's tens of
  people, not thousands. Academics have Zotero and paywalled PDFs this
  cannot reach; legal writers have perma.cc and authenticated databases;
  newsroom fact desks verify inside closed CMSes with people, not a Node CLI.
  If that isn't your workflow, this probably isn't your tool.

## Measured limits

These are not bugs. Each one follows directly from the design, and each one
will eventually surprise a real user if it isn't said here first.

- **No read below the ~4,500-character prose floor can itself carry an
  accusation.** Below that floor, a real document is
  indistinguishable from a bot-challenge shell *by this instrument* - both
  are short - so the tool declines to accuse rather than guess, and a
  one-paragraph official notice whose claim phrase is genuinely missing
  reads `unreachable` rather than a finding against your prose. That is a
  property of the *read*, not of the citation: the HTML ladder climbs on any
  sub-floor read, so where a later rung returns a readable page the citation
  is judged from that read and can still report `unsupported` with the claim
  named - measured, a 302-character notice at `node` plus a readable page at
  `curl`. The floor bites on **accusation only**: a full match is checked
  *first* and is its own proof of a read, so a short unvetoed page whose
  claims are all present still reports `supported`.
- **A `supported` verdict therefore does not imply a 4,500-character-or-longer
  document.** If you are integrating against the evidence file, do not read
  `supported` as "we retrieved the whole article" - a paywall stub or a
  syndication teaser that happens to carry the quoted paragraph yields
  `supported` on a couple of hundred characters, and the excerpt is the only
  thing that says how much was actually there.
- **A read served at HTTP 404 or 410 is vetoed, even if its body still
  visibly carries the claim phrases.** A server is not
  authoritative about *presence* - error pages routinely serve tens of
  kilobytes of intact navigation chrome - but 404/410 is the one place a
  server *is* authoritative: it is the origin stating the resource is gone,
  and that statement is trusted over the body.
  The ladder climbs past such a read to the next rung, and that rung's read
  is judged on its own: a document gone to node and present to curl is
  judged from curl's read, and can be `supported` or `unsupported` from it.
- **A heavy-chrome error page served at HTTP 200 can evade both the status
  veto and the prose floor.** This route *is* pinned by a fixture:
  `fixtures/corpus.json` files the real ECB error capture a second time at
  status 200 (`"kind": "known-gap"`), where its 13,216 characters of intact
  navigation chrome clear the prose floor and reach an accusation. That page
  matches **none** of the twelve bundled challenge signatures - verified, 0
  of 12 - so at its real 404 the status veto is the *only* thing rejecting
  it, and nothing about the body would.
- **A gone document whose error chrome is served at 200 to a later rung
  reaches the same accusation through the ladder.** If the node rung is
  answered 404 and the curl rung is answered 200 with the same heavy chrome -
  a mirror or CDN that lost the status but kept the page - the 404 read is
  vetoed, the ladder climbs, and the 200 read is judged on its own: over the
  floor, no veto, none of the claims, `unsupported`. It is the route above
  reached indirectly, accepted for the same reason, and pinned as an
  ACCEPTED EXPOSURE in `test/check.test.ts`.
  The route is not specific to error chrome: any readable read reached after
  a vetoed or sub-floor one is judged on its own, whatever document it is -
  a soft-404 landing page, the target of a redirect after removal, a
  mirror's home page - because no signal the classifier gates on
  distinguishes the same page at 200 from a different document at 200 (the
  classifier computes slug overlap and the head markers and gates on
  neither; the GATE also never compares a read's `finalUrl` with the URL it
  was asked for, so a redirect away from the citation is observable and, in
  `check`, unobserved - a gate left unbuilt, not a limit of the signals.
  `harvest` does compare it, and reports a proposal from a read whose final
  path differs from the cited path; it gates on nothing either). A vetoed
  wall on the first rung leaves no trace on such a result beyond
  `rungsAttempted`; a sub-floor read leaves one whenever it matched a claim
  no readable read carried, since its matches still enter the union and drop
  that claim from `missed`.
  `firedRule` is the winning read's.
- **The same false accusation is reachable a second way, and that route has
  no fixture at all.** The signature list only vetoes a *short* body: above
  `THRESHOLDS.maxChallengeChars` (800 extracted characters) it stops firing,
  because a real article discussing bot walls quotes the same wording. So a
  wall that *does* carry bundled signatures, padded past the ~4,500-character
  prose floor with navigation and boilerplate, reads as a normal document and
  reports `unsupported` when its claims miss. The bundled corpus contains **no
  fixture for this route** - the largest non-vetoed challenge in it is 1,180
  characters, comfortably under the floor - so unlike the one above it is
  disclosed here and in `docs/calibration-2026-09.md`, not pinned by a test.
- **N5's binary check has three known evasions, and every one of them is a
  route to a false accusation.** All three need the same precondition: an
  absent or lying `content-type`. A server that truthfully declares a
  non-textual type is caught by N5's other trigger before the body is looked
  at, so these are the cases where the header does not help.
  1. **Printable non-prose.** The check counts replacement characters and C0
     control bytes. Base64, ASCII85 and PostScript's own text operators are
     neither - they are printable ASCII that simply is not prose. Measured
     2026-09-07: a 26,668-character body of pure base64, no headers, status
     200, is not vetoed and reaches `unsupported` against a claim it plainly
     does not contain.
  2. **Binary past the sample window.** Only the first 65,536 code points are
     scanned. Measured 2026-09-07: a 72,000-character clean prose head
     followed by a 16,000-character control-byte tail is 18% binary overall
     and measures 0 in the window, so it is not vetoed.
  3. **An uncompressed PDF that fits entirely inside the window.** Neither gap
     above covers this one - the whole body is inside the window and it does
     carry real control bytes; there are just not enough of them. Measured
     2026-09-07: 55,668 characters of PDF text operators plus one 500-character
     embedded-font binary object is density 0.00898 against a 0.01 threshold,
     so `check()` returns `unsupported` with the claim named in `missed`.
     Uncompressed content streams are an ordinary PDF shape, not an exotic one.

  None of the three is closed here, and specifically **not** by lowering the
  density threshold. That number has never been swept against real pages with
  genuinely low but non-zero binary density, so moving it would be trading a
  disclosed evasion for an undisclosed one. See `docs/calibration-2026-09.md`.
- **If a site is redesigned and now serves different prose-rich content at a
  cited URL, `testimonium` can report `unsupported`.** It verifies that the
  page *carries the phrases*, not that it is *the same page* it was when you
  wrote the citation. A site redesign and a fabricated citation look
  identical to this instrument.
- **A citation URL carrying a `#fragment` must have that same fragment on
  the key in the claims file**, or the join misses and the footnote reads as
  `unclaimed` rather than being checked.
- **`unreachable` never fails a run by default, and is never treated as a
  finding against your prose** - it's an availability fact about the fetch,
  not a credibility fact about the claim - but it is always listed, to you,
  the author. That default is a default, not an invariant:
  `--fail-on-unreachable` makes it exit 1, which is the right choice for a
  corpus you expect to be fully readable. If you cited a walled host,
  `testimonium` will not catch a fabricated claim behind that wall. It will
  tell you, honestly, that it could not look.
- **A `supported` verdict from a truncated ladder does not mean the same
  thing as one from a full ladder.** The ladder shells out: `curl` for the
  second HTML rung, and **both** `curl` and `pdftotext` for the PDF rung -
  `pdfFetch` downloads with curl before it converts, so pdftotext alone is
  not enough. On a slim container or a serverless runtime missing either
  one, `check` still runs and still exits 0 - but every PDF citation
  attempts *nothing at all*, reports `unreachable`, and passes.
  `rungsAvailable` and `ladderTruncated` are on every result for
  exactly this reason, and `check` prints "ladder truncated" beside each
  affected *unreachable* citation - a `supported` verdict reached from a
  truncated ladder prints no such note, even though the same caveat applies
  to it. If your CI image is minimal, read those fields before reading the
  exit code.

## Commands

```
testimonium check <doc.md>          the gate. exit 0 clean, 1 author-fixable, 2 infra
testimonium harvest <doc.md>        propose claims. writes a draft, never the claims file
testimonium recheck <doc.md>        drift. re-runs each claim against the live source and the archive
testimonium reachability <doc.md>   preflight. no claims file needed
```

All four read `<doc>` as GitHub-Flavored Markdown footnotes. `check` reads
`<doc>.claims.json` beside it, writes `<doc>.evidence.json`, and - for every
citation that reads `supported` - writes the bytes it read into
`<doc>.archive/`. Commit all three: the evidence file so a later re-check's
output is a diff, and the archive because a control arm that only exists on
the machine that wrote it cannot control anything on a fresh clone or in CI.
`reachability` needs none of them.
`harvest` reads `<doc>.claims.json` if it is there - to skip what you have
marked not applicable and to leave what you have already claimed alone - and
writes `<doc>.claims.draft.json`, which is not the claims file and never
becomes one without you.
`check` and `reachability` read a URL through the same fetch ladder, under the
same rules, and judge each read by the same definition of a read document, so
on the same
responses a URL `reachability` calls readable is one `check` never calls
`unreachable`, and one it calls unreadable is one `check` never calls
`unsupported` - it can still be `supported`, by a full match on a body under
the prose floor.

## Harvest: proposing claims, without proposing to trust them

The claims file is the cost. `harvest` reads your draft and every source it
cites, and proposes as candidate claims the phrases that appear verbatim in
both - the sentences you copied out while writing. It writes them to
`<doc>.claims.draft.json`. It never writes `<doc>.claims.json`.

```
node dist/bin.js harvest essay.md
node dist/bin.js harvest essay.md --json   # print the draft instead of writing it
```

There is no model in it. It fetches through the same ladder `check` uses,
proposes only from a read that cleared the same prose floor `check` demands
before it will accuse anything, and every proposal is afterwards judged by
`check` exactly as a phrase you typed by hand would be.

**What it proposes is what you COPIED, and that is not the same as what you
CLAIM.** A phrase found in both your draft and a source is evidence that a
sentence was lifted from that page. It is not evidence that the sentence is
the point of the citation. The draft file says so in its own `_note`, and
moving a proposal into your claims file is the step that makes it a claim.
Read every one against its source first.

**Harvest is not safe by construction, and inherits every exposure `check`
has.** A span common to your draft and a source is, by definition, a span
`check` will find in that source - so a page that fools the gate fools
harvest identically. The two that matter are in Measured limits above: a
heavy-chrome error page served at HTTP 200, and a page reached after a
redirect. For the second, harvest tells you: a proposal from a read whose
final path differs from the path you cited is reported as `REDIRECTED`, with
the URL it actually got. Nothing gates on it. You decide.

**Four filters, in order, and the report says what each one took.** A phrase
below the claim floor; a phrase that also appears in another source this
document cites, which is how an outlet's name, a cookie notice or a wire
story reprinted twice gets removed; a phrase matching a `boilerplate` rule in
your own `--rules` file (none ship - a bundled rule would need a date from a
live page); and a phrase you have already claimed for that URL. If your
document has fewer than two readable sources the second filter has nothing to
compare against, and the report says so in words rather than printing a zero.

**Migration.** If `check` is already refusing your claims file - for a phrase
under the floor, say - fix what it names first, then run `harvest`. Harvest
reads the existing file through the same loader with no lenient variant, so a
file `check` refuses is a file harvest refuses, with the same message and
exit 2.

Exit codes are 0 and 2 only: 0 when the draft was written or printed,
including a draft that proposes nothing, and 2 for an input it could not read
or a draft in the way that you had edited. There is no exit 1, because
harvest has no verdict to fail on.

## Recheck: what changed, and whose fault it is

`check` stores what it read. Every citation that comes back `supported` leaves
its bytes in `<doc>.archive/`, gzipped and content-addressed, beside the
verdict they produced. `recheck` then runs your claims twice: once against the
live source, and once against those stored bytes, through the same code both
times.

```
node dist/bin.js recheck essay.md
node dist/bin.js check essay.md --no-archive   # gate the document, write no archive
```

`--no-archive` suppresses the archive write and nothing else: `check` still
rewrites `<doc>.evidence.json`, exactly as it has since plan 1, so the flag
buys you a gate with no *new* output rather than a gate with no output.

**Two arms, because one is not enough to attribute anything.** The fetch layer
and the extractor evolve - that is this project's whole history - so a bare
"the verdict changed since last time" cannot tell a source that was edited from
an extractor that was improved. The stored bytes supply the control: the same
code, run over the same bytes, must still reach the same verdict. Where it does
not, the change is ours.

**Only one outcome is your problem, and `recheck` says so.** A live read that
positively failed to find a claim the stored bytes still positively prove is
**source drift**: the page changed under your citation, and exit 1 asks you to
verify it and update or remove the claim. Everything else exits 0 or 2. If the
gate still passes live and the stored bytes no longer do, that is **pipeline
drift** - a regression in this tool, exit 2, and not something to fix in your
document. If the source is unreachable now, it is listed and never failed: the
page may be perfectly intact. If the origin says 404 or 410 it is reported as
**gone since** the date that baseline was established, which exits 0 unless you
pass `--fail-on-gone`. And if you edited that URL's claims, upgraded
`pdftotext`, or changed your own `--rules` file since it was archived, the
comparison says so and compares nothing: those are **named confounds**, and
answering "did my source change?" with an accusation because you edited a claim
would be answering a question with an accusation. A source the origin reports
deleted is reported **gone** whatever else changed, with the confound named
beside it - nothing you can edit locally makes a page 404, so a claims edit
never hides a dead link or quietly switches off `--fail-on-gone`.

**`--json` carries the same gate as the terminal report.** `recheck --json`
prints `{ version, results, drift }`, where `drift` is one entry per citation.
Every entry's `missed` field is emptied unless `category` is `sourceDrift`:
the schema cannot carry an accusation past the one row licensed to make it,
so a `confounded` or `noBaseline` entry never carries a live-arm miss list
even though the underlying result did miss something.

**`recheck` never writes the archive.** Only a `supported` `check` does. A
drifted source cannot silently become its own new baseline, and there is no way
to make a drift report go away by running `recheck` again. `recheck` does
rewrite `<doc>.evidence.json`, with the live arm's results - what is true of
the source today.

**It detects change, never correctness.** A source that was already wrong when
it first read `supported` is archived wrong, and `recheck` will call it clean
for as long as it stays wrong. This is the same limit `check` has, moved
forward in time: it tells you the page still says what it said, not that what
it says is true.

**What the archive costs you.** A green `check` over an unchanged source is
free of diffs: an entry that changed in nothing material is kept exactly as it
was, so a fresh timestamp or a fresh `date` header never churns the committed
`index.json`, and `archived` dates mean "established or last materially
changed". What it does cost: it grows and nothing prunes it - re-archiving a
URL at new bytes overwrites its index entry and leaves the old blob behind, and
a page with per-request bytes - a CSRF token, a nonce, a timestamp in the
markup - hashes differently on every run and adds a blob on every `check`.
Every header the source sent is committed with it except `set-cookie`, which is
never stored in any form; if you archive an authenticated page you are
committing whatever else that host chose to return. And for a PDF what is
stored is `pdftotext`'s extracted text, not the PDF, so the archive records
which `pdftotext` produced it and treats a different one as a confound rather
than as your problem.

## What's not here

There is no renderer and no GitHub Action bundled here - `check`'s exit code is
the integration point. There is no cron, no rot score and no staleness badge
either: `recheck` is the instrument, and the drift rate across real corpora is
unmeasured, so shipping a policy on top of it would be shipping an answer this
project has not measured.

## The real cost

The claims file is hand-authored, and that is the actual cost centre of using
this tool. Where a research note already quotes sources verbatim, filling in
`essay.claims.json` is a copy-out. Where it doesn't, every claim is a fresh
read of the source. `harvest` shortens the copy-out and shortens nothing
else: paraphrase does not match by design, because a phrase that matches
loosely is a phrase that matches something the source didn't actually say,
and a proposal is not a claim until you have read it against its source and
moved it yourself.

See `docs/first-run-2026-09.md` for a worked example: four real citations,
what reachability and the gate reported, and what broke on the first honest
attempt before anything was deliberately sabotaged.

## Global constraints

Node >= 20, ESM only, zero runtime dependencies. `testimonium` itself makes
no outbound calls except to the URLs your document cites.
