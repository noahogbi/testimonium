import type { Footnote } from "../adapters/types.js";
import { norm } from "../text/normalize.js";
import { THRESHOLDS } from "../classify/thresholds.js";

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

/**
 * The claim floor's predicate, applied to `norm(claim).length` because
 * `norm()` is what the MATCHER runs (spec 7.3).
 *
 * It SUBSUMES the "non-empty once normalized" check that stood inside
 * parseClaimsFile before: a claim norm() folds to "" is 0 characters, which
 * is under any floor, and "," and U+200B both fold to "" while surviving
 * trim(). Testing a weaker predicate than the matcher uses is how a false
 * attestation walked in from the CLI once already, so the predicate stays
 * norm-based and stays in one place.
 */
export function belowClaimFloor(claim: string): boolean {
  return norm(claim).length < THRESHOLDS.minClaimChars;
}

/**
 * The ONE message every door uses to refuse a short claim.
 *
 * Three doors ask this question - this loader, `check()`'s front door, and
 * harvest's first filter (spec 7.3; 13 Q3) - and a floor that one door
 * phrases differently from another is a floor the author has to learn twice.
 * It names the claim, its normalized length, the floor and the remedy,
 * because a refusal that does not say what to do instead is a wall.
 *
 * `where` is the caller's own prefix: the authored key for the loader,
 * `check(<url>): claim at index N` for the front door, the URL for harvest.
 */
export function claimFloorMessage(where: string, claim: string): string {
  return (
    `${where}: ${JSON.stringify(claim)} is ${norm(claim).length} characters once normalized, ` +
    `under the ${THRESHOLDS.minClaimChars}-character floor; ` +
    `extend it to take in the surrounding words`
  );
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
      if (value.length === 0 || value.some((p) => typeof p !== "string")) {
        throw new Error(`${key}: claims must be a non-empty array of strings`);
      }
      // The floor, refused rather than warned about (spec 7.3). It subsumes
      // the "non-empty once normalized" check this branch used to make: a
      // phrase norm() folds to "" is 0 characters and cannot clear any floor.
      // The type check above stays and runs first, so norm() is never handed
      // a non-string.
      const short = (value as string[]).find(belowClaimFloor);
      if (short !== undefined) throw new Error(claimFloorMessage(key, short));
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
