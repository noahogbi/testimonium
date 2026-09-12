/**
 * `classifyRun` lives here, apart from `src/bin.ts`, so it can be a public
 * export without dragging the CLI's whole dependency graph along with it.
 * `bin.ts` pulls in the archive writers, the draft writers, and
 * `pathToFileURL` - none of which this nine-line arithmetic function needs -
 * and `import "testimonium"` would otherwise load all of it just to reach
 * this one classifier.
 */

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
