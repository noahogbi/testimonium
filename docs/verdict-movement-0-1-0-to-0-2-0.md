# Verdict movement, 0.1.0 to 0.2.0

**Date:** 2026-09-11
**Instrument:** `scripts/verdict-movement.mjs` (`node scripts/verdict-movement.mjs`)
**Inputs:** `fixtures/corpus.json` (36 rows) and `fixtures/paired/{shell-node,document-curl}.html` (Task 9's escalation fixture)
**Result:** **zero verdict movement from the corpus; one verdict move on the paired fixture** (`unsupported` -> `supported`)

## Read this section first

0.2.0's headline feature is `check()` climbing one more rung before returning
`unsupported` ("escalate before accusing", spec 0.2.0 section 4, `src/check.ts`).
**`fixtures/corpus.json` cannot exercise that feature at all.** Every row in the
corpus is one file - one body - so however many rungs the classifier tries, it
is handed the identical bytes each time, and escalating from one rung to
another cannot change what it sees. Zero movement out of the corpus below is
the EXPECTED, UNINTERESTING result of that structural fact, not evidence that
escalation is inert.

`fixtures/paired/shell-node.html` and `fixtures/paired/document-curl.html`
exist for exactly this reason: they are the two rungs of a single URL, with
DIFFERENT bodies - a JS/consent shell over the prose floor with none of the
claim, and the real document underneath it with the claim intact. That pair is
the only fixture in this repository capable of showing the movement 0.2.0 is
built to produce, and it is the only row below where a verdict moves. A report
that showed only the corpus's other deltas while implying the headline change
had been exercised would be worse than no report; it has not been exercised
here except by that one pair.

## Method

**Getting 0.1.0.** Worktree route (preferred, offline, deterministic): the
script runs `git worktree add <tmp> 47620c6` - commit `47620c6` is the exact
tree published as `testimonium@0.1.0` (npm's own `gitHead` for that version) -
then `npm ci` in the worktree, which runs the package's own `prepare` ->
`build` script. It imports that worktree's `dist/index.js` and asserts its
`VERSION` export reads `"0.1.0"` before running a single comparison; if it
does not, the script refuses to proceed rather than produce a report against
a mis-built or stale tree. Confirmed on this run:

```
0.1.0 side confirmed: VERSION = 0.1.0 (...\testimonium-0.1.0-CrDfem\dist\index.js)
```

**Getting 0.2.0.** The script also runs `npm run build` at the repo's current
HEAD (`c1ed17b`, branch `feat/0-2-0`) and imports the resulting
`dist/index.js` fresh, so "0.2.0" here means the actual current source, not a
leftover `dist/` from an earlier build. One thing worth flagging rather than
hiding: `src/version.ts`'s `VERSION` constant and `package.json`'s `version`
field both still read `"0.1.0"` at this commit - the bump to `0.2.0` has not
landed yet (it is not this task's job; see the release task). Every
behavioral comparison below is still valid, because it compares the ACTUAL
CODE at 47620c6 against the ACTUAL CODE at HEAD, not against a version
string - the string just does not yet say what the code now does.

**Amended 2026-09-12.** The release task landed after this report was
written: `src/version.ts` and `package.json` now both read `"0.2.0"`
(`chore(release): 0.2.0`, commit `9cd9bc3`). The paragraph above describes
the state at `c1ed17b`, the commit this report's comparison actually ran
against, and is left as written for that reason - the version strings have
since caught up to it.

**The claims the corpus does not carry.** `fixtures/corpus.json` rows are
`{path, kind, url, title, status}` - no claims. Calling `check(url, [])`
reads `unclaimed` on every row in BOTH versions, so "zero corpus movement"
would pass trivially without ever exercising the classifier. Every row here
is checked with one synthesized, non-empty claim:

- `document` rows get a real phrase sliced from the middle of the fixture's
  own (crudely, script-locally extracted) text - mirroring
  `test/classify/corpus-verdict.test.ts`'s own "self-generating positive
  test" approach, so the claim is something the document plausibly contains
  rather than an arbitrary fragment.
- `challenge` and `known-gap` rows get one fixed claim that is not present in
  any fixture body, mirroring the same test file's split.

The script asserts the full claim set is non-empty (37 claims: one per corpus
row plus the paired fixture's claim) before running a single comparison, and
refuses to run at all if any synthesized claim comes back empty. Confirmed on
this run:

```
Claim set confirmed non-empty: 36 corpus claims (1 per row) + 1 paired-fixture claim = 37 total. None empty.
```

**Interfaces.** The script consumes only what `src/index.ts` exports -
`check()`, `VERSION`, `norm` - from BOTH versions, and passes each row through
a hand-rolled `Fetcher` (the public `Fetcher` interface from
`src/fetch/types.ts`) that replays the fixture's own bytes instead of making a
network call, so the comparison is offline and deterministic. It never
imports an internal module (`text/extract.js`, `classify/signals.js`, etc.)
from either version - unlike the acceptance tests or this repo's other
`scripts/*.mjs` files, which are allowed to reach into `src/` because they
ship inside the same package as the code they measure. That restriction
means a working comparison is itself a demonstration that the public surface
is enough to build this kind of tool on top of.

## Corpus result: zero movement (36/36 rows unchanged)

| kind | rows | 0.1.0 verdict | 0.2.0 verdict | reason |
|---|---:|---|---|---|
| `challenge` | 25 | `unreachable` | `unreachable` | unchanged - vetoed (N4/N5/signature) before either version's climb ever reaches a second rung |
| `document` | 10 | `supported` | `supported` | unchanged - single-bodied, so the same rung finds the same self-sliced claim in both versions |
| `known-gap` | 1 | `unsupported` | `unsupported` | unchanged - the ECB capture's known exposure (see `test/classify/corpus-verdict.test.ts`'s "known gap" block); single-bodied, nothing to escalate to |

Every row, individually:

| path | kind | url | 0.1.0 | 0.2.0 | reason |
|---|---|---|---|---|---|
| fixtures/challenge/amazon-robot-check.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/anubis-foss-site-bot-wall.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/blog-cloudflare-com-cloudflare-incident-on-november-18-2025-.html | challenge | https://blog.cloudflare.com/cloudflare-incident-on-november-18-2025/ | unreachable | unreachable | unchanged |
| fixtures/challenge/bloomberg-wall.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/cloudflare-managed-challenge-ing-form.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/cloudflare-noscript-line.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/cloudflare-retired-pre-2023-wording.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/cloudflare-turnstile-checkbox-page.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/cloudflare-turnstile-cookie-privacy-boilerplate-800-chars.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/cookie-consent-wall-at-200.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/datadome-block.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/eur-lex-french.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/eurlex-202-the-fixture.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/gdpr-geo-block-at-200.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/google-sorry-page.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/imperva-incapsula.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/paywall-stub-at-200.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/pdf-binary-served-at-200.bin | challenge | https://arxiv.org/abs/2401.01234v2 | unreachable | unreachable | unchanged |
| fixtures/challenge/perimeterx-block-page.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/perimeterx-human-press-and-hold.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/soft-404-served-at-200.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/stock-react-vite-noscript-shell.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/vercel-security-checkpoint.html | challenge | (none in fixture) | unreachable | unreachable | unchanged |
| fixtures/challenge/www-ecb-europa-eu-press-pr-date-2024-html-index-en-html.html | challenge | https://www.ecb.europa.eu/press/pr/date/2024/html/index.en.html | unreachable | unreachable | unchanged |
| fixtures/challenge/www-federalregister-gov-documents-2024-01-29-2024-01580-.html | challenge | https://www.federalregister.gov/documents/2024/01/29/2024-01580/ | unreachable | unreachable | unchanged |
| fixtures/documents/apnews-com-hub-technology.html | document | https://apnews.com/hub/technology | supported | supported | unchanged |
| fixtures/documents/blog-mozilla-org-en-.html | document | https://blog.mozilla.org/en/ | supported | supported | unchanged |
| fixtures/documents/developer-mozilla-org-en-US-docs-Web-HTTP-Status.html | document | https://developer.mozilla.org/en-US/docs/Web/HTTP/Status | supported | supported | unchanged |
| fixtures/documents/docs-python-org-3-library-json-html.html | document | https://docs.python.org/3/library/json.html | supported | supported | unchanged |
| fixtures/documents/en-wikipedia-org-wiki-Textual-criticism.html | document | https://en.wikipedia.org/wiki/Textual_criticism | supported | supported | unchanged |
| fixtures/documents/entity-heavy-article.html | document | https://example.com/news/river-commission-report | supported | supported | unchanged |
| fixtures/documents/openai-com-index-gpt-4o-system-card-.html | document | https://openai.com/index/gpt-4o-system-card/ | supported | supported | unchanged |
| fixtures/documents/www-bls-gov-news-release-cpi-nr0-htm.html | document | https://www.bls.gov/news.release/cpi.nr0.htm | supported | supported | unchanged |
| fixtures/documents/www-gov-uk-government-news.html | document | https://www.gov.uk/government/news | supported | supported | unchanged |
| fixtures/documents/www-theverge-com-tech.html | document | https://www.theverge.com/tech | supported | supported | unchanged |
| fixtures/challenge/www-ecb-europa-eu-press-pr-date-2024-html-index-en-html.html | known-gap | https://www.ecb.europa.eu/press/pr/date/2024/html/index.en.html | unsupported | unsupported | unchanged |

**Why this is expected, not a null result.** Every row above is read once,
by whichever rung the ladder tries; if `check()`'s escalation logic decides a
second rung is worth trying (it does, for every row that comes back
`unsupported` on the first read - see the known-gap row, which is escalated
in both versions and still resolves to `unsupported` since the second rung
replays the identical bytes), the second read is byte-identical to the
first. There is no daylight for a two-rung feature to open on a one-rung
fixture. If a future run of this script ever DOES show corpus movement, that
is not this release's escalation feature at work - it means some other
classifier behavior changed between the two versions, and the script itself
detects that condition and exits non-zero rather than let it pass as a quiet
line item (see `scripts/verdict-movement.mjs`'s corpus-movement guard).

## Paired fixture result: one movement, and why

| path | kind | url | 0.1.0 | 0.2.0 | reason |
|---|---|---|---|---|---|
| `fixtures/paired/shell-node.html` + `fixtures/paired/document-curl.html` | paired | `https://example.com/paired-fixture-task-9` | `unsupported` | `supported` | 0.2.0 escalated past 0.1.0's ladder (`node` -> `node+curl`) before returning a verdict; 0.1.0 has no escalation and stopped at `node` |

Claim used: `"the regulator imposed a fine of 290 million euros"` - the exact
string `test/fetch/escalation.test.ts` uses for the same pair. It is absent
from `shell-node.html` (a chrome/consent shell over the 4,500-character prose
floor, carrying none of the claim) and present, verbatim, in
`document-curl.html` (the real document underneath the shell).

**What happened, rung by rung:**

- **0.1.0** (`src/check.ts` at commit `47620c6`): `node` reads the shell.
  It is over the prose floor and vetoed by nothing, so the ladder's ordinary
  climb rule treats it as "readable" and stops there. The claim is not in it,
  so the verdict is `unsupported` - against a citation whose real document,
  one rung away, actually carries the claim. `rungsAttempted: ["node"]`.
- **0.2.0** (`src/check.ts` at HEAD, `c1ed17b`): the same `node` read produces
  the same first-pass `unsupported`, but `check()` now asks
  `hasUntriedClimbableRung` (`src/fetch/ladder.ts:52`) whether an HTML rung
  is still available and untried before returning it. `curl` is, so it climbs
  once more, reads `document-curl.html`, finds the claim, and returns
  `supported`. `rungsAttempted: ["node", "curl"]`.

This is spec 0.2.0 section 4's "escalate before accusing" working exactly as
designed: `unsupported` is the only verdict that accuses an author, and the
one extra fetch is spent precisely there. The cost (one extra fetch on every
citation that reads `unsupported` after the first rung, including ordinary
misses where the claim genuinely is not on the page - see
`test/fetch/escalation.test.ts`'s "escalates on an ordinary healthy page too"
case) is accepted by the spec, not something this report is re-litigating.

## The recheck/replayFetcher interaction (for the release notes)

This is not something `scripts/verdict-movement.mjs` runs - it has no live
archive to replay against - but it is a real, code-confirmed consequence of
the same escalation feature that belongs in this report and in next task's
release notes, because it is the shape a user upgrading with an existing
`recheck` archive will actually see.

`recheck()` (`src/recheck.ts`) runs `check()` twice per citation: once over
the LIVE source, through whatever fetcher the caller/environment provides
(full rung set - `node`, `curl`, `pdftotext` where available), and once as a
control arm over the ARCHIVED bytes, through `replayFetcher(entry, loadBlob)`
(`src/archive/replay.ts`). `replayFetcher`'s rungs are **not** the machine's;
they are exactly what the archive recorded:

```ts
// src/archive/replay.ts:35
rungs: [...byRung.keys()],
```

`check()`'s escalation trigger asks `hasUntriedClimbableRung(attempted,
available, isPdfUrl)`, and `available` there is `fetcher.rungs`
(`src/fetch/ladder.ts:52-58`) - so a rung the fetcher never offers can never
be "untried and climbable," regardless of what the live ladder would have
tried. **An archive written before 0.2.0 shipped only ever recorded the
rung(s) that version's ladder actually attempted** - which, for the exact
shell-then-document shape this release targets, is `["node"]` alone, because
0.1.0's ladder stopped climbing the moment a rung was readable, whether or
not it was accusing.

The practical consequence: on the first `recheck` run after upgrading to
0.2.0, against a baseline archived under 0.1.0, the LIVE arm can escalate
(it has the full rung set) while the REPLAY/control arm, built from that same
pre-0.2.0 archive, cannot (`replayFetcher` never offers the rung the archive
did not record). That asymmetry is not a bug in either arm on its own - it is
the direct, mechanical result of `replayFetcher` faithfully replaying only
what was actually recorded, composed with a genuinely new capability on the
live side that did not exist when the recording was made. The entries where
this is visible are exactly the ones this release exists to help: citations
whose first-rung read is a shell or wall that 0.1.0 could only read as
`unsupported`. **This is the intended fix surfacing at the recheck seam, not
a defect** - but a user who runs `recheck` right after upgrading, against
baselines archived under 0.1.0, should expect to see it, and should not read
it as source drift or as recheck malfunctioning. It belongs called out in the
0.2.0 release notes.

## Reproducing this report

```
node scripts/verdict-movement.mjs
```

Self-contained: it provisions 0.1.0 into a throwaway `git worktree` at commit
`47620c6`, builds both sides, runs the comparison above, and removes the
worktree before exiting - no arguments, no network access beyond `npm ci`'s
own package resolution, no state left behind. Pass an existing 0.1.0
`dist/index.js` path as the one optional argument to skip the worktree step
during iteration.
