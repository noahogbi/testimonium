import type { Footnote } from "../adapters/types.js";

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
  for (const [key, value] of Object.entries(raw)) {
    // Keys beginning with "_" are notes for a human reader, not citations.
    if (key.startsWith("_")) continue;
    if (Array.isArray(value)) {
      if (value.length === 0 || value.some((p) => typeof p !== "string" || !p.trim())) {
        throw new Error(`${key}: claims must be a non-empty array of non-empty strings`);
      }
      out.set(normalizeUrl(key), value as string[]);
      continue;
    }
    if (value && typeof value === "object" && typeof (value as { notApplicable?: unknown }).notApplicable === "string") {
      out.set(normalizeUrl(key), value as { notApplicable: string });
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
