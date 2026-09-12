#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { check } from "./check.js";
import { reachability } from "./reachability.js";
import { harvest } from "./harvest.js";
import { recheck } from "./recheck.js";
import type { CitationOutcome } from "./archive/compare.js";
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
import { classifyRun, type RunTally, type FailOn } from "./run/classify.js";

export interface RecheckTally {
  readonly sourceDrift: number;
  readonly pipelineDrift: number;
  readonly gone: number;
}

/**
 * `recheck`'s exit policy. **For `recheck`, 1 DOMINATES 2** - deliberately
 * unlike `classifyRun` above.
 *
 * Under `check` a 2 means the tool could not do its job and the run is void, so
 * infrastructure is tested first and wins outright: there is nothing
 * author-actionable to preserve. Under `recheck` both signals are real results
 * about different citations, and letting our own regression mask genuine source
 * drift at the exit code would be this tool's defect suppressing the author's
 * news. Both are named in the report either way; only the code is forced to
 * choose.
 *
 * There is deliberately NO `infrastructure` member here. In `recheck` an
 * infrastructure failure is a PRE-COMPARISON one - an unreadable document, an
 * unreadable claims file, unloadable rules - and `main` returns 2 for it before
 * any tally exists. A member this function could only ever be handed `false`
 * would be an option it ignores, which is worse than no option.
 *
 * What 1-versus-2 delivers is ATTRIBUTION, not a passing build: exit 2 fails
 * every naive `set -e` gate exactly as exit 1 does. The author is never told to
 * fix their document for a defect that is ours.
 */
export function classifyRecheckRun(t: RecheckTally, opts: { readonly failOnGone?: boolean }): 0 | 1 | 2 {
  if (t.sourceDrift > 0) return 1;
  // A genuinely dead link is the author's to fix, which is why the opt-in
  // exists - and why it contributes 1 rather than 2. Failing by default would
  // accuse over a transiently misconfigured 404.
  if (t.gone > 0 && opts.failOnGone === true) return 1;
  if (t.pipelineDrift > 0) return 2;
  return 0;
}

/**
 * The per-outcome report lines for `recheck`, pulled out of `main` so THE
 * ACCUSATION GATE IS A PURE FUNCTION A TEST CAN DRIVE DIRECTLY, rather than a
 * branch buried inside an unexported `main()` that only the manual
 * end-to-end check can reach.
 *
 * `missed` is present on EVERY `CitationOutcome`, including rows that do not
 * accuse (see `RecheckReport.outcomes`'s doc comment in `src/recheck.ts`),
 * and this is the ONE place that decides whose row gets to print it as a
 * `MISS:` line: `category === "sourceDrift"`, and nothing else. Gate
 * categorically on that - never on an enumeration of what to exclude - so a
 * `DriftCategory` added later inherits silence by default rather than
 * inheriting an accusation.
 *
 * `rungsAttempted` is the one field the `unreachable` row needs that does not
 * live on `CitationOutcome` itself (`CitationResult` carries no status, so it
 * comes from the live arm's own result at the same index); omitted, it
 * renders as "tried: " with nothing named, which is still correct, just
 * silent about the ladder.
 */
export function renderOutcome(o: CitationOutcome, n: number, rungsAttempted: readonly string[] = []): string[] {
  const lines: string[] = [];
  // The BUNDLED rules moving is named as a likely cause and changes
  // nothing: it is never a confound, because treating a version bump as one
  // would suppress the comparison on every citation after every release and
  // retire the instrument by upgrading it.
  const bundled = o.bundledVersionChanged
    ? ` (the bundled rules moved: archived under ${o.archivedToolVersion}, running ${VERSION})`
    : "";
  if (o.category === "sourceDrift") {
    lines.push(`  [${n}] SOURCE DRIFT - ${o.url}`);
    lines.push(`        archived ${o.archivedAt}: the stored bytes still prove this claim and the live page does not`);
    for (const m of o.missed) lines.push(`        MISS: "${m}"`);
  } else if (o.category === "pipelineDrift") {
    lines.push(`  [${n}] pipeline drift - ${o.url} (live ${o.live}, archived bytes ${o.archived})${bundled}`);
    lines.push("        This is a regression in testimonium, not a defect in your document.");
  } else if (o.category === "gone") {
    // `archivedAt` is when the baseline was established or last MATERIALLY
    // changed - the store preserves an entry that changed in nothing
    // material - so this line reads "gone since at least that date".
    lines.push(`  [${n}] gone since ${o.archivedAt} - ${o.url}`);
    // THE ONE ROW THAT CAN CARRY CONFOUNDS. The gone row is evaluated above
    // the named confounds (spec 8.3 as amended), because no confound can
    // explain an origin's 404 - so print them here: the reorder changes
    // which category wins, not what the author is told.
    for (const c of o.confounds) lines.push(`        ${c}`);
  } else if (o.category === "unreachable") {
    lines.push(`  [${n}] unreachable now - ${o.url} (tried: ${rungsAttempted.join(", ")})`);
  } else if (o.category === "confounded") {
    lines.push(`  [${n}] not compared - ${o.url}`);
    for (const c of o.confounds) lines.push(`        ${c}`);
  } else if (o.category === "noBaseline") {
    lines.push(`  [${n}] no baseline - ${o.url} (live: ${o.live})`);
  } else if (o.category === "unclaimed") {
    lines.push(`  [${n}] NO CLAIMS RECORDED - ${o.url}`);
  } else {
    lines.push(`  [${n}] clean - ${o.url}${bundled}`);
  }
  // `liveGone` is set only when the live arm came back UNREACHABLE (Fable's
  // correction 5), so this clause can no longer print under a citation the
  // ladder went on to read: a node rung that 404s before a curl rung reads
  // the document is L = supported, and telling that author their source may
  // be gone is a false alarm. With the gone row now above the confounds,
  // what is left for this flag is the `noBaseline` row (entry absent, or R
  // violated), where the gone check is never reached.
  if (o.liveGone && o.category !== "gone") {
    lines.push("        the live read was a 404 or 410, so this source may be gone");
  }
  return lines;
}

/**
 * `recheck --json`'s accusation gate, twin to `renderOutcome`'s above. `missed`
 * is present on every `CitationOutcome` (see `RecheckReport.outcomes`'s doc
 * comment in `src/recheck.ts`) whether or not the row accuses, and the `--json`
 * payload used to emit `report.outcomes` unfiltered - so a `confounded` row
 * that prints "not compared" to the terminal still carried a `missed` list in
 * the JSON. Spec 7.4's doctrine is that the output schema cannot EXPRESS an
 * accusation, so this gates categorically on `category === "sourceDrift"`,
 * exactly as `renderOutcome` does - never on an enumeration of what to
 * exclude - so a `DriftCategory` added later inherits silence by default.
 */
export function jsonOutcome(o: CitationOutcome): CitationOutcome {
  return o.category === "sourceDrift" ? o : { ...o, missed: [] };
}

/**
 * `RecheckReport.archiveUnreadable`, surfaced as its own notice in the
 * printed report rather than left to `recheck()`'s internal `console.warn`.
 *
 * When the archive exists but this build could not read it, every citation
 * degrades to `noBaseline` and the run exits 0 - which, read on its own,
 * looks exactly like "you never ran check", a materially different thing to
 * tell the author than "your archive exists and is corrupt". This function
 * exists so that distinction reaches the report, not just stderr.
 */
export function archiveUnreadableNotice(archiveUnreadable: string | null): string[] {
  if (archiveUnreadable === null) return [];
  return [
    `\nARCHIVE UNREADABLE: ${archiveUnreadable}`,
    "Every citation below reports \"no baseline\" because of that - not because check was never run.",
  ];
}

const KNOWN_FLAGS = new Set([
  "--json",
  "--rules",
  "--identity",
  "--fail-on-unreachable",
  "--allow-unclaimed",
  "--explain-fetch",
  "--no-archive",
  "--fail-on-gone",
  "--help",
]);

/** Exported so a test can assert it names every command this build has. A
 *  command the usage line does not name is a command nobody finds. */
export const USAGE =
  "usage: testimonium <check|harvest|recheck|reachability> <doc.md> " +
  "[--json] [--rules <path>] [--identity <app contact-email>] " +
  "(check only: [--fail-on-unreachable] [--allow-unclaimed] [--explain-fetch] [--no-archive]) " +
  "(recheck only: [--fail-on-gone]) " +
  "| testimonium --help|-h";

/**
 * The first `--flag` in argv this build does not recognize, or null when
 * every one is known.
 *
 * Without this, `node dist/bin.js check doc.md --fail-on-unrechable` (a
 * typo) exits 0 and prints nothing: a user who believes they hardened CI has
 * not, invisibly. That is the same silent-no-op class the bare `--rules`
 * guard below already exists for. Most of `main()`'s branches touch the
 * filesystem or the network, which is why this - and the other pure pieces
 * below it - are exported for direct testing rather than routed through a
 * spawned process; `main()` itself is exported too (Task 16), but only for
 * the one branch (`--help`/`-h`) that touches neither.
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
 * THE `{ hosts }` ARGUMENT IS LOAD-BEARING, and so is `identity` beside it.
 * `check()` and `recheck()` both build their live fetcher through
 * `buildFetcher()` (src/fetch/build-fetcher.ts), and this function is a
 * SECOND, CLI-ONLY construction site for that same live fetcher: `check`'s
 * command below hands it the fetcher it uses whenever archiving is on (the
 * default - see `--no-archive`), and `recheck`'s command hands it over
 * unconditionally. A `--identity` value stops at check()'s or recheck()'s own
 * options object whenever THIS function is the one that actually built the
 * fetcher in use, exactly as a `--rules` file's host rules would - the same
 * silent no-op an unwired `hostRuleFor` already cost this project once, and
 * the reason `identity` is threaded all the way to this call.
 *
 * Returns null when a provenance fact cannot be established. Archiving must
 * never fail a run (13 Q4), and an entry recording `localRulesHash: null` when
 * a `--rules` file WAS passed would be a baseline that mis-reports the
 * local-rules confound for as long as it survives.
 */
export function archiveContextFor(
  rules: RuleSet,
  rulesPath: string | undefined,
  identity: string | undefined,
  deps: ArchiveDeps = {},
): ArchiveContext | null {
  let localRulesHash: string | null = null;
  if (rulesPath !== undefined) {
    try {
      localRulesHash = sha256Hex(readFileSync(rulesPath));
    } catch (e) {
      console.warn(`warn not archiving: could not hash ${rulesPath}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }
  const fetcher = (deps.make ?? defaultFetcher)({ hosts: rules.hosts, ...(identity ? { identity } : {}) });
  const probe = deps.version ?? pdftotextVersion;
  return {
    fetcher,
    // Only probe when the rung exists: the probe spawns a process, and a
    // machine with no pdftotext has no read to stamp a version on anyway.
    pdftotextVersion: fetcher.rungs.includes("pdftotext") ? probe() : null,
    localRulesHash,
  };
}

// Exported so a test can pin the exit code directly (Ruling T11-R1): before
// this, `node dist/bin.js --help` printed `unknown flag --help` and exited 2,
// the most-typed flag on a published CLI erroring on first contact. A usage
// string printed with exit 2 looks identical to one printed with exit 0 in a
// terminal, so a test that only checks WHAT was printed would pass on the
// broken behaviour; this is the one main() branch that touches neither the
// filesystem nor the network, which is what makes exporting main() itself
// (rather than yet another extracted pure function) the direct way to pin it.
export async function main(argv: string[]): Promise<number> {
  // Checked before validateFlags AND before the `!command || !doc` branch
  // below, deliberately (fix round 1, Important 3 - an earlier version of
  // this comment said `--help` "is not in KNOWN_FLAGS's normal sense", which
  // was false: `--help` IS a KNOWN_FLAGS entry, so validateFlags alone would
  // never reject it). The real reason for checking here, first: ordering.
  // `check doc.md --bogus --help` must still print help rather than
  // "unknown flag --bogus", and bare `--help` (no command, no doc) must
  // print help rather than fall into the missing-doc branch two checks below
  // - which is exactly where it would land if this ran after argv were
  // destructured into `[command, doc]`, since `--help` has no doc to its
  // right. Matched anywhere in argv, not just first position, so
  // `check doc.md --help` asks for help exactly as bare `--help` does. `-h`
  // is a single dash and validateFlags never inspects those (see its own
  // characterization test), so it needs no KNOWN_FLAGS entry - only this
  // direct check.
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return 0;
  }
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
  // front - before the command dispatch below - so it applies to all four
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

  // --identity <value>: declares a UA for hosts that require one (sec.gov's
  // "<app> <contact email>"), forwarded into every command exactly as
  // --rules is. Parsed the same way and for the same reason: a trailing
  // --identity with no value, or one immediately followed by another flag,
  // would otherwise silently do nothing - the exact silent-no-op class this
  // task exists to close (Ruling T5-R1). Unlike --rules, an absent identity
  // is not itself refused anywhere below: the fetcher warns per-host and
  // falls back to a browser UA (userAgentFor) rather than failing the run.
  //
  // `identity.trim() === ""` is refused for the SAME reason (fix round 1,
  // Minor 5). Without it, `--identity ""` passed the checks above (it is not
  // `undefined` and does not start with "--") and exited 0 having configured
  // nothing: every downstream spread is `identity ? { identity } : {}`,
  // falsy for "", so it was dropped silently one layer down - the CLI
  // reported success for a flag that did exactly what omitting it does. This
  // guard also refuses a whitespace-only value ("--identity ' '"), which
  // would otherwise be TRUTHY and survive every downstream spread including
  // userAgentFor's own `if (!opts.identity)` check, arriving as a garbage UA
  // string rather than being dropped - a second, worse silent failure this
  // one check closes at no extra cost.
  const identityIdx = argv.indexOf("--identity");
  const identity = identityIdx !== -1 ? argv[identityIdx + 1] : undefined;
  if (
    identityIdx !== -1 &&
    (identity === undefined || identity.startsWith("--") || identity.trim() === "")
  ) {
    console.error('--identity requires a value ("<app> <contact email>")');
    return 2;
  }

  if (command === "reachability") {
    const urls = document.footnotes.map((f) => f.url).filter((u): u is string => u !== null);
    const r = await reachability(urls, { rules, ...(identity ? { identity } : {}) });
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

    const report = await harvest(document, {
      rules,
      ...(claims ? { claims } : {}),
      ...(identity ? { identity } : {}),
    });

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

  if (command === "recheck") {
    let joined;
    try {
      joined = joinClaims(document.footnotes, parseClaimsFile(readFileSync(claimsPathFor(doc), "utf8")));
    } catch (e) {
      console.error(`cannot read claims: ${e instanceof Error ? e.message : String(e)}`);
      return 2;
    }

    // The live fetcher plus the two provenance facts the comparison needs.
    // Unlike `check`, a null context here is an INFRASTRUCTURE FAILURE rather
    // than "do not archive": `recheck` writes nothing, but a localRulesHash it
    // could not compute would feed the local-rules confound a wrong answer, and
    // a wrong confound input is one of the few ways this command could mint an
    // exit 1 it has no licence for.
    //
    // `ctx.fetcher` is what `recheck()` below receives as its LIVE fetcher, so
    // `identity` has to reach it HERE, not just in `recheck()`'s own options
    // object: `RecheckOptions.fetcher` is always set on this call site, and
    // buildFetcher()'s first branch (bring-your-own-fetcher) always wins over
    // an `identity` field sitting beside it - an option that reaches no
    // command is this codebase's own named failure shape.
    const ctx = archiveContextFor(rules, rulesPath, identity);
    if (ctx === null) {
      console.error("cannot establish rules provenance, so the comparison would be unsound");
      return 2;
    }

    const report = await recheck(
      joined.checkable.map((c) => ({ url: c.url, label: c.label, claims: c.claims })),
      {
        archiveDir: archivePathFor(doc),
        rules,
        fetcher: ctx.fetcher,
        localRulesHash: ctx.localRulesHash,
        pdftotextVersion: ctx.pdftotextVersion,
      },
    );

    // Surfaced as its own notice, distinct from the per-citation `noBaseline`
    // rows an unreadable archive degrades every one of them to: to an author
    // that degradation reads as "you never ran check", not "your archive
    // exists and is corrupt" - a materially different thing to be told.
    for (const line of archiveUnreadableNotice(report.archiveUnreadable)) console.log(line);

    let sourceDrift = 0;
    let pipelineDrift = 0;
    let gone = 0;
    // outcomes are 1:1 with the citations handed in, in order.
    for (const [i, o] of report.outcomes.entries()) {
      const n = joined.checkable[i]?.n ?? i + 1;
      if (o.category === "sourceDrift") sourceDrift++;
      else if (o.category === "pipelineDrift") pipelineDrift++;
      else if (o.category === "gone") gone++;
      for (const line of renderOutcome(o, n, report.liveResults[i]?.rungsAttempted ?? [])) console.log(line);
    }

    // Reported exactly as `check` reports them, from the same joinClaims output.
    for (const na of joined.notApplicable) console.log(`  [${na.n}] not applicable - ${na.reason}`);
    for (const u of joined.unclaimed) console.log(`  [${u.n}] NO CLAIMS RECORDED - ${u.url}`);
    for (const o of joined.orphanedClaims) console.log(`  warn claimed but no longer cited: ${o}`);

    // The LIVE arm's results, which is the same thing `check` writes there and
    // the only arm whose verdicts describe the world. `recheck` writes nothing
    // into the archive and never refreshes a baseline.
    writeEvidenceFile(evidencePathFor(doc), report.liveResults);
    if (flags.has("--json")) {
      const drift = report.outcomes.map(jsonOutcome);
      console.log(JSON.stringify({ version: 1, results: report.liveResults, drift }, null, 2));
    }

    console.log(`\n${sourceDrift} source drift, ${pipelineDrift} pipeline drift, ${gone} gone since archiving`);
    console.log(
      "recheck detects change, never correctness: a source that was already wrong when it was archived is archived wrong.",
    );
    return classifyRecheckRun({ sourceDrift, pipelineDrift, gone }, { failOnGone: flags.has("--fail-on-gone") });
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
  //
  // `identity` is passed to `archiveContextFor` here for the SAME reason it is
  // passed to `check()` below: whichever call actually builds the fetcher in
  // use for this run is the one that has to see it. With archiving on (the
  // default), that is this call - `check()`'s own `opts.fetcher` is set below
  // and its own identity spread never runs. With `--no-archive`, `archive` is
  // null, `recorder` is null, and `check()`'s own buildFetcher call is the one
  // that has to see it instead - which is why it is ALSO passed below.
  const archive = flags.has("--no-archive") ? null : archiveContextFor(rules, rulesPath, identity);
  const staged = new Map<string, StagedEntry>();
  for (const c of joined.checkable) {
    const recorder = archive ? recordingFetcher(archive.fetcher) : null;
    // The label feeds C1's content-word pool, which is what gives a PDF at a
    // hashed URL something to correlate against.
    const r = await check(c.url, c.claims, {
      sourceLabel: c.label,
      rules,
      // Harmless to include even when `recorder` is also set: buildFetcher's
      // bring-your-own-fetcher branch (opts.fetcher first) ignores `identity`
      // entirely once a fetcher is supplied, so this only takes effect on the
      // `--no-archive` path, where `identity` above is the one that matters.
      ...(identity ? { identity } : {}),
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
