// Region movement for 0.7.0 (spec section 5), over the BUILT package.
//
//   npm run build && node scripts/region-movement-0-7-0.mjs <path-to-0.6.0-ndjson>
//
// Two populations: the 38 fixtures named by fixtures/totext-0-5-0.json, from
// their bytes; and the regions 0.6.0's 618-URL run recorded (`regionsAfter`),
// frozen - no network. Reports the cap, the signature, provenance, and cost.
// Reads only; writes nothing but stdout.
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { check } from "../dist/index.js";
import { MAX_DESCRIPTION_REGIONS, toTextRegions } from "../dist/text/extract.js";
import { matchesChallengePath, matchesChallengeSignature, matchesChallengeSignatureIn } from "../dist/rules/challenge.js";
import { proseVolume, THRESHOLDS } from "../dist/classify/thresholds.js";

const ndjsonPath = process.argv[2];
if (!ndjsonPath) throw new Error("usage: node scripts/region-movement-0-7-0.mjs <0.6.0 ndjson>");

function judge(regions, finalUrl) {
  const text = regions.join(" ");
  const prose = proseVolume(text);
  const flat = matchesChallengeSignature(text);
  const per = matchesChallengeSignatureIn(regions);
  const short = prose < THRESHOLDS.maxChallengeChars;
  const path = matchesChallengePath(finalUrl ?? "");
  return {
    prose,
    flat: flat?.note ?? null,
    per: per?.note ?? null,
    vetoBefore: !!flat && short,
    vetoAfter: !!per && short,
    vetoedFalse: !path && !!per && !short,
  };
}

// 1. Fixtures.
const expected = JSON.parse(readFileSync("fixtures/totext-0-5-0.json", "utf8"));
const fixtures = { total: 0, toTextMoved: [], overCap: [], signatureMoved: [], vetoedFalse: [] };
for (const rel of Object.keys(expected)) {
  fixtures.total++;
  const regions = toTextRegions(readFileSync(rel, "utf8"));
  if (createHash("sha256").update(regions.join(" ")).digest("hex") !== expected[rel]) fixtures.toTextMoved.push(rel);
  if (regions.length > 1 + MAX_DESCRIPTION_REGIONS) fixtures.overCap.push(rel);
  const j = judge(regions, "");
  if (j.flat !== j.per || j.vetoBefore !== j.vetoAfter) fixtures.signatureMoved.push({ rel, ...j });
  if (j.vetoedFalse) fixtures.vetoedFalse.push({ rel, note: j.per, prose: j.prose });
}

// 2. The 0.6.0 corpus run, frozen.
const lines = readFileSync(ndjsonPath, "utf8").split("\n").filter(Boolean);
const corpus = { rows: lines.length, withRegions: 0, regionHistogram: {}, overCap: [], signatureMoved: [], vetoedFalse: [] };
for (const line of lines) {
  const r = JSON.parse(line);
  if (!Array.isArray(r.regionsAfter)) continue;
  corpus.withRegions++;
  const n = r.regionsAfter.length;
  corpus.regionHistogram[n] = (corpus.regionHistogram[n] ?? 0) + 1;
  if (n > 1 + MAX_DESCRIPTION_REGIONS) corpus.overCap.push(r.url);
  const j = judge(r.regionsAfter, r.finalUrl);
  if (j.flat !== j.per || j.vetoBefore !== j.vetoAfter) corpus.signatureMoved.push({ url: r.url, ...j });
  if (j.vetoedFalse) corpus.vetoedFalse.push({ url: r.url, note: j.per, prose: j.prose });
}

// 3. Cost: 50 absent claims on a 5,000-description page, best of five.
const metas = Array.from({ length: 5000 }, (_, i) => `<meta name="description" content="Distinct description number ${i} about budgets.">`).join("");
const page = `<html><head>${metas}</head><body>${"<p>Background material about budgets and departmental process.</p>".repeat(120)}</body></html>`;
const claims = Array.from({ length: 50 }, (_, i) => `claim text number ${i} that is not present anywhere`);
const fetcher = { rungs: ["node"], async fetch(u) { return { rawBody: page, status: 200, headers: { "content-type": "text/html" }, finalUrl: u, bytes: page.length }; } };
let best = Infinity;
for (let k = 0; k < 5; k++) {
  const t = performance.now();
  await check("https://x.test/a", claims, { fetcher });
  best = Math.min(best, performance.now() - t);
}

const st = statSync(ndjsonPath);
process.stdout.write(JSON.stringify({
  ndjson: { path: ndjsonPath, bytes: st.size },
  fixtures, corpus,
  cost: { regions: toTextRegions(page).length, checkMsBestOf5: Math.round(best) },
}, null, 2) + "\n");
