/**
 * Print the two populations so a human picks the floor. RUN BY HAND.
 *   node scripts/calibrate.mjs
 * Record the output in docs/calibration-2026-09.md alongside the chosen values.
 */
import { readFileSync } from "node:fs";
import { toText } from "../dist/text/extract.js";
import { proseVolume, slugLabelOverlap } from "../dist/classify/thresholds.js";

const corpus = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));
const rows = corpus.map((f) => {
  const text = toText(readFileSync(f.path, "utf8"));
  return { kind: f.kind, path: f.path, status: f.status, prose: proseVolume(text), overlap: slugLabelOverlap(text, f.url) };
});
for (const kind of ["challenge", "document"]) {
  const g = rows.filter((r) => r.kind === kind).sort((a, b) => a.prose - b.prose);
  console.log(`\n== ${kind} ==`);
  for (const r of g) console.log(`  ${String(r.prose).padStart(7)}  ov=${r.overlap.toFixed(2)}  http=${r.status}  ${r.path}`);
  console.log(`  min=${g[0]?.prose}  max=${g[g.length - 1]?.prose}`);
}
