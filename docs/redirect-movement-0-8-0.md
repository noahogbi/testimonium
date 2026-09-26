# What 0.8.0 moves - the redirect gate, measured

**Measured:** 2026-09-25, against `feat/0-8-0` at `22d3083` (all source changes in).
**Spec:** `docs/superpowers/specs/2026-09-25-testimonium-0-8-0-design.md`.
**Script:** `scripts/redirect-movement-0-8-0.mjs`, over the built package and the committed
recording `docs/data/redirects-2026-09-25/`.

## Result

The gate fires on **0 of 618** cited URLs, so no verdict in this corpus moves. Its effect is
pinned by constructed tests instead (below). The measurement's job was to choose the rule, and
it did: every real redirect in the corpus is a legitimate move the rule leaves alone.

## Where the judged read landed

For each URL, the read `check()` judges (the first readable read, else the last):

| landed on | URLs |
| --- | --- |
| the cited page, after ignoring scheme, `www.`, trailing slash, query, fragment and case | 603 (468 readable) |
| somewhere else | 15 (13 readable) |
| a site root | 0 |
| an ancestor of the cited path | 0 |

## The 15 redirects

Every one is the same article at a new address. None is a root or an ancestor, so `movedAway`
is false for all 15 - each is a literal case in `test/classify/moved.test.ts`.

| cited | what happened |
| --- | --- |
| euronews.com, 3 URLs | section segment (`/my-europe/`, `/next/`) dropped from the path |
| openai.com `/index/introducing-ai-futures/` | post renamed |
| openai.com `/index/economic-research-exchange/` | post renamed |
| sec.gov EDGAR filing | leading zeros stripped from the CIK path segment |
| cognition.ai, 2 URLs | domain moved to cognition.com (both read as not readable) |
| deepmind.google blog post | moved to blog.google |
| developers.openai.com Codex doc | moved to learn.chatgpt.com |
| techcrunch.com | URL date moved by a day |
| newsroom.intel.com | moved into www.intel.com's newsroom |
| assorthealth.com | `/blog/` became `/press/` |
| ilga.gov bill status | `billstatus.asp` became `BillStatus` |
| theregister.com | re-slugged under `/security/` |

Measured against the alternatives: "any path change" (harvest's report rule) would have fired
on all 15, and a cross-site clause on the 2 readable domain migrations. The ilga.gov case is
why the ancestor test requires a `/` boundary: without it, `/legislation/billstatus.asp` reads as
under `/legislation/billstatus` (a mutation of `moved.ts` that drops the boundary turns the
15-redirect test red).

## What pins the gate, since the corpus cannot

- `test/classify/moved.test.ts`: roots on the same and other hosts, ancestors, the 15 real
  redirects, same-page variants, children, cited roots, siblings, bad input, encodings.
- `test/check.test.ts`: a miss on a root redirect is `unreachable` with `redirectedTo` and
  still spends the escalation, since that keys on the verdict before the gate; a first rung
  bounced to the root while curl reads the cited page is `supported` from curl, as in 0.7.1;
  a claim found is `supported` with `redirectedTo`; with
  the accusation on the unmoved rung and curl landing on the root with more prose, the verdict
  is `unsupported` from node, with no `redirectedTo`; a redirect to another host's article still
  attests with no `redirectedTo`.
- `test/bin.test.ts`: the "moved to" and "served from" lines.

## Other checks

- **Fidelity:** `scripts/fidelity-snapshot.mjs` before the first source edit and after the
  last: byte-identical.
- **Calibration:** `calibrate.mjs` and `sweep-floor.mjs` byte-identical against a build of
  `44b196a` (0.7.1).

## Limits

- One recording, one day. These citations are at most months old, and link rot - the case the
  gate exists for - accumulates over years, so the corpus under-represents it.
- A removed page redirected to an unrelated ARTICLE path is not caught: by URL shape it cannot
  be told from the 10 legitimate same-site moves above.
- The fetch identity carried no contact address, so sec.gov-style hosts may have read as
  unreachable; that does not change where a readable read landed.
