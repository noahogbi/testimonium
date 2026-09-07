import type { Footnote } from "../adapters/types.js";
import { norm } from "../text/normalize.js";

export type ClaimEntry = string[] | { notApplicable: string };
export type ClaimsFile = Map<string, ClaimEntry>;

const TRACKING = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|s_cid$)/i;

/**
 * Declared join semantics. Without these, a trailing-slash difference between
 * the document and the claims file silently turns a checked citation into an
 * unclaimed one - the same class of defect as misattached claims, minus the
 * alarm.
 */
export function normalizeUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) u.port = "";
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  let out = u.toString();
  // Only a pathless URL loses its slash. "/a/" and "/a" can be different
  // resources; "https://e.com/" and "https://e.com" never are.
  if (u.pathname === "/" && !u.search && !u.hash) out = out.replace(/\/$/, "");
  return out;
}

export function parseClaimsFile(json: string): ClaimsFile {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const out: ClaimsFile = new Map();
  /** normalized key -> the authored key it came from, for collision reporting. */
  const origin = new Map<string, string>();

  for (const [key, value] of Object.entries(raw)) {
    // Keys beginning with "_" are notes for a human reader, not citations.
    if (key.startsWith("_")) continue;

    const url = normalizeUrl(key);

    // Two authored keys that normalize alike would collide in the Map and the
    // later would win - an entire footnote's claims vanishing with no error.
    // That is the precise quiet-failure class URL keying exists to remove, so
    // it is a hard error rather than a warning.
    const prior = origin.get(url);
    if (prior !== undefined) {
      throw new Error(`${key}: normalizes to the same URL as ${prior} (${url}) - remove one`);
    }
    origin.set(url, key);

    // Credentials in a citation URL would be written into the evidence file,
    // which is committed beside the prose. Warn rather than strip: stripping
    // would silently break access to a source that needs them.
    if (/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i.test(key)) {
      console.warn(`warn ${key.replace(/\/\/[^@]*@/, "//<credentials>@")}: URL carries embedded credentials, which will be stored in the evidence file`);
    }

    if (Array.isArray(value)) {
      // `norm()`, NOT `trim()`: the predicate has to be the one the MATCHER
      // uses. A phrase norm() folds to "" matches every document exactly as ""
      // does, and trim() cannot see it - "," and ",,," survive trim (norm
      // deletes commas) and U+200B is not whitespace to JS. Letting one
      // through here walks a false attestation straight in from the CLI.
      if (value.length === 0 || value.some((p) => typeof p !== "string" || !norm(p))) {
        throw new Error(`${key}: claims must be a non-empty array of strings that are non-empty once normalized`);
      }
      out.set(url, value as string[]);
      continue;
    }
    if (value && typeof value === "object" && typeof (value as { notApplicable?: unknown }).notApplicable === "string") {
      out.set(url, value as { notApplicable: string });
      continue;
    }
    throw new Error(`${key}: expected a non-empty array of phrases or {"notApplicable": "<reason>"}`);
  }
  return out;
}

export interface Joined {
  readonly checkable: { n: number; url: string; label: string; claims: string[] }[];
  readonly notApplicable: { n: number; url: string | null; label: string; reason: string }[];
  readonly unclaimed: { n: number; url: string; label: string }[];
  /** A claimed URL that appears in no footnote. Usually a citation removed
   *  from the prose without updating the claims file. Warning by default. */
  readonly orphanedClaims: string[];
}

export function joinClaims(footnotes: readonly Footnote[], claims: ClaimsFile): Joined {
  const checkable: Joined["checkable"][number][] = [];
  const notApplicable: Joined["notApplicable"][number][] = [];
  const unclaimed: Joined["unclaimed"][number][] = [];
  const seen = new Set<string>();

  for (const fn of footnotes) {
    if (!fn.url) {
      notApplicable.push({ n: fn.n, url: null, label: fn.label, reason: "no external source" });
      continue;
    }
    const key = normalizeUrl(fn.url);
    seen.add(key);
    const entry = claims.get(key);
    if (entry === undefined) {
      unclaimed.push({ n: fn.n, url: fn.url, label: fn.label });
    } else if (Array.isArray(entry)) {
      checkable.push({ n: fn.n, url: fn.url, label: fn.label, claims: entry });
    } else {
      notApplicable.push({ n: fn.n, url: fn.url, label: fn.label, reason: entry.notApplicable });
    }
  }

  return {
    checkable,
    notApplicable,
    unclaimed,
    orphanedClaims: [...claims.keys()].filter((k) => !seen.has(k)),
  };
}
