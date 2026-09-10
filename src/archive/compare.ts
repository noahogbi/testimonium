import type { Verdict } from "../classify/verdict.js";
import { claimsHashFor, type ArchiveEntry } from "./format.js";

export type DriftCategory =
  | "clean"
  | "sourceDrift"
  | "pipelineDrift"
  | "gone"
  | "unreachable"
  | "noBaseline"
  | "confounded"
  | "unclaimed";

export interface CitationOutcome {
  readonly url: string;
  readonly key: string;
  readonly category: DriftCategory;
  /** L - `check()` over the live source. */
  readonly live: Verdict;
  /** A - `check()` over the archived bytes, with today's claims and today's
   *  code. Null when there was no baseline to run it against. */
  readonly archived: Verdict | null;
  /** R - the verdict recorded in the archive. Always "supported" when a
   *  baseline exists; see the invariant check in `compareCitation`. */
  readonly recorded: Verdict | null;
  /** When the baseline was established or last MATERIALLY changed - the store
   *  preserves an entry that changed in nothing material (Task 5), so
   *  "gone since `<archivedAt>`" reads "gone since at least that date". */
  readonly archivedAt: string | null;
  /** Named confounds, in the report's own words. Carried on the `confounded`
   *  row, which they produce, AND on the `gone` row, which outranks them
   *  (spec 8.3 as amended): a 404 is not something a confound can explain, but
   *  the report still names what else changed. Empty on every other row. */
  readonly confounds: readonly string[];
  /** The live arm was `unreachable` AND some live read reported 404 or 410.
   *  Both conjuncts matter: computed over every read regardless of the verdict,
   *  it fires on a node rung that 404s before a curl rung that reads the
   *  document, and the report tells the author a page it had just read may be
   *  gone. With the gone row now above the confounds, what is left for this
   *  flag is the `noBaseline` row (entry absent, or R violated), where the
   *  gone check is never reached. */
  readonly liveGone: boolean;
  /** The BUNDLED rules moved. Named in the report as a likely cause, and
   *  nothing else: never a confound, never a promotion. */
  readonly bundledVersionChanged: boolean;
  readonly archivedToolVersion: string | null;
  /** The LIVE arm's missed claims, for the source-drift report line. */
  readonly missed: readonly string[];
}

export interface CompareInput {
  readonly url: string;
  readonly key: string;
  readonly liveVerdict: Verdict;
  readonly liveMissed: readonly string[];
  /** The status of every live read, off the recording wrapper. `CitationResult`
   *  carries no status by design (7.4), which is why this comes from the tee. */
  readonly liveStatuses: readonly number[];
  readonly replayVerdict: Verdict | null;
  readonly entry: ArchiveEntry | null;
  readonly claims: readonly string[];
  readonly toolVersion: string;
  readonly localRulesHash: string | null;
  readonly pdftotextVersion: string | null;
}

/**
 * N4's predicate, restated where the CLI can reach it.
 *
 * `computeSignals` owns the original (`src/classify/signals.ts`:
 * `documentGone: input.status === 404 || input.status === 410`), and
 * `CitationResult` carries no status, so `recheck` reads gone-ness off the
 * recording wrapper instead. That makes this a second copy, and a test pins the
 * two together over 404, 410, 403, 500, 200, 0 and 301 so they cannot drift.
 */
export function isGoneStatus(status: number): boolean {
  return status === 404 || status === 410;
}

function namedConfounds(entry: ArchiveEntry, input: CompareInput): string[] {
  const out: string[] = [];
  if (entry.claimsHash !== claimsHashFor(input.claims)) {
    out.push(`the claims for this URL changed since ${entry.archivedAt}`);
  }
  const recorded = entry.reads.map((r) => r.pdftotextVersion).filter((v): v is string => v !== null);
  const differing = recorded.find((v) => v !== input.pdftotextVersion);
  if (differing !== undefined) {
    out.push(
      `pdftotext here is ${input.pdftotextVersion ?? "not installed"} and was ${differing} when this was archived`,
    );
  }
  if (entry.localRulesHash !== input.localRulesHash) {
    out.push("the local --rules file differs from the one recorded");
  }
  return out;
}

/**
 * THE DECISION PROCEDURE (spec 8.3). Condition on L first.
 *
 * EXIT 1 IFF `L = unsupported` AND `A = supported` AND no named confound. That
 * is the only row permitted to accuse, and the reason is the keystone:
 * `check()` cannot return `unsupported` from a read it did not judge readable
 * (every veto returns `unreachable` first and the final branch asks
 * `isReadable`), so the live arm positively read the page and positively failed
 * to find the claim there; and `A = supported` certifies that today's code,
 * today's rules and today's claims still prove that same claim from the stored
 * bytes. Nothing on our side can account for the difference.
 *
 * The section shipped, for one day, a three-row table keyed on "L vs A: same or
 * differ" that conditioned on whether the arms differ WITHOUT SAYING WHICH WAY.
 * It is deleted, and this is what replaced it. Do not reintroduce a comparison
 * of the form `live !== archived`.
 */
export function compareCitation(input: CompareInput): CitationOutcome {
  const entry = input.entry;
  // BOTH CONJUNCTS. Without the first, this is true of a citation whose node
  // rung 404'd before a curl rung read the document - the ladder climbs past an
  // N4-only veto - and the report tells the author a page it just read may be
  // gone (a UA-dependent 404 is a real shape).
  const liveGone = input.liveVerdict === "unreachable" && input.liveStatuses.some(isGoneStatus);
  const base = {
    url: input.url,
    key: input.key,
    live: input.liveVerdict,
    archived: input.replayVerdict,
    recorded: entry?.verdict ?? null,
    archivedAt: entry?.archivedAt ?? null,
    liveGone,
    bundledVersionChanged: entry !== null && entry.toolVersion !== input.toolVersion,
    archivedToolVersion: entry?.toolVersion ?? null,
    missed: input.liveMissed,
  };

  // No baseline. Evaluated FIRST - as 8.3's amended block also lists it -
  // because every confound predicate reads a field off the entry. The URL has
  // never read `supported`, so nothing was stored and there is nothing to
  // control against: report the live verdict for information and contribute 0
  // even when it is `unsupported`. `check` is the gate; `recheck` detects
  // change. A `recheck` that also gated would let an author skip `check` and
  // receive a worse version of it.
  if (entry === null) return { ...base, category: "noBaseline", confounds: [] };

  // THE INVARIANT: R is always `supported`. A file on disk that breaks it is
  // corrupt or hand-edited, and must never reach the accusing row - trusting it
  // would accuse from a baseline that never proved anything.
  if (entry.verdict !== "supported") {
    console.warn(
      `warn ${input.key}: the archived verdict is "${entry.verdict}", not "supported" - treating it as no baseline`,
    );
    return { ...base, category: "noBaseline", confounds: [] };
  }

  const confounds = namedConfounds(entry, input);

  // GONE IS EVALUATED ABOVE THE NAMED CONFOUNDS (spec 8.3, as amended by
  // Fable's correction 2). This is the ONE deliberate exception to "a named
  // confound short-circuits everything", and the reason is that a confound
  // explains a divergence between the ARMS while gone-ness is the origin's own
  // statement about L: a claims edit cannot 404 a page, a local rule changes
  // classification rather than the wire status, and the pdftotext confound
  // cannot co-occur with gone at all (that rung reports status 0, so N4 never
  // fires on a PDF). Under the other order, `--fail-on-gone` returned 0 for a
  // genuinely deleted page whenever that URL's claims had been edited since
  // archiving - the opt-in flag disabled by an unrelated edit, on the ordinary
  // sequence. The confounds ride along on the outcome so the report still names
  // them, and this row contributes 0 by default and 1 only under the opt-in, so
  // the reorder cannot mint an exit 1 nothing licensed.
  // Gone is its own category, kept apart from transient unreachability: a
  // deleted page is the most common real drift there is, and reporting it as a
  // bare "unreachable now" hides it inside the flaky-network bucket.
  if (liveGone) return { ...base, category: "gone", confounds };

  // Named confounds short-circuit everything below, with an exit contribution
  // of 0. A named confound is NOT pipeline drift and must never be reported as
  // one: pipeline drift means a regression in THIS tool, and in each of these
  // cases what changed is the author's own machine or the author's own data.
  if (confounds.length > 0) return { ...base, category: "confounded", confounds };

  if (input.liveVerdict === "unreachable") {
    // Transient unreachability is listed, never failed: the page may be
    // perfectly intact and the citation still good.
    return { ...base, category: "unreachable", confounds: [] };
  }
  if (input.liveVerdict === "unclaimed") {
    // Unreachable through the CLI (parseClaimsFile refuses an empty array), but
    // `recheck()` is callable with any claims array and a total function is
    // better than a fallthrough. It accuses nobody.
    return { ...base, category: "unclaimed", confounds: [] };
  }
  if (input.liveVerdict === "supported") {
    return { ...base, category: input.replayVerdict === "supported" ? "clean" : "pipelineDrift", confounds: [] };
  }
  // L === "unsupported".
  return { ...base, category: input.replayVerdict === "supported" ? "sourceDrift" : "pipelineDrift", confounds: [] };
}
