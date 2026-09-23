// Fidelity snapshot: one sha256 per fixture per surface, over the BUILT
// package. Run before a release's first source edit and after its last; the
// two outputs must be identical, or the release moved something it promised
// not to. Written for 0.6.2 (spec section 7).
//
//   npm run build && node scripts/fidelity-snapshot.mjs > before.json
//
// Surfaces: toText; every computeSignals field; check() over claims cut from
// the fixture's own text (verdict and evidence, so excerpts are covered); and
// harvest() over one draft citing every document fixture. Fixtures are the 38
// named by fixtures/totext-0-5-0.json, the set 0.6.0's fidelity test pins.
// Reads fixtures only; writes nothing but stdout.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { check, parseGfmFootnotes, toText } from "../dist/index.js";
import { computeSignals } from "../dist/classify/signals.js";
import { harvest } from "../dist/harvest.js";

const sha = (v) => createHash("sha256").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex");
const names = Object.keys(JSON.parse(readFileSync("fixtures/totext-0-5-0.json", "utf8")));
const statusOf = new Map(JSON.parse(readFileSync("fixtures/corpus.json", "utf8")).map((e) => [e.path, e.status]));

const fetcherFor = (byUrl) => ({
  rungs: ["node"],
  async fetch(url) {
    const e = byUrl.get(url);
    if (!e) return { rawBody: "", status: 0, headers: {}, finalUrl: "", bytes: 0 };
    return { rawBody: e.body, status: e.status, headers: { "content-type": "text/html" }, finalUrl: url, bytes: e.body.length };
  },
});

// Three ten-word windows from fixed positions in the fixture's own text, so
// every readable fixture yields claims that match and excerpt.
function windows(text) {
  const words = text.split(" ");
  return [50, 200, 400].filter((i) => i + 10 <= words.length).map((i) => words.slice(i, i + 10).join(" "));
}

const out = {};
const draftLines = [];
const notes = [];
const byUrl = new Map();
for (const [i, rel] of names.entries()) {
  const body = readFileSync(rel, "utf8");
  const status = statusOf.get(rel) ?? 200;
  const url = `https://fixture.test/${i}`;
  byUrl.set(url, { body, status });
  const text = toText(body);
  const claims = windows(text);
  const signals = computeSignals({ rawBody: body, headers: { "content-type": "text/html" }, finalUrl: url, status, claims });
  const checked = claims.length > 0 ? await check(url, claims, { fetcher: fetcherFor(byUrl) }) : null;
  out[rel] = {
    toText: sha(text),
    signals: sha(signals),
    check: sha(checked && { verdict: checked.verdict, evidence: checked.evidence ?? null }),
  };
  if (rel.startsWith("fixtures/documents/") && claims.length > 0) {
    draftLines.push(`Point ${i}: ${claims.join(". ")}.[^${i}]`, "");
    notes.push(`[^${i}]: Fixture ${i}, ${url}`);
  }
}
const report = await harvest(parseGfmFootnotes([...draftLines, ...notes, ""].join("\n")), { fetcher: fetcherFor(byUrl) });
out["harvest"] = sha(report);

process.stdout.write(JSON.stringify(out, null, 2) + "\n");
