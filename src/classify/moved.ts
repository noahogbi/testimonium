/**
 * Did a read land somewhere that is no longer the page the author cited?
 *
 * The narrow answer, chosen from measurement rather than taste (spec 0.8.0
 * section 3). All 618 URLs cited by published bulletin issues were read on
 * 2026-09-25: 603 landed on the cited page, and the 15 that redirected were
 * every one the SAME ARTICLE at a new address - a dropped section segment, a
 * renamed post, a stripped leading zero, a domain move. None landed on a site
 * root or an ancestor of its path. So "moved away" is exactly those two shapes,
 * which is the removed-page-to-homepage failure `check()` must not accuse over,
 * and fires on none of the 15. Any path change would have fired on all 15; a
 * cross-site clause, on the two READABLE domain migrations (four cross-site
 * URLs in all).
 *
 * Scheme, host, query and fragment are not compared: a homepage on another site
 * is still a homepage. One exception: a cited ROOT that carries a query
 * (`/?p=123`, a WordPress short link) addresses a page, so landing on the bare
 * root counts as moved away. Paths are percent-decoded (raw on a malformed escape),
 * lowercased and stripped of trailing slashes. An empty or unparseable URL is no
 * evidence of a move.
 *
 * KNOWN LIMIT: a removed page redirected to an unrelated ARTICLE path is not
 * caught - by URL shape it is indistinguishable from the 10 legitimate
 * same-site moves measured above (README, measured limits). And the opposite
 * direction: a canonical rewrite of the cited page itself to the root
 * (`/index.html` -> `/`, `/home` -> `/`) reads as moved away, so a genuine miss
 * there is withheld as `unreachable` - the safe direction, and disclosed.
 */
export function movedAway(cited: string, landed: string): boolean {
  if (!landed) return false;
  const c = parse(cited);
  const l = parse(landed);
  if (!c || !l) return false;
  const pc = normPath(c);
  const pl = normPath(l);
  // A cited root WITH a query (`/?p=123`) addresses a page, not the homepage:
  // landing on the bare root, no query, is a move away (final review, 0.8.0).
  if (pl === "/") return pc !== "/" || (c.search !== "" && l.search === "");
  return pc.startsWith(pl + "/");
}

function parse(u: string): URL | null {
  try {
    return new URL(u);
  } catch {
    return null;
  }
}

function normPath(u: URL): string {
  let p: string;
  try {
    p = decodeURIComponent(u.pathname);
  } catch {
    p = u.pathname;
  }
  p = p.toLowerCase().replace(/\/+$/, "");
  return p === "" ? "/" : p;
}
