# testimonium 0.8.0 - the redirect gate

**Status:** design, approved in conversation 2026-09-25; not yet reviewed as a written spec.
**Builds on** `v0.7.1` (`44b196a` on `main`).
**Source of the work:** `README.md:309-310`, "the GATE also never compares a read's `finalUrl`
with the URL it was asked for, so a redirect away from the citation is observable and, in
`check`, unobserved - a gate left unbuilt, not a limit of the signals."

## 1. What this fixes

A cited page that is removed and redirected to a site's homepage or section landing page is
read, judged as a document, found not to carry the claims, and reported `unsupported`: the
tool accuses the author over a page they never cited. That is a false accusation reachable on
an ordinary, well-behaved site, which the design's keystone rule
(`2026-09-06-testimonium-design.md:101-110`) ranks as the worst failure the tool can make.

`harvest()` already observes this (`src/harvest/sources.ts:143-154`, `redirectedTo`) but gates
nothing. `check()` does not observe it at all, and `test/check.test.ts:39` pins that on
purpose, asking for a spec amendment before any gate is added. This is that amendment.

## 2. What the gate does - decided

**It blocks the accusation and nothing else.** A read that moved away from the cited URL
cannot produce `unsupported`; a miss there becomes `unreachable`. A `supported` verdict on such
a read stands: the claim text is genuinely on the page the cited URL serves, which is weaker
ground than the page the author cited but not a fabrication, and omnisscientia renders only
`supported`, so gating it would silently stop attesting real citations wherever the rule is
wrong. The two rejected alternatives - gating every verdict, and reporting without gating -
are recorded in the conversation that approved this spec; neither closes the accusation route
without a cost this one avoids.

## 3. What "moved away" means - measured

### The measurement

All 618 distinct source URLs cited by published bulletin issues (the set in omnisscientia's
`docs/superpowers/worklogs/data/2026-09-13-subfloor/results.json`) were read live on
2026-09-25 through testimonium 0.7.1's own `readSource`, recording every read's `finalUrl`.
The recording and its analysis script are committed with this release (section 6). For the
read `check()` would judge - the first readable one, else the last:

| where the judged read landed | pages |
| --- | --- |
| the cited page, after ignoring scheme, `www.`, trailing slash, query, fragment and case | 603 (468 readable, 135 not) |
| same site, a different path | 10 |
| a different site | 4 (2 readable) |
| a different subdomain of the same site | 1 |
| the site root | **0** |
| an ancestor of the cited path | **0** |
| a DOI or other resolver | 0 (none cited) |

**Every one of the 15 redirects is the same article at a new address:** Euronews dropped a
section segment from its URLs, OpenAI renamed two posts, sec.gov stripped leading zeros from a
CIK, TechCrunch shifted a date, The Register re-slugged, Intel moved its newsroom, Cognition
moved `cognition.ai` to `cognition.com`, DeepMind moved a post to `blog.google`, OpenAI moved
developer docs to `learn.chatgpt.com`. The homepage failure the README names does not occur in
this corpus - these citations are at most months old, and link rot accumulates over years.

### The rule

`movedAway(cited: string, landed: string): boolean`, in a new `src/classify/moved.ts`:

1. Parse both. Either unparseable, or `landed` empty, returns `false` - no evidence of a move.
2. Normalize each path: percent-decode (falling back to the raw path if decoding throws),
   lowercase, strip trailing slashes; an empty path is `/`. Scheme, host, query and fragment
   are not compared.
3. Return `true` when **the landed path is `/` and the cited path is not**, or **the cited
   path begins with the landed path followed by `/`** (the landed path is a strict ancestor,
   `/news/2024/story` -> `/news`). Otherwise `false`.

The host is deliberately ignored: a homepage on another site is still a homepage, and an
ancestor path across a host change (`blog.e.com/2024/post` -> `e.com/2024`) is still a landing
page. Measured against the 15 real redirects above, the rule fires on **none**; any path change
(harvest's rule) would fire on all 15, and a cross-site clause on the 2 readable domain
migrations. No resolver list is needed: a DOI lands on a publisher's article path, which is
neither a root nor an ancestor.

**Known limit, stated:** a removed page redirected to an unrelated article path (not root, not
an ancestor) is not caught - it is indistinguishable by URL shape from the 10 legitimate
same-site moves measured above. It remains disclosed in the README.

## 4. Where it acts

In `check.ts` `assemble`:

- **Which read is judged.** Currently `won = proven ?? bestReadable(reads) ?? largest`. It
  becomes `proven ?? bestReadable(stayed) ?? bestReadable(reads) ?? largest`, where `stayed` is
  the reads whose `finalUrl` did not move away from the cited URL. A readable read that stayed
  is preferred to one that moved, so a genuine accusation from an unmoved rung is not lost to a
  moved one.
- **The gate.** After `verdict(...)`: if the verdict is `unsupported` and `movedAway(url,
  won.computed.finalUrl)`, the verdict is `unreachable`. `missed` is then empty, as for every
  `unreachable` (`buildResult` already gates `missed` to `unsupported`).
- `assemble` gains the cited `url` as a parameter to do this.

**Escalation is unaffected in mechanism.** `check()` climbs one more rung before accusing
(`continueReading`); a gated read is no longer an accusation, so it no longer triggers that
climb. A second rung reached for other reasons is judged by the same rule.

**`reachability()` and `harvest()` are unchanged.** Reachability accuses nobody; harvest keeps
its broader path-change report, which asks the author to look rather than deciding anything.

## 5. Reporting

- `CitationResult` gains `readonly redirectedTo?: string`: the winning read's `finalUrl`,
  present **only** when that read moved away, on any verdict. Additive. On `supported` it tells
  the author the claim was found on the page the cited URL now serves, which was not the one
  they cited.
- The CLI's `unreachable` line (`src/bin.ts:772`) becomes
  `unreachable - <url> (moved to <redirectedTo>; tried: ...)` when present. A `supported` line
  with `redirectedTo` gains `(served from <redirectedTo>)`.
- `test/check.test.ts:39` is amended as its own comment requires: its redirect goes to another
  host AND a different article path, which is not moved away, so it stays `supported` with no
  `redirectedTo`; its comment is rewritten to say the gate exists and why this case passes it.
- `README.md:309-310` stops saying the gate is unbuilt, and names the remaining limit in
  section 3.

## 6. Measurement and release

- **Committed data:** `docs/data/redirects-2026-09-25/redirects.ndjson` (618 rows, ~219 KB) and
  `analyze.mjs`, beside a short README naming the fetch date, the identity string used (no
  contact address, so sec.gov rows may read as unreachable), and that a re-run will not
  reproduce it.
- **Movement:** with the committed recording, report how many judged reads `movedAway` fires
  on (measured: 0 of 618), so no corpus verdict moves. The fixtures (`fixtures/corpus.json`)
  carry no redirects. The gate's effect is therefore pinned by constructed tests, and the
  report says so.
- **Fidelity:** `scripts/fidelity-snapshot.mjs` before the first source edit and after the
  last: byte-identical (its fetcher returns the cited URL as `finalUrl`, so no read moves).
- **Calibration:** `calibrate.mjs` and `sweep-floor.mjs` diffed against a build of `44b196a`.
- **Version:** 0.8.0 - verdicts can move from `unsupported` to `unreachable` and a result field
  is added. CHANGELOG, README, a ledger note. Do not tag, publish or push without the owner.

## 7. Acceptance criteria

1. `movedAway` returns true for: a non-root path landing on `/`; landing on `/` on another host;
   a cited path landing on its ancestor. False for: the same page with scheme, `www.`, trailing
   slash, query or case changes; each of the 15 measured redirects (as literal test cases); an
   empty or unparseable landed URL; a root cited URL landing on root.
2. A readable read that landed on the site root and misses a claim yields `unreachable` with
   `redirectedTo` set, and no `missed`.
3. The same read carrying every claim yields `supported` with `redirectedTo` set.
4. With a moved-away readable read and a larger-or-smaller stayed readable read that misses, the
   verdict is `unsupported` from the stayed read, with no `redirectedTo`.
5. The amended `check.test.ts:39` case stays `supported` with no `redirectedTo`.
6. The CLI prints the "moved to" and "served from" forms.
7. The fidelity snapshot is byte-identical; calibration output is byte-identical to 0.7.1's.
