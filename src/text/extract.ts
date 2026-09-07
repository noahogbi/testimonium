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
  // real citation hits ("chi-squared", "TNF-alpha") and the capitals that
  // differ visibly from their Latin look-alikes.
  alpha: 0x3b1, beta: 0x3b2, gamma: 0x3b3, delta: 0x3b4, epsilon: 0x3b5,
  theta: 0x3b8, kappa: 0x3ba, lambda: 0x3bb, mu: 0x3bc, nu: 0x3bd,
  pi: 0x3c0, rho: 0x3c1, sigma: 0x3c3, tau: 0x3c4, phi: 0x3c6, chi: 0x3c7,
  psi: 0x3c8, omega: 0x3c9,
  Delta: 0x394, Theta: 0x398, Lambda: 0x39b, Pi: 0x3a0, Sigma: 0x3a3,
  Phi: 0x3a6, Omega: 0x3a9,
};

/** HTML to visible prose. Script and style bodies are removed before tags are
 *  stripped, or their contents would land in the extracted text and a claim
 *  could "match" against a JSON blob. */
export function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
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
