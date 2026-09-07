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

Global flags: `--json`, `--explain-fetch`, `--rules <path>`, and on `check`
specifically `--allow-unclaimed` and `--fail-on-unreachable`. There is no
`--fetcher` flag - swapping the fetcher (a headless browser, a paid proxy) is
a programmatic option (`CheckOptions.fetcher`), not a CLI one, because a CLI
plugin registry is a design nothing in this tool yet requires.

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
  `unreachable` is decided from **five** inputs: the HTTP status (404/410),
  a vendor challenge response header, the post-redirect URL, a length
  threshold on the extracted text, and a match against the bundled
  challenge-signature list. That fifth input *is* a search of the prose -
  twelve regexes over the normalized extracted text
  (`src/rules/challenge.ts`), and a hit feeds the blocked decision directly.
  What none of the five involve is a model.
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

- **A document extracting to fewer than ~4,500 characters of prose can never
  read as `unsupported`.** Below that floor, a real document is
  indistinguishable from a bot-challenge shell *by this instrument* - both
  are short - so the tool declines to accuse rather than guess, and a
  one-paragraph official notice whose claim phrase is genuinely missing
  reports `unreachable` instead of a finding against your prose. The floor
  bites on **accusation only**: a full match is checked *first* and is its
  own proof of a read, so a short page whose claims are all present still
  reports `supported`.
- **A `supported` verdict therefore does not imply a ≥4,500-character
  document.** If you are integrating against the evidence file, do not read
  `supported` as "we retrieved the whole article" - a paywall stub or a
  syndication teaser that happens to carry the quoted paragraph yields
  `supported` on a couple of hundred characters, and the excerpt is the only
  thing that says how much was actually there.
- **A source served at HTTP 404 or 410 reads as `unreachable`, even if its
  body still visibly carries the claim phrases.** A server is not
  authoritative about *presence* - error pages routinely serve tens of
  kilobytes of intact navigation chrome - but 404/410 is the one place a
  server *is* authoritative: it is the origin stating the resource is gone,
  and that statement is trusted over the body.
- **A heavy-chrome error page served at HTTP 200 can evade both the status
  veto and the prose floor.** This route *is* pinned by a fixture:
  `fixtures/corpus.json` files the real ECB error capture a second time at
  status 200 (`"kind": "known-gap"`), where its 13,221 characters of intact
  navigation chrome clear the prose floor and reach an accusation. That page
  matches **none** of the twelve bundled challenge signatures - verified, 0
  of 12 - so at its real 404 the status veto is the *only* thing rejecting
  it, and nothing about the body would.
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
  second HTML rung, `pdftotext` for PDFs. On a slim container or a
  serverless runtime that has neither, `check` still runs and still exits 0 -
  but every PDF citation attempts *nothing at all*, reports `unreachable`,
  and passes. `rungsAvailable` and `ladderTruncated` are on every result for
  exactly this reason, and the CLI prints "ladder truncated" beside each
  affected citation. If your CI image is minimal, read those fields before
  reading the exit code.

## Commands

```
testimonium check <doc.md>          the gate. exit 0 clean, 1 author-fixable, 2 infra
testimonium reachability <doc.md>   preflight. no claims file needed
```

Both read `<doc>` as GitHub-Flavored Markdown footnotes. `check` reads
`<doc>.claims.json` beside it and writes `<doc>.evidence.json` - commit both;
a later re-check's output is then a diff. `reachability` needs neither.

## What's not here

This is plan 1 of three. `harvest` (propose candidate claims by finding
verbatim overlap between your draft and the source, still no model) and
`recheck` (re-run the claims against the live source and an archived copy, to
tell real drift from a pipeline regression) are separate plans, not missing
features of this one. There is also no renderer and no GitHub Action bundled
here - `check`'s exit code is the integration point.

## The real cost

The claims file is hand-authored, and that is the actual cost centre of using
this tool. Where a research note already quotes sources verbatim, filling in
`essay.claims.json` is a copy-out. Where it doesn't, every claim is a fresh
read of the source. There is no shortcut in this plan - paraphrase does not
match by design, because a phrase that matches loosely is a phrase that
matches something the source didn't actually say.

See `docs/first-run-2026-09.md` for a worked example: four real citations,
what reachability and the gate reported, and what broke on the first honest
attempt before anything was deliberately sabotaged.

## Global constraints

Node >= 20, ESM only, zero runtime dependencies. `testimonium` itself makes
no outbound calls except to the URLs your document cites.
