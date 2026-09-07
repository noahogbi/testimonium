export interface HostRule {
  readonly host: string;
  readonly userAgent?: string;
  readonly requiresIdentity?: boolean;
  readonly lastConfirmed: string;
  readonly note: string;
}

/**
 * Per-host fetch rules, each learned by losing a verification pass to it.
 *
 * ADDITIVE ONLY. A rule may add a fetch attempt or change a header. It may
 * never skip a rung and it may never decide a verdict - so a rule that has
 * gone stale costs one wasted request, not a wrong answer.
 */
export const HOST_RULES: readonly HostRule[] = [
  {
    host: "sec.gov",
    requiresIdentity: true,
    lastConfirmed: "2026-09-06",
    note:
      "403s browser UAs and REQUIRES a declared-identity UA of the form " +
      "'<app> <contact email>'. Configure it; testimonium ships no identity " +
      "of its own and warns rather than sending someone else's.",
  },
  {
    host: "bloomberg.com",
    lastConfirmed: "2026-08-24",
    note:
      "Observed hard-blocked since 2026-08-24: a robot wall to node fetch, to " +
      "curl, and to every UA tried, with Wayback captures that are archived " +
      "403s. This is REPORTED, not acted on - consider an authorized " +
      "syndication carrier. No rung is skipped on its account.",
  },
];

export function hostRuleFor(url: string): HostRule | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return HOST_RULES.find((r) => host === r.host || host.endsWith(`.${r.host}`)) ?? null;
}
