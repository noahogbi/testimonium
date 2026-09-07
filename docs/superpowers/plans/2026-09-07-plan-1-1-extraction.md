# testimonium Plan 1.1 (extraction fidelity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close two false-accusation routes that ship in `main` today, both living below the layer plan 1's sixteen reviews examined.

**Architecture:** No structural change. One new veto in the classifier, one correction to the extractor's entity table, fixtures for two body shapes the corpus has never held, and the cheap keystone hygiene alongside.

**Tech Stack:** TypeScript, Node >= 20, vitest. Unchanged.

**Spec:** `docs/superpowers/specs/2026-09-06-testimonium-design.md`. This plan **amends section 6.2** by adding a fifth veto.

**Base:** `main` @ `dbaa030`, 199 tests green.

## Global Constraints

- Node >= 20, ESM only. **Zero runtime dependencies.** Conventional commit prefixes.
- **THE KEYSTONE RULE:** reporting a citation `unsupported` requires positive proof the real page was read. A false accusation against an author's accurate citation is the worst outcome; a false attestation is second.
- **No unit test may touch the network.** Fixtures only. (Task 4 has one manual live check, marked as such.)
- Every change must move a verdict toward `unreachable`, never toward `unsupported`. **If a change could newly produce an accusation, stop and report.**
- **ASCII ONLY inside code blocks.** Every non-ASCII character is written as a code point via `String.fromCodePoint`. This document corrupted itself twice while being drafted - literal U+FFFD became NUL bytes, and an escape became a real newline - and its first review found four *invisible* space literals in a table where they were indistinguishable from ASCII spaces. Prose may use ordinary punctuation; code may not.

---

## Why this plan exists

A fresh-eyes review of merged `main` found two defects that produce **false accusations against accurate citations**. A second review then verified every factual claim below by running the real code.

**1. A content-negotiated PDF is matched as HTML.** `isPdf` (`src/fetch/pdf.ts`) decides by URL shape only. Its `contentType` parameter is dead - called with one argument at `src/check.ts:69` and `src/reachability.ts:52`, and nothing in `src/` reads `headers["content-type"]`. Probed with the real bytes of `https://arxiv.org/pdf/1706.03762v7` (`content-type: application/pdf`, no `.pdf` in the path): the binary decodes to a 2.1MB string, `proseVolume` measures **1,037,512** - 230x the floor - no veto fires, and a claim the paper genuinely contains comes back **`unsupported`**.

**2. `toText` disagrees with itself about the em dash.** `&#8212;` and `&mdash;` map to `"--"`; `&#x2014;` falls through to the numeric branch and yields the literal character, which `norm` folds to `"-"`. Same code point, two extractions. A claim copied verbatim from a rendered page matches or misses depending on how the *source markup* spelled a character no author can see. Named entities outside the small decode list are left raw, so `caf&eacute;` misses the rendered word.

**The structural gap under both:** `toText`, `norm` and the calibration corpus jointly define what "the page's text" means, and **every one of the 34 fixtures is a friendly HTML page**. No PDF, no entity-heavy document, no binary body. The classifier asks "did we read a document" by prose volume and vetoes, and never asks **"is this body text at all."**

**Ordering note.** Plan 2's `harvest` proposes claims drawn from `toText` output. Shipping it against today's extractor would bake these quirks into users' committed claims files, which then break when the extractor is fixed. Extraction fidelity is a dependency of harvest, not parallel work.

---

## File Structure

```
src/text/extract.ts             entity table -> code-point map; one canonical form
src/classify/verdict.ts         + notText on Signals and in isBlocked (N5)
src/classify/signals.ts         + notText derivation: content-type and binary probes
src/reachability.ts             + an N5 branch in the reason chain (see Task 2)
src/fetch/pdf.ts                isPdf widened to /pdf/ paths; probe requires curl; comment
src/fetch/default-fetcher.ts    pdftotext rung requires curl too
src/classify/thresholds.ts      false comment corrected
src/rules/load.ts               false doctrine comment corrected
src/bin.ts                      reject unknown flags
test/classify/acceptance.test.ts  `rejected` predicate taught about N5 (see Task 3)
fixtures/                       + a PDF binary at 200, + an entity-heavy document
```

---

### Task 1: Entity decoding - one canonical form per character

**Files:** modify `src/text/extract.ts`; test `test/text/extract.test.ts`.

**The defect.** Two spellings of U+2014 map to `"--"` while a third reaches the numeric branch and produces the literal, which `norm` folds to `"-"`.

**The fix.** Named entities decode to their literal characters via a **code-point map**, and `norm` does all folding. One canonical form, one place that folds it. A multi-character stand-in would also desynchronise `excerpt.ts`'s `FOLD` map, which is length-preserving by construction.

**Ordering is load-bearing.** `&amp;` decodes **last**, or `&amp;#x27;` double-decodes. The current file gets this right; preserve it.

- [ ] **Step 1: Write the failing test**

Add to `test/text/extract.test.ts` (import `phraseFound` from `../../src/text/normalize.js`):

```ts
const CP = String.fromCodePoint;
const EM = CP(0x2014);   // em dash
const EN = CP(0x2013);   // en dash
const EACUTE = CP(0xE9); // e-acute
const HELLIP = CP(0x2026);
const LDQUO = CP(0x201C);
const RDQUO = CP(0x201D);

describe("entity decoding is canonical", () => {
  it("decodes every spelling of one code point identically", () => {
    // toText once disagreed with ITSELF: &#8212; and &mdash; became "--" while
    // &#x2014; fell through to the numeric branch and produced the literal
    // character, which norm folds to "-". A claim copied verbatim from a
    // rendered page then matched or missed depending on how the SOURCE markup
    // spelled a character no author can see.
    const forms = ["&mdash;", "&#8212;", "&#x2014;", EM];
    const out = forms.map((f) => toText("<p>profits" + f + "up sharply</p>"));
    expect(new Set(out).size, JSON.stringify(out)).toBe(1);
  });

  it("agrees with norm on every dash spelling", () => {
    for (const f of ["&mdash;", "&#8212;", "&#x2014;", EM, "&ndash;", "&#8211;", EN]) {
      const text = toText("<p>profits" + f + "up sharply</p>");
      expect(phraseFound(text, "profits" + EM + "up sharply"), f).toBe(true);
    }
  });

  it("decodes the named entities a real citation hits", () => {
    expect(toText("<p>caf&eacute;</p>")).toBe("caf" + EACUTE);
    expect(toText("<p>&Eacute;cole</p>")).toBe(CP(0xC9) + "cole");
    expect(toText("<p>fen&ecirc;tre</p>")).toBe("fen" + CP(0xEA) + "tre");
    expect(toText("<p>TNF-&alpha;</p>")).toBe("TNF-" + CP(0x3B1));
    expect(toText("<p>and so on&hellip;</p>")).toBe("and so on" + HELLIP);
    expect(toText("<p>a &lt; b &gt; c</p>")).toBe("a < b > c");
    expect(toText("<p>&ldquo;quoted&rdquo;</p>")).toBe(LDQUO + "quoted" + RDQUO);
  });

  it("still decodes &amp; LAST so an escaped entity does not double-decode", () => {
    // "&amp;#x27;" is a literal "&#x27;" on the page, not an apostrophe.
    expect(toText("<p>&amp;#x27;</p>")).toBe("&#x27;");
  });

  it("leaves an unknown entity raw rather than guessing", () => {
    expect(toText("<p>&nosuchentity;</p>")).toBe("&nosuchentity;");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/text/extract.test.ts`
Expected: the first two FAIL - `&mdash;` yields `"--"` where `&#x2014;` yields the literal character. The named-entity test fails on every entity outside the current short list.

- [ ] **Step 3: Implement**

In `src/text/extract.ts`, replace the ad-hoc entity lines with a code-point map decoded before the numeric branches, keeping `&amp;` last. **Entity names are case-sensitive**, so uppercase forms need their own rows.

```ts
/** Named entities decode to their literal characters; norm() does all folding.
 *  One canonical form per code point, folded in one place.
 *
 *  Values are CODE POINTS, not literal characters. Four of the entries below
 *  are spaces of different widths, and written literally they are
 *  indistinguishable from an ASCII space in any editor - a review of this
 *  file's own plan caught exactly that.
 *
 *  Mapping an entity to a multi-character stand-in (this file once turned
 *  &mdash; into "--") makes toText disagree with itself, because the numeric
 *  branches below produce the literal character for the same code point - and
 *  it desynchronises excerpt.ts's FOLD map, which is length-preserving.
 *
 *  `amp` is deliberately ABSENT: it decodes last, separately, or "&amp;#x27;"
 *  - a literal "&#x27;" on the page - would double-decode. */
const NAMED: Readonly<Record<string, number>> = {
  lt: 0x3c, gt: 0x3e, quot: 0x22, apos: 0x27,
  nbsp: 0xa0, ensp: 0x2002, emsp: 0x2003, thinsp: 0x2009, shy: 0xad,
  ndash: 0x2013, mdash: 0x2014, minus: 0x2212,
  lsquo: 0x2018, rsquo: 0x2019, sbquo: 0x201a,
  ldquo: 0x201c, rdquo: 0x201d, bdquo: 0x201e,
  laquo: 0xab, raquo: 0xbb, lsaquo: 0x2039, rsaquo: 0x203a,
  hellip: 0x2026, prime: 0x2032, Prime: 0x2033, bull: 0x2022, middot: 0xb7,
  dagger: 0x2020, Dagger: 0x2021, permil: 0x2030, sect: 0xa7, para: 0xb6,
  copy: 0xa9, reg: 0xae, trade: 0x2122,
  deg: 0xb0, plusmn: 0xb1, micro: 0xb5, times: 0xd7, divide: 0xf7,
  sup2: 0xb2, sup3: 0xb3, frac12: 0xbd, frac14: 0xbc, frac34: 0xbe,
  pound: 0xa3, euro: 0x20ac, yen: 0xa5, cent: 0xa2,
  aacute: 0xe1, Aacute: 0xc1, eacute: 0xe9, Eacute: 0xc9,
  iacute: 0xed, Iacute: 0xcd, oacute: 0xf3, Oacute: 0xd3,
  uacute: 0xfa, Uacute: 0xda,
  agrave: 0xe0, Agrave: 0xc0, egrave: 0xe8, Egrave: 0xc8,
  ugrave: 0xf9, ograve: 0xf2,
  acirc: 0xe2, ecirc: 0xea, icirc: 0xee, ocirc: 0xf4, ucirc: 0xfb,
  auml: 0xe4, Auml: 0xc4, euml: 0xeb, iuml: 0xef,
  ouml: 0xf6, Ouml: 0xd6, uuml: 0xfc, Uuml: 0xdc,
  ntilde: 0xf1, Ntilde: 0xd1, ccedil: 0xe7, Ccedil: 0xc7, szlig: 0xdf,
  aelig: 0xe6, oslash: 0xf8, aring: 0xe5, oelig: 0x153,
  alpha: 0x3b1, beta: 0x3b2, gamma: 0x3b3, delta: 0x3b4,
  mu: 0x3bc, sigma: 0x3c3, omega: 0x3c9, Omega: 0x3a9,
};

export function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    // Named entities EXCEPT &amp;, which must come last.
    .replace(/&([a-zA-Z][a-zA-Z0-9]{1,31});/g, (raw, name: string) => {
      const cp = NAMED[name];
      return cp === undefined ? raw : String.fromCodePoint(cp);
    })
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (raw, h: string) => entityChar(parseInt(h, 16), raw))
    .replace(/&#(\d+);/g, (raw, d: string) => entityChar(Number(d), raw))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 4: Verify, and run the corpus sweep correctly**

Run `npx vitest run` and `npx tsc --noEmit`.

**Then the sweep. `scripts/calibrate.mjs` imports from `dist/`, so it measures the OLD build unless you rebuild first** - run as written, "0 verdicts moved" is vacuously true. Do this:

1. `npm run build`.
2. Write a throwaway script in your temp directory that, for each of the 34 fixtures in `fixtures/corpus.json`, computes a verdict **twice: once through the whole patched pipeline, once through the whole `dbaa030` pipeline.** Use a claim drawn from the fixture's own extracted text, as `corpus-verdict.test.ts` does.

   **Baseline means the whole pipeline, not just `toText`.** `computeSignals` closes over its imported `toText` and takes no injection, so you cannot swap one function in. Check out `dbaa030` into a second temp directory and build it, or reconstruct the old signal derivation alongside the old extractor. At Task 2 this matters twice over: a script that swaps only `toText` would leave N5 running on **both** sides and report a vacuous 0 moved.
3. Report fixtures, comparisons, and verdicts moved.

**Expected: 0 verdicts moved.** A prior review performed this by simulation and measured 0 of 34. **If one moves, report the fixture and both verdicts rather than proceeding.**

- [ ] **Step 5: Commit** with `fix:`.

---

### Task 2: N5 - the body is not text

**Files:** modify `src/classify/verdict.ts`, `src/classify/signals.ts`, **`src/reachability.ts`**; test `test/classify/verdict.test.ts` and a new `test/classify/signals-nottext.test.ts`.

**The defect.** The classifier never asks whether the body is text at all. A PDF decoded as UTF-8 measures a million characters of "prose", clears every threshold, and turns a genuine claim into an accusation.

**The limit, deliberately.** N5 sends a non-text body to `unreachable` - the safe direction. It does **not** re-route to the `pdftotext` rung; that would break `ladder.ts`'s load-bearing contract ("pdftotext is selected by URL shape before any fetch, never as a fallback") and ripple through `Attempt`, `nextAction`, and `isLadderTruncated`'s `isPdfUrl` keying. **Task 4 states the consequence in the README.**

- [ ] **Step 1: Write the failing test**

`test/classify/signals-nottext.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeSignals } from "../../src/classify/signals.js";
import { verdict } from "../../src/classify/verdict.js";

const CP = String.fromCodePoint;
const REPL = CP(0xfffd);      // what binary looks like decoded as UTF-8
const NL = CP(0x0a);
const CTRL = CP(0x01);        // a single C0 control byte

const base = { finalUrl: "https://e.com/paper", claims: ["a phrase"], status: 200 };
const prose = "<html><body>" + "Real sentences of ordinary prose. ".repeat(300) + "</body></html>";

describe("N5 - the body is not text", () => {
  it("vetoes on a non-textual content-type", () => {
    const s = computeSignals({ ...base, rawBody: prose, headers: { "content-type": "application/pdf" } });
    expect(s.signals.notText).toBe(true);
    expect(verdict(s.signals)).toBe("unreachable");
  });

  it("accepts the textual content-types a real page sends", () => {
    for (const ct of ["text/html; charset=utf-8", "text/plain", "application/xhtml+xml", "application/xml", "application/json", ""]) {
      const s = computeSignals({ ...base, rawBody: prose, headers: { "content-type": ct } });
      expect(s.signals.notText, ct).toBe(false);
    }
  });

  it("vetoes a binary body even when the content-type is absent or lies", () => {
    const binary = "%PDF-1.7" + NL + (" " + REPL + REPL).repeat(500) + "stream";
    const s = computeSignals({ ...base, rawBody: binary, headers: {} });
    expect(s.signals.notText).toBe(true);
  });

  it("tolerates prose carrying a stray control character", () => {
    // Pins the TOLERANCE property: density below the threshold must not veto.
    // An earlier draft of this test passed a body identical to `prose` and so
    // asserted nothing.
    const s = computeSignals({ ...base, rawBody: prose + CTRL, headers: { "content-type": "text/html" } });
    expect(s.signals.notText).toBe(false);
  });

  it("does not veto scripts with no ASCII - CJK, emoji, mathematics", () => {
    const cjk = "<html><body>" + CP(0x6587) + CP(0x66F8) + CP(0x1F600) + CP(0x2211);
    const s = computeSignals({ ...base, rawBody: cjk.repeat(200), headers: {} });
    expect(s.signals.notText).toBe(false);
  });

  it("vetoes even a full claim match - a non-text body is not the document", () => {
    const body = "%PDF-1.7 a phrase " + (" " + REPL).repeat(400);
    const s = computeSignals({ ...base, rawBody: body, headers: { "content-type": "application/pdf" } });
    expect(s.signals.matched).toBeGreaterThan(0);
    expect(verdict(s.signals)).toBe("unreachable");
  });
});
```

Add to `test/classify/verdict.test.ts`'s veto group, and add `notText: false` to that file's shared `base`:

```ts
  it("a non-text body vetoes, even over a full match", () => {
    expect(verdict({ ...base, matched: 3, notText: true })).toBe("unreachable");
  });
```

- [ ] **Step 2: Run to verify it fails** - `notText` does not exist on `Signals`.

- [ ] **Step 3: Implement**

`src/classify/verdict.ts` - add to `Signals`, and to `isBlocked`'s `Pick` and disjunction:

```ts
  /** N5: the body is not text at all.
   *
   *  The other four vetoes ask whether a server or a wall stopped us. This one
   *  asks whether what came back is prose in the first place. Without it a
   *  content-negotiated PDF - an arxiv or DOI link with no ".pdf" in the path -
   *  decodes to a megabyte of "prose", clears every threshold, and turns a
   *  claim the document genuinely contains into an accusation. Measured on a
   *  real paper: 1,037,512 extracted characters, 230x the floor, no veto. */
  readonly notText: boolean;
```

`src/classify/signals.ts`:

```ts
/** Content types that carry prose a reader could read. An ABSENT header is
 *  treated as textual, and that is forced rather than merely defensible: the
 *  pdftotext rung returns `headers: {}` with real extracted text, so the
 *  opposite choice would veto every PDF the tool CAN read. */
function isTextualContentType(raw: string | undefined): boolean {
  const t = (raw ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (t === "") return true;
  return (
    t.startsWith("text/") ||
    t === "application/xhtml+xml" ||
    t === "application/xml" ||
    t === "application/json" ||
    t.endsWith("+xml") ||
    t.endsWith("+json")
  );
}

/** Binary decoded as UTF-8 is dense with replacement characters and C0 control
 *  bytes; prose is not - and no script is, since CJK, emoji and mathematical
 *  notation all sit above U+0020. Tests the RAW body: toText's tag stripping
 *  mangles binary in ways that hide the evidence. */
function looksBinary(rawBody: string): boolean {
  if (rawBody.length === 0) return false;
  const sample = rawBody.length > 65536 ? rawBody.slice(0, 65536) : rawBody;
  let bad = 0;
  for (const ch of sample) {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 0xfffd || c === 0 || c < 0x09 || (c > 0x0d && c < 0x20)) bad++;
  }
  return bad / sample.length > 0.01;
}
```

and in the returned signals:

```ts
      notText: !isTextualContentType(input.headers["content-type"]) || looksBinary(input.rawBody),
```

**`src/reachability.ts` needs an N5 branch in its reason chain.** It currently reads `gone ? ... : challenged ? "challenge interstitial" : ...`, with `challenged` fed by `isBlocked`. Without a carve-out, every preflighted PDF reports as a **challenge interstitial** - a false diagnosis of exactly the class the N4 carve-out two lines above exists to prevent. Add a branch reporting that the body was not text.

**Placement matters: the new branch must come BEFORE the `challenged` branch**, exactly as the `gone` branch does. N5 implies `isBlocked`, so a branch placed after `challenged` is unreachable - dead code that changes nothing and fails no test.

**Pin it**, or nothing catches that mistake. `test/reachability.test.ts` already has the stub-fetcher pattern; add one case: a binary body returned at 200 must produce a reason naming a non-text body, and **must not** say "challenge interstitial".

**State, do not fix, one divergence:** `reachability` escalates its ladder on `isBlocked` while `check.ts` escalates on the inline `N1 || N2 || N3`. Post-N5 the preflight will try curl on a PDF and the gate will stop after one rung. Harmless (curl returns the same bytes) and verdict-neutral. Note it in the report for plan 2 rather than changing escalation here.

- [ ] **Step 4: Verify** - `npx vitest run`, `npx tsc --noEmit`, `npm run build`, then the **same sweep procedure as Task 1 Step 4**, comparing against `dbaa030`. Every fixture is HTML, so **0 verdicts moved** is expected; a prior review measured the binary probe firing on 0 of 34 with no fixture within 10x of the threshold. **If one moves, report the fixture and its measured ratio rather than raising the threshold.**

- [ ] **Step 5: Commit** with `feat:`.

---

### Task 3: Fixtures for body shapes the corpus has never held

**Files:** create `fixtures/challenge/pdf-binary-served-at-200.bin` and `fixtures/documents/entity-heavy-article.html`; modify `fixtures/corpus.json`, **`test/classify/acceptance.test.ts`**, `test/classify/corpus-verdict.test.ts`, `docs/calibration-2026-09.md`.

**Context.** Every one of the 34 fixtures is a friendly HTML page, which is why both defects survived sixteen reviews.

- [ ] **Step 1: Teach the acceptance test about N5 - do this FIRST**

`test/classify/acceptance.test.ts`'s `rejected` predicate mirrors N4 (`documentGone`) but knows nothing of N5. A PDF fixture filed as `kind: "challenge"`, `status: 200` therefore fails both "NO challenge or error shell can reach an accusation" and the margin assertion once its stream is large enough to clear the prose floor - **measured at 4,639 characters from an 8KB stream.** Below that the floor alone rejects it, and the new fixture would pin nothing.

So: add an N5 term to the predicate, exactly as N4 has one, and **exempt N5-vetoed fixtures from the margin assertion** in the same way status-vetoed ones are exempt - the filter goes from `!documentGone(f)` to `!documentGone(f) && !notText(f)`. The margin assertion is about prose-volume separation; a fixture rejected by a veto does not need prose margin.

**Name the mechanism, or a literal executor will duplicate the probe** - the second-copy drift this codebase outlaws. `looksBinary` is module-private in Task 2's snippet and `corpus.json` carries no headers, so the test cannot call it directly. Derive the term through the real classifier instead:

```ts
const notText = (f: Fixture): boolean =>
  computeSignals({ rawBody: read(f), headers: {}, finalUrl: f.url, status: f.status, claims: [] })
    .signals.notText;
```

That reuses the shipped predicate rather than restating it, and `headers: {}` is the honest input since the corpus records no headers.

**Amending before the fixture exists is safe**: a prior review measured the N5 term firing on 0 of the existing 34 fixtures, with no fixture within 10x of the threshold.

- [ ] **Step 2: Build the fixtures by hand**

- **`pdf-binary-served-at-200.bin`** - a small real PDF's bytes or a faithful synthetic one (`%PDF-1.7` header, a `stream`/`endstream` block of binary, an `xref` table), **at least 16KB of stream**.

  The size is load-bearing and 8KB is not enough. The fixture must clear the prose floor so that **N5 rejects it and the floor does not** - otherwise it pins nothing, which is the exact failure this task exists to prevent. Measured over 200 random draws: an 8KB stream extracts a median of 4,087 characters and lands **below the 4,500 floor 75.5% of the time** (min 2,270); a 16KB stream landed below it 0 times out of 200 (min 4,938). An earlier draft said 8KB on the strength of one lucky draw of 4,639.

  Because it would fail silently - N5 fires either way in the corpus test's `headers: {}` context, so every test stays green - **pin the property rather than trusting the build**. In the PDF test below, assert the fixture actually clears the floor:

  ```ts
  expect(
    proseVolume(toText(readFileSync(f!.path, "utf8"))),
    "fixture must be rejected by N5, not by the prose floor",
  ).toBeGreaterThanOrEqual(THRESHOLDS.minProseChars);
  ```

  File it `kind: "challenge"`, `status: 200`, and a `url` with **no `.pdf` and no `/pdf/` segment in the path** - that is the whole point, and Task 4 widens the URL heuristic to catch `/pdf/`.
- **`entity-heavy-article.html`** - a real-shaped article using `&mdash;`, `&#8212;`, `&#x2014;`, `&eacute;`, `&Eacute;`, `&hellip;`, `&nbsp;`, `&amp;` and `&lt;`, long enough to clear the prose floor. `kind: "document"`.

Record both in `fixtures/corpus.json` and add a section to `docs/calibration-2026-09.md` noting what each pins and that the corpus previously held no non-HTML body.

- [ ] **Step 3: Write the tests**

In `test/classify/corpus-verdict.test.ts`:

```ts
  it("rejects a PDF binary served at 200 with no .pdf in the url", () => {
    // The arxiv shape. Before N5 this measured over a million characters of
    // "prose", cleared every threshold, and accused an accurate citation.
    const f = corpus.find((x) => x.path.includes("pdf-binary-served-at-200"));
    expect(f, "fixture missing from corpus.json").toBeDefined();
    expect(run(f!, ["any claim at all"])).toBe("unreachable");
  });

  it("reads an entity-heavy document and supports a claim in its RENDERED form", () => {
    // NOT `run(f, [])`: verdict() returns "unclaimed" on total === 0 before any
    // veto, so that would pass for any input including a challenge shell - the
    // test-that-asserts-nothing shape this file already warns about. The claim
    // below is written as a reader sees it; the fixture spells it with
    // entities. This is the only end-to-end pin of Task 1.
    const f = corpus.find((x) => x.path.includes("entity-heavy-article"));
    expect(f, "fixture missing from corpus.json").toBeDefined();
    expect(run(f!, [RENDERED_CLAIM])).toBe("supported");
  });
```

Define `RENDERED_CLAIM` with `String.fromCodePoint` for its non-ASCII characters, and put the entity spellings of the same sentence in the fixture.

- [ ] **Step 4: Verify** - `npx vitest run`. The corpus grows by two, so **state the new totals** rather than matching the old figure.

- [ ] **Step 5: Commit** with `test:`.

---

### Task 4: One cheap recovery, three false comments, one false probe, one silent flag

**Files:** modify `src/fetch/pdf.ts`, `src/fetch/default-fetcher.ts`, `src/classify/thresholds.ts`, `src/rules/load.ts`, `src/bin.ts`, `README.md`; test `test/bin.test.ts`, `test/fetch/`.

- [ ] **Step 1: Recover the arxiv case pre-fetch**

N5 makes a content-negotiated PDF `unreachable` rather than verified. One cheap widening recovers the named case without touching the ladder: **`arxiv.org/pdf/1706.03762v7` has `/pdf/` in the path.** Widen `isPdf`'s URL heuristic to treat a `/pdf/` path segment as a PDF, so the rung is chosen before the fetch, as `ladder.ts` requires. Worst case it is wrong and the body is HTML, which reads as `unreachable` - never an accusation. Add tests for `/pdf/` paths, a `.pdf` suffix, and a URL containing "pdf" only as a substring of a word (must NOT match).

- [ ] **Step 2: Correct three false comments**

- `src/classify/thresholds.ts`, `slugLabelOverlap`: "Returning 0 sends that case to `unreachable`, the safe direction" - false since the signal was withdrawn from the verdict; it sends nothing anywhere. The same docstring says "THIS DOES NOT GATE" three paragraphs above.
- `src/fetch/pdf.ts`: "The classifier does not consult status" - false since N4. The conclusion (that `status: 0` is honest rather than a fabricated 200) stands; the reason does not.
- `src/rules/load.ts`: "a rule can only ever ADD a fetch attempt... never a wrong verdict" - true of host rules, **false of signature and path rules**, which are verdict inputs via N2 and N3.

**`thresholds.ts`'s calibration docstring needs re-scoping, not leaving alone.** Its "33-fixture corpus" figure is correct *today* (24 + 9; the known-gap row is excluded from both `calibrate.mjs` and the acceptance test) - but Task 3 adds two fixtures, so after this plan it reads false, which is the very sin this step exists to punish. Two claims go stale together:

- "the largest challenge shell **that N4 does not veto** is 1,180 chars" - the new PDF fixture is a challenge N4 does not veto either; **N5** does. Amend to "that no veto rejects", or name both vetoes.
- the corpus count - update it, and check whether the entity-heavy article changes "smallest real document is 6,858".

Do this **after** Task 3 so the numbers are real, and re-run `scripts/calibrate.mjs` to get them rather than arithmetic.

- [ ] **Step 3: Fix the pdftotext probe**

`pdfFetch` downloads via **curl**, but `defaultFetcher` advertises the rung on `pdftotextAvailable()` alone. On a machine with pdftotext and no curl every PDF attempts the rung, fails, and reports `unreachable` with **`ladderTruncated: false`** - the one field built to disclose exactly that. Require both binaries. To make it testable, extract the predicate rather than leaving it an inline `&&`, and test the predicate directly - do not require an actually-missing binary.

- [ ] **Step 4: Reject unknown flags**

`node dist/bin.js check doc.md --fail-on-unrechable` exits 0 with no complaint: a user who believes they hardened CI has not, invisibly. `bin.ts` already guards the bare-`--rules` case against this same silent-no-op class. Collect the known flags, reject anything else with exit 2 naming the offender. **`main()` is not exported**, so export a small `validateFlags(argv)` and test that directly rather than spawning a process.

- [ ] **Step 5: README**

Two additions to "What this does not do":

1. **A PDF cited from a URL with neither `.pdf` nor a `/pdf/` path segment reads as `unreachable`.** The tool declines to judge a body it cannot confirm is text. Re-entry via the PDF rung is future work. Do not imply PDFs are unsupported generally.
2. **A claim that appears only inside an HTML comment can return `supported`.** Verified live on current `main`: `toText` strips tags but not comment bodies, so commented-out markup - which always contains `>` - leaks into extracted prose. That is a false attestation from text no reader sees. It is disclosed rather than fixed here because fixing it can move a verdict *toward* `unsupported`, which this plan's constraints forbid; it is plan 2 work. Record it beside the existing known-gap in `docs/calibration-2026-09.md` too.

- [ ] **Step 6: Verify and commit**

`npx vitest run`, `npx tsc --noEmit`, `npm run build`. Then **manually** (this one touches the network and rewrites `example/sample.evidence.json`): `node dist/bin.js check example/sample.md` must exit 0. Restore that file to HEAD afterwards. Commit with `fix:`.

---

## Self-Review

**Coverage:** both Criticals are addressed - entity canonicalisation (Task 1) and the non-text veto (Task 2) - with fixtures pinning the body shapes that hid them (Task 3), the arxiv case recovered cheaply, and the keystone hygiene alongside (Task 4).

**Deliberately NOT in this plan, and why:** true PDF re-routing (breaks the ladder's before-any-fetch contract); HTML-comment stripping (can move a verdict toward `unsupported`; **disclosed** in Task 4 Step 5 instead); `--json` stdout purity; `rungsAvailable` on `ReachabilityResult`; the N2-without-redirect question; per-run URL memoisation and politeness delays; case-insensitive local signature rules; `&shy;` in `norm()`; and an all-ASCII non-prose body (ASCII85/base64) under a textual content-type, which evades both N5 probes - record that beside the known-gap.

**The risk to watch:** Task 1 changes extracted text and Task 2 adds a veto. Either could move a verdict. Both require the sweep, both must **build first** or the sweep measures the old code, and both say to report a moved verdict rather than tune around it.
