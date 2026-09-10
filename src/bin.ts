#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { check } from "./check.js";
import { reachability } from "./reachability.js";
import { harvest } from "./harvest.js";
import { parseGfmFootnotes } from "./adapters/gfm-footnotes.js";
import { joinClaims, parseClaimsFile } from "./io/claims.js";
import { buildDraft, draftInTheWay, writeDraftFile } from "./io/draft.js";
import { writeEvidenceFile, type CitationResult } from "./io/evidence.js";
import { loadRules, type RuleSet } from "./rules/load.js";
import { VERSION } from "./version.js";
import { archiveKeyFor, sha256Hex } from "./archive/format.js";
import { buildArchiveEntry, recordingFetcher, type StagedEntry } from "./archive/record.js";
import { writeArchive } from "./archive/store.js";
import { defaultFetcher, type FetcherOptions } from "./fetch/default-fetcher.js";
import { pdftotextVersion } from "./fetch/pdf.js";
import type { Fetcher } from "./fetch/types.js";

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

const KNOWN_FLAGS = new Set([
  "--json",
  "--rules",
  "--fail-on-unreachable",
  "--allow-unclaimed",
  "--explain-fetch",
  "--no-archive",
]);

/** Exported so a test can assert it names every command this build has. A
 *  command the usage line does not name is a command nobody finds. */
export const USAGE =
  "usage: testimonium <check|harvest|reachability> <doc.md> " +
  "[--json] [--rules <path>] " +
  "(check only: [--fail-on-unreachable] [--allow-unclaimed] [--explain-fetch] [--no-archive])";

/**
 * The first `--flag` in argv this build does not recognize, or null when
 * every one is known.
 *
 * Without this, `node dist/bin.js check doc.md --fail-on-unrechable` (a
 * typo) exits 0 and prints nothing: a user who believes they hardened CI has
 * not, invisibly. That is the same silent-no-op class the bare `--rules`
 * guard below already exists for. `main()` is not exported, so this is
 * exported instead - tests call it directly rather than spawning a process.
 */
export function validateFlags(argv: readonly string[]): string | null {
  for (const a of argv) {
    if (a.startsWith("--") && !KNOWN_FLAGS.has(a)) return a;
  }
  return null;
}

// Exported for the test suite, the way validateFlags is - not for consumers:
// `./dist/bin.js` is not a subpath export and test/exports.test.ts pins that.
export function claimsPathFor(doc: string): string {
  return join(dirname(doc), `${basename(doc).replace(/\.[^.]+$/, "")}.claims.json`);
}

export function evidencePathFor(doc: string): string {
  return join(dirname(doc), `${basename(doc).replace(/\.[^.]+$/, "")}.evidence.json`);
}

/** `<doc>.claims.draft.json` - harvest's output, and never the claims file
 *  (spec 8.2 step 6). The author edits its proposals into the claims file
 *  and deletes it. */
export function draftPathFor(doc: string): string {
  return join(dirname(doc), `${basename(doc).replace(/\.[^.]+$/, "")}.claims.draft.json`);
}

/** `<doc>.archive/` - the bytes `recheck` controls against, beside the
 *  evidence file. Written by `check` on `supported` and by nothing else
 *  (spec 8.1's file list). */
export function archivePathFor(doc: string): string {
  return join(dirname(doc), `${basename(doc).replace(/\.[^.]+$/, "")}.archive`);
}

/** The one-line summary printed after harvest writes a draft to disk.
 *  Exported so a test can pin its grammar - singular "proposal" at exactly
 *  one - and its qualifier: `readableUrlCount` is `report.proposals.length`,
 *  one entry per READABLE source whether or not it proposed anything, not
 *  the number of keys in the draft `buildDraft` just wrote. `buildDraft`
 *  omits a zero-claim entry, so the two counts differ whenever any readable
 *  source proposed nothing, and "URLs" alone would read as a count of the
 *  file the author is about to open, which it is not. */
export function harvestSummaryLine(draftPath: string, totalProposals: number, readableUrlCount: number): string {
  return (
    `\nwrote ${draftPath} - ${totalProposals} proposal${totalProposals === 1 ? "" : "s"} ` +
    `across ${readableUrlCount} readable URLs`
  );
}

export interface ArchiveContext {
  /** The LIVE fetcher, before recording. `check` wraps it per citation. */
  readonly fetcher: Fetcher;
  readonly pdftotextVersion: string | null;
  readonly localRulesHash: string | null;
}

/** Injected only so a test never spawns a binary and never builds a real
 *  fetcher, the same way `pdfRungAvailable` takes its two predicates. */
export interface ArchiveDeps {
  readonly make?: (opts: FetcherOptions) => Fetcher;
  readonly version?: () => string | null;
}

/**
 * Everything the archive write needs, built once per run - or null when this
 * run must not archive.
 *
 * THE `{ hosts }` ARGUMENT IS LOAD-BEARING. `check()` builds its own fetcher as
 * `defaultFetcher(opts.rules ? { hosts: opts.rules.hosts } : {})`, and a CLI
 * that builds its own and omits it gives the author a `--rules` file that
 * loads, validates and is never consulted - the silent no-op an unwired
 * `hostRuleFor` already cost this project once.
 *
 * Returns null when a provenance fact cannot be established. Archiving must
 * never fail a run (13 Q4), and an entry recording `localRulesHash: null` when
 * a `--rules` file WAS passed would be a baseline that mis-reports the
 * local-rules confound for as long as it survives.
 */
export function archiveContextFor(rules: RuleSet, rulesPath: string | undefined, deps: ArchiveDeps = {}): ArchiveContext | null {
  let localRulesHash: string | null = null;
  if (rulesPath !== undefined) {
    try {
      localRulesHash = sha256Hex(readFileSync(rulesPath));
    } catch (e) {
      console.warn(`warn not archiving: could not hash ${rulesPath}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }
  const fetcher = (deps.make ?? defaultFetcher)({ hosts: rules.hosts });
  const probe = deps.version ?? pdftotextVersion;
  return {
    fetcher,
    // Only probe when the rung exists: the probe spawns a process, and a
    // machine with no pdftotext has no read to stamp a version on anyway.
    pdftotextVersion: fetcher.rungs.includes("pdftotext") ? probe() : null,
    localRulesHash,
  };
}

async function main(argv: string[]): Promise<number> {
  const unknownFlag = validateFlags(argv);
  if (unknownFlag) {
    console.error(`unknown flag ${unknownFlag}`);
    return 2;
  }
  const [command, doc] = argv;
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  if (!command || !doc) {
    console.error(USAGE);
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
  // front - before the command dispatch below - so it applies to all three
  // commands, and so a bad local file is reported clearly
  // rather than exploding mid-run on whichever citation happens to trip it
  // first. `reachability` walks the same ladder `check` does; a preflight
  // that ignores a local rule the gate honors is worse than no preflight.
  const rulesIdx = argv.indexOf("--rules");
  const rulesPath = rulesIdx !== -1 ? argv[rulesIdx + 1] : undefined;
  // A trailing `--rules` with no path yields undefined, which loadRules reads
  // as "bundled only" - the flag would silently do nothing, which is the
  // silent-no-op class this project keeps finding. Say so instead.
  if (rulesIdx !== -1 && (rulesPath === undefined || rulesPath.startsWith("--"))) {
    console.error("--rules requires a path to a local rules file");
    return 2;
  }
  let rules: RuleSet;
  try {
    rules = loadRules(rulesPath);
  } catch (e) {
    console.error(`cannot load rules: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }

  if (command === "reachability") {
    const urls = document.footnotes.map((f) => f.url).filter((u): u is string => u !== null);
    const r = await reachability(urls, { rules });
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

  if (command === "harvest") {
    // The existing claims file, when there is one. A document with none is
    // the ordinary case - it is what harvest exists to help write. A file
    // that EXISTS and the loader refuses is exit 2 with the loader's own
    // message and no lenient variant: uniform refusal means harvest does not
    // get a parser `check` does not have. The README's migration note is
    // written from this: fix the claims `check` names first, then harvest.
    const claimsPath = claimsPathFor(doc);
    let claims;
    if (existsSync(claimsPath)) {
      try {
        claims = parseClaimsFile(readFileSync(claimsPath, "utf8"));
      } catch (e) {
        console.error(`cannot read claims: ${e instanceof Error ? e.message : String(e)}`);
        return 2;
      }
    }

    const draftPath = draftPathFor(doc);
    const asJson = flags.has("--json");
    // Checked BEFORE any fetching: refusing after twenty requests wastes the
    // author's time and the hosts'. Under --json no draft is read or written
    // on disk, so there is nothing to overwrite and the rule does not apply.
    if (!asJson) {
      const blocked = draftInTheWay(draftPath);
      if (blocked) {
        console.error(blocked);
        return 2;
      }
    }

    const report = await harvest(document, { rules, ...(claims ? { claims } : {}) });

    // Under --json, stdout carries the draft and NOTHING else, so
    // `harvest doc.md --json > draft.json` produces a file `jq` and the
    // author's editor can both read. The per-URL report is still written -
    // she needs to know what each filter took - on stderr, where it does not
    // corrupt the document. (`check --json` mixes the two on stdout; that
    // inconsistency is plan 1's, and it is left where it is rather than
    // widened to a third command. Fable F6.)
    const say = asJson ? console.error : console.log;

    for (const p of report.proposals) {
      say(
        `  ${p.url} - ${p.claims.length} proposed via ${p.rungs.join(", ")} ` +
          `(dropped: ${p.drops.floor} below the floor, ${p.drops.frequency} also in another cited source, ` +
          `${p.drops.rules} by a boilerplate rule, ${p.drops.claimed} already claimed)`,
      );
      if (p.redirectedTo !== null) {
        say(
          `        REDIRECTED to ${p.redirectedTo} - a different path from the one you cited. ` +
            "Read these proposals against the page you actually got.",
        );
      }
      // Each `bugs` line is printed as it comes, with NO blanket `BUG:`
      // prefix: fix round 1 found that this field carries two distinguishable
      // causes, a genuine map-integrity defect and a benign norm()-boundary
      // drop that is explicitly labelled "NOT A BUG" in its own text (see
      // src/harvest.ts's HarvestProposal.bugs doc comment). A blanket prefix
      // would relabel the benign ones as defects and bury the real ones among
      // them.
      for (const bug of p.bugs) say(`        ${bug}`);
    }
    for (const u of report.unreachable) {
      say(`  ${u.url} - UNREADABLE, nothing proposed (tried: ${u.rungsAttempted.join(", ")})`);
    }
    for (const s of report.skipped) {
      say(`  ${s.url} - not applicable, skipped: ${s.reason}`);
    }
    if (report.frequencyVacuous) {
      say(
        "Fewer than two of your sources were readable, so the cross-source boilerplate filter " +
          "had nothing to compare against and dropped nothing.",
      );
    }

    // Every readable URL is handed over, including the ones that proposed
    // nothing; `buildDraft` is the single place that decides an empty entry
    // is omitted rather than written as `[]`, which is what keeps the draft a
    // file `parseClaimsFile` accepts on rename (Fable F1). The report line
    // above already told the author which URLs proposed 0.
    const draft = buildDraft({
      entries: report.proposals.map((p) => ({ url: p.url, claims: p.claims })),
      version: VERSION,
      date: new Date().toISOString().slice(0, 10),
    });

    // --json prints instead of writing, the convention `reachability --json`
    // follows - and, like it, stdout is pure JSON: the report went to stderr
    // above. `check --json` prints IN ADDITION on stdout, and that
    // inconsistency is plan 1's, recorded in spec 8.2 rather than resolved
    // here.
    if (asJson) {
      console.log(JSON.stringify(draft, null, 2));
    } else {
      writeDraftFile(draftPath, draft);
      const total = report.proposals.reduce((n, p) => n + p.claims.length, 0);
      console.log(harvestSummaryLine(draftPath, total, report.proposals.length));
      console.log(
        "Every claim in it is unconfirmed: harvest proposes what you COPIED, which is not always " +
          "what you CLAIM. Read each one against its source, move what you mean into the claims " +
          "file, and delete the draft.",
      );
    }
    // 0 whether or not anything was proposed. Harvest has no verdict to fail
    // on, so it has no exit 1 (spec 8.2, "Exit codes").
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
  // THE ARCHIVE IS WRITTEN HERE, NOT IN check(). `readSource` drops every
  // RawResponse the moment computeSignals has run on it and `SignalResult`
  // carries no rawBody, so the bytes exist only inside the fetcher (spec 8.3).
  // `--no-archive` means DO NOT WRAP, so the unwrapped path is byte-for-byte
  // what it was before this flag existed: check() builds its own fetcher.
  const archive = flags.has("--no-archive") ? null : archiveContextFor(rules, rulesPath);
  const staged = new Map<string, StagedEntry>();
  for (const c of joined.checkable) {
    const recorder = archive ? recordingFetcher(archive.fetcher) : null;
    // The label feeds C1's content-word pool, which is what gives a PDF at a
    // hashed URL something to correlate against.
    const r = await check(c.url, c.claims, {
      sourceLabel: c.label,
      rules,
      ...(recorder ? { fetcher: recorder.fetcher } : {}),
    });
    // ONLY `supported` writes a baseline. A failing check leaves the previous
    // one standing, which is what lets the author then ask `recheck` whether
    // the source moved as well (spec 8.3).
    if (archive && recorder && r.verdict === "supported") {
      staged.set(
        archiveKeyFor(c.url),
        buildArchiveEntry({
          verdict: r.verdict,
          claims: c.claims,
          reads: recorder.reads,
          toolVersion: VERSION,
          localRulesHash: archive.localRulesHash,
          pdftotextVersion: archive.pdftotextVersion,
          // A fresh stamp on every run, deliberately: `writeArchive` keeps the
          // EXISTING entry when nothing material changed (Task 5), so this
          // does not churn the committed index, and when something material
          // DID change this is the date it changed. That is what makes
          // `archivedAt` mean "established or last materially changed".
          archivedAt: new Date().toISOString(),
        }),
      );
    }
    results.push(r);
    if (r.verdict === "unsupported") {
      unsupported++;
      console.log(`  [${c.n}] unsupported - ${c.url}`);
      for (const m of r.missed ?? []) console.log(`        MISS: "${m}"`);
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

  // "Archiving must never fail a run" (13 Q4): one try/catch around one write,
  // in the CLI, rather than a guarantee about a callback the core invokes
  // mid-run. A refusal here - an index this build cannot parse, an unwritable
  // path - warns and leaves the run's own exit code alone.
  try {
    writeArchive(archivePathFor(doc), staged);
  } catch (e) {
    console.warn(`warn archive not written: ${e instanceof Error ? e.message : String(e)}`);
  }

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
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    // Without this, an infrastructure failure - an unwritable evidence path, a
    // fetcher bug - rejects the promise and Node exits 1, the code the README
    // and classifyRun both define as AUTHOR-FIXABLE. A CI gate would read a
    // broken tool as a broken citation.
    .catch((e: unknown) => {
      console.error(`testimonium failed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
      process.exit(2);
    });
}
