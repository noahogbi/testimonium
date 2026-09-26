// Scratch measurement for the 0.8.0 redirect gate: for each of the 618 cited
// URLs, read through testimonium's own ladder (readSource, the path check()
// uses) and record every read's finalUrl and readability. Resumable NDJSON.
// Read-only against the web; writes only the NDJSON beside this file.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
const REPO = "file:///C:/users/noaho/testimonium/dist/";
const { defaultFetcher, loadRules } = await import(REPO + "index.js");
const { readSource } = await import(REPO + "fetch/read-source.js");
const { isReadable } = await import(REPO + "classify/verdict.js");

const corpus = JSON.parse(readFileSync("C:/users/noaho/omnisscientia/docs/superpowers/worklogs/data/2026-09-13-subfloor/results.json", "utf8"));
const out = new URL("./redirects.ndjson", import.meta.url);
const done = new Set(existsSync(out) ? readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).url) : []);
const rules = loadRules();
const fetcher = defaultFetcher({ identity: "testimonium-0.8.0-redirect-measurement", hosts: rules.hosts });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let n = done.size;
for (const entry of corpus) {
  if (done.has(entry.url)) continue;
  let row;
  try {
    const s = await readSource(entry.url, [], { fetcher, rules });
    row = {
      url: entry.url,
      cites: entry.cites,
      attempted: s.attempted,
      reads: s.reads.map((r) => ({
        rung: r.rung,
        finalUrl: r.computed.finalUrl,
        readable: isReadable(r.computed.signals),
        gone: r.computed.signals.documentGone,
        prose: r.computed.signals.proseChars,
      })),
    };
  } catch (e) {
    row = { url: entry.url, cites: entry.cites, error: String(e?.message ?? e) };
  }
  appendFileSync(out, JSON.stringify(row) + "\n", "utf8");
  n++;
  if (n % 25 === 0) console.log(`${n}/${corpus.length}`);
  await sleep(800);
}
console.log(`done ${n}/${corpus.length}`);
