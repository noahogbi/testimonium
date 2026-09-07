# testimonium Plan 1.1 (extraction fidelity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close two false-accusation routes that ship in `main` today, both living below the layer plan 1's sixteen reviews examined.

**Architecture:** No structural change. One new veto in the classifier, one correction to the extractor's entity table, two fixtures for body shapes the corpus has never contained, and three false comments corrected.

**Tech Stack:** TypeScript, Node >= 20, vitest. Unchanged.

**Spec:** `docs/superpowers/specs/2026-09-06-testimonium-design.md`. This plan **amends section 6.2** by adding a fifth veto.

**Base:** `main` @ `dbaa030`, 199 tests green.

## Global Constraints

- Node >= 20, ESM only. **Zero runtime dependencies.** Conventional commit prefixes.
- **THE KEYSTONE RULE:** reporting a citation `unsupported` requires positive proof the real page was read. A false accusation against an author's accurate citation is the worst outcome; a false attestation is second.
- **No unit test may touch the network.** Fixtures only.
- Every change must move a verdict toward `unreachable`, never toward `unsupported`. If a change could newly produce an accusation, stop and report.
- The corpus sweep (34 fixtures) must show **0 verdicts moved** unless a task says otherwise and says why.

---

## Why this plan exists

A fresh-eyes review of merged `main` found two defects that produce **false accusations against accurate citations**, both proven by running the real code:

**1. A content-negotiated PDF is matched as HTML.** `isPdf` (`src/fetch/pdf.ts:7`) decides by URL shape only. Its `contentType` parameter is dead — neither `check.ts` nor `reachability.ts` passes it, and nothing anywhere reads `RawResponse.headers["content-type"]`. Probed with the real bytes of `https://arxiv.org/pdf/1706.03762v7` (`content-type: application/pdf`, no `.pdf` in the path): the binary decodes to a 2.1MB string, `proseVolume` measures **1,037,512** — 230x the floor — no veto fires, and a claim the paper genuinely contains comes back **`unsupported`**. arxiv links, DOI redirects and CMS `download?id=` endpoints are first-class citation shapes.

**2. `toText` disagrees with itself, and with `norm`, about the em dash.** `&#8212;` and `&mdash;` map to `"--"`; `&#x2014;` falls through to the numeric branch and yields a literal `—`, which `norm` folds to `"-"`. Same code point, two extractions. A claim copied verbatim from a rendered page therefore matches or misses depending on how the *source markup* spelled the character. Named entities outside the small decode list are left raw, so `caf&eacute;` misses "café".

**The structural gap under both:** `toText`/`norm` and the calibration corpus jointly define what "the page's text" means, and **every fixture in that corpus is a friendly HTML page**. No PDF, no entity-heavy document, no binary body. The floor and the vetoes have never been calibrated against a body that is not text. The classifier asks "did we read a document" by prose volume and vetoes, and never asks **"is this body text at all."**

**Ordering note.** Plan 2's `harvest` proposes claims drawn from `toText` output. Shipping it against today's extractor would bake these quirks into users' committed claims files, which then break when the extractor is fixed. Extraction fidelity is a dependency of harvest, not parallel work.

---

## File Structure

```
src/classify/signals.ts     + notText derivation, content-type and binary probes
src/classify/verdict.ts     + notText in Signals and isBlocked (N5)
src/text/extract.ts         entity table corrected: named entities -> literal characters
src/fetch/pdf.ts            availability probe requires curl too; false comment corrected
src/fetch/default-fetcher.ts  pass content-type nowhere - see Task 2 note
src/classify/thresholds.ts  false comment corrected
src/rules/load.ts           false doctrine comment corrected
src/bin.ts                  reject unknown flags
fixtures/                   + a PDF binary served at 200, + an entity-heavy document
```

---

### Task 1: Entity decoding — one canonical form per character

**Files:**
- Modify: `src/text/extract.ts`
- Test: `test/text/extract.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `toText` unchanged in signature; changed in output for named entities.

**The defect.** The table maps two spellings of U+2014 to `"--"` while a third spelling reaches the numeric branch and produces the literal `—`. `norm` folds the literal to `"-"`. So `phraseFound(toText(src), claim)` depends on the source's encoding choice, which no author can see.

**The fix, and why this shape.** Named entities decode to **their literal characters**, and `norm` does all folding. One canonical form, one place that folds it. Mapping to `"--"` inside `toText` would also desynchronise `excerpt.ts`'s length-preserving `FOLD` map, which assumes one character in, one character out.

**Ordering is load-bearing.** `&amp;` must decode **last**, or `&amp;#x27;` double-decodes into an apostrophe. The current file already gets this right; preserve it.

- [ ] **Step 1: Write the failing test**

Add to `test/text/extract.test.ts`:

```ts
describe("entity decoding is canonical", () => {
  it("decodes every spelling of one code point identically", () => {
    // toText once disagreed with ITSELF: &#8212; and &mdash; became "--" while
    // &#x2014; fell through to the numeric branch and produced a literal em
    // dash, which norm folds to "-". A claim copied verbatim from a rendered
    // page then matched or missed depending on how the SOURCE markup spelled
    // the character - something no author can see.
    const forms = ["&mdash;", "&#8212;", "&#x2014;", "—"];
    const out = forms.map((f) => toText(`<p>profits${f}up sharply</p>`));
    expect(new Set(out).size, JSON.stringify(out)).toBe(1);
  });

  it("agrees with norm on every dash spelling", () => {
    for (const f of ["&mdash;", "&#8212;", "&#x2014;", "—", "&ndash;", "&#8211;", "–"]) {
      const text = toText(`<p>profits${f}up sharply</p>`);
      expect(phraseFound(text, "profits—up sharply"), f).toBe(true);
    }
  });

  it("decodes the common named entities a real page uses", () => {
    expect(toText("<p>caf&eacute;</p>")).toBe("café");
    expect(toText("<p>and so on&hellip;</p>")).toBe("and so on…");
    expect(toText("<p>a &lt; b &gt; c</p>")).toBe("a < b > c");
    expect(toText("<p>&ldquo;quoted&rdquo;</p>")).toBe("“quoted”");
  });

  it("still decodes &amp; LAST so an escaped entity does not double-decode", () => {
    // &amp;#x27; is a literal "&#x27;" on the page, not an apostrophe.
    expect(toText("<p>&amp;#x27;</p>")).toBe("&#x27;");
  });

  it("leaves an unknown entity raw rather than guessing", () => {
    expect(toText("<p>&nosuchentity;</p>")).toBe("&nosuchentity;");
  });
});
```

`phraseFound` must be imported in that file.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/text/extract.test.ts`
Expected: the first two tests FAIL — `&mdash;` yields `"--"` where `&#x2014;` yields `—`.

- [ ] **Step 3: Implement**

In `src/text/extract.ts`, replace the ad-hoc entity lines with a named table decoded before the numeric branches, keeping `&amp;` last:

```ts
/** Named entities decode to their LITERAL characters; norm() does all folding.
 *  One canonical form per code point, folded in one place.
 *
 *  Mapping an entity to a multi-character stand-in (this file once turned
 *  &mdash; into "--") makes toText disagree with itself, because the numeric
 *  branches below produce the literal character for the same code point - and
 *  it desynchronises excerpt.ts's FOLD map, which is length-preserving by
 *  construction.
 *
 *  `amp` is deliberately ABSENT: it is decoded last, separately, or
 *  "&amp;#x27;" - a literal "&#x27;" on the page - would double-decode. */
const NAMED: Readonly<Record<string, string>> = {
  lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: " ", ensp: " ", emsp: " ", thinsp: " ",
  ndash: "–", mdash: "—", minus: "−",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  hellip: "…", prime: "′", bull: "•", middot: "·",
  eacute: "é", egrave: "è", agrave: "à", ccedil: "ç",
  uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß",
  ntilde: "ñ", aacute: "á", iacute: "í", oacute: "ó",
  uacute: "ú", copy: "©", reg: "®", trade: "™",
  deg: "°", pound: "£", euro: "€", yen: "¥",
  sect: "§", para: "¶", dagger: "†", permil: "‰",
  laquo: "«", raquo: "»", times: "×", divide: "÷",
};

export function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    // Named entities EXCEPT &amp;, which must come last.
    .replace(/&([a-zA-Z][a-zA-Z0-9]{1,31});/g, (raw, name: string) => NAMED[name] ?? raw)
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (raw, h: string) => entityChar(parseInt(h, 16), raw))
    .replace(/&#(\d+);/g, (raw, d: string) => entityChar(Number(d), raw))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
```

**Write the escapes as `\uXXXX`, then byte-check.** Writing these literally has round-tripped into raw invisible characters twice on this project.

- [ ] **Step 4: Verify**

Run: `npx vitest run` and `npx tsc --noEmit`.
**Then run the corpus sweep** (`scripts/calibrate.mjs` plus a verdict comparison against pre-patch `toText`): confirm **0 verdicts moved** across all 34 fixtures. Entity decoding changes extracted text, so this is the task most likely to move one — **if a verdict moves, report it with the fixture rather than proceeding.**

- [ ] **Step 5: Commit**

```bash
git add src/text/extract.ts test/text/extract.test.ts
git commit -m "fix: one canonical form per entity, folded only by norm"
```

---

### Task 2: N5 — the body is not text

**Files:**
- Modify: `src/classify/verdict.ts`, `src/classify/signals.ts`
- Test: `test/classify/verdict.test.ts`, `test/classify/signals-nottext.test.ts` (new)

**Interfaces:**
- Consumes: `RawResponse.headers` (already threaded into `computeSignals`).
- Produces: `Signals.notText`, included in `isBlocked`.

**The defect.** The classifier asks "did we read a document" by prose volume and vetoes, and never asks whether the body is text at all. A 2.1MB PDF decoded as UTF-8 measures a million characters of "prose", clears every threshold, and turns a genuine claim into an accusation.

**The fix, and its deliberate limit.** N5 sends a non-text body to `unreachable` — the keystone's safe direction. It does **not** re-route to the pdftotext rung; that requires the ladder to revise a rung choice after a fetch, which is a redesign this plan does not attempt. **The consequence must be stated plainly in the README:** a PDF cited from a URL without `.pdf` in the path currently reads as `unreachable` rather than being verified. That is a lost capability, not a wrong answer, and it replaces a false accusation.

- [ ] **Step 1: Write the failing test**

`test/classify/signals-nottext.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeSignals } from "../../src/classify/signals.js";
import { verdict } from "../../src/classify/verdict.js";

const base = { finalUrl: "https://e.com/paper", claims: ["a phrase"], status: 200 };
const prose = `<html><body>${"Real sentences of ordinary prose. ".repeat(300)}</body></html>`;

describe("N5 - the body is not text", () => {
  it("vetoes on a non-textual content-type", () => {
    const s = computeSignals({ ...base, rawBody: prose, headers: { "content-type": "application/pdf" } });
    expect(s.signals.notText).toBe(true);
    expect(verdict(s.signals)).toBe("unreachable");
  });

  it("accepts the textual content-types a real page sends", () => {
    for (const ct of ["text/html; charset=utf-8", "text/plain", "application/xhtml+xml", "application/xml", ""]) {
      const s = computeSignals({ ...base, rawBody: prose, headers: { "content-type": ct } });
      expect(s.signals.notText, ct).toBe(false);
    }
  });

  it("vetoes a binary body even when the content-type is absent or lies", () => {
    // A server that mislabels, or a rung that reports no header at all.
    // Build the non-ASCII characters from code points. Writing them literally
    // into a plan or a test file has corrupted them twice on this project -
    // once into NUL bytes. Nothing here needs an escape sequence, so nothing
    // here can round-trip wrong.
    const REPL = String.fromCharCode(0xFFFD);
    const NL = String.fromCharCode(10);
    const binary = "%PDF-1.7" + NL + (" " + REPL + REPL).repeat(500) + "stream";
    const s = computeSignals({ ...base, rawBody: binary, headers: {} });
    expect(s.signals.notText).toBe(true);
  });

  it("does not veto ordinary prose containing a stray control character", () => {
    const s = computeSignals({ ...base, rawBody: `${prose}`, headers: { "content-type": "text/html" } });
    expect(s.signals.notText).toBe(false);
  });

  it("vetoes even a full claim match - a non-text body is not the document", () => {
    const REPL = String.fromCharCode(0xFFFD);
    const body = "%PDF-1.7 a phrase " + (" " + REPL).repeat(400);
    const s = computeSignals({ ...base, rawBody: body, headers: { "content-type": "application/pdf" } });
    expect(s.signals.matched).toBeGreaterThan(0);
    expect(verdict(s.signals)).toBe("unreachable");
  });
});
```

Add to `test/classify/verdict.test.ts`'s veto group:

```ts
  it("a non-text body vetoes, even over a full match", () => {
    expect(verdict({ ...base, matched: 3, notText: true })).toBe("unreachable");
  });
```

and add `notText: false` to that file's shared `base` object.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/classify/`
Expected: FAIL — `notText` does not exist on `Signals`.

- [ ] **Step 3: Implement**

In `src/classify/verdict.ts`, add to `Signals`:

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

and include it in `isBlocked`'s `Pick` and its disjunction.

In `src/classify/signals.ts`:

```ts
/** Content types that carry prose a reader could read. An ABSENT header is
 *  treated as textual: it is unknown, not evidence, and the body test below is
 *  what decides. Being wrong in that direction costs a wasted read; being
 *  wrong the other way would veto real documents on silent servers. */
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
 *  bytes; prose is not. Tests the RAW body, because toText's tag stripping
 *  mangles binary in ways that hide the evidence. */
function looksBinary(rawBody: string): boolean {
  if (rawBody.length === 0) return false;
  const sample = rawBody.length > 65536 ? rawBody.slice(0, 65536) : rawBody;
  let bad = 0;
  for (const ch of sample) {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 0xfffd || c === 0 || (c < 0x09) || (c > 0x0d && c < 0x20)) bad++;
  }
  return bad / sample.length > 0.01;
}
```

and in the returned signals:

```ts
      notText:
        !isTextualContentType(input.headers["content-type"]) || looksBinary(input.rawBody),
```

- [ ] **Step 4: Verify**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run build`.
**Run the corpus sweep: 0 verdicts moved.** Every fixture is HTML, so any movement means the binary probe is over-firing on real prose — **report the fixture and its measured ratio rather than raising the threshold.**

- [ ] **Step 5: Commit**

```bash
git add src/classify/verdict.ts src/classify/signals.ts test/classify/
git commit -m "feat: N5 - a body that is not text cannot be the document"
```

---

### Task 3: Fixtures for body shapes the corpus has never held

**Files:**
- Create: `fixtures/challenge/pdf-binary-served-at-200.bin`, `fixtures/documents/entity-heavy-article.html`
- Modify: `fixtures/corpus.json`, `docs/calibration-2026-09.md`

**Context.** Every one of the 34 fixtures is a friendly HTML page. The floor and the vetoes have never been calibrated against a body that is not text, or one dense with entities — which is exactly why both defects in this plan survived sixteen reviews.

- [ ] **Step 1: Write the failing test**

Add to `test/classify/corpus-verdict.test.ts`:

```ts
  it("rejects a PDF binary served at 200 with no .pdf in the url", () => {
    // The arxiv shape. Before N5 this measured over a million characters of
    // "prose", cleared every threshold, and accused an accurate citation.
    const f = corpus.find((x) => x.path.includes("pdf-binary-served-at-200"));
    expect(f, "fixture missing from corpus.json").toBeDefined();
    expect(run(f!, ["any claim at all"])).toBe("unreachable");
  });

  it("reads an entity-heavy document as a document", () => {
    const f = corpus.find((x) => x.path.includes("entity-heavy-article"));
    expect(f, "fixture missing from corpus.json").toBeDefined();
    expect(run(f!, [])).toBe("unclaimed");
  });
```

- [ ] **Step 2: Build the fixtures by hand**

- **`pdf-binary-served-at-200.bin`** — a small real PDF's bytes, or a faithful synthetic one (`%PDF-1.7` header, a `stream`/`endstream` block of binary, an `xref` table). It must be filed with `kind: "challenge"`, `status: 200`, and a `url` **without** `.pdf` in the path — that is the whole point.
- **`entity-heavy-article.html`** — a real-shaped article using `&mdash;`, `&#8212;`, `&#x2014;`, `&eacute;`, `&hellip;`, `&nbsp;`, `&amp;` and `&lt;`, long enough to clear the prose floor. `kind: "document"`.

Record both in `fixtures/corpus.json`, and add a section to `docs/calibration-2026-09.md` noting what each pins and that the corpus previously contained no non-HTML body.

- [ ] **Step 3: Verify**

Run: `npx vitest run` and the corpus sweep. The two new fixtures change the corpus size — **state the new totals** rather than matching the old figure.

- [ ] **Step 4: Commit**

```bash
git add fixtures/ docs/calibration-2026-09.md test/classify/corpus-verdict.test.ts
git commit -m "test: fixtures for a binary body and an entity-heavy document"
```

---

### Task 4: Three false comments, one false probe, one silent flag

**Files:**
- Modify: `src/classify/thresholds.ts`, `src/fetch/pdf.ts`, `src/rules/load.ts`, `src/bin.ts`, `README.md`
- Test: `test/bin.test.ts`

**Context.** Comments in this codebase are load-bearing — each records a specific defeat — so a false one is worse than none. Three are now false, and one availability probe reports a capability the machine does not have.

- [ ] **Step 1: Correct the three comments**

- `src/classify/thresholds.ts`, `slugLabelOverlap`: "Returning 0 sends that case to `unreachable`, the safe direction" — false since the signal was withdrawn from the verdict. It sends nothing anywhere. The same docstring says "THIS DOES NOT GATE" three paragraphs above; make it consistent.
- `src/fetch/pdf.ts`: "The classifier does not consult status" — false since the 404/410 veto. The conclusion (that `status: 0` is honest rather than a fabricated 200) stands; the stated reason does not.
- `src/rules/load.ts`: "a rule can only ever ADD a fetch attempt… never a wrong verdict" — true of host rules, **false of signature and path rules**, which are verdict inputs via N2 and N3. Say which is which.

- [ ] **Step 2: Fix the pdftotext probe**

`pdfFetch` downloads via **curl**, but `defaultFetcher` advertises the `pdftotext` rung whenever the binary exists. On a machine with pdftotext and no curl, every PDF attempts the rung, fails, and reports `unreachable` with **`ladderTruncated: false`** — the one field built to disclose exactly that. Require both:

```ts
if (pdftotextAvailable() && curlAvailable()) rungs.push("pdftotext");
```

with a comment saying why. Add a test asserting the rung is absent when either binary is missing (inject the probes or test the predicate directly — do not require an actual missing binary).

- [ ] **Step 3: Reject unknown flags**

`node dist/bin.js check doc.md --fail-on-unrechable` exits 0 with no complaint: a user who believes they hardened CI has not, invisibly. `bin.ts` already guards the bare-`--rules` case against this exact "silent no-op class" — generalise it. Collect the known flags, reject anything else with exit 2 and a message naming the offender. Add tests for a typo'd flag and for a valid one.

- [ ] **Step 4: README**

State N5's consequence plainly in "What this does not do": **a PDF cited from a URL with no `.pdf` in the path reads as `unreachable`** — the tool declines to judge a body it cannot confirm is text, and re-entry via the PDF rung is future work. Do not imply PDFs are unsupported generally; a `.pdf` URL still works.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run build`, and `node dist/bin.js check example/sample.md` (exit 0).

```bash
git add src test README.md
git commit -m "fix: correct three false comments, the pdftotext probe, and silent flag typos"
```

---

## Self-Review

**Coverage:** both Criticals from the fresh-eyes review are addressed — entity canonicalisation (Task 1) and the non-text veto (Task 2) — with fixtures pinning the body shapes that hid them (Task 3) and the cheap keystone hygiene alongside (Task 4).

**Deliberately NOT in this plan:** re-routing a content-negotiated PDF into the `pdftotext` rung (needs the ladder to revise a rung choice post-fetch); the `--json` stdout purity fix; `rungsAvailable` on `ReachabilityResult`; the N2-without-redirect question; per-run URL memoisation and politeness delays; case-insensitive local signature rules; HTML-comment stripping. All are recorded for plan 2.

**The risk to watch:** Task 1 changes extracted text and Task 2 adds a veto — either could move a verdict on a fixture that has always passed. Both tasks require a corpus sweep, and both say to report a moved verdict rather than tune around it.
