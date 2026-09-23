import { THRESHOLDS } from "../classify/thresholds.js";
import { foldWithMap } from "../text/excerpt.js";
import { norm } from "../text/normalize.js";

export interface SpanResult {
  /** Proposals, in source order, cut from the SOURCE's typography. Each is a
   *  whole-word run with its whitespace collapsed, none contained in another,
   *  and none beginning or ending on half of a surrogate pair. */
  readonly spans: string[];
  /** Spans dropped by a self-validation failure, one line each naming what
   *  failed. The span is not proposed - a span that cannot be shown to be
   *  what the source says must not reach the author - and no entry here is
   *  ever counted as a filter's work or allowed to change an exit code (spec
   *  8.2 step 4; Fable F3c).
   *
   *  NOT EVERY ENTRY IS A BUG, which is why each line now says which it is.
   *  Spec 8.2 step 4 used to call the three assertions "each a bug if it
   *  fails"; measured 2026-09-09 that is FALSE of assertion 1 and half
   *  true of assertion 2, because `norm()` applies four digit-magnitude
   *  rewrites `foldWithMap` deliberately does not, and their input can
   *  straddle a span's edge on a page that is working perfectly. The DROPS
   *  are correct and stay - see `normBoundaryNote` for why - but the LABEL
   *  was wrong, and a real offset-map fault was invisible inside a routine
   *  boundary effect. The spec was amended to agree with this file on
   *  2026-09-09; step 4 now says which assertion is which. A caller must NOT
   *  print a blanket `BUG:` prefix over this list; each line carries its own
   *  reading.
   *
   *  Five conditions can land here: spec 8.2 step 4's THREE assertions
   *  (present in the source, present in the document, and the fold round trip
   *  that catches a shifted offset map), plus two guards for faults that
   *  strike BEFORE those assertions can run - an offset map shorter than the
   *  span, and a slice that collapses to nothing. Those two would otherwise
   *  `continue` silently, and an unreported drop is indistinguishable from a
   *  span that was never found, which is the one outcome that would make a bug
   *  in this file invisible.
   *
   *  ONE drop is deliberately NOT reported here: `e <= s`, when the trims
   *  have consumed the whole match. THREE kinds of trim narrow `[s, e)`
   *  before that test, each running at both ends - the word-boundary snap,
   *  the astral-half trim and the space trim - and the branch belongs to all
   *  of them, not to the snap alone (it named only the snap until
   *  2026-09-09, which was incomplete rather than false). Each is the trim
   *  WORKING: a seed landing mid-token, a divergence between the halves of
   *  one astral character, a run that is whitespace once its boundaries have
   *  been snapped off. Reporting any of them would fill `bugs` with noise and
   *  destroy the signal the rest of this list carries. */
  readonly bugs: string[];
}

/**
 * Assertion 1's line. NOT a bug, and it must not read like one.
 *
 * `norm()` applies four rewrites `foldWithMap` deliberately omits, because
 * they change length and the offset map cannot survive that: the
 * digit-magnitude pair `(\d)\s*billion -> $1bn` and `(\d)\s*million -> $1mn`
 * and their two `bn`/`mn` siblings. Their input can straddle a span's edge. A
 * source reading "spent 6 billion dollars" against a draft reading "spent 7
 * billion dollars" snaps the left boundary past the differing digit onto
 * "billion", and `norm(span)` is then absent from `norm(sourceText)`, which
 * holds "6bn". The page is working perfectly; nothing is broken.
 *
 * SINCE TASK 5, `sourceText` HERE IS ONE REGION, NEVER A READ'S FLAT,
 * JOINED `text`. `harvest()` calls `commonSpans` once per element of
 * `read.regions` (src/harvest.ts), specifically so a span can never be
 * built by extending across the join between two regions - so this is NOT a
 * new failure path opened by that change, it is the same proof, restated
 * over a narrower `sourceText`. A digit-magnitude straddle can no longer
 * arise AT a region boundary - "spent 6" ending one region and "billion
 * dollars" opening the next is exactly the join-crossing run Task 5 exists
 * to stop proposing, so it never reaches this function to straddle anything.
 * It still arises WITHIN a region exactly as before: a single body paragraph
 * or a single description value can itself contain the digit and the
 * magnitude word close enough together to straddle a span's edge, and the
 * proof below does not depend on which substring of the page `sourceText`
 * happens to be.
 *
 * THIS IS THE ONLY WAY ASSERTION 1 CAN FAIL. The span is `sourceText.slice`d
 * through the map, so it is a raw substring of the source whatever the map
 * says - a wrong offset yields a DIFFERENT substring, never a non-substring -
 * and `norm` is deterministic, so the only remaining freedom is its own
 * context sensitivity. Measured 2026-09-09: with `foldWithMap`'s map shifted
 * by one, assertion 1 did not fire on a fixture with no magnitude word, and
 * assertion 2 caught the shift.
 *
 * THE DROP IS CORRECT AND STAYS (controller ruling, fix round 1). Assertion 1
 * asks whether `phraseFound` will locate the span, and `check()` uses that
 * same predicate, so a span failing it could never be verified afterwards -
 * proposing it would set the author up for a false accusation against her own
 * citation. What was wrong was the label, not the behaviour.
 */
export function normBoundaryNote(span: string): string {
  return (
    `NOT A BUG, a norm() boundary: this span is verbatim in the source, but ` +
    `norm() rewrites the source's copy of it differently (a digit-magnitude ` +
    `rule such as "6 billion" -> "6bn"), so check() could not find it either. ` +
    `Dropped rather than proposed: ${JSON.stringify(span)}`
  );
}

/**
 * Assertion 2's line, which can be EITHER a bug or the same boundary effect
 * on the DOCUMENT's side.
 *
 * A BUG: `norm()` and this file's fold table drifting apart, which has
 * happened three times, and - measured 2026-09-09 - a shifted offset map,
 * which reaches this assertion before assertion 3 does.
 *
 * NOT A BUG: a source spelling a magnitude in words against a draft spelling
 * it in digits. "The agency spent seven billion dollars on procurement"
 * against "the agency spent 7 billion dollars on procurement" proposes the
 * span "billion dollars on procurement across every department", which is in
 * `norm(sourceText)` (no digit precedes "billion" there, so nothing is
 * rewritten) and absent from `norm(docProse)`, which holds "7bn". Measured
 * 2026-09-09; the fixture is in test/harvest.test.ts.
 *
 * This code cannot tell the two apart without cutting the document's own
 * slice back through `doc.map` and re-testing it, which fix round 1 is not
 * adding this late. So the line names both readings rather than asserting the
 * wrong one - the whole finding here was a message that read as a certainty
 * it did not have.
 */
export function documentMismatchNote(span: string): string {
  return (
    `not found in the document - a BUG if norm() and the fold table have ` +
    `drifted apart, NOT a bug if a digit-magnitude rewrite straddles this ` +
    `span's edge: ${JSON.stringify(span)}`
  );
}

/**
 * First occurrence of every seed-length gram of the folded document.
 *
 * Built once per prepared draft (`prepareDraft`) so that the scan over the
 * source is a map lookup per position instead of an `indexOf` over the whole
 * document - which is what spec 8.2 step 3 means by a pass "linear in the
 * source". Indexing EVERY occurrence would make the inner step a walk over an
 * occurrence list, which is quadratic on a source and a document that both
 * repeat.
 *
 * FIRST OCCURRENCE ONLY, and what that costs is measured rather than argued.
 * Against the 45 unrelated pairs of the 10 `document` fixtures, indexing every
 * occurrence and taking the longest extension reproduces this one's counts
 * EXACTLY at L = 20, 21, 22, 23, 24, 25 and 30 - the whole 20..25 band
 * `harvestSeedChars` is chosen from, the shipped 21 included - and differs
 * only far below it, at L=13 (above-floor mean 2.2 against 2.0, max 20 against
 * 15) and L=16 (2.3 against 2.2, max 21 against 19). Measured 2026-09-09; the
 * sweep in `scripts/calibrate-harvest-seed.mjs` is the L=first column of it.
 *
 * So the exposure is a MISS, at seed lengths this tool does not ship, and
 * never a false proposal. What is NOT true - and the L=13 row is the claim
 * measured false - is that the containment drop below always recovers what a
 * later occurrence would have added.
 */
function seedIndex(folded: string, seedChars: number): Map<string, number> {
  const index = new Map<string, number>();
  for (let i = 0; i + seedChars <= folded.length; i++) {
    const gram = folded.slice(i, i + seedChars);
    if (!index.has(gram)) index.set(gram, i);
  }
  return index;
}

/** A word character in fold space. A token ends at punctuation as well as at
 *  a space, so "quarter." is a whole word and the snap must not treat the
 *  full stop as evidence that "quarter" was cut in half. */
const WORD = /[\p{L}\p{N}]/u;

const wordAt = (text: string, i: number): boolean =>
  i >= 0 && i < text.length && WORD.test(text[i] as string);

/**
 * The spans that appear verbatim in both texts, normalized - the candidate
 * claims of spec 8.2 step 3.
 *
 * Both texts are folded with `foldWithMap`, which returns the folded text and
 * one source offset per folded code unit. Seeds are the seed-length grams of
 * the folded source that occur in the folded document; each is extended left
 * and right while the two agree, snapped inward to word boundaries, cut from
 * the SOURCE through the offset map, and its whitespace collapsed. A span
 * contained in one already emitted is dropped, and the scan resumes past the
 * span just extended, so the pass is linear in the source.
 *
 * Proposals are cut from the source, not the document, because a claim must
 * be what the source SAYS (spec 7.3) - the author's draft may have retyped a
 * dash or a quote, and a claim in the draft's typography would be a claim the
 * source does not carry.
 *
 * `seedChars` exists for `scripts/calibrate-harvest-seed.mjs`, which sweeps
 * it. Nothing in `src/` passes it: the shipped value is the calibrated one.
 *
 * `harvest()` calls `spansAgainst` over one `prepareDraft` instead, so the
 * draft is folded and indexed once per run.
 */
export function commonSpans(
  docProse: string,
  sourceText: string,
  seedChars: number = THRESHOLDS.harvestSeedChars,
): SpanResult {
  return spansAgainst(prepareDraft(docProse, seedChars), sourceText);
}

/** The draft side of `commonSpans`, computed once. The draft is constant
 *  across a `harvest()` run, while `commonSpans` is called once per region,
 *  per read, per source; before 0.6.2 each of those calls re-folded the draft,
 *  rebuilt its seed index and re-normalized it. `harvest()` prepares it once
 *  and calls `spansAgainst` per region. */
export interface PreparedDraft {
  readonly seedChars: number;
  readonly doc: ReturnType<typeof foldWithMap>;
  readonly index: Map<string, number>;
  /** `norm(docProse)`: `phraseFound`'s haystack side for the draft, hoisted -
   *  see the note in `spansAgainst` where `normSource` is bound. */
  readonly normDoc: string;
}

export function prepareDraft(docProse: string, seedChars: number = THRESHOLDS.harvestSeedChars): PreparedDraft {
  const doc = foldWithMap(docProse);
  return {
    seedChars,
    doc,
    index: seedChars > 0 ? seedIndex(doc.folded, seedChars) : new Map(),
    normDoc: norm(docProse),
  };
}

/** `commonSpans` over a prepared draft. See `commonSpans` for the contract. */
export function spansAgainst(draft: PreparedDraft, sourceText: string): SpanResult {
  const candidates: string[] = [];
  const bugs: string[] = [];
  const { seedChars, doc, index, normDoc } = draft;
  if (seedChars <= 0) return { spans: [], bugs };

  const src = foldWithMap(sourceText);

  // Spec 8.2 step 3, last clause: "`norm(text)` is computed once per read and
  // reused by every filter; it is not recomputed per span." `phraseFound(h, p)`
  // is `norm(h).includes(norm(p))`, so calling it per candidate re-normalizes
  // the WHOLE source and the WHOLE document once for every proposal.
  // `normSource` here and `normDoc` on the prepared draft are that same rule
  // with the haystack side hoisted: a MEMOIZATION of `phraseFound`, not a
  // second definition of it.
  //
  // Inlining a rule is how the fold table drifted from `norm()` three times, so
  // the equivalence is pinned rather than asserted in a comment:
  // `test/harvest/spans.test.ts` checks `normSource.includes(norm(span))`
  // against `phraseFound(sourceText, span)` over case folding, a soft hyphen,
  // curly quotes, a Unicode dash and the rest of `norm()`'s clauses. A future
  // change to `phraseFound` or to `norm` breaks a red test instead of silently
  // diverging from what `check()` will do.
  const normSource = norm(sourceText);

  let i = 0;
  while (i + seedChars <= src.folded.length) {
    const at = index.get(src.folded.slice(i, i + seedChars));
    if (at === undefined) {
      i++;
      continue;
    }

    let end = i + seedChars;
    let d = at + seedChars;
    while (end < src.folded.length && d < doc.folded.length && src.folded[end] === doc.folded[d]) {
      end++;
      d++;
    }
    let begin = i;
    let c = at;
    while (begin > 0 && c > 0 && src.folded[begin - 1] === doc.folded[c - 1]) {
      begin--;
      c--;
    }

    // The scan resumes past the extended span whatever happens below. Every
    // seed inside it would extend to the same run, and the containment drop
    // would throw the result away after paying for it.
    i = Math.max(end, i + 1);

    // Snap INWARD to word boundaries, CONSULTING BOTH TEXTS. Extension stops
    // where the two diverge, and that is mid-token more often than not - the
    // review saw "s the ability to" and "communications w" proposed as
    // claims. The divergence point is a boundary only when NEITHER text
    // continues a word through it: "quarter." against "quarter," is a
    // boundary and keeps the word, while "proceedings" against "proceedin."
    // is not and loses the fragment. Asking only the source would cut
    // "quarter" off the first and keep "proceedin" on the second - measured
    // 2026-09-08, which is why both indices are carried.
    let s = begin;
    let cs = c;
    let e = end;
    let de = d;
    while (e > s && (wordAt(src.folded, e) || wordAt(doc.folded, de))) {
      e--;
      de--;
    }
    while (s < e && (wordAt(src.folded, s - 1) || wordAt(doc.folded, cs - 1))) {
      s++;
      cs++;
    }
    // Drop a HALF of an astral character left at either edge. Two texts can
    // diverge BETWEEN the halves of a surrogate pair - any two emoji sharing a
    // lead unit do it, U+1F4C8 against U+1F4C9 - and `wordAt` reads a lone
    // surrogate as a non-word unit, so the snap above sees a clean boundary
    // and stops mid-pair. The slice then ends on a bare high surrogate, which
    // is not a character: it does not survive a UTF-8 round trip, so a claim
    // confirmed from that proposal can NEVER match the page. A false miss, and
    // one the author cannot diagnose by looking at it. It also breaks the
    // "whole-word run" the return contract promises.
    // A COMPLETE pair inside the span begins on its HIGH half and ends on its
    // LOW half, so neither loop touches it; only a dangling half matches.
    // The fix lives here, not in foldWithMap, whose per-UTF-16-unit iteration
    // is parked by controller ruling P3.
    while (e > s && /[\uD800-\uDBFF]/.test(src.folded[e - 1] as string)) e--;
    while (s < e && /[\uDC00-\uDFFF]/.test(src.folded[s] as string)) s++;

    while (s < e && src.folded[s] === " ") s++;
    while (e > s && src.folded[e - 1] === " ") e--;
    if (e <= s) continue;

    // NEITHER of the next two guards may drop a span SILENTLY. The contract
    // above is that a span dropped by a self-validation failure is dropped AND
    // reported, and an unreported drop is indistinguishable from a span that
    // was never there - the one outcome that makes a bug in this file
    // invisible. `src.map` carries one entry per folded unit, so a map shorter
    // than the span is an offset-map fault of exactly the kind assertion 3
    // exists to catch; it just strikes EARLIER, where `undefined + 1` is NaN
    // and `slice(x, NaN)` is "", so assertion 3 would never get to run.
    const from = src.map[s];
    const toInclusive = src.map[e - 1];
    if (from === undefined || toInclusive === undefined) {
      bugs.push(
        `offset map shorter than the span: folded [${s}, ${e}) of ` +
          `${src.folded.length}, map length ${src.map.length}`,
      );
      continue;
    }

    // Cut from the SOURCE, through the map. The whitespace collapse is not
    // cosmetic: the map records the offset of the FIRST character of a
    // whitespace run (excerpt.ts), so an uncollapsed slice carries the
    // source's newlines and indentation into a claims file. Collapsing is
    // norm-equivalent, so it cannot change what check() finds.
    const span = sourceText.slice(from, toInclusive + 1).replace(/\s+/g, " ").trim();
    if (!span) {
      bugs.push(`empty slice from source offsets [${from}, ${toInclusive}]`);
      continue;
    }

    // THE THREE ASSERTIONS (spec 8.2 step 4). Assertion 3 is a bug if it
    // fails, and so is the fold-drift half of assertion 2; assertion 1 is
    // NOT - see `normBoundaryNote` and `documentMismatchNote`, which carry
    // the measurement. `normSource`/`normDoc` are `phraseFound`'s haystack
    // side, hoisted - see the note where they are bound.
    if (!normSource.includes(norm(span))) {
      bugs.push(normBoundaryNote(span));
      continue;
    }
    if (!normDoc.includes(norm(span))) {
      bugs.push(documentMismatchNote(span));
      continue;
    }
    // The one phraseFound cannot stand in for. phraseFound(text, slice) is
    // true for ANY contiguous slice of text, so a slice the map placed one
    // character over still passes it. Equality in FOLD space - the space the
    // match was made in - is what catches an offset map that has shifted.
    if (foldWithMap(span).folded !== src.folded.slice(s, e)) {
      bugs.push(`offset map round trip failed: ${JSON.stringify(span)}`);
      continue;
    }

    candidates.push(span);
  }

  return { spans: dropContained(candidates), bugs };
}

/**
 * Spans with every one contained in another removed, comparing in norm()
 * space because that is where `check()` will compare.
 *
 * ONE implementation of the containment rule, used twice: here over one
 * read's candidates, and in `harvest()` over the union of a URL's several
 * readable reads. A second copy of a rule this small is how the fold table
 * drifted from `norm()` three times.
 *
 * A later span that CONTAINS an earlier one replaces it, in place, so the
 * result keeps source order.
 */
export function dropContained(spans: readonly string[]): string[] {
  const kept: string[] = [];
  const normed: string[] = [];
  for (const span of spans) {
    const n = norm(span);
    if (!n) continue;
    if (normed.some((p) => p.includes(n))) continue;
    for (let k = normed.length - 1; k >= 0; k--) {
      if (n.includes(normed[k] as string)) {
        normed.splice(k, 1);
        kept.splice(k, 1);
      }
    }
    normed.push(n);
    kept.push(span);
  }
  return kept;
}
