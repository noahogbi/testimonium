import { THRESHOLDS } from "../classify/thresholds.js";
import { foldWithMap } from "../text/excerpt.js";
import { norm, phraseFound } from "../text/normalize.js";

export interface SpanResult {
  /** Proposals, in source order, cut from the SOURCE's typography. Each is a
   *  whole-word run with its whitespace collapsed, and none is contained in
   *  another. */
  readonly spans: string[];
  /** Spans dropped by a self-validation assertion, one line each naming the
   *  assertion that failed. A non-zero count is a BUG SIGNAL, not a filter
   *  statistic (spec 8.2 step 4; Fable F3c): every one of the three
   *  assertions is a property the code should hold unconditionally. The
   *  caller reports these with a `BUG:` label and does not change its exit
   *  code, and the span is not proposed - a span that cannot be shown to be
   *  what the source says must not reach the author. */
  readonly bugs: string[];
}

/**
 * First occurrence of every seed-length gram of the folded document.
 *
 * Built once per call so that the scan over the source is a map lookup per
 * position instead of an `indexOf` over the whole document - which is what
 * spec 8.2 step 3 means by a pass "linear in the source". Indexing EVERY
 * occurrence would make the inner step a walk over an occurrence list, which
 * is quadratic on a source and a document that both repeat.
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
 */
export function commonSpans(
  docProse: string,
  sourceText: string,
  seedChars: number = THRESHOLDS.harvestSeedChars,
): SpanResult {
  const candidates: string[] = [];
  const bugs: string[] = [];
  if (seedChars <= 0) return { spans: [], bugs };

  const doc = foldWithMap(docProse);
  const src = foldWithMap(sourceText);
  const index = seedIndex(doc.folded, seedChars);

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
    while (s < e && src.folded[s] === " ") s++;
    while (e > s && src.folded[e - 1] === " ") e--;
    if (e <= s) continue;

    // Cut from the SOURCE, through the map. The whitespace collapse is not
    // cosmetic: the map records the offset of the FIRST character of a
    // whitespace run (excerpt.ts), so an uncollapsed slice carries the
    // source's newlines and indentation into a claims file. Collapsing is
    // norm-equivalent, so it cannot change what check() finds.
    const span = sourceText
      .slice(src.map[s] as number, (src.map[e - 1] as number) + 1)
      .replace(/\s+/g, " ")
      .trim();
    if (!span) continue;

    // THE THREE ASSERTIONS (spec 8.2 step 4). Each is a bug if it fails.
    if (!phraseFound(sourceText, span)) {
      bugs.push(`not found in the source: ${JSON.stringify(span)}`);
      continue;
    }
    if (!phraseFound(docProse, span)) {
      bugs.push(`not found in the document: ${JSON.stringify(span)}`);
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
