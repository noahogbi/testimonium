import { readFileSync, existsSync } from "node:fs";
import { CHALLENGE_PATHS, CHALLENGE_SIGNATURES, type Rule } from "./challenge.js";
import { HOST_RULES, type HostRule } from "./hosts.js";

export interface RuleSet {
  readonly signatures: readonly Rule[];
  readonly paths: readonly Rule[];
  readonly hosts: readonly HostRule[];
}

interface LocalRule {
  pattern?: unknown;
  lastConfirmed?: unknown;
  note?: unknown;
}

function toRule(raw: LocalRule, where: string): Rule {
  if (typeof raw.lastConfirmed !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.lastConfirmed)) {
    throw new Error(`${where}: every rule needs a lastConfirmed date (YYYY-MM-DD)`);
  }
  if (typeof raw.note !== "string" || raw.note.trim() === "") {
    throw new Error(`${where}: every rule needs a note saying what it is for`);
  }
  if (typeof raw.pattern !== "string") throw new Error(`${where}: pattern must be a string`);
  try {
    return { pattern: new RegExp(raw.pattern), lastConfirmed: raw.lastConfirmed, note: raw.note };
  } catch {
    // Better here than as a crash halfway through a run.
    throw new Error(`${where}: pattern is not a valid regular expression: ${raw.pattern}`);
  }
}

/** Local host rules get the same audit discipline as signatures: a rule
 *  without a date is a rule nobody can review. Absent before, which was moot
 *  only while host rules were unwired - see `hostRuleFor`/`userAgentFor` -
 *  and stopped being moot the moment they reached the fetcher. */
function toHostRule(raw: Record<string, unknown>, where: string): HostRule {
  if (typeof raw["host"] !== "string" || raw["host"].trim() === "") {
    throw new Error(`${where}: every host rule needs a host`);
  }
  if (typeof raw["lastConfirmed"] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw["lastConfirmed"])) {
    throw new Error(`${where}: every rule needs a lastConfirmed date (YYYY-MM-DD)`);
  }
  if (typeof raw["note"] !== "string" || raw["note"].trim() === "") {
    throw new Error(`${where}: every rule needs a note saying what it is for`);
  }
  return raw as unknown as HostRule;
}

/**
 * Bundled rules plus any local ones. ADDITIVE ONLY.
 *
 * A local file cannot delete a bundled rule. Deletion would let a user's config
 * silently switch off a protection, and a rule can only ever ADD a fetch
 * attempt anyway - so the worst a stale bundled rule costs is one wasted
 * request, never a wrong verdict.
 */
export function loadRules(path?: string): RuleSet {
  if (!path) return { signatures: CHALLENGE_SIGNATURES, paths: CHALLENGE_PATHS, hosts: HOST_RULES };
  if (!existsSync(path)) throw new Error(`rules file not found: ${path}`);
  const local = JSON.parse(readFileSync(path, "utf8")) as {
    signatures?: LocalRule[];
    paths?: LocalRule[];
    hosts?: Record<string, unknown>[];
  };
  return {
    signatures: [...CHALLENGE_SIGNATURES, ...(local.signatures ?? []).map((r, i) => toRule(r, `signatures[${i}]`))],
    paths: [...CHALLENGE_PATHS, ...(local.paths ?? []).map((r, i) => toRule(r, `paths[${i}]`))],
    hosts: [...HOST_RULES, ...(local.hosts ?? []).map((h, i) => toHostRule(h, `hosts[${i}]`))],
  };
}
