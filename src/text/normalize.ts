/**
 * Normalize both sides of a phrase test so it survives the renderings outlets
 * actually use. Every clause below was added because a claim demonstrably
 * present in a source reported as MISSING without it, and a false miss is
 * indistinguishable from a fabricated claim.
 */
export function norm(s: string): string {
  return s
    .toLowerCase()
    // Zero-width and word-joiner characters, stripped from BOTH sides. Radio
    // station mirrors that carry the Reuters wire inject them mid-phrase: one
    // article held 21 (8x U+200B, 5x U+200C, 8x U+2060), landing inside
    // "in contact<U+2060>with Tesla". U+FEFF is here for the same reason a BOM
    // survives a mid-document concatenation.
    // U+00AD SOFT HYPHEN is deleted here too (spec 7.3, plan 1.2): toText
    // decodes &shy; into it, a browser renders nothing there, and the claim
    // quoting the visible word missed - a false miss on a readable page.
    .replace(/[\u00AD\u200B-\u200F\u2060\uFEFF]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Every Unicode hyphen and dash folded to ASCII, not just en and em.
    // OpenAI writes its model names with U+2011 NON-BREAKING HYPHEN, so without
    // this every claim quoting an OpenAI model name reports a false MISS.
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/(\d)\s*billion/g, "$1bn")
    .replace(/(\d)\s*bn\b/g, "$1bn")
    .replace(/(\d)\s*million/g, "$1mn")
    .replace(/(\d)\s*mn\b/g, "$1mn")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    // toText() replaces every tag with a space, so a phrase copied VERBATIM
    // from a rendered page arrives as "404 file not found ." and misses. A
    // miss on a document that cleared the prose floor is an ACCUSATION, so
    // this clause is keystone-critical, not cosmetic. It is applied to BOTH
    // sides and only ever deletes, so it can only ADD a match - and an added
    // match can only move a verdict toward "supported", the safe direction.
    // Space AFTER terminal punctuation is deliberately NOT removed: that
    // would let the claim "1.5" match a list rendering "1. 5 things".
    .replace(/\s+([.;:!?%)\]}])/g, "$1")
    .replace(/([(\[{])\s+/g, "$1")
    .trim();
}

/** A phrase test that survives the renderings outlets actually use. */
export function phraseFound(haystack: string, phrase: string): boolean {
  return norm(haystack).includes(norm(phrase));
}
