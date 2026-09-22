/**
 * Measure what 0.6.0's route 2 (src/text/extract.ts, task 1 - attribute
 * parsing instead of whole-tag substring matching) moves on real bulletin
 * source URLs. RUN BY HAND, against a live corpus.
 *
 *   node scripts/description-movement.mjs \
 *     --corpus-dir "C:/users/noaho/omnisscientia/docs/superpowers/worklogs/data/2026-09-13-subfloor" \
 *     --out <path/to/output.ndjson> \
 *     [--identity "<app> <contact email>"] [--delay 800] [--force]
 *
 * DESIGN (task-6-brief.md; design spec 2026-09-20-testimonium-0-6-0-design.md
 * section 5, question 1): fetch each URL ONCE, extract it TWICE from the SAME
 * bytes:
 *
 *   - "before" - the PRE-0.6.0 (ac71498) IS_DESCRIPTION/CONTENT_ATTR
 *     whole-tag-substring extractor, ported inline below as
 *     `oldToTextPreRoute2`, run flat (one string, the shape that extractor
 *     always produced).
 *   - "after"  - the CURRENT (post-task-1..5) `computeSignals`, which is
 *     route 2's `toTextRegions` joined, the way `check()` reads it today.
 *
 * This is a DIFFERENT comparison from 0.5.0's own description-movement
 * script, which compared "no <meta> ever harvested" against 0.5.0's harvest,
 * to measure THAT release's effect. 0.6.0 already harvests descriptions;
 * what changed is WHICH text a malformed tag yields. Stripping <meta> tags
 * entirely (0.5.0's trick) would measure nothing about this release - both
 * arms would read identically on every ordinary page, since route 2 only
 * diverges from route 2-fixed behaviour on tags shaped to trigger the
 * substring bug (leaked keyword text, `data-content`, a `content="..."`
 * planted inside another attribute's value). So this script instead runs the
 * GENUINE pre-route-2 extractor, ported mechanically (types stripped, nothing
 * else changed) from `git show ac71498:src/text/extract.ts`. The port was
 * verified byte-for-byte against a real `tsc` compile of that same git blob
 * across every fixture under fixtures/**\/*.html before being trusted here -
 * see docs/description-movement-0-6-0.md's Method section for the counts.
 * Route 1 (the join-matching seam fix) is NOT exercised by this comparison: task 2's and
 * task 3's own reviews proved `toText`/`toTextRegions`'s BYTE output is
 * unmoved by route 1 (matching moved, extraction did not), so comparing
 * extracted text this way isolates route 2 cleanly - route 1 cannot appear
 * in a `proseChars` delta at all.
 *
 * The corpus directory is `C:/users/noaho/omnisscientia/...`, READ ONLY:
 * this script only ever calls readFileSync on urls.json inside it. It is
 * never written to.
 *
 * `readSource` (src/fetch/read-source.ts) is sealed and not exported, so the
 * rung ladder is walked here directly: try each of `fetcher.rungs` in order
 * and take the first read with a 2xx status and a non-empty body. Ladder
 * fidelity does not bias this measurement - the "before" and "after" values
 * are computed from the SAME chosen bytes, so which rung produced them
 * cancels out of the comparison.
 *
 * Resumable: one NDJSON line per URL, written as the run goes. A restart
 * reads `--out` first and skips any URL already recorded there, because a
 * lost run is 618 more live requests against real publishers - the one part
 * of this task that is rude to redo.
 *
 * Rate-limited at (at least) capture-fixtures.mjs's own precedent, an 800ms
 * pause after every live fetch attempt (scripts/capture-fixtures.mjs:70) -
 * not merely between URLs, so a URL that needs a second rung still pauses
 * before that second live request too.
 */
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { defaultFetcher, loadRules } from "../dist/index.js";
import { computeSignals } from "../dist/classify/signals.js";
import { isBlocked } from "../dist/classify/verdict.js";
import { proseVolume } from "../dist/classify/thresholds.js";
import { THRESHOLDS } from "../dist/classify/thresholds.js";
import { matchesChallengeSignature, matchesChallengePath } from "../dist/rules/challenge.js";

const DEFAULT_DELAY_MS = 800;
const EXPECTED_URL_COUNT = 618;

// ---------------------------------------------------------------------------
// The pre-route-2 (ac71498) extractor, ported mechanically from
// `git show ac71498:src/text/extract.ts` - TypeScript type annotations
// stripped, nothing else changed. This is the LAST commit before
// 536b757 "fix(text): parse attributes rather than matching tag substrings",
// i.e. exactly the code route 2 replaced. `tagsIn` is byte-identical between
// that commit and HEAD (route 2 changed only what happens to a tag once
// found, not how tags are found), so it is not a source of divergence and is
// reproduced here rather than imported, to keep this file self-contained and
// independent of dist's current tagsIn ever changing under it.
// ---------------------------------------------------------------------------

function entityChar(n, raw) {
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : raw;
}

const OLD_NAMED = {
  lt: 0x3c, gt: 0x3e, quot: 0x22, apos: 0x27,
  le: 0x2264, ge: 0x2265, ne: 0x2260,
  nbsp: 0xa0, ensp: 0x2002, emsp: 0x2003, thinsp: 0x2009, shy: 0xad,
  ndash: 0x2013, mdash: 0x2014, minus: 0x2212,
  lsquo: 0x2018, rsquo: 0x2019, sbquo: 0x201a,
  ldquo: 0x201c, rdquo: 0x201d, bdquo: 0x201e,
  laquo: 0xab, raquo: 0xbb, lsaquo: 0x2039, rsaquo: 0x203a,
  iexcl: 0xa1, iquest: 0xbf,
  hellip: 0x2026, prime: 0x2032, Prime: 0x2033, bull: 0x2022, middot: 0xb7,
  dagger: 0x2020, Dagger: 0x2021, permil: 0x2030, sect: 0xa7, para: 0xb6,
  copy: 0xa9, reg: 0xae, trade: 0x2122,
  deg: 0xb0, plusmn: 0xb1, micro: 0xb5, times: 0xd7, divide: 0xf7,
  sup2: 0xb2, sup3: 0xb3, frac12: 0xbd, frac14: 0xbc, frac34: 0xbe,
  pound: 0xa3, euro: 0x20ac, yen: 0xa5, cent: 0xa2,
  aacute: 0xe1, Aacute: 0xc1, eacute: 0xe9, Eacute: 0xc9,
  iacute: 0xed, Iacute: 0xcd, oacute: 0xf3, Oacute: 0xd3,
  uacute: 0xfa, Uacute: 0xda,
  agrave: 0xe0, Agrave: 0xc0, egrave: 0xe8, Egrave: 0xc8,
  ugrave: 0xf9, Ugrave: 0xd9, ograve: 0xf2, Ograve: 0xd2,
  acirc: 0xe2, Acirc: 0xc2, ecirc: 0xea, Ecirc: 0xca,
  icirc: 0xee, Icirc: 0xce, ocirc: 0xf4, Ocirc: 0xd4, ucirc: 0xfb, Ucirc: 0xdb,
  auml: 0xe4, Auml: 0xc4, euml: 0xeb, Euml: 0xcb,
  iuml: 0xef, Iuml: 0xcf, ouml: 0xf6, Ouml: 0xd6, uuml: 0xfc, Uuml: 0xdc,
  ntilde: 0xf1, Ntilde: 0xd1, ccedil: 0xe7, Ccedil: 0xc7, szlig: 0xdf,
  aelig: 0xe6, AElig: 0xc6, oslash: 0xf8, Oslash: 0xd8,
  aring: 0xe5, Aring: 0xc5, oelig: 0x153, OElig: 0x152,
  alpha: 0x3b1, beta: 0x3b2, gamma: 0x3b3, delta: 0x3b4, epsilon: 0x3b5,
  theta: 0x3b8, kappa: 0x3ba, lambda: 0x3bb, mu: 0x3bc, nu: 0x3bd,
  pi: 0x3c0, rho: 0x3c1, sigma: 0x3c3, tau: 0x3c4, phi: 0x3c6, chi: 0x3c7,
  psi: 0x3c8, omega: 0x3c9,
  Delta: 0x394, Theta: 0x398, Lambda: 0x39b, Pi: 0x3a0, Sigma: 0x3a3,
  Phi: 0x3a6, Omega: 0x3a9,
};

const IS_DESCRIPTION = /\b(?:name|property)\s*=\s*(["'])(?:og:|twitter:)?description\1/i;
const CONTENT_ATTR = /\bcontent\s*=\s*(["'])([\s\S]*?)\1/i;

function* oldTagsIn(html) {
  let i = 0;
  while ((i = html.indexOf("<", i)) !== -1) {
    let j = i + 1;
    let quote = "";
    while (j < html.length) {
      const c = html[j];
      if (quote) {
        if (c === quote) quote = "";
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === ">") break;
      j++;
    }
    if (j >= html.length) break;
    yield html.slice(i, j + 1);
    i = j + 1;
  }
}

function oldDescriptionText(html) {
  const seen = new Set();
  for (const tag of oldTagsIn(html)) {
    if (!/^<meta\b/i.test(tag)) continue;
    if (!IS_DESCRIPTION.test(tag)) continue;
    const m = CONTENT_ATTR.exec(tag);
    const value = m?.[2]?.trim();
    if (value) seen.add(value);
  }
  return [...seen].join(" ");
}

/** The old code's entity-decode/whitespace-collapse tail, split out so it can
 *  run on the body and the description separately (for duplicate analysis,
 *  storing the two parts distinctly) as well as on the concatenation (for
 *  `oldToTextPreRoute2`). Finishing each part separately then joining is NOT
 *  equivalent to finishing the joined string in one pass, and an earlier version
 *  of this comment claimed it was "PROVABLY equivalent". Counterexample: a page
 *  whose body strips to nothing. The real pre-0.6.0 `toText` trims the leading
 *  space; the split-finish form keeps it, so `proseBefore` inflates by one and
 *  `gain` reads -1. No row in the 2026-09-22 run had an empty body region, so
 *  the published numbers are unaffected - but the 38-fixture re-check could
 *  never have caught it either, because 0 of the 38 has one. `oldParts` is for
 *  the per-part duplicate analysis ONLY; `oldToTextPreRoute2` finishes the JOIN
 *  and is what the measurement calls. */
function oldFinish(s) {
  return s
    .replace(/&([a-zA-Z][a-zA-Z0-9]{1,31});/g, (raw, name) => {
      const cp = OLD_NAMED[name];
      return cp === undefined ? raw : String.fromCodePoint(cp);
    })
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (raw, h) => entityChar(parseInt(h, 16), raw))
    .replace(/&#(\d+);/g, (raw, d) => entityChar(Number(d), raw))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Old body text and old harvested-description text, kept separate (rather
 *  than pre-joined) so a duplicate check on a floor crossing can compare
 *  newly-correct description text against the page's OWN body, the same
 *  comparison basis docs/description-movement-0-5-0.md used. Each is finished
 *  independently - see oldFinish's docstring for why that is not a behaviour
 *  change from finishing the join. */
function oldParts(html) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const forHarvest = stripped
    .replace(/<script\b[\s\S]*?(?:<\/script>|$)/gi, " ")
    .replace(/<style\b[\s\S]*?(?:<\/style>|$)/gi, " ")
    .replace(/<!--[\s\S]*?(?:-->|$)/g, " ")
    .replace(/<template\b[\s\S]*?(?:<\/template>|$)/gi, " ");
  const described = oldDescriptionText(forHarvest);
  const body = stripped.replace(/<[^>]*>/g, " ");
  return { body: oldFinish(body), described: oldFinish(described), rawBody: body, rawDescribed: described };
}

/** The exact pre-0.6.0 (ac71498) `toText`: whole-tag substring matching for
 *  both IS_DESCRIPTION and CONTENT_ATTR, flat single-string output. This is
 *  the "before" arm - what route 2 replaced. Built from `oldParts` rather
 *  than restating the extraction, so there is exactly one place that walks
 *  the tags. */
function oldToTextPreRoute2(html) {
  // Finish the JOIN, not the parts - see oldFinish's docstring for the
  // empty-body counterexample that makes these two forms differ by one byte.
  const { rawBody, rawDescribed } = oldParts(html);
  return oldFinish(rawDescribed ? `${rawBody} ${rawDescribed}` : rawBody);
}

// ---------------------------------------------------------------------------
// A mirror of computeSignals' veto computation, parametrised on an externally
// supplied `text` rather than deriving it from rawBody via toTextRegions.
// Needed because computeSignals (dist/classify/signals.js) always extracts
// with the CURRENT (route-2-fixed) extractor internally - there is no way to
// hand it the "before" text directly. Everything below except the four
// private helpers (byLowercasedName, hasChallengeHeader, isTextualContentType,
// looksBinary) is imported straight from dist so the veto arithmetic itself
// is never re-derived, only re-parametrised. Those four helpers are copied
// verbatim from src/classify/signals.ts (2026-09-22, HEAD 049da8f) - they do
// not depend on which extractor ran and neither route touches them.
// ---------------------------------------------------------------------------

function byLowercasedName(headers) {
  const out = new Map();
  for (const [k, v] of Object.entries(headers)) {
    const name = k.toLowerCase();
    const seen = out.get(name);
    if (seen) seen.push(v);
    else out.set(name, [v]);
  }
  return out;
}

function hasChallengeHeader(headers) {
  return (headers.get("cf-mitigated") ?? []).some(
    (v) => typeof v === "string" && v.toLowerCase().includes("challenge"),
  );
}

function isTextualContentType(raw) {
  const t = (raw ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (t === "") return true;
  return (
    t.startsWith("text/") ||
    t === "application/xhtml+xml" ||
    t === "application/xml" ||
    t === "application/json" ||
    t.endsWith("+xml") ||
    t.endsWith("+json")
  );
}

function hasNonTextualContentType(headers) {
  const values = headers.get("content-type");
  if (values === undefined) return !isTextualContentType(undefined);
  return values.some((v) => !isTextualContentType(v));
}

function looksBinary(rawBody) {
  if (rawBody.length === 0) return false;
  let bad = 0;
  let seen = 0;
  for (const ch of rawBody) {
    if (seen >= THRESHOLDS.binarySampleCodePoints) break;
    seen++;
    const c = ch.codePointAt(0) ?? 0;
    if (c === 0xfffd || c === 0 || c < 0x09 || (c > 0x0d && c < 0x20)) bad++;
  }
  return seen > 0 && bad / seen > THRESHOLDS.maxBinaryDensity;
}

/** The veto-relevant subset of computeSignals, for a `text` this script
 *  computed itself rather than one toTextRegions produced. Sanity-checked in
 *  task-6-report.md's Method section: called on the CURRENT (after) text for
 *  a sample of real reads, it reproduces computeSignals' own vetoed/
 *  challengeSignature exactly. */
function vetoSignalsForText(text, rawBody, headersRaw, finalUrl, status, rules) {
  const headers = byLowercasedName(headersRaw);
  const sigRule = matchesChallengeSignature(text, rules?.signatures);
  const pathRule = matchesChallengePath(finalUrl, rules?.paths);
  const signals = {
    challengeHeader: hasChallengeHeader(headers),
    challengePath: pathRule !== null,
    challengeSignature: sigRule !== null && proseVolume(text) < THRESHOLDS.maxChallengeChars,
    documentGone: status === 404 || status === 410,
    notText: hasNonTextualContentType(headers) || looksBinary(rawBody),
  };
  return { proseChars: proseVolume(text), vetoed: isBlocked(signals), challengeSignature: signals.challengeSignature };
}

function parseArgs(argv) {
  const out = { delay: DEFAULT_DELAY_MS, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--corpus-dir") out.corpusDir = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--identity") out.identity = argv[++i];
    else if (a === "--delay") out.delay = Number(argv[++i]);
    else if (a === "--force") out.force = true;
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else {
      console.error(`unrecognized argument: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

function usage() {
  console.error(
    "usage: node scripts/description-movement.mjs --corpus-dir <dir with urls.json> --out <ndjson path> " +
      "[--identity \"<app> <contact email>\"] [--delay 800] [--force] [--limit N]",
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadDoneUrls(outPath) {
  const done = new Set();
  if (!existsSync(outPath)) return done;
  const raw = readFileSync(outPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed);
      if (row && typeof row.url === "string") done.add(row.url);
    } catch {
      // A half-written last line from a killed process. Skip it; the URL it
      // names will be re-fetched, which is correct - we cannot trust a
      // truncated record.
    }
  }
  return done;
}

/**
 * Walk `fetcher.rungs` in order, taking the first read with a 2xx status and
 * a non-empty body. Sleeps `delayMs` after EVERY live fetch attempt,
 * including ones that do not qualify, so a URL needing several rungs still
 * rate-limits each of them.
 */
async function firstQualifyingRead(url, fetcher, delayMs) {
  let last = null;
  for (const rung of fetcher.rungs) {
    let resp;
    try {
      resp = await fetcher.fetch(url, rung);
    } catch (e) {
      // Contract says a Fetcher must not throw, but this loop is not the
      // production ladder's own error handling - degrade the same way
      // read-source.ts does rather than aborting the whole run.
      console.warn(`warn rung "${rung}" threw for ${url}: ${e instanceof Error ? e.message : String(e)}`);
      resp = { rawBody: "", status: 0, headers: {}, finalUrl: url, bytes: 0 };
    }
    last = { rung, resp };
    await sleep(delayMs);
    if (resp.status >= 200 && resp.status < 300 && resp.rawBody && resp.rawBody.trim().length > 0) {
      return { rung, resp };
    }
  }
  return { rung: null, resp: null, last };
}

async function measureOne(entry, fetcher, rules, delayMs) {
  const url = entry.url;
  const { rung, resp, last } = await firstQualifyingRead(url, fetcher, delayMs);

  if (!resp) {
    return {
      url,
      cites: entry.cites,
      status: "unreachable",
      rung: last?.rung ?? null,
      httpStatus: last?.resp?.status ?? null,
      finalUrl: null,
      bytes: 0,
      proseBefore: null,
      proseAfter: null,
      gain: null,
      vetoedBefore: null,
      vetoedAfter: null,
      challengeSignatureBefore: null,
      challengeSignatureAfter: null,
      textBefore: null,
      textAfter: null,
      regionsAfter: null,
      bodyBefore: null,
      describedBefore: null,
    };
  }

  const finalUrl = resp.finalUrl || url;
  const after = computeSignals({
    headers: resp.headers,
    finalUrl,
    status: resp.status,
    claims: [],
    rules,
    rawBody: resp.rawBody,
  });
  const { body: oldBody, described: oldDescribed } = oldParts(resp.rawBody);
  // Byte-faithful to pre-0.6.0 `toText`: finish the join, not the parts.
  const oldText = oldToTextPreRoute2(resp.rawBody);
  const before = vetoSignalsForText(oldText, resp.rawBody, resp.headers, finalUrl, resp.status, rules);

  return {
    url,
    cites: entry.cites,
    status: "ok",
    rung,
    httpStatus: resp.status,
    finalUrl,
    bytes: resp.bytes,
    proseBefore: before.proseChars,
    proseAfter: after.signals.proseChars,
    gain: after.signals.proseChars - before.proseChars,
    vetoedBefore: before.vetoed,
    vetoedAfter: isBlocked(after.signals),
    challengeSignatureBefore: before.challengeSignature,
    challengeSignatureAfter: after.signals.challengeSignature,
    // regionsAfter is the SAME array check() matches claims against today
    // (SignalResult.regions) - kept separately from textAfter (which is just
    // regions.join(" ")) so a floor-crossing row can be duplicate-checked
    // against its own body region specifically, without re-fetching.
    regionsAfter: after.regions,
    // The old extractor's two parts, kept separate for the same reason:
    // oldText alone cannot distinguish "body" from "wrongly harvested
    // leak/loss" after the fact.
    bodyBefore: oldBody,
    describedBefore: oldDescribed || null,
    // Full toText output, both arms - not merely lengths - so a later pass
    // can tell whether a gain restates body text already present (ledes
    // commonly repeat the meta description) or is genuinely new prose,
    // without re-fetching 618 live pages to find out.
    textBefore: oldText,
    textAfter: after.text,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.corpusDir || !args.out) {
    usage();
    process.exit(1);
  }

  const urlsPath = join(args.corpusDir, "urls.json");
  const urlsData = JSON.parse(readFileSync(urlsPath, "utf8"));
  const urls = urlsData.urls;
  console.log(
    `corpus: itemCount=${urlsData.itemCount} missingUrl=${urlsData.missingUrl} ` +
      `publishedIssues=${urlsData.publishedIssues} urls=${urls.length}`,
  );
  if (urls.length !== EXPECTED_URL_COUNT) {
    console.error(
      `EXPECTED ${EXPECTED_URL_COUNT} URLS, GOT ${urls.length}. Per task-6 requirements this is a ` +
        `stop-and-report condition, not something to proceed past silently.`,
    );
    if (!args.force) process.exit(1);
    console.error("--force given: proceeding anyway.");
  }

  const rules = loadRules();
  const identity = args.identity ?? "testimonium-0.6.0-measurement noahogbi@gmail.com";
  const fetcher = defaultFetcher({ identity, hosts: rules.hosts });
  console.log(`identity: ${identity}`);
  console.log(`fetcher rungs: ${fetcher.rungs.join(", ")}`);
  console.log(`rate limit: ${args.delay}ms minimum between live fetch attempts`);

  const done = loadDoneUrls(args.out);
  console.log(`resuming: ${done.size} of ${urls.length} already recorded in ${args.out}`);

  const work = args.limit ? urls.slice(0, args.limit) : urls;
  let processed = done.size;
  for (const entry of work) {
    if (done.has(entry.url)) continue;
    const row = await measureOne(entry, fetcher, rules, args.delay);
    appendFileSync(args.out, `${JSON.stringify(row)}\n`, "utf8");
    processed++;
    console.log(
      `[${processed}/${work.length}] ${row.status} rung=${row.rung} ` +
        `before=${row.proseBefore} after=${row.proseAfter} gain=${row.gain}  ${entry.url}`,
    );
  }
  console.log(`done. ${processed}/${work.length} recorded in ${args.out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
