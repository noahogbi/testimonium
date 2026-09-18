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

/** Text a page carries in description attributes. Harvested AFTER script and
 *  style bodies are removed but BEFORE the tag strip: `<[^>]*>` discards
 *  attribute values wholesale - which is why a page whose only prose lives in
 *  its description reads as unreadable - while a `<meta>` written inside a
 *  script body is text no reader sees and must not be harvested at all.
 *  Deduplicated: the three tags almost always carry one sentence, and counting
 *  it three times inflates prose toward the 4,500 floor. */
const META_TAG = /<meta\b[^>]*>/gi;
const IS_DESCRIPTION = /\b(?:name|property)\s*=\s*(["'])(?:og:|twitter:)?description\1/i;
const CONTENT_ATTR = /\bcontent\s*=\s*(["'])([\s\S]*?)\1/i;

function descriptionText(html: string): string {
  const seen = new Set<string>();
  for (const tag of html.match(META_TAG) ?? []) {
    if (!IS_DESCRIPTION.test(tag)) continue;
    const m = CONTENT_ATTR.exec(tag);
    const value = m?.[2]?.trim();
    if (value) seen.add(value);
  }
  return [...seen].join(" ");
}

/** HTML to visible prose. Script and style bodies are removed before tags are
 *  stripped, or their contents would land in the extracted text and a claim
 *  could "match" against a JSON blob. */
export function toText(html: string): string {
  // Strip script and style FIRST, then harvest, then strip tags. The order is
  // load-bearing: a `<meta>` tag written inside a script body is text no reader
  // ever sees, and harvesting from raw HTML would feed it to the classifier as
  // prose - a route to a false `supported`, which is the one outcome the spec
  // calls inviolable. This function's own docstring already names the hazard
  // for script bodies generally; harvesting before the strip would bypass the
  // protection it was built around.
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const described = descriptionText(stripped);
  const body = stripped.replace(/<[^>]*>/g, " ");
  return (described ? `${body} ${described}` : body)
    // Named entities EXCEPT &amp;, which must come last.
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
