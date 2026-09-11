/**
 * The claim floor's figures, reprinted against the live constant. RUN BY HAND,
 * after a build:
 *   npm run build && node scripts/calibrate-claim-floor.mjs
 *
 * READ THIS BEFORE TRUSTING ITS OUTPUT. Until 2026-09-10 this script WAS the
 * derivation: it walked the 210 claim strings frozen in `fixtures/claims/`,
 * ran `phraseFound` over every one of them against every unrelated `document`
 * fixture, and measured the ceiling from scratch. That corpus was taken from
 * four of the owner's unpublished drafts and was deleted when this repository
 * was made public - the claim text discloses what those drafts are about.
 *
 * So this script no longer CALIBRATES anything. It reports
 * `fixtures/claim-lengths.json`, the derived fixture that replaced the corpus,
 * against today's `THRESHOLDS`. The distribution figures - the bands, the
 * refusal counts, the ceiling's margin against the floor - are still live in
 * the only sense that matters here: change `minClaimChars` and the margin and
 * the refusal count move with it. The two SPURIOUS MATCHES and therefore the
 * CEILING are not live. They are a measurement taken on 2026-09-09 and frozen,
 * because re-taking it needs the strings. The name is kept, not improved, so
 * that the command cited beside every number in docs/calibration-2026-09.md
 * and in src/classify/thresholds.ts still runs.
 *
 * THE QUESTION it answered, for the reader who arrives from one of those
 * citations: does a real, hand-authored claim ever match a page it was not
 * written about? Every claim was tested against every `document` fixture - all
 * unrelated to all of them - with the matcher check() itself uses. The longest
 * claim that matched an unrelated page is the CEILING. The floor must sit
 * above it with margin. Two claims matched, at 12 and 3 normalized characters.
 *
 * The floor's LICENCE is a priori (spec 7.3): a bare number, a year, or a
 * token like "the report" attests nothing about a source, and a match on one
 * is a coincidence the checker cannot tell from evidence. That measurement was
 * the sanity check, not the derivation. A floor at or below the frozen ceiling
 * is a finding to stop on and report, not a number to explain away - and it is
 * the one thing here that can still fail, so the check is kept below.
 */
import { readFileSync } from "node:fs";
import { THRESHOLDS } from "../dist/classify/thresholds.js";

const derived = JSON.parse(readFileSync("fixtures/claim-lengths.json", "utf8"));
const { lengths, spurious, documentFixtures } = derived;

console.log(`derived fixture: fixtures/claim-lengths.json (fixtures/claims/ deleted 2026-09-10)`);
console.log(`document fixtures at the freeze: ${documentFixtures}`);
console.log(`distinct claims: ${lengths.length}`);
console.log(`normalized length: min ${Math.min(...lengths)}, max ${Math.max(...lengths)}`);

for (const [lo, hi] of [[1, 10], [11, 20], [21, 30], [31, 40], [41, 60], [61, 1e9]]) {
  const band = lengths.filter((n) => n >= lo && n <= hi);
  console.log(`norm length ${lo}-${hi === 1e9 ? "up" : hi}: ${band.length} claims`);
}

console.log("spurious matches, frozen 2026-09-09 (claim | normalized length | unrelated fixtures hit):");
for (const r of spurious) console.log(`  ${JSON.stringify(r.claim)} | ${r.n} | ${r.hits}`);

const ceiling = spurious.length === 0 ? 0 : Math.max(...spurious.map((r) => r.n));
console.log(`CEILING (longest claim matching an unrelated fixture, 2026-09-09): ${ceiling}`);
console.log(`FLOOR (THRESHOLDS.minClaimChars): ${THRESHOLDS.minClaimChars}, margin ${THRESHOLDS.minClaimChars - ceiling}`);
console.log(`SEED (THRESHOLDS.harvestSeedChars): ${THRESHOLDS.harvestSeedChars}`);
console.log(`refused at F: ${[8, 12, 16, 20, 25, 30, 40].map((F) => `${F}:${lengths.filter((n) => n < F).length}`).join("  ")}`);
console.log(`refused at the shipped floor: ${lengths.filter((n) => n < THRESHOLDS.minClaimChars).length} of ${lengths.length}`);
if (ceiling >= THRESHOLDS.minClaimChars) {
  console.log("STOP: the floor has been lowered to or below the recorded ceiling. Report this; do not adjust the number to fit.");
}
