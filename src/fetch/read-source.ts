import { computeSignals, type SignalResult } from "../classify/signals.js";
import { isReadable } from "../classify/verdict.js";
import { nextAction, type Attempt } from "./ladder.js";
import { isPdf } from "./pdf.js";
import { EMPTY_RESPONSE, type Fetcher, type RawResponse, type RungId } from "./types.js";
import type { RuleSet } from "../rules/load.js";

/** One rung's read of one URL: the rung, carried WITH the classification.
 *  Never read the rung off the end of the attempt history - an earlier rung is
 *  often the one that read the document. */
export interface Read {
  readonly rung: RungId;
  readonly computed: SignalResult;
}

export interface ReadSourceOptions {
  readonly fetcher: Fetcher;
  /** Passed through to the classifier for C1 (slug/label overlap). Absent and
   *  "" are the same thing to it. */
  readonly sourceLabel?: string;
  readonly rules?: RuleSet;
}

export interface SourceReads {
  /** Every rung's read, in the order attempted. Vetoed reads are kept: the
   *  caller decides what a wall's text may and may not contribute. */
  readonly reads: Read[];
  readonly attempted: RungId[];
  readonly pdfUrl: boolean;
}

/**
 * THE ONE LADDER LOOP (spec 6.6). Fetch a rung, classify, climb unless that
 * read was readable, until the ladder stops. Until plan 1.2 check() and
 * reachability() each carried a copy of this loop, and the copies escalated
 * on different predicates - three vetoes in one, five in the other - so the
 * preflight climbed past a 404 that ended the gate's ladder. No test noticed.
 *
 * This module is deliberately NOT exported from src/index.ts (spec 5.3). It
 * returns raw reads, and a caller holding raw reads can assemble a verdict
 * check() never issued. The public surface stays check() and reachability().
 */
export async function readSource(url: string, claims: readonly string[], opts: ReadSourceOptions): Promise<SourceReads> {
  const pdfUrl = isPdf(url);
  const history: Attempt[] = [];
  const attempted: RungId[] = [];
  const reads: Read[] = [];

  for (;;) {
    const action = nextAction(history, opts.fetcher.rungs, pdfUrl);
    if (action.kind === "stop") break;

    // A Fetcher must not throw - see the contract on the interface. The three
    // bundled rungs all return EMPTY_RESPONSE on failure. A third-party
    // fetcher that throws anyway degrades to an unread rung rather than
    // aborting a run midway through a document, and is WARNED about rather
    // than swallowed (ruling C12).
    let response: RawResponse;
    try {
      response = await opts.fetcher.fetch(url, action.rung);
    } catch (e) {
      console.warn(
        `warn fetcher rung "${action.rung}" threw for ${url}: ${e instanceof Error ? e.message : String(e)}`,
      );
      response = EMPTY_RESPONSE;
    }
    attempted.push(action.rung);
    const computed = computeSignals({
      rawBody: response.rawBody,
      headers: response.headers,
      finalUrl: response.finalUrl || url,
      status: response.status,
      claims,
      sourceLabel: opts.sourceLabel ?? "",
      ...(opts.rules ? { rules: opts.rules } : {}),
    });
    reads.push({ rung: action.rung, computed });
    history.push({ rung: action.rung, readable: isReadable(computed.signals) });
  }

  return { reads, attempted, pdfUrl };
}

/**
 * The readable read with the most prose, or undefined when no read is
 * readable. Ties go to the earlier rung. This is spec 6.6 rule 2's "best" and
 * rule 5's "some read is readable", in one place so the gate and the preflight
 * cannot disagree about which read counts.
 */
export function bestReadable(reads: readonly Read[]): Read | undefined {
  let best: Read | undefined;
  for (const r of reads) {
    if (!isReadable(r.computed.signals)) continue;
    if (best === undefined || r.computed.signals.proseChars > best.computed.signals.proseChars) best = r;
  }
  return best;
}
