// Redirect movement for 0.8.0 (spec section 6), over the BUILT package: for
// the read check() would judge (first readable, else last), classify where it
// landed and count how often movedAway fires. Reads the committed recording.
//
//   npm run build && node scripts/redirect-movement-0-8-0.mjs
import { readFileSync } from "node:fs";
import { movedAway } from "../dist/classify/moved.js";

const rows = readFileSync("docs/data/redirects-2026-09-25/redirects.ndjson", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const path = (u) => { try { const p = decodeURIComponent(new URL(u).pathname).toLowerCase().replace(/\/+$/, ""); return p || "/"; } catch { return u; } };
const host = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };

const out = { rows: rows.length, judged: 0, samePage: 0, samePageReadable: 0, redirected: [], movedAway: [] };
for (const r of rows) {
  if (!r.reads || r.reads.length === 0) continue;
  const j = r.reads.find((x) => x.readable) ?? r.reads[r.reads.length - 1];
  out.judged++;
  if (host(r.url) === host(j.finalUrl) && path(r.url) === path(j.finalUrl)) {
    out.samePage++;
    if (j.readable) out.samePageReadable++;
  } else out.redirected.push({ url: r.url, finalUrl: j.finalUrl, readable: j.readable });
  if (movedAway(r.url, j.finalUrl)) out.movedAway.push({ url: r.url, finalUrl: j.finalUrl, readable: j.readable });
}
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
