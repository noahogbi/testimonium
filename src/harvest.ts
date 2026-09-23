import type { Document } from "./adapters/types.js";
import { buildFetcher } from "./fetch/build-fetcher.js";
import type { Fetcher, RungId } from "./fetch/types.js";
import { applyFilters, type FilterDrops } from "./harvest/filters.js";
import { dropContained, prepareDraft, spansAgainst } from "./harvest/spans.js";
import { scanSources } from "./harvest/sources.js";
import type { ClaimsFile } from "./io/claims.js";
import type { RuleSet } from "./rules/load.js";

export interface HarvestOptions {
  /** Bring your own reader, exactly as CheckOptions does. */
  readonly fetcher?: Fetcher;
  readonly rules?: RuleSet;
  /** Declared identity for hosts that require one, e.g. sec.gov's
   *  "<app> <contact email>". testimonium ships no identity of its own, and
   *  before Task 16 this option existed on FetcherOptions but was reachable
   *  from nowhere: harvest() never passed it, so every such citation took
   *  the warn-and-use-a-browser-UA branch. Matches CheckOptions.identity. */
  readonly identity?: string;
  /** The existing `<doc>.claims.json`, when the author has one. Absent is
   *  the ordinary case for a document harvest is being run on for the first
   *  time, and is NOT an error. */
  readonly claims?: ClaimsFile;
}

export interface HarvestProposal {
  /** The first citation spelling of this normalized URL; the draft's key. */
  readonly url: string;
  readonly key: string;
  /** Candidate claims, in the SOURCE's typography, after all four filters. */
  readonly claims: string[];
  /** The rungs of this URL's readable reads - every one of them, whether or
   *  not it proposed anything. A source that shares nothing with the draft,
   *  or whose every span was filtered, still lists the rung that read it. */
  readonly rungs: RungId[];
  readonly drops: FilterDrops;
  readonly floorMessages: string[];
  /** Self-validation lines from `commonSpans`, never counted as a filter's
   *  work (spec 8.2 step 4).
   *
   *  DO NOT RENDER THESE UNDER A BLANKET `BUG:` PREFIX. Spec 8.2 step 4 used
   *  to call the three assertions "each a bug if it fails", and that was
   *  measured false for assertion 1: a source reading "6 billion" against a
   *  draft reading "7 billion" lands a line here from a page that is working
   *  perfectly. Each line says which reading it carries - see
   *  `normBoundaryNote` and `documentMismatchNote` in harvest/spans.ts - and
   *  the caller prints the line, not a label of its own. The spec was amended
   *  to agree with this file on 2026-09-09. */
  readonly bugs: string[];
  readonly redirectedTo: string | null;
}

export interface HarvestReport {
  readonly proposals: HarvestProposal[];
  /** A cited URL no rung could read. `pdfUrl` rides along from `scanSources`
   *  unchanged: it is what lets the report tell "we could not read it" from
   *  "this machine cannot read PDFs", the same distinction `check` draws by
   *  carrying `isPdfUrl` into `isLadderTruncated` (src/io/evidence.ts).
   *
   *  IT IS WIDER THAN THE PLAN'S INTERFACE BLOCK, deliberately. The plan
   *  wrote `{ url, rungsAttempted }` before Task 6's fix round added
   *  `pdfUrl` to `SourceScan.unreachable` FOR this report (ruling T6-R4);
   *  narrowing it back here would leave that field with no reader and the
   *  reason it was added unserved. */
  readonly unreachable: { url: string; rungsAttempted: RungId[]; pdfUrl: boolean }[];
  readonly skipped: { url: string; reason: string }[];
  /** Fewer than two URLs held a readable read, so the cross-source frequency
   *  filter had nothing to compare against. Vacuous, not wrong (13 Q5) - and
   *  the report says so in words rather than leaving the author to infer it
   *  from a zero.
   *
   *  It is a fact about READABLE sources, not about cited ones: a document
   *  citing ten URLs of which one could be read has a vacuous filter, and a
   *  `frequency: 0` beside it means "could not fire", not "fired and found
   *  nothing". Those two are the same number and different facts, which is
   *  why the flag exists rather than leaving the count to speak alone. */
  readonly frequencyVacuous: boolean;
}

/**
 * Propose candidate claims for every URL a document cites.
 *
 * IT NEVER WRITES `<doc>.claims.json`, and it has no code path that could:
 * it returns a report, and the caller writes `<doc>.claims.draft.json` from
 * it. Every proposal is afterwards judged by `check()` exactly as a
 * hand-written claim is (spec 8.2).
 *
 * HARVEST IS NOT SAFE BY CONSTRUCTION - spec 8.2, "What it is not", which
 * corrected the section 8 paragraph that once claimed the opposite. (The
 * README's own `## Harvest` section says the same thing to the author, in her
 * words rather than the spec's, as of 2026-09-09; before that the spec was
 * the only place it was written down.) A span common
 * to the draft and a source is by definition a span `check` will find in that
 * source, so harvest carries the checker's exposures unreduced - an
 * above-floor un-vetoed wall, and a redirect to a homepage that shares a
 * sentence with the draft. It adds one of its own: it proposes what the
 * author COPIED, which is not always what she CLAIMS. The draft's `_note`
 * says so, and her confirmation is what makes a proposal a claim.
 */
export async function harvest(doc: Document, opts: HarvestOptions = {}): Promise<HarvestReport> {
  // buildFetcher (Task 16): the ONE construction shared with check(),
  // reachability() and recheck()'s live arm - see its own docstring. `opts`
  // is passed straight through rather than rebuilt field-by-field (fix round
  // 1, Important 1): `HarvestOptions` is a structural superset of
  // `BuildFetcherOptions`, and rebuilding it here would be a second copy of
  // the forwarding logic that drifts the moment a field is added to one
  // interface and not mirrored to the other.
  const fetcher = buildFetcher(opts);
  const scan = await scanSources(doc.footnotes, {
    fetcher,
    ...(opts.rules ? { rules: opts.rules } : {}),
    ...(opts.claims ? { claims: opts.claims } : {}),
  });

  const proposals: HarvestProposal[] = [];
  // Folded, indexed and normalized ONCE: the draft is the same for every
  // region of every read of every source (see PreparedDraft).
  const draft = prepareDraft(doc.prose);
  for (const source of scan.sources) {
    // The union over this URL's readable reads, containment-deduped by the
    // same function commonSpans uses on one read's candidates. ONE
    // implementation of the containment rule, two call sites - which is why
    // Task 5 extracted `dropContained` instead of inlining it.
    //
    // NO FIXTURE CAN EXERCISE THE UNION TODAY, and that is a fact about the
    // ladder rather than about this loop: on harvest's path `nextAction`
    // stops the moment a read is readable - check()'s continueReading
    // escalation (spec 0.2.0 section 4) is the one exception, and harvest
    // never takes it (src/harvest/sources.ts) - so `source.reads` holds at
    // most one entry and `commonSpans` has already deduped it. Removing the
    // `dropContained`
    // call below therefore breaks no test, so it was verified by injecting
    // the second read instead - duplicating `readable` in `scanSources`
    // makes this loop propose the same span twice without it and once with
    // it (measured 2026-09-09). The characterization test in
    // test/harvest.test.ts goes red under that same injection, which is what
    // makes a future ladder change arrive as a red test rather than as a
    // draft file quietly listing every claim twice.
    const candidates: string[] = [];
    const bugs: string[] = [];
    // `found.bugs` is carried, never swallowed: a dropped line is the one
    // outcome that would make a fault in spans.ts invisible. An earlier
    // version of this comment claimed no fixture could reach it, because a
    // non-empty `bugs` is a code fault rather than a property of any page.
    // THAT WAS FALSE, and the fix-round-1 reviewer built the fixture: a
    // source reading "6 billion" against a draft reading "7 billion" lands a
    // `normBoundaryNote` line with nothing broken anywhere. Both sides of the
    // assertion pair are now pinned in test/harvest.test.ts.
    for (const read of source.reads) {
      // Per region, not over the regions' flat join (Task 5; spec criterion
      // 3): a span common to the draft and the CONCATENATION of two regions
      // can be a run that exists on neither region alone - the join between a
      // page's body and its description is not a place an author's copy ever
      // sat - and check() (Task 3) already refuses to find such a span
      // anywhere on the page. Proposing one would be the tool accusing an
      // author over its own suggestion. Cross-region duplicates within one
      // read, and across a URL's several reads, are absorbed by the
      // `dropContained` call below - ONE containment pass over the union,
      // same as before this loop scanned by region instead of once per read.
      for (const region of read.regions) {
        const found = spansAgainst(draft, region);
        bugs.push(...found.bugs);
        candidates.push(...found.spans);
      }
    }

    const entry = opts.claims?.get(source.key);
    const filtered = applyFilters({
      source,
      spans: dropContained(candidates),
      // A URL's own reads never vote against its own spans, and two
      // citations that normalize alike are ONE source (Fable F10). This is
      // the CALLER's half of that contract; `applyFilters` re-checks `.key`
      // defensively, because leaving the source in its own `others` drops
      // 100% of its proposals silently and "harvest proposed nothing" reads
      // to an author exactly like "the sources shared nothing".
      others: scan.sources.filter((other) => other.key !== source.key),
      existing: Array.isArray(entry) ? entry : [],
      boilerplate: opts.rules?.boilerplate ?? [],
    });

    proposals.push({
      url: source.url,
      key: source.key,
      claims: filtered.kept,
      rungs: source.reads.map((read) => read.rung),
      drops: filtered.drops,
      floorMessages: filtered.floorMessages,
      bugs,
      redirectedTo: source.redirectedTo,
    });
  }

  return {
    proposals,
    unreachable: scan.unreachable,
    skipped: scan.skipped,
    // Readable sources, not cited URLs: filter 2 compares a span against
    // OTHER sources' reads, so one readable source leaves it nothing to
    // compare against however many citations the document carries.
    frequencyVacuous: scan.sources.length < 2,
  };
}
