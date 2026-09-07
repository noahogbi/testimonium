import { computeSignals } from "./classify/signals.js";
import { verdict } from "./classify/verdict.js";
import { defaultFetcher } from "./fetch/default-fetcher.js";
import { nextAction, type Attempt } from "./fetch/ladder.js";
import { isPdf } from "./fetch/pdf.js";
import type { Fetcher, RungId } from "./fetch/types.js";
import { dedupeEvidence, excerptFor, type Evidence } from "./text/excerpt.js";
import { buildResult, type CitationResult } from "./io/evidence.js";

export interface CheckOptions {
  /** Bring your own reader - a headless browser, a paid proxy - behind the
   *  same interface. The bundled ladder is the reference implementation. */
  readonly fetcher?: Fetcher;
  /** The author's own footnote text. Feeds C1's content-word pool, which is
   *  how a PDF at a hashed URL with no title still has something to correlate
   *  against. Optional; omitting it only makes an accusation harder to earn. */
  readonly sourceLabel?: string;
}

// NOTE: there is deliberately no `failOn` here. check() returns ONE result and
// cannot fail a run; run-level policy belongs to the caller and lives in the
// CLI's classifyRun. An option the function ignores is worse than no option.

/**
 * THE FRONT DOOR. It owns the verdict.
 *
 * There is deliberately no fetch-level public entry point that returns text and
 * leaves the caller to decide what it means. In the origin repo the keystone
 * mapping lived in the caller, a second caller reimplemented it inline, and
 * that copy diverged three ways on the day the rule landed. Comments do not
 * bind; the ladder has to be un-copyable.
 */
export async function check(
  url: string,
  claims: readonly string[],
  opts: CheckOptions = {},
): Promise<CitationResult> {
  const fetcher = opts.fetcher ?? defaultFetcher();
  const pdfUrl = isPdf(url);
  const history: Attempt[] = [];
  const attempted: RungId[] = [];
  // The rung is carried WITH the signals, not read off the end of the history.
  // Taking the last attempted rung mis-attributes evidence whenever an earlier
  // rung is the one that read the document.
  let best: { rung: RungId; computed: ReturnType<typeof computeSignals> } | null = null;

  for (;;) {
    const action = nextAction(history, fetcher.rungs, pdfUrl);
    if (action.kind === "stop") break;

    const response = await fetcher.fetch(url, action.rung);
    attempted.push(action.rung);
    const computed = computeSignals({
      rawBody: response.rawBody,
      headers: response.headers,
      finalUrl: response.finalUrl || url,
      status: response.status,
      claims,
      sourceLabel: opts.sourceLabel ?? "",
    });

    // Keep the rung that read the most prose. A later rung that got a wall must
    // not overwrite an earlier one that got the document.
    if (!best || computed.signals.proseChars > best.computed.signals.proseChars) {
      best = { rung: action.rung, computed };
    }

    history.push({
      rung: action.rung,
      proseChars: computed.signals.proseChars,
      challenged:
        computed.signals.challengeHeader ||
        computed.signals.challengePath ||
        computed.signals.challengeSignature,
    });
  }

  if (!best) {
    return buildResult({
      url, verdict: claims.length === 0 ? "unclaimed" : "unreachable",
      evidence: [], rungsAttempted: attempted, rungsAvailable: fetcher.rungs,
      missed: [], isPdfUrl: pdfUrl,
    });
  }

  const v = verdict(best.computed.signals);
  const evidence: Evidence[] = best.computed.matchedClaims.map((claim) => ({
    claims: [claim],
    excerpt: excerptFor(best!.computed.text, claim),
    rung: best!.rung,
  }));

  return buildResult({
    url,
    verdict: v,
    evidence: dedupeEvidence(evidence),
    rungsAttempted: attempted,
    rungsAvailable: fetcher.rungs,
    missed: v === "unsupported" ? [...best.computed.missedClaims] : [],
    isPdfUrl: pdfUrl,
  });
}
