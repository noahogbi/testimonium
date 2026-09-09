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
import { commonSpans } from "../dist/harvest/spans.js";
import { norm } from "../dist/text/normalize.js";
import { THRESHOLDS } from "../dist/classify/thresholds.js";

const SWEEP = [13, 16, 20, 21, 22, 23, 24, 25, 30];

const corpus = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));
const docs = corpus
  .filter((f) => f.kind === "document")
  .map((f) => ({ path: f.path, text: toText(readFileSync(f.path, "utf8")) }));

/**
 * The sweep calls the shipped `commonSpans` (src/harvest/spans.ts). Until
 * plan 2's Task 5 this file carried a replica of its emit rules, because the
 * seed length had to be chosen before the function that consumes it could be
 * written. The replica is gone; the numbers below come from the code that
 * ships.
 */

const pairs = [];
for (let a = 0; a < docs.length; a++) for (let b = a + 1; b < docs.length; b++) pairs.push([docs[a], docs[b]]);

const mean = (xs) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
console.log(`document fixtures: ${docs.length}, unrelated pairs: ${pairs.length}`);
console.log(`floor (THRESHOLDS.minClaimChars): ${THRESHOLDS.minClaimChars}`);
for (const L of SWEEP) {
  const emitted = [];
  const above = [];
  for (const [src, doc] of pairs) {
    const spans = commonSpans(doc.text, src.text, L).spans;
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
  for (const span of commonSpans(doc.text, src.text, CLASSIFY_L).spans) {
    const k = norm(span);
    if (k.length < THRESHOLDS.minClaimChars) continue;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
}
console.log(`\ndistinct above-floor cross-fixture spans at L=${CLASSIFY_L}: ${seen.size} - the hand-classification population`);
for (const [k, n] of [...seen].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))) {
  console.log(`  ${String(n).padStart(2)} pairs | ${k.length} | ${JSON.stringify(k)}`);
}
