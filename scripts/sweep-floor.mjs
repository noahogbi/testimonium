/**
 * How many integer floors would still pass every acceptance assertion, and
 * what is the widest one? RUN BY HAND, after a build:
 *   npm run build && node scripts/sweep-floor.mjs
 * Record the output in docs/calibration-2026-09.md alongside the chosen
 * value. Exists because an earlier version of that page carried this figure
 * from a one-off script that was never committed - nobody after the fact
 * could tell whether it was still true. This one can always be re-run.
 *
 * Replicates the four assertions in test/classify/acceptance.test.ts, with
 * the floor as a swept parameter instead of the fixed THRESHOLDS constant.
 */
import { readFileSync } from "node:fs";
import { toText } from "../dist/text/extract.js";
import { proseVolume } from "../dist/classify/thresholds.js";
import { computeSignals } from "../dist/classify/signals.js";

const MAX_FLOOR_TO_TRY = 120_000;
const MARGIN = 200; // test/classify/acceptance.test.ts's required margin.

const corpus = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));
const read = (f) => toText(readFileSync(f.path, "utf8"));
const documentGone = (f) => f.status === 404 || f.status === 410;
const notText = (f) =>
  computeSignals({ rawBody: read(f), headers: {}, finalUrl: f.url, status: f.status, claims: [] }).signals.notText;

const rows = corpus
  .filter((f) => f.kind === "challenge" || f.kind === "document")
  .map((f) => ({ ...f, prose: proseVolume(read(f)), gone: documentGone(f), bin: notText(f) }));

function passesAll(floor) {
  for (const r of rows) {
    const rejected = r.gone || r.bin || r.prose < floor;
    if (r.kind === "challenge" && !rejected) return false; // assertion 1
    if (r.kind === "document" && rejected) return false; // assertion 2
    if (r.kind === "challenge" && !r.gone && !r.bin && r.prose > floor - MARGIN) return false; // assertion 3
    if (r.kind === "document" && r.prose < floor + MARGIN) return false; // assertion 4
  }
  return true;
}

const satisfying = [];
for (let floor = 1; floor <= MAX_FLOOR_TO_TRY; floor++) if (passesAll(floor)) satisfying.push(floor);

console.log(`corpus: ${rows.filter((r) => r.kind === "challenge").length} challenge, ` +
  `${rows.filter((r) => r.kind === "document").length} document`);
console.log(`satisfying floors (1..${MAX_FLOOR_TO_TRY}): ${satisfying.length}`);
if (satisfying.length > 0) {
  console.log(`range: [${satisfying[0]}, ${satisfying[satisfying.length - 1]}]`);
}
