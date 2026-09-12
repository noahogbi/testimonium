/**
 * Task 17 (spec 0.2.0). Which verdicts move between 0.1.0 and 0.2.0, and why.
 *
 * RUN: node scripts/verdict-movement.mjs
 *
 * With no argument it is fully self-contained: it checks out the exact tree
 * published as testimonium@0.1.0 (commit 47620c6 - npm's own `gitHead` for
 * that version) into a throwaway `git worktree`, builds it, imports its
 * `dist/index.js`, and removes the worktree again before exiting. Pass an
 * existing 0.1.0 `dist/index.js` path as argv[2] to skip that provisioning
 * step (useful for re-running quickly during development).
 *
 * INTERFACES: this script consumes ONLY what `src/index.ts` exports - from
 * BOTH versions - never an internal module (no `text/extract.js`,
 * `classify/signals.js`, etc., unlike the acceptance tests or the other
 * scripts/ files, which are allowed to reach into src/ because they ship
 * inside the same package as the code they measure). That restriction is
 * deliberate: a comparison that only needs `check()`, `VERSION` and `norm()`
 * to do its job is itself a demonstration that the public surface is enough
 * to build this kind of tool on - the script doubles as a parity check.
 *
 * THE CLAIMS TRAP: fixtures/corpus.json rows are `{path, kind, url, title,
 * status}` - they carry no claims. Calling check(url, []) reads `unclaimed`
 * on every row in both versions, so "zero corpus movement" would pass
 * without ever exercising the classifier. Every row here is checked with a
 * synthesized, non-empty, floor-clearing claim (see `claimFor` below), and
 * the full claim set is asserted non-empty before the comparison loop runs.
 *
 * THE ESCALATION TRAP: 0.2.0's headline change (spec 0.2.0 section 4,
 * `check()` in src/check.ts) climbs one more rung before returning
 * `unsupported`, so a JS/consent shell that clears the prose floor no longer
 * ends the ladder with the real document unread. fixtures/corpus.json CANNOT
 * exercise this: every row is one file, one body - so whichever rung the
 * fetcher stub is asked for, it replays the SAME bytes, and escalating changes
 * nothing. fixtures/paired/{shell-node,document-curl}.html exists precisely
 * because the corpus cannot express this (see test/fetch/escalation.test.ts's
 * own comment on the same point) - it is checked separately, below the corpus
 * loop, with a fetcher that returns a DIFFERENT body per rung.
 *
 * If the corpus loop finds movement anyway, this script does not paper over
 * it: it prints every moved row and exits 1. Movement there would mean
 * something OTHER than escalation changed between the two versions, and that
 * is a finding to stop and investigate, not a line item for the report.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const RELEASE_COMMIT = "47620c6"; // npm's gitHead for testimonium@0.1.0.
const npmCmd = "npm";
const gitCmd = "git";

function run(cmd, args, cwd) {
  // On Windows, npm resolves to npm.cmd - a batch file, which execFileSync
  // cannot spawn directly (EINVAL) without shell:true. Enabling it only on
  // win32 keeps the POSIX path exactly as before; every argument here is an
  // internal path or a fixed flag, never unsanitized input.
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
}

/** Adds the throwaway worktree at RELEASE_COMMIT and returns
 *  { worktreeDir, cleanup() } IMMEDIATELY - before the (slower, more likely
 *  to fail) npm ci/build step - so a caller can register cleanup in a
 *  try/finally that covers the build too. A worktree added successfully but
 *  never removed because a LATER step threw would otherwise leak on every
 *  failed run. */
function addZeroOneZeroWorktree() {
  execFileSync(gitCmd, ["cat-file", "-e", `${RELEASE_COMMIT}^{commit}`], { cwd: repoRoot });
  const worktreeDir = mkdtempSync(join(tmpdir(), "testimonium-0.1.0-"));
  // mkdtempSync already created worktreeDir; `git worktree add` refuses to
  // add into an existing non-empty directory but is fine with an existing
  // EMPTY one, which is exactly what mkdtempSync just gave us.
  console.log(`Provisioning 0.1.0 from commit ${RELEASE_COMMIT} into ${worktreeDir} ...`);
  run(gitCmd, ["worktree", "add", "--detach", worktreeDir, RELEASE_COMMIT], repoRoot);
  return {
    worktreeDir,
    cleanup() {
      console.log(`Removing temporary worktree ${worktreeDir} ...`);
      try {
        run(gitCmd, ["worktree", "remove", "--force", worktreeDir], repoRoot);
      } catch (e) {
        console.warn(`warn: git worktree remove failed (${e.message}); removing the directory directly`);
        rmSync(worktreeDir, { recursive: true, force: true });
        try {
          run(gitCmd, ["worktree", "prune"], repoRoot);
        } catch {
          // best effort
        }
      }
    },
  };
}

/** Builds the 0.1.0 worktree (npm ci runs its own "prepare" -> "build") and
 *  returns the path to its dist/index.js. Separate from
 *  addZeroOneZeroWorktree so the worktree-add and the build sit on either
 *  side of the try/finally boundary in main(). */
function buildZeroOneZero(worktreeDir) {
  console.log('Running npm ci (runs the build via its own "prepare" script) ...');
  run(npmCmd, ["ci", "--no-audit", "--no-fund"], worktreeDir);
  return join(worktreeDir, "dist", "index.js");
}

// --- Claim synthesis (script-local; NOT testimonium's own text extraction) -

/** A deliberately crude, self-rolled HTML-to-text pass. This is the script's
 *  own logic, not a call into src/text/extract.js - see the file docstring on
 *  why this script stays off internal modules. It only needs to produce SOME
 *  real prose to slice a claim from; it does not need to match testimonium's
 *  own extraction byte for byte. */
function crudeText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&mdash;/gi, "-")
    .replace(/&rsquo;/gi, "'")
    .replace(/&hellip;/gi, "...")
    .replace(/\s+/g, " ")
    .trim();
}

/** Word-aligned at both edges, from the middle - a real phrase rather than a
 *  fragment, and (for a `document` row) a phrase the fixture itself carries,
 *  so the claim exercises the matching path rather than trivially missing.
 *  Mirrors test/classify/corpus-verdict.test.ts's own approach, minus its use
 *  of the internal `toText`. */
function sliceClaim(text, width) {
  const mid = Math.floor(text.length / 2);
  return text
    .slice(mid, mid + width)
    .replace(/^\S*\s/, "")
    .replace(/\s\S*$/, "");
}

const NEGATIVE_CLAIM =
  "a claim that this script certainly did not lift from any fixture body, used to probe challenge and known-gap rows";

/** Builds the one claim used for a corpus row, in both versions. `document`
 *  rows get a real phrase sliced from their own (crudely extracted) text, so
 *  the comparison exercises matching, excerpting and evidence assembly, not
 *  just the floor/veto path; `challenge` and `known-gap` rows get the fixed
 *  negative claim, mirroring corpus-verdict.test.ts's own split. */
function claimFor(row, minLen) {
  if (row.kind !== "document") return NEGATIVE_CLAIM;
  const text = crudeText(readFileSync(row.path, "utf8"));
  let claim = sliceClaim(text, 60);
  if (claim.length < minLen) claim = sliceClaim(text, 200);
  if (claim.length < minLen) claim = text.slice(0, Math.max(minLen, 200)).trim();
  return claim;
}

/** A Fetcher (the public `Fetcher` interface from src/fetch/types.ts) that
 *  replays fixed bytes for every rung it is asked for - `bodyForRung`
 *  defaults to "same body whatever the rung", which is what makes a corpus
 *  row single-bodied: node and curl replay IDENTICAL bytes, so escalating
 *  from one to the other cannot change what the classifier sees. The paired
 *  fixture overrides `bodyForRung` to return a DIFFERENT body per rung, which
 *  is the only way escalation can move a verdict at all. */
function replayFetcher(status, bodyForRung, rungs = ["node", "curl"]) {
  return {
    rungs,
    async fetch(url, rung) {
      const rawBody = bodyForRung(rung);
      return { rawBody, headers: {}, finalUrl: url, status, bytes: rawBody.length };
    },
  };
}

function reasonFor(oldR, newR) {
  if (oldR.verdict === newR.verdict) return "unchanged";
  const oldRungs = oldR.rungsAttempted.join("+");
  const newRungs = newR.rungsAttempted.join("+");
  if (newRungs !== oldRungs) {
    return (
      `0.2.0 escalated past 0.1.0's ladder (${oldRungs} -> ${newRungs}) before returning a verdict; ` +
      `0.1.0 has no escalation and stopped at ${oldRungs}`
    );
  }
  return `verdict differs on the SAME rungs attempted (${newRungs}) - not an escalation effect`;
}

function padTo(s, n) {
  return s.length >= n ? s.slice(0, n - 1) + "~" : s.padEnd(n);
}

function printRow(oldV, newV, kind, label, reason) {
  console.log(`  ${padTo(oldV, 12)} -> ${padTo(newV, 12)} [${padTo(kind, 11)}] ${padTo(label, 60)} ${reason}`);
}

async function main() {
  const providedOldDist = process.argv[2];
  const worktree = providedOldDist ? null : addZeroOneZeroWorktree();

  try {
    const oldDistIndexPath = providedOldDist ?? buildZeroOneZero(worktree.worktreeDir);

    console.log("Building current HEAD (0.2.0-in-progress) ...");
    run(npmCmd, ["run", "build"], repoRoot);

    const oldMod = await import(pathToFileURL(oldDistIndexPath).href);
    const newMod = await import(pathToFileURL(join(repoRoot, "dist", "index.js")).href);

    // CONFIRM THE 0.1.0 SIDE ACTUALLY RAN. A comparison against a mis-built
    // or stale tree would produce a clean report that means nothing.
    if (oldMod.VERSION !== "0.1.0") {
      throw new Error(
        `refusing to compare: old side's VERSION export reads ${JSON.stringify(oldMod.VERSION)}, not "0.1.0" ` +
          `(from ${oldDistIndexPath})`,
      );
    }
    console.log(`0.1.0 side confirmed: VERSION = ${oldMod.VERSION} (${oldDistIndexPath})`);
    console.log(
      `0.2.0 side: current HEAD build (dist/index.js; its VERSION export still reads ` +
        `${JSON.stringify(newMod.VERSION)} - the bump to 0.2.0 has not landed yet, see the report)`,
    );

    const corpus = JSON.parse(readFileSync(join(repoRoot, "fixtures", "corpus.json"), "utf8"));
    // THRESHOLDS.minClaimChars is 16 normalized characters (src/classify/
    // thresholds.ts); 20 raw characters is comfortably clear of that floor
    // after norm()'s whitespace/case folding, so every synthesized claim
    // passes check()'s own claim-floor guard on both sides.
    const minLen = 20;

    const rows = corpus.map((row) => ({ row, claim: claimFor(row, minLen) }));

    // THE CLAIMS-TRAP GUARD. Refuse to run a comparison that would read
    // "unclaimed" on both sides without anyone noticing.
    for (const { row, claim } of rows) {
      if (!claim || claim.trim().length === 0) {
        throw new Error(`empty claim synthesized for ${row.path} - refusing to run a meaningless comparison`);
      }
    }
    const totalClaims = rows.length + 1; // +1 for the paired fixture, below.
    if (totalClaims === 0) throw new Error("no claims to compare - refusing to run");
    console.log(
      `Claim set confirmed non-empty: ${rows.length} corpus claims (1 per row) + 1 paired-fixture claim ` +
        `= ${totalClaims} total. None empty.\n`,
    );

    console.log(`=== fixtures/corpus.json (${rows.length} rows) ===`);
    let corpusMoved = 0;
    for (const { row, claim } of rows) {
      const url = row.url || "https://example.com/";
      const rawBody = readFileSync(row.path, "utf8");
      // SAME body on every rung - see replayFetcher's docstring. This is
      // exactly why a corpus row cannot exercise escalation.
      const fetcher = () => replayFetcher(row.status, () => rawBody);
      const oldR = await oldMod.check(url, [claim], { fetcher: fetcher() });
      const newR = await newMod.check(url, [claim], { fetcher: fetcher() });
      const reason = reasonFor(oldR, newR);
      printRow(oldR.verdict, newR.verdict, row.kind, row.path, reason);
      if (oldR.verdict !== newR.verdict) corpusMoved++;
    }

    console.log(`\ncorpus movement: ${corpusMoved} / ${rows.length} rows changed verdict.`);

    console.log(`\n=== fixtures/paired/{shell-node,document-curl}.html (Task 9's escalation fixture) ===`);
    const shellBody = readFileSync(join(repoRoot, "fixtures", "paired", "shell-node.html"), "utf8");
    const documentBody = readFileSync(join(repoRoot, "fixtures", "paired", "document-curl.html"), "utf8");
    // Exact string from test/fetch/escalation.test.ts: present in
    // document-curl.html, absent from shell-node.html.
    const PAIR_CLAIM = "the regulator imposed a fine of 290 million euros";
    const pairedUrl = "https://example.com/paired-fixture-task-9";
    const pairedFetcher = () =>
      replayFetcher(200, (rung) => (rung === "node" ? shellBody : documentBody));
    const oldPaired = await oldMod.check(pairedUrl, [PAIR_CLAIM], { fetcher: pairedFetcher() });
    const newPaired = await newMod.check(pairedUrl, [PAIR_CLAIM], { fetcher: pairedFetcher() });
    const pairedReason = reasonFor(oldPaired, newPaired);
    printRow(oldPaired.verdict, newPaired.verdict, "paired", "shell-node.html + document-curl.html", pairedReason);
    console.log(
      `  0.1.0 rungsAttempted: [${oldPaired.rungsAttempted.join(", ")}]  ` +
        `0.2.0 rungsAttempted: [${newPaired.rungsAttempted.join(", ")}]`,
    );

    console.log("\n=== summary ===");
    console.log(`corpus:  ${corpusMoved} / ${rows.length} moved (expected: 0 - see script/report docstring)`);
    console.log(
      `paired:  ${oldPaired.verdict === newPaired.verdict ? 0 : 1} / 1 moved ` +
        `(expected: 1 - this is the escalation fixture)`,
    );

    if (corpusMoved > 0) {
      console.error(
        "\nCORPUS MOVEMENT DETECTED. The corpus is single-bodied per row and cannot exercise escalation, " +
          "so this means something OTHER than escalation changed between 0.1.0 and 0.2.0. " +
          "Stop and investigate before writing this up as the verdict-movement report.",
      );
      process.exitCode = 1;
    }
  } finally {
    worktree?.cleanup();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
