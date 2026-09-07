# First real run

**Date:** 2026-09-07
**Document:** `example/sample.md` (four GFM footnotes)
**Command:** `npm run build && node dist/bin.js reachability example/sample.md`, then `node dist/bin.js check example/sample.md`

Every other task in this plan was verified against fixtures and stubs; nothing had
ever made a network request. This is that first request, by hand, against sources
picked for this run and read by hand to copy their claims.

## URLs used

| # | URL | Source |
|---|---|---|
| 1 | `https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/404` | MDN Web Docs |
| 2 | `https://en.wikipedia.org/wiki/HTTP_404` | Wikipedia |
| 3 | `https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/410` | MDN Web Docs |
| 4 | `https://www.rfc-editor.org/rfc/rfc9110.html` | IETF, RFC 9110 (standards body) |

All four were reachable on the first attempt; no walled or paywalled host was
encountered, so there is no "picked one, it was walled, picked another" story to
tell here - the corpus is small and every source is a stable reference page or
standards document chosen specifically to avoid that outcome.

## Reachability preflight

```
node dist/bin.js reachability example/sample.md
```

Literal output:

```
  readable    https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/404 (12164 chars via node)
  readable    https://en.wikipedia.org/wiki/HTTP_404 (16301 chars via node)
  readable    https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/410 (11161 chars via node)
  readable    https://www.rfc-editor.org/rfc/rfc9110.html (451673 chars via node)

4/4 readable (100.0%)
This is YOUR corpus's number. Do not compare it to anyone else's.
```

**4/4 readable, 100.0%.** All four were served by the `node` rung - the cheapest
rung in the ladder. `curl` and `pdftotext` are both available on this machine
(they show up in `rungsAvailable` in the evidence file below) but neither was
needed: none of the four sources returned a challenge, a non-2xx status, or
prose under the 4,500-character floor on the first attempt, so the ladder never
escalated. As the tool itself says, this 100% is this corpus's number, not a
claim about the web generally - these four sources were picked specifically for
stability (a standards body, a reference wiki, a documentation site) and
avoiding exactly the walls this tool exists to detect.

## The gate, clean

```
node dist/bin.js check example/sample.md
```

Literal output:

```
  [1] supported (1 claims) - https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/404
  [2] supported (2 claims) - https://en.wikipedia.org/wiki/HTTP_404
  [3] supported (1 claims) - https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/410
  [4] supported (2 claims) - https://www.rfc-editor.org/rfc/rfc9110.html

0 unsupported, 0 unreachable, 0 without claims
```

`echo $?` → **0**

Six claim phrases were checked across four footnotes (1 + 2 + 1 + 2). Every
footnote reports `supported`. The evidence file `example/sample.evidence.json`
records `"rung": "node"` for all six matched claims and `rungsAttempted:
["node"]` for all four sources - the first rung tried was also the last, for
every citation.

## `--explain-fetch`

```
node dist/bin.js check example/sample.md --explain-fetch
```

Output was **identical** to the plain `check` run above - no extra `rule
fired:` lines appeared for any of the four citations. That is correct, not
broken: `--explain-fetch` prints `firedRule` only when a host rule from
`src/rules/hosts.ts` matched, and the bundled rule set currently covers exactly
two hosts (`sec.gov`, which requires a declared identity, and
`bloomberg.com`, which is known hard-blocked). None of `developer.mozilla.org`,
`en.wikipedia.org`, or `www.rfc-editor.org` has a bundled rule, so there was
nothing to explain. A corpus that never touches a ruled host will always look
like this under `--explain-fetch`, and that surprised me until I read
`hosts.ts` and saw the rule set is two entries, not a general per-host
explanation of every fetch decision.

## Proving the gate can fail

`example/sample.claims.json` entry 4 (RFC 9110) was changed by one word, from:

> "The 404 (Not Found) status code indicates that the origin server did not
> find a **current** representation for the target resource or is not willing
> to disclose that one exists."

to:

> "The 404 (Not Found) status code indicates that the origin server did not
> find a **stale** representation for the target resource or is not willing
> to disclose that one exists."

Re-running `check`:

```
  [1] supported (1 claims) - https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/404
  [2] supported (2 claims) - https://en.wikipedia.org/wiki/HTTP_404
  [3] supported (1 claims) - https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/410
  [4] unsupported - https://www.rfc-editor.org/rfc/rfc9110.html
        MISS: "The 404 (Not Found) status code indicates that the origin server did not find a stale representation for the target resource or is not willing to disclose that one exists."

1 unsupported, 0 unreachable, 0 without claims
```

`echo $?` → **1**

Footnote 4 flips to `unsupported`, the altered phrase is printed under `MISS:`,
and the process exits 1. The phrase was then restored to `current` and `check`
was re-run to confirm it returns to the clean state recorded above (0
unsupported, 0 unreachable, exit 0).

## What surprised me

**The gate failed on the first real attempt, for a reason that had nothing to
do with the claim being false.** Before deliberately breaking anything, the
first honest `check` run reported footnote 2 (Wikipedia) as `unsupported`:

```
  [2] unsupported - https://en.wikipedia.org/wiki/HTTP_404
        MISS: "The code is often associated with response reason Not Found and is often referred to as page not found or file not found."
```

The phrase was copied by eye from the rendered Wikipedia article, where it
reads as ordinary prose ending "...or file not found." But Wikipedia's HTML
wraps "page not found" and "file not found" in `<i>` tags, and `src/text/
extract.ts`'s `toText` replaces each tag with a literal space - including the
`</i>` immediately before the closing period, which has no space in the
source markup. The tool's own extracted text therefore reads "...or file not
found ." - **a space before the period that no human reader of the rendered
page ever sees.** My hand-copied phrase, punctuated the way a person would
punctuate it, did not match the extracted text a machine actually produces.

This is not a bug: `toText` is a simple, honest tag-stripper, and the fix
(adding the space to the claim phrase) took one edit. But it is a sharp edge
worth recording, because it will hit any author who copies a claim by reading
a rendered page instead of by reading the tool's own extraction: **a phrase
that spans an inline-formatted word boundary (italics, bold, a hyperlink) next
to punctuation can pick up or lose whitespace that is invisible in a browser
but present in `toText`'s output.** The safest authoring practice is to copy
phrases that do not straddle such a boundary, or to keep them short enough
that punctuation stays clear of any inline markup. This cost about five
minutes to diagnose and is exactly the kind of thing a fixture-only test suite
cannot surface, because no fixture happened to have this shape.

Everything else about the run behaved exactly as documented: the reachability
preflight was free and accurate, the evidence file captured which rung read
each source, and breaking one word in one claim produced precisely one
`unsupported` footnote with the miss printed and a nonzero exit code - nothing
else changed.
