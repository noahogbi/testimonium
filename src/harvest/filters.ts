import { belowClaimFloor, claimFloorMessage } from "../io/claims.js";
import type { Rule } from "../rules/challenge.js";
import { norm } from "../text/normalize.js";
import type { HarvestSource } from "./sources.js";

/** How many spans each filter removed, for THIS URL. Reported per URL so an
 *  author who suspects a filter took something real can see which one (spec
 *  8.2 step 5). */
export interface FilterDrops {
  readonly floor: number;
  readonly frequency: number;
  readonly rules: number;
  readonly claimed: number;
}

export interface FilterResult {
  readonly kept: string[];
  readonly drops: FilterDrops;
  /** One message per span filter 1 refused, from the same builder the
   *  claims-file loader and `check()`'s front door use (spec 7.3's third
   *  site). Harvest DROPS rather than errors - a span is a proposal, not an
   *  authored claim - but the author who wants to know why sees the same
   *  wording she would have seen from the other two doors. */
  readonly floorMessages: string[];
}

export interface FilterInput {
  readonly source: HarvestSource;
  readonly spans: readonly string[];
  /** Every OTHER source holding at least one readable read. The caller is
   *  EXPECTED to exclude `source` itself, but this function does not trust
   *  that: a caller mistake that leaves the source in its own `others` has
   *  a 100% blast radius (every span drops, silently), so `.key` is checked
   *  here too, defensively (controller ruling, fix round 1). A URL's own
   *  reads never vote against its own spans, and two citations that
   *  normalize alike are ONE source, so they cannot vote against each other
   *  either (Fable F10). */
  readonly others: readonly HarvestSource[];
  /** The claims `<doc>.claims.json` already records for this URL. */
  readonly existing: readonly string[];
  readonly boilerplate: readonly Rule[];
}

/**
 * The four filters, in the order spec 8.2 step 5 fixes: floor, cross-source
 * frequency, boilerplate rules, already-claimed. A span is attributed to the
 * FIRST filter that drops it, which is what makes the counts readable.
 *
 * `norm(span)` is computed once per span, and every read's `normRegions` was
 * computed once when it was read (Fable F18): the frequency filter is a
 * substring test between an already-normalized span and an already-normalized
 * REGION, never a `phraseFound` that re-normalizes a source body per span -
 * and never a test against a read's flat, joined text either (Task 5): a span
 * votes only if some single region of some other read carries it whole, so a
 * run that exists solely across that other source's own body/description join
 * can never cast a vote.
 */
export function applyFilters(input: FilterInput): FilterResult {
  const kept: string[] = [];
  const floorMessages: string[] = [];
  let floor = 0;
  let frequency = 0;
  let rules = 0;
  let claimed = 0;
  const existing = input.existing.map(norm);

  for (const span of input.spans) {
    // 1. Floor (spec 7.3). Refused for the same reason the other two doors
    //    refuse: a phrase this short attests nothing about a source.
    if (belowClaimFloor(span)) {
      floor += 1;
      floorMessages.push(claimFloorMessage(input.source.url, span));
      continue;
    }

    const n = norm(span);

    // 2. Cross-source frequency (13 Q5, primary). `read.normRegions.some(t =>
    //    t.includes(n))` asks whether ONE region of the other read carries the
    //    span whole - never whether the read's flat, joined text does (Task
    //    5): a span present only across that read's own region join is a run
    //    `check()` could never find there either, so it must not be able to
    //    drop a proposal by looking like it was shared. Each region string was
    //    normalized once, at read time (Fable F18), so this is still a
    //    substring test between two already-normalized strings, never a
    //    `phraseFound` that re-normalizes a source body per span.
    //    `other.key !== input.source.key` is a defensive self-exclusion
    //    guard, not a restatement of the caller's contract: a caller that
    //    wrongly includes the source in its own `others` must not silently
    //    drop every proposal (controller ruling, fix round 1; Important 6).
    //    Belt AND suspenders with the `others` docstring above - Task 8 pins
    //    the caller's side separately.
    if (
      input.others.some(
        (other) => other.key !== input.source.key && other.reads.some((read) => read.normRegions.some((t) => t.includes(n))),
      )
    ) {
      frequency += 1;
      continue;
    }

    // 3. The author's boilerplate rules. Compiled with no flags by
    //    `toRule`, so `.test()` carries no lastIndex state between spans.
    if (input.boilerplate.some((rule) => rule.pattern.test(n))) {
      rules += 1;
      continue;
    }

    // 4. Already claimed. Containment either way: a proposal inside an
    //    existing claim adds nothing, and one that contains it is the same
    //    claim with more context, which the author can widen by hand if she
    //    wants it. `e.length > 0` guards a normalized-empty existing entry
    //    from swallowing every span via vacuous containment (every string
    //    "contains" ""); unreachable today because `parseClaimsFile` refuses
    //    a below-floor claim before it can reach `existing` (Minor 5), but
    //    this filter does not depend on that caller staying strict.
    if (existing.some((e) => e.length > 0 && (e.includes(n) || n.includes(e)))) {
      claimed += 1;
      continue;
    }

    kept.push(span);
  }

  return { kept, drops: { floor, frequency, rules, claimed }, floorMessages };
}
