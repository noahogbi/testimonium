import type { Footnote } from "../adapters/types.js";
import { isReadable } from "../classify/verdict.js";
import { readSource } from "../fetch/read-source.js";
import type { Fetcher, RungId } from "../fetch/types.js";
import { normalizeUrl, type ClaimsFile } from "../io/claims.js";
import type { RuleSet } from "../rules/load.js";
import { norm } from "../text/normalize.js";

/** One readable read of one URL, with the two forms of its text harvest
 *  needs. */
export interface HarvestRead {
  readonly rung: RungId;
  /** The extracted text, which proposals are cut from. */
  readonly text: string;
  /** `norm(text)`, computed ONCE per read (Fable F18). The frequency filter
   *  asks every other source's every read about every span; recomputing
   *  norm() inside that loop is O(spans x sources x |text|) over bodies that
   *  run to tens of thousands of characters. */
  readonly normText: string;
}

export interface HarvestSource {
  /** The FIRST citation spelling of this normalized URL. The draft file is
   *  keyed by it, so that a URL cited twice cannot produce two draft keys
   *  that `parseClaimsFile` then refuses as a collision (Fable F8). */
  readonly url: string;
  /** `normalizeUrl(url)`. Identity for the frequency filter and for the join
   *  against an existing claims file. */
  readonly key: string;
  /** READABLE reads only, in the order attempted. Only these propose, and
   *  only these vote (spec 6.6, "Harvest reads only what is readable").
   *
   *  With the shipped ladder this list holds AT MOST ONE read, because
   *  `nextAction` stops the moment a read is readable (fetch/ladder.ts). It
   *  is a list because spec 8.2 says "reads", plural, and because the shape
   *  is what keeps harvest correct if the stop rule ever changes - the same
   *  defensiveness `bestReadable` carries in read-source.ts. Task 8 pins the
   *  at-most-one property as a characterization, so a change to the ladder
   *  shows up as a red test rather than as a silent widening. */
  readonly reads: HarvestRead[];
  readonly rungsAttempted: RungId[];
  /** The final URL of the first readable read whose PATH differs from the
   *  path asked for, or null. Reported beside the proposals; gates nothing. */
  readonly redirectedTo: string | null;
}

export interface SourceScan {
  readonly sources: HarvestSource[];
  /** A URL with no readable read. Nothing is proposed for it, and the report
   *  says which rungs were tried (spec 8.2 step 2). */
  readonly unreachable: { url: string; rungsAttempted: RungId[] }[];
  /** A URL the author has declared not checkable. Never fetched. */
  readonly skipped: { url: string; reason: string }[];
}

export interface ScanOptions {
  readonly fetcher: Fetcher;
  readonly rules?: RuleSet;
  /** The existing `<doc>.claims.json`, when there is one. Used HERE only to
   *  skip `notApplicable` URLs; filter 4's already-claimed test reads it
   *  separately. */
  readonly claims?: ClaimsFile;
}

/** A URL's path, or the whole string when it does not parse - the same
 *  fallback `normalizeUrl` and `slugLabelOverlap` make, for the same reason:
 *  an unparseable citation is the author's to fix, not this function's to
 *  guess at. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Every cited URL, read once, reduced to the reads harvest may propose from.
 *
 * Grouping is by `normalizeUrl` and the group keeps the FIRST spelling seen
 * (spec 8.2 step 1). Reading is `readSource` - the one ladder loop, shared
 * with `check` and `reachability` (spec 6.6) - and the filter afterwards is
 * `isReadable`, NOT `!isBlocked`: 22 of the 25 challenge fixtures and every
 * paywall stub pass all five vetoes and fail only the prose floor, and
 * harvesting from one would turn the checker's accepted sub-floor-stub
 * exposure into a generator of it (Fable F1).
 *
 * No claims are passed to `readSource`: harvest has none to match, and the
 * signals it needs - the vetoes and the prose count - do not depend on them.
 */
export async function scanSources(
  footnotes: readonly Footnote[],
  opts: ScanOptions,
): Promise<SourceScan> {
  const sources: HarvestSource[] = [];
  const unreachable: SourceScan["unreachable"][number][] = [];
  const skipped: SourceScan["skipped"][number][] = [];
  const seen = new Set<string>();

  for (const footnote of footnotes) {
    if (!footnote.url) continue;
    const key = normalizeUrl(footnote.url);
    if (seen.has(key)) continue;
    seen.add(key);

    const entry = opts.claims?.get(key);
    if (entry !== undefined && !Array.isArray(entry)) {
      skipped.push({ url: footnote.url, reason: entry.notApplicable });
      continue;
    }

    const { reads, attempted } = await readSource(footnote.url, [], {
      fetcher: opts.fetcher,
      sourceLabel: footnote.label,
      ...(opts.rules ? { rules: opts.rules } : {}),
    });

    const readable = reads.filter((r) => isReadable(r.computed.signals));
    if (readable.length === 0) {
      unreachable.push({ url: footnote.url, rungsAttempted: attempted });
      continue;
    }

    const asked = pathOf(footnote.url);
    const moved = readable.find((r) => pathOf(r.computed.finalUrl) !== asked);
    sources.push({
      url: footnote.url,
      key,
      reads: readable.map((r) => ({
        rung: r.rung,
        text: r.computed.text,
        normText: norm(r.computed.text),
      })),
      rungsAttempted: attempted,
      redirectedTo: moved ? moved.computed.finalUrl : null,
    });
  }

  return { sources, unreachable, skipped };
}
