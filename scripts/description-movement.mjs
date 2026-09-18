/**
 * Measure what 0.5.0's description harvest (src/text/extract.ts, task 1)
 * moves on real bulletin source URLs. RUN BY HAND, against a live corpus.
 *
 *   node scripts/description-movement.mjs \
 *     --corpus-dir "C:/users/noaho/omnisscientia/docs/superpowers/worklogs/data/2026-09-13-subfloor" \
 *     --out <path/to/output.ndjson> \
 *     [--identity "<app> <contact email>"] [--delay 800] [--force]
 *
 * DESIGN (task-2-brief.md): fetch each URL ONCE, extract it TWICE from the
 * SAME bytes - once with every <meta> tag removed first ("before", what
 * pre-0.5.0 toText would have produced) and once untouched ("after", what
 * 0.5.0 actually produces). Comparing against the 2026-09-13 results.json
 * baseline instead would mix the fix's effect with four days of live-page
 * drift, and drift would be indistinguishable from movement - that file is
 * read only as a CROSS-CHECK, never as the comparison basis.
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

const DEFAULT_DELAY_MS = 800;
const EXPECTED_URL_COUNT = 618;
const META_TAG = /<meta\b[^>]*>/gi;

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
    };
  }

  const strippedBody = resp.rawBody.replace(META_TAG, " ");
  const commonInput = {
    headers: resp.headers,
    finalUrl: resp.finalUrl || url,
    status: resp.status,
    claims: [],
    rules,
  };
  const before = computeSignals({ ...commonInput, rawBody: strippedBody });
  const after = computeSignals({ ...commonInput, rawBody: resp.rawBody });

  return {
    url,
    cites: entry.cites,
    status: "ok",
    rung,
    httpStatus: resp.status,
    finalUrl: resp.finalUrl || url,
    bytes: resp.bytes,
    proseBefore: before.signals.proseChars,
    proseAfter: after.signals.proseChars,
    gain: after.signals.proseChars - before.signals.proseChars,
    vetoedBefore: isBlocked(before.signals),
    vetoedAfter: isBlocked(after.signals),
    challengeSignatureBefore: before.signals.challengeSignature,
    challengeSignatureAfter: after.signals.challengeSignature,
    // Full toText output, both arms - not merely lengths - so a later pass
    // can tell whether a gain restates body text already present (ledes
    // commonly repeat the meta description) or is genuinely new prose,
    // without re-fetching 618 live pages to find out.
    textBefore: before.text,
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
      `EXPECTED ${EXPECTED_URL_COUNT} URLS, GOT ${urls.length}. Per task-2 requirements this is a ` +
        `stop-and-report condition, not something to proceed past silently.`,
    );
    if (!args.force) process.exit(1);
    console.error("--force given: proceeding anyway.");
  }

  const rules = loadRules();
  const identity = args.identity ?? "testimonium-0.5.0-measurement noahogbi@gmail.com";
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
