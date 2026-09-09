/**
 * The claim floor's measurement, re-runnable. RUN BY HAND, after a build:
 *   npm run build && node scripts/calibrate-claim-floor.mjs
 * Record the output in docs/calibration-2026-09.md with this command beside
 * every number it produced.
 *
 * THE QUESTION: does a real, hand-authored claim ever match a page it was not
 * written about? Every claim in fixtures/claims/ is tested against every
 * `document` fixture in fixtures/corpus.json - all unrelated to all of them -
 * with the matcher check() itself uses. The longest claim that matches an
 * unrelated page is the CEILING. The floor must sit above it with margin.
 *
 * The floor's LICENCE is a priori (spec 7.3): a bare number, a year, or a
 * token like "the report" attests nothing about a source, and a match on one
 * is a coincidence the checker cannot tell from evidence. This script is the
 * sanity check, not the derivation. A run that puts the ceiling at or above
 * THRESHOLDS.minClaimChars is a finding to stop on and report, not a number
 * to explain away.
 *
 * Descended from the review-session probe kept in the git-ignored SDD
 * workspace, which imported dist through absolute file:/// URLs into another
 * checkout, read the claims out of the origin repo, and counted a
 * `notApplicable` reason string as a claim. All three are fixed here: the
 * imports are relative to dist/ the way scripts/sweep-floor.mjs's are, the
 * claims come from the frozen fixtures, and the walker skips notApplicable.
 */
import { readFileSync, readdirSync } from "node:fs";
import { toText } from "../dist/text/extract.js";
import { norm, phraseFound } from "../dist/text/normalize.js";
import { THRESHOLDS } from "../dist/classify/thresholds.js";

const CLAIMS_DIR = "fixtures/claims";

const corpus = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));
const docs = corpus
  .filter((f) => f.kind === "document")
  .map((f) => ({ path: f.path, text: toText(readFileSync(f.path, "utf8")) }));

/**
 * Every claim STRING in a claims file, whichever shape it has - keyed by
 * footnote number or keyed by URL - and nothing that is not a claim: a key
 * beginning with "_" is a note for a human reader, and a
 * {"notApplicable": "<reason>"} object's reason is prose about why a URL is
 * not checkable. Counting either as a claim would put non-claims into a
 * population that licenses a threshold.
 */
function walk(v, out) {
  if (typeof v === "string") {
    out.push(v);
    return;
  }
  if (Array.isArray(v)) {
    for (const x of v) walk(x, out);
    return;
  }
  if (v && typeof v === "object") {
    if (typeof v.notApplicable === "string") return;
    for (const [k, x] of Object.entries(v)) if (!k.startsWith("_")) walk(x, out);
  }
}

const files = readdirSync(CLAIMS_DIR).filter((f) => f.endsWith("-claims.json")).sort();
const all = [];
for (const f of files) {
  const before = all.length;
  walk(JSON.parse(readFileSync(`${CLAIMS_DIR}/${f}`, "utf8")), all);
  console.log(`  ${f}: ${all.length - before} claim strings`);
}
const claims = [...new Set(all)];

console.log(`document fixtures: ${docs.length}, ${docs.reduce((a, d) => a + d.text.length, 0)} chars`);
console.log(`claim strings: ${all.length}, distinct: ${claims.length}`);

const rows = claims.map((c) => ({
  c,
  n: norm(c).length,
  hits: docs.filter((d) => phraseFound(d.text, c)).length,
}));

for (const [lo, hi] of [[1, 10], [11, 20], [21, 30], [31, 40], [41, 60], [61, 1e9]]) {
  const band = rows.filter((r) => r.n >= lo && r.n <= hi);
  const bad = band.filter((r) => r.hits > 0);
  console.log(`norm length ${lo}-${hi === 1e9 ? "up" : hi}: ${band.length} claims, ${bad.length} matching an unrelated fixture`);
}

const spurious = rows.filter((r) => r.hits > 0).sort((a, b) => b.n - a.n);
console.log("spurious matches (claim | normalized length | unrelated fixtures hit):");
for (const r of spurious) console.log(`  ${JSON.stringify(r.c)} | ${r.n} | ${r.hits}`);

const ceiling = spurious.length === 0 ? 0 : spurious[0].n;
console.log(`CEILING (longest claim matching an unrelated fixture): ${ceiling}`);
console.log(`FLOOR (THRESHOLDS.minClaimChars): ${THRESHOLDS.minClaimChars}, margin ${THRESHOLDS.minClaimChars - ceiling}`);
console.log(`refused at F: ${[8, 12, 16, 20, 25, 30, 40].map((F) => `${F}:${rows.filter((r) => r.n < F).length}`).join("  ")}`);
if (ceiling >= THRESHOLDS.minClaimChars) {
  console.log("STOP: the observed ceiling has reached the floor. Report this; do not adjust the number to fit.");
}
