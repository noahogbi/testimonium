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
 * cross-site clause, on the two domain migrations.
 *
 * Scheme, host, query and fragment are not compared: a homepage on another site
 * is still a homepage. Paths are percent-decoded (raw on a malformed escape),
 * lowercased and stripped of trailing slashes. An empty or unparseable URL is no
 * evidence of a move.
 *
 * KNOWN LIMIT: a removed page redirected to an unrelated ARTICLE path is not
 * caught - by URL shape it is indistinguishable from the 10 legitimate
 * same-site moves measured above (README, measured limits).
 */
export function movedAway(cited: string, landed: string): boolean {
  if (!landed) return false;
  const c = parse(cited);
  const l = parse(landed);
  if (!c || !l) return false;
  const pc = normPath(c);
  const pl = normPath(l);
  if (pl === "/") return pc !== "/";
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
