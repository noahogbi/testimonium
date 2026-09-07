#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { check } from "./check.js";
import { reachability } from "./reachability.js";
import { parseGfmFootnotes } from "./adapters/gfm-footnotes.js";
import { joinClaims, parseClaimsFile } from "./io/claims.js";
import { writeEvidenceFile, type CitationResult } from "./io/evidence.js";
import { loadRules, type RuleSet } from "./rules/load.js";

export interface RunTally {
  readonly unsupported: number;
  readonly unclaimed: number;
  readonly unreachable: number;
  readonly orphaned: number;
  readonly infrastructure: boolean;
}

export interface FailOn {
  readonly unreachable?: boolean;
  readonly unclaimed?: boolean;
  readonly orphanedClaims?: boolean;
}

/**
 * Exit 0 clean, 1 author-fixable defect, 2 infrastructure failure.
 *
 * An unclaimed citation fails by default: a gate that passes when nothing was
 * actually checked is the whole design's named top risk. `unreachable` does not
 * fail by default - it is an availability fact about us, not a credibility fact
 * about the claim - but a caller may opt in.
 */
export function classifyRun(t: RunTally, failOn: FailOn): 0 | 1 | 2 {
  if (t.infrastructure) return 2;
  const fail =
    t.unsupported > 0 ||
    (t.unclaimed > 0 && failOn.unclaimed !== false) ||
    (t.unreachable > 0 && failOn.unreachable === true) ||
    (t.orphaned > 0 && failOn.orphanedClaims === true);
  return fail ? 1 : 0;
}

function claimsPathFor(doc: string): string {
  return join(dirname(doc), `${basename(doc).replace(/\.[^.]+$/, "")}.claims.json`);
}

function evidencePathFor(doc: string): string {
  return join(dirname(doc), `${basename(doc).replace(/\.[^.]+$/, "")}.evidence.json`);
}

async function main(argv: string[]): Promise<number> {
  const [command, doc] = argv;
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  if (!command || !doc) {
    console.error(
      "usage: testimonium <check|reachability> <doc.md> " +
        "[--json] [--fail-on-unreachable] [--allow-unclaimed] [--explain-fetch] [--rules <path>]",
    );
    return 2;
  }

  let document;
  try {
    document = parseGfmFootnotes(readFileSync(doc, "utf8"));
  } catch (e) {
    console.error(`cannot read ${doc}: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }

  // --rules <path>: additive-only local override (Task 15). Loaded once, up
  // front, so a bad local file is reported clearly rather than exploding
  // mid-run on whichever citation happens to trip it first.
  const rulesIdx = argv.indexOf("--rules");
  const rulesPath = rulesIdx !== -1 ? argv[rulesIdx + 1] : undefined;
  let rules: RuleSet;
  try {
    rules = loadRules(rulesPath);
  } catch (e) {
    console.error(`cannot load rules: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }

  if (command === "reachability") {
    const urls = document.footnotes.map((f) => f.url).filter((u): u is string => u !== null);
    const r = await reachability(urls);
    if (flags.has("--json")) console.log(JSON.stringify(r, null, 2));
    else {
      for (const x of r.readable) console.log(`  readable    ${x.url} (${x.proseChars} chars via ${x.rung})`);
      for (const x of r.unreadable) {
        console.log(`  UNREADABLE  ${x.url} - ${x.reason} (tried: ${x.rungsAttempted.join(", ")})`);
      }
      console.log(`\n${r.readable.length}/${urls.length} readable (${(r.rate * 100).toFixed(1)}%)`);
      console.log("This is YOUR corpus's number. Do not compare it to anyone else's.");
    }
    return 0;
  }

  if (command !== "check") {
    console.error(`unknown command ${command}`);
    return 2;
  }

  let joined;
  try {
    joined = joinClaims(document.footnotes, parseClaimsFile(readFileSync(claimsPathFor(doc), "utf8")));
  } catch (e) {
    console.error(`cannot read claims: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }

  const results: CitationResult[] = [];
  let unsupported = 0;
  let unreachable = 0;
  for (const c of joined.checkable) {
    // The label feeds C1's content-word pool, which is what gives a PDF at a
    // hashed URL something to correlate against.
    const r = await check(c.url, c.claims, { sourceLabel: c.label, rules });
    results.push(r);
    if (r.verdict === "unsupported") {
      unsupported++;
      console.log(`  [${c.n}] unsupported - ${c.url}`);
      for (const m of r.missed) console.log(`        MISS: "${m}"`);
    } else if (r.verdict === "unreachable") {
      unreachable++;
      // Silent to a reader, NEVER to the author: URL and rung history, always.
      const trunc = r.ladderTruncated ? `, ladder truncated: ${r.rungsAvailable.join(", ")} only` : "";
      console.log(`  [${c.n}] unreachable - ${c.url} (tried: ${r.rungsAttempted.join(", ")}${trunc})`);
    } else {
      console.log(`  [${c.n}] supported (${c.claims.length} claims) - ${c.url}`);
    }
    if (flags.has("--explain-fetch") && r.firedRule) {
      const age = Math.round((Date.now() - Date.parse(r.firedRule.lastConfirmed)) / 86_400_000);
      console.log(`        rule fired: ${r.firedRule.note} (last confirmed ${age} days ago)`);
    }
  }
  // not_applicable is signposted, never silenced: a clause resting on a primary
  // document rather than the cited outlet "will miss by design", and the author
  // said so on purpose.
  for (const na of joined.notApplicable) {
    console.log(`  [${na.n}] not applicable - ${na.reason}`);
  }
  for (const u of joined.unclaimed) console.log(`  [${u.n}] NO CLAIMS RECORDED - ${u.url}`);
  for (const o of joined.orphanedClaims) console.log(`  warn claimed but no longer cited: ${o}`);

  writeEvidenceFile(evidencePathFor(doc), results);
  if (flags.has("--json")) console.log(JSON.stringify({ version: 1, results }, null, 2));

  console.log(
    `\n${unsupported} unsupported, ${unreachable} unreachable, ${joined.unclaimed.length} without claims`,
  );
  if (unreachable > 0) {
    console.log("Unreachable is not a failure and is never shown to a reader. Read each one and decide.");
  }

  if (joined.unclaimed.length > 0 && !flags.has("--allow-unclaimed")) {
    console.log("A footnote with no claims is unverified. Pass --allow-unclaimed to accept that.");
  }

  return classifyRun(
    {
      unsupported,
      unclaimed: joined.unclaimed.length,
      unreachable,
      orphaned: joined.orphanedClaims.length,
      infrastructure: false,
    },
    {
      unreachable: flags.has("--fail-on-unreachable"),
      // A gate that passes when nothing was actually checked is the design's
      // named top risk, so unclaimed fails unless the author opts out here.
      unclaimed: !flags.has("--allow-unclaimed"),
    },
  );
}

/**
 * Direct-invocation guard.
 *
 * NOT `import.meta.url === \`file://${process.argv[1]}\``. On Windows that
 * compares "file:///C:/Users/..." against "file://C:\Users\..." - three slashes
 * versus two, forward versus back - so it is never equal and `bin.js` becomes a
 * silent no-op that exits 0. pathToFileURL produces the same form on every
 * platform.
 */
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
