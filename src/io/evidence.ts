import { writeFileSync, readFileSync, existsSync } from "node:fs";
import type { Verdict } from "../classify/verdict.js";
import type { Evidence } from "../text/excerpt.js";
import type { RungId } from "../fetch/types.js";
import type { Rule } from "../rules/challenge.js";

/** Which rule fired, and how stale it is. PROVENANCE, not a renderable field:
 *  it may appear on every verdict, including `unreachable` and `unclaimed`,
 *  without violating the rule that those two carry no renderable evidence.
 *  (Amended 2026-09-12, 0.2.0 section 2: `unsupported` now carries renderable
 *  evidence too, for the claims that DID match - see `:27-35` below - but
 *  `firedRule` was never gated on that boundary in the first place, so this
 *  interface is unaffected either way.) The pattern itself is dropped - a
 *  RegExp does not survive JSON.stringify, and callers only ever want to know
 *  what fired and when it was last confirmed. */
export interface FiredRule {
  readonly lastConfirmed: string;
  readonly note: string;
}

export interface CitationResult {
  readonly url: string;
  readonly verdict: Verdict;
  readonly rungsAttempted: readonly RungId[];
  readonly rungsAvailable: readonly RungId[];
  /** True when this machine lacks a rung the full ladder would have tried, so
   *  an unreachable reads as "ladder truncated" and never as a fact about the
   *  host. A serverless caller has node only. */
  readonly ladderTruncated: boolean;
  /** PRESENT ONLY WHEN verdict === "unsupported". The most accusatory field in
   *  the schema - it names the claims the author allegedly failed to support -
   *  so it is gated the same way evidence and retrievedAt below are, and for
   *  the same reason: the schema must be structurally unable to express an
   *  accusation on a verdict that is not accusing. */
  readonly missed?: readonly string[];
  /** PRESENT WHEN verdict === "supported" OR "unsupported" - never on
   *  `unreachable` or `unclaimed`, because we did not read the page and there
   *  is nothing honest to render.
   *
   *  (Amended 2026-09-12, 0.2.0 section 2. This used to read PRESENT ONLY
   *  WHEN verdict === "supported": an `unsupported` footnote that matched
   *  four of five claims kept zero passages, and an author fixing the fifth
   *  could not see what already landed. `unreachable` is unaffected and
   *  stays exactly as before.) */
  readonly evidence?: readonly Evidence[];
  readonly retrievedAt?: string;
  readonly firedRule?: FiredRule;
}

export interface BuildInput {
  readonly url: string;
  readonly verdict: Verdict;
  readonly evidence: readonly Evidence[];
  readonly rungsAttempted: readonly RungId[];
  readonly rungsAvailable: readonly RungId[];
  readonly missed: readonly string[];
  /** Required: truncation is defined against the ladder this URL WOULD use,
   *  and an HTML url never uses pdftotext. Without it the flag is wrong in
   *  both directions. */
  readonly isPdfUrl: boolean;
  /** The full Rule that fired, if any - `computeSignals`'s output. Stripped
   *  down to `{ lastConfirmed, note }` on the way into `CitationResult`. */
  readonly firedRule?: Rule | null;
}

/**
 * Did this machine lack a rung the full ladder for THIS url would have tried?
 *
 * The naive form - comparing attempted against available, or counting
 * available against 3 - is wrong twice over. An HTML url on a node+curl
 * machine with both rungs walled reports truncated when the ladder was
 * complete; and a PDF url on a machine with no pdftotext attempts NOTHING and
 * reports untruncated, which is exactly the serverless case the field exists
 * to disclose.
 */
function isLadderTruncated(available: readonly RungId[], isPdfUrl: boolean): boolean {
  const has = (r: RungId) => available.includes(r);
  return isPdfUrl ? !has("pdftotext") : !(has("node") && has("curl"));
}

/**
 * The render half of the keystone rule, enforced by construction.
 *
 * (Amended 2026-09-12, 0.2.0 section 2. This docstring used to say, without
 * qualification, "Non-supported results carry NO renderable fields - no
 * excerpt, no retrievedAt." That is now true only of `unreachable` and
 * `unclaimed`: `unsupported` carries `evidence` and `retrievedAt` for the
 * claims that DID match, so an author fixing four of five claims does not
 * lose the one passage that already landed. `unreachable` is unaffected -
 * we did not read the page, so there is nothing honest to render - and stays
 * exactly as this docstring originally described.)
 *
 * The schema is still unable to express an accusation `unreachable` never
 * made: the tool's first downstream integrator cannot render `unreachable`
 * as a red badge and break the premise the tool exists for.
 *
 * `missed` is gated in the OTHER direction, by the same doctrine: only an
 * `unsupported` verdict may name claims as unsupported. It sat in `base` on
 * every verdict, so an `unreachable` result - the verdict that means "we could
 * not look" - shipped a list of the author's allegedly-missing claims beside
 * it.
 */
export function buildResult(input: BuildInput): CitationResult {
  const base = {
    url: input.url,
    verdict: input.verdict,
    rungsAttempted: input.rungsAttempted,
    rungsAvailable: input.rungsAvailable,
    ladderTruncated: isLadderTruncated(input.rungsAvailable, input.isPdfUrl),
    // Provenance, carried on every verdict - deliberately not gated behind
    // verdict at all, unlike evidence/retrievedAt below (gated to
    // "supported" and "unsupported" since 0.2.0 section 2; still never on
    // "unreachable" or "unclaimed").
    ...(input.firedRule ? { firedRule: { lastConfirmed: input.firedRule.lastConfirmed, note: input.firedRule.note } } : {}),
  };
  if (input.verdict === "unsupported") {
    return { ...base, missed: input.missed, evidence: input.evidence, retrievedAt: new Date().toISOString() };
  }
  if (input.verdict !== "supported") return base;
  return { ...base, evidence: input.evidence, retrievedAt: new Date().toISOString() };
}

export function writeEvidenceFile(path: string, results: readonly CitationResult[]): void {
  writeFileSync(path, `${JSON.stringify({ version: 1, results }, null, 2)}\n`, "utf8");
}

export function readEvidenceFile(path: string): CitationResult[] {
  if (!existsSync(path)) return [];
  return (JSON.parse(readFileSync(path, "utf8")) as { results: CitationResult[] }).results;
}
