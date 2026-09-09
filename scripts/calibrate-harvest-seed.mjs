/**
 * The harvest seed length's measurement, re-runnable. RUN BY HAND, after a
 * build:
 *   npm run build && node scripts/calibrate-harvest-seed.mjs [L-to-classify]
 *
 * THE QUESTION harvest's precision turns on: how many spans does
 * seed-and-extend emit between two texts that have nothing to do with each
 * other? Every unordered pair of the `document` fixtures is unrelated by
 * construction, so every span emitted from a pair is noise an author would
 * have to read and reject. The count per pair, at each candidate seed length,
 * is what harvestSeedChars is chosen from.
 *
 * It measures what commonSpans EMITS - after extension, word-boundary
 * snapping, whitespace collapse and containment dedupe - not raw L-gram
 * seeds. Emitted spans are what an author reviews; seeds are not.
 *
 * SELECTION RULE, stated before the run so the number is chosen by a rule
 * rather than by taste: harvestSeedChars is the SMALLEST L in 20..25 (spec
 * 8.2's band) whose MEAN count of emitted above-floor spans per unrelated
 * pair is below 1.0 - fewer than one chance proposal per unrelated source.
 * If no L in the band qualifies, take 25 and record that none did.
 *
 * No committed script ever produced the figures spec 8.2 quotes (24.8 / 5.0 /
 * 0.9 / 0.2 at L = 13 / 16 / 20 / 25). They came from a scratch script in the
 * design review, kept nowhere. This one replaces them; expect the shape to
 * agree and the digits to differ.
 */
import { readFileSync } from "node:fs";
import { toText } from "../dist/text/extract.js";
import { foldWithMap } from "../dist/text/excerpt.js";
import { norm } from "../dist/text/normalize.js";
import { THRESHOLDS } from "../dist/classify/thresholds.js";

const SWEEP = [13, 16, 20, 21, 22, 23, 24, 25, 30];

const corpus = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));
const docs = corpus
  .filter((f) => f.kind === "document")
  .map((f) => ({ path: f.path, text: toText(readFileSync(f.path, "utf8")) }));

/** First occurrence of every L-gram of the folded document. Built once per
 *  call so the source scan is a lookup per position rather than an indexOf
 *  over the whole document - what spec 8.2 means by "linear in the source". */
function seedIndex(folded, L) {
  const ix = new Map();
  for (let i = 0; i + L <= folded.length; i++) {
    const g = folded.slice(i, i + L);
    if (!ix.has(g)) ix.set(g, i);
  }
  return ix;
}

/** A word character in fold space; a token ends at punctuation too. */
const WORD = /[\p{L}\p{N}]/u;
const wordAt = (t, i) => i >= 0 && i < t.length && WORD.test(t[i]);

function dropContained(spans) {
  const kept = [];
  const normed = [];
  for (const span of spans) {
    const n = norm(span);
    if (!n) continue;
    if (normed.some((p) => p.includes(n))) continue;
    for (let k = normed.length - 1; k >= 0; k--) {
      if (n.includes(normed[k])) {
        normed.splice(k, 1);
        kept.splice(k, 1);
      }
    }
    normed.push(n);
    kept.push(span);
  }
  return kept;
}

/**
 * REPLICA of src/harvest/spans.ts's emit rules. Task 5 of plan 2 deletes this
 * function and imports the real `commonSpans` instead, then re-runs this
 * script to prove the numbers did not move. Until commonSpans exists this is
 * what there is, and the plan says so rather than pretending otherwise.
 */
function spansOf(docProse, sourceText, L) {
  const D = foldWithMap(docProse);
  const S = foldWithMap(sourceText);
  const ix = seedIndex(D.folded, L);
  const candidates = [];
  let i = 0;
  while (i + L <= S.folded.length) {
    const at = ix.get(S.folded.slice(i, i + L));
    if (at === undefined) {
      i++;
      continue;
    }
    let end = i + L;
    let d = at + L;
    while (end < S.folded.length && d < D.folded.length && S.folded[end] === D.folded[d]) {
      end++;
      d++;
    }
    let begin = i;
    let c = at;
    while (begin > 0 && c > 0 && S.folded[begin - 1] === D.folded[c - 1]) {
      begin--;
      c--;
    }
    i = Math.max(end, i + 1);
    let s = begin;
    let cs = c;
    let e = end;
    let de = d;
    while (e > s && (wordAt(S.folded, e) || wordAt(D.folded, de))) {
      e--;
      de--;
    }
    while (s < e && (wordAt(S.folded, s - 1) || wordAt(D.folded, cs - 1))) {
      s++;
      cs++;
    }
    while (s < e && S.folded[s] === " ") s++;
    while (e > s && S.folded[e - 1] === " ") e--;
    if (e <= s) continue;
    const span = sourceText.slice(S.map[s], S.map[e - 1] + 1).replace(/\s+/g, " ").trim();
    if (span) candidates.push(span);
  }
  return dropContained(candidates);
}

const pairs = [];
for (let a = 0; a < docs.length; a++) for (let b = a + 1; b < docs.length; b++) pairs.push([docs[a], docs[b]]);

const mean = (xs) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
console.log(`document fixtures: ${docs.length}, unrelated pairs: ${pairs.length}`);
console.log(`floor (THRESHOLDS.minClaimChars): ${THRESHOLDS.minClaimChars}`);
for (const L of SWEEP) {
  const emitted = [];
  const above = [];
  for (const [src, doc] of pairs) {
    const spans = spansOf(doc.text, src.text, L);
    emitted.push(spans.length);
    above.push(spans.filter((x) => norm(x).length >= THRESHOLDS.minClaimChars).length);
  }
  console.log(
    `L=${String(L).padStart(2)}  emitted mean ${mean(emitted)} max ${Math.max(...emitted)}` +
      `  |  above floor mean ${mean(above)} max ${Math.max(...above)}`,
  );
}

const CLASSIFY_L = Number(process.argv[2] ?? THRESHOLDS.harvestSeedChars);
const seen = new Map();
for (const [src, doc] of pairs) {
  for (const span of spansOf(doc.text, src.text, CLASSIFY_L)) {
    const k = norm(span);
    if (k.length < THRESHOLDS.minClaimChars) continue;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
}
console.log(`\ndistinct above-floor cross-fixture spans at L=${CLASSIFY_L}: ${seen.size} - the hand-classification population`);
for (const [k, n] of [...seen].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))) {
  console.log(`  ${String(n).padStart(2)} pairs | ${k.length} | ${JSON.stringify(k)}`);
}
