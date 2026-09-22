/** A numeric entity's code point as a character, leaving the raw entity in
 *  place when it is out of range so a malformed entity cannot throw mid-run. */
function entityChar(n: number, raw: string): string {
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : raw;
}

/** Named entities decode to their literal characters; norm() does all folding.
 *  One canonical form per code point, folded in one place.
 *
 *  Values are CODE POINTS, not literal characters. Four of the entries below
 *  are spaces of different widths, and written literally they are
 *  indistinguishable from an ASCII space in any editor - a review of this
 *  file's own plan caught exactly that.
 *
 *  Mapping an entity to a multi-character stand-in (this file once turned
 *  &mdash; into "--") makes toText disagree with itself, because the numeric
 *  branches below produce the literal character for the same code point - and
 *  it desynchronises excerpt.ts's FOLD map, which is length-preserving.
 *
 *  `amp` is deliberately ABSENT: it decodes last, separately, or "&amp;#x27;"
 *  - a literal "&#x27;" on the page - would double-decode. */
const NAMED: Readonly<Record<string, number>> = {
  lt: 0x3c, gt: 0x3e, quot: 0x22, apos: 0x27,
  // Comparison operators: ordinary in quantitative and statistical claims.
  le: 0x2264, ge: 0x2265, ne: 0x2260,
  nbsp: 0xa0, ensp: 0x2002, emsp: 0x2003, thinsp: 0x2009, shy: 0xad,
  ndash: 0x2013, mdash: 0x2014, minus: 0x2212,
  lsquo: 0x2018, rsquo: 0x2019, sbquo: 0x201a,
  ldquo: 0x201c, rdquo: 0x201d, bdquo: 0x201e,
  laquo: 0xab, raquo: 0xbb, lsaquo: 0x2039, rsaquo: 0x203a,
  // Spanish-language sources open with these rather than closing with them.
  iexcl: 0xa1, iquest: 0xbf,
  hellip: 0x2026, prime: 0x2032, Prime: 0x2033, bull: 0x2022, middot: 0xb7,
  dagger: 0x2020, Dagger: 0x2021, permil: 0x2030, sect: 0xa7, para: 0xb6,
  copy: 0xa9, reg: 0xae, trade: 0x2122,
  deg: 0xb0, plusmn: 0xb1, micro: 0xb5, times: 0xd7, divide: 0xf7,
  sup2: 0xb2, sup3: 0xb3, frac12: 0xbd, frac14: 0xbc, frac34: 0xbe,
  pound: 0xa3, euro: 0x20ac, yen: 0xa5, cent: 0xa2,
  // Every accented-Latin row below is symmetric: present in lowercase, its
  // uppercase row is present too, and vice versa - except szlig, which HTML5
  // gives no uppercase named entity for at all.
  aacute: 0xe1, Aacute: 0xc1, eacute: 0xe9, Eacute: 0xc9,
  iacute: 0xed, Iacute: 0xcd, oacute: 0xf3, Oacute: 0xd3,
  uacute: 0xfa, Uacute: 0xda,
  agrave: 0xe0, Agrave: 0xc0, egrave: 0xe8, Egrave: 0xc8,
  ugrave: 0xf9, Ugrave: 0xd9, ograve: 0xf2, Ograve: 0xd2,
  acirc: 0xe2, Acirc: 0xc2, ecirc: 0xea, Ecirc: 0xca,
  icirc: 0xee, Icirc: 0xce, ocirc: 0xf4, Ocirc: 0xd4, ucirc: 0xfb, Ucirc: 0xdb,
  auml: 0xe4, Auml: 0xc4, euml: 0xeb, Euml: 0xcb,
  iuml: 0xef, Iuml: 0xcf, ouml: 0xf6, Ouml: 0xd6, uuml: 0xfc, Uuml: 0xdc,
  ntilde: 0xf1, Ntilde: 0xd1, ccedil: 0xe7, Ccedil: 0xc7, szlig: 0xdf,
  aelig: 0xe6, AElig: 0xc6, oslash: 0xf8, Oslash: 0xd8,
  aring: 0xe5, Aring: 0xc5, oelig: 0x153, OElig: 0x152,
  // Greek: the eight letters an earlier pass already carried, plus the rest a
  // real citation hits ("chi-squared", "TNF-alpha").
  //
  // THE SET IS PARTIAL, in both cases, and no rule generates it - it is the
  // letters successive passes happened to need. The capitals were once
  // described here as "the capitals that differ visibly from their Latin
  // look-alikes", which is false: Gamma (U+0393), Xi (U+039E) and Psi
  // (U+03A8) all differ visibly and none of them is below. Lowercase zeta,
  // eta, iota, omicron, upsilon and xi are absent too, so `xi` is missing in
  // both cases. A missing entry leaves the raw entity in the extracted text,
  // which is a false-MISS - an accusation route - so completing the set is
  // safe in the direction that matters; it is simply not done here.
  alpha: 0x3b1, beta: 0x3b2, gamma: 0x3b3, delta: 0x3b4, epsilon: 0x3b5,
  theta: 0x3b8, kappa: 0x3ba, lambda: 0x3bb, mu: 0x3bc, nu: 0x3bd,
  pi: 0x3c0, rho: 0x3c1, sigma: 0x3c3, tau: 0x3c4, phi: 0x3c6, chi: 0x3c7,
  psi: 0x3c8, omega: 0x3c9,
  Delta: 0x394, Theta: 0x398, Lambda: 0x39b, Pi: 0x3a0, Sigma: 0x3a3,
  Phi: 0x3a6, Omega: 0x3a9,
};

/** A tag's attributes, by lowercased name, FIRST occurrence winning. Replaces
 *  two regexes that matched substrings of the whole tag: `\bcontent\s*=` fired
 *  inside `data-content`, and both fired inside another attribute's VALUE, so
 *  the wrong text was harvested and the real description was lost. Values are
 *  matched case-insensitively by the caller, because `name="Description"` is
 *  ordinary legacy CMS output.
 *
 *  Unquoted values are deliberately NOT collected: 0.5.0 never harvested them,
 *  and accepting them here would newly harvest `name=description` on pages this
 *  release is not otherwise changing. */
function parseAttrs(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  // Strip the angle brackets. The tag name needs no skipping: it carries no `=`.
  const body = tag.slice(1, -1);
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(["'])([\s\S]*?)\2/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    // `as string`: the repo runs noUncheckedIndexedAccess, so a matched group
    // types as string | undefined even though the regex guarantees it here.
    const name = (m[1] as string).toLowerCase();
    if (!attrs.has(name)) attrs.set(name, m[3] as string);
  }
  return attrs;
}

const DESCRIPTION_VALUES = new Set(["description", "og:description", "twitter:description"]);

/** Tags, with attribute values respected. A regex cannot do this: `<[^>]*>`
 *  ends the tag at the first `>`, so a `>` inside a quoted attribute value both
 *  truncates a genuine tag and makes a `<meta>`-shaped STRING sitting inside
 *  another tag's attribute look like a tag of its own. The first loses a real
 *  description; the second harvests text that is markup, not page content. */
function* tagsIn(html: string): Generator<string> {
  let i = 0;
  while ((i = html.indexOf("<", i)) !== -1) {
    let j = i + 1;
    let quote = "";
    while (j < html.length) {
      const c = html[j];
      if (quote) {
        if (c === quote) quote = "";
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === ">") break;
      j++;
    }
    // An unterminated quote consumes to end of input and we stop here, discarding
    // every later tag - including legitimate descriptions. That is NOT free: on a
    // page with enough body prose to clear the floor, losing a description that
    // carried a claim leaves matched < total and accuses the author. Recovering
    // instead - resuming at the first `>` seen inside the quote - trades that for
    // harvesting text a strict parser would never render.
    //
    // The design spec RANKS those two outcomes rather than leaving it open: a
    // false accusation "is a worse failure than the one the tool exists to
    // prevent, because it is self-inflicted and it is aimed at the author's own
    // honest citations", and everything in that document is subordinate to that
    // rule (2026-09-06-testimonium-design.md:101). So recovery is the direction
    // the spec points, and the risk it carries is milder than it first looks: an
    // unterminated quote is a MALFORMED page, not an adversarial one, and the tag
    // recovered is a genuine publisher-authored description rather than the stale
    // or injected content the strips above exist to exclude.
    //
    // It is deferred out of 0.5.0 for one reason, and not because the question is
    // open: changing this after the fact would invalidate
    // docs/description-movement-0-5-0.md, whose numbers describe the code as
    // measured, and re-measuring costs 618 live requests against real publishers.
    // Malformed pages keep pre-0.5.0 behaviour meanwhile, so this is a coverage
    // gap rather than a regression. Scheduled for 0.5.1.
    if (j >= html.length) break;
    yield html.slice(i, j + 1);
    i = j + 1;
  }
}

/** Text a page carries in description attributes, one entry per distinct
 *  value. Harvested AFTER script and style bodies are removed but BEFORE the
 *  tag strip: `<[^>]*>` discards attribute values wholesale - which is why a
 *  page whose only prose lives in its description reads as unreadable -
 *  while a `<meta>` sitting in text no reader's browser actually renders - a
 *  script body, an inert `<template>`, a comment - must not be harvested at
 *  all. Deduplicated: the three tags almost always carry one sentence, and
 *  counting it three times inflates prose toward the 4,500 floor. */
function descriptionValues(html: string): string[] {
  const seen = new Set<string>();
  for (const tag of tagsIn(html)) {
    if (!/^<meta\b/i.test(tag)) continue;
    const attrs = parseAttrs(tag);
    // Prefer whichever of `name=`/`property=` actually carries a description
    // value, rather than preferring `name` blindly: a tag carrying BOTH
    // `name="author"` and `property="og:description"` is real, and 0.5.0
    // harvested it. `.trim()` here newly harvests `name=" description "`,
    // which 0.5.0 did not. This is a DELIBERATE WIDENING on a well-formed
    // page, in the text-ADDING direction, and it is more permissive than a
    // browser rather than equal to it: HTML5 matches standard metadata names
    // exactly, so `name=" description "` selects nothing for a browser. An
    // earlier comment here claimed this "matches a browser"; that was false.
    // Disclosed in the 0.6.0 spec's grammar table and in the changelog.
    const candidates = [attrs.get("name"), attrs.get("property")];
    const key = candidates.map((v) => (v ?? "").trim().toLowerCase()).find((v) => DESCRIPTION_VALUES.has(v));
    if (!key) continue;
    const value = attrs.get("content")?.trim();
    // Deduplicated by the RAW attribute text, not the decoded value, so
    // `Cats &amp; Dogs.` and `Cats &amp;amp; Dogs.` remain two regions even
    // though they decode alike. Deliberate, and it must stay: decoding first
    // would change how many regions a page yields and therefore move
    // `toText`'s byte output, which this release holds fixed.
    if (value) seen.add(value);
  }
  return [...seen];
}

// Named entities EXCEPT &amp;, which must come last, then whitespace collapse
// and trim. Split out of toText so toTextRegions can run it per-region before
// joining rather than once over an already-joined string - see toTextRegions.
function finish(s: string): string {
  return s
    .replace(/&([a-zA-Z][a-zA-Z0-9]{1,31});/g, (raw, name: string) => {
      const cp = NAMED[name];
      return cp === undefined ? raw : String.fromCodePoint(cp);
    })
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (raw, h: string) => entityChar(parseInt(h, 16), raw))
    .replace(/&#(\d+);/g, (raw, d: string) => entityChar(Number(d), raw))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** The body plus each distinct description value, as separate strings. The
 *  regions exist because a claim must not be matchable across the join between
 *  them: `toText`'s flat output concatenates them, and a phrase spanning that
 *  boundary appears nowhere on the page.
 *
 *  Order is the body followed by each description in document order, but an
 *  empty region is OMITTED, so position is not a reliable label: a page whose
 *  body normalizes to nothing returns its description at index 0. Callers must
 *  identify a region by searching it, never by its index. (An earlier draft of
 *  this comment, and of the plan it came from, said "index 0 is always the
 *  body"; that is false in exactly that case.)
 *
 *  Each region runs the entity/whitespace chain independently and the join is a
 *  single space, which reproduces `toText` byte for byte because the chain
 *  trims each part - proven over every fixture in extract-regions.test.ts. */
export function toTextRegions(html: string): string[] {
  // Strip script and style FIRST, then harvest, then strip tags. The order is
  // load-bearing: a `<meta>` tag written inside a script body is text no reader
  // ever sees, and harvesting from raw HTML would feed it to the classifier as
  // prose - a route to a false `supported`, which the CONSUMER cutover spec
  // (2026-09-15-citation-check-cutover-design.md, section 1) calls inviolable.
  // Note this is a different ranking from the one cited in `tagsIn` above: the
  // binding DESIGN spec ranks a false accusation as the worse of the two
  // (2026-09-06-testimonium-design.md:101). The order below is what both
  // rankings require, so nothing turns on which governs - but the two citations
  // point in opposite directions and each must name its own spec to stay
  // readable. `toText`'s docstring below names the hazard for script bodies
  // generally - this code moved here from that function, so the self-reference
  // it used to carry would now point at the wrong docstring; harvesting before
  // the strip would bypass the protection it was built around.
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  // Every strip here tolerates a MISSING closer. A regex that demands one simply
  // fails to match on malformed input, leaving the region's contents in the
  // harvest input for `tagsIn` to read as live markup - which is the dangerous
  // direction, since a browser treats an unterminated `<!--`, `<template>` or
  // `<script>` as swallowing the rest of the document as inert content. `$` only
  // matches once the non-greedy engine has exhausted the string without finding
  // the real closer, so well-formed input is completely unaffected.
  //
  // Script and style are re-stripped here even though `stripped` already removed
  // the well-formed ones: `stripped` feeds BODY extraction, which is contractually
  // untouched in this release, so the tolerant variants live on this side only.
  const forHarvest = stripped
    .replace(/<script\b[\s\S]*?(?:<\/script>|$)/gi, " ")
    .replace(/<style\b[\s\S]*?(?:<\/style>|$)/gi, " ")
    .replace(/<!--[\s\S]*?(?:-->|$)/g, " ")
    .replace(/<template\b[\s\S]*?(?:<\/template>|$)/gi, " ");
  const body = finish(stripped.replace(/<[^>]*>/g, " "));
  const out = body ? [body] : [];
  for (const v of descriptionValues(forHarvest)) {
    const f = finish(v);
    if (f) out.push(f);
  }
  return out;
}

/** HTML to visible prose. Script and style bodies are removed before tags are
 *  stripped, or their contents would land in the extracted text and a claim
 *  could "match" against a JSON blob. */
export function toText(html: string): string {
  return toTextRegions(html).join(" ");
}
