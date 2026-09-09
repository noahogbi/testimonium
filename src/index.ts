export { check, type CheckOptions } from "./check.js";
export { reachability, type ReachabilityResult, type ReachabilityOptions } from "./reachability.js";
export type { CitationResult, FiredRule } from "./io/evidence.js";
export { loadRules, type RuleSet } from "./rules/load.js";
export type { Verdict } from "./classify/verdict.js";
export type { Fetcher, RawResponse, RungId } from "./fetch/types.js";
export { parseGfmFootnotes } from "./adapters/gfm-footnotes.js";
export { parseClaimsFile, normalizeUrl, joinClaims } from "./io/claims.js";
export { VERSION } from "./version.js";
