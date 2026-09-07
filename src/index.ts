export { check, type CheckOptions } from "./check.js";
// NOTE: reachability is omitted here on purpose. Task 14 creates
// src/reachability.ts; until then this export line would break the build.
// Task 14 restores: export { reachability, type ReachabilityResult } from "./reachability.js";
export type { CitationResult } from "./io/evidence.js";
export type { Verdict } from "./classify/verdict.js";
export type { Fetcher, RawResponse, RungId } from "./fetch/types.js";
export { parseGfmFootnotes } from "./adapters/gfm-footnotes.js";
export { parseClaimsFile, normalizeUrl, joinClaims } from "./io/claims.js";
export const VERSION = "0.1.0";
