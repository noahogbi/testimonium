import type { Document, Footnote } from "./types.js";

/** A GFM footnote DEFINITION at the start of a line. A reference in running
 *  prose - "text.[^1]" - is not a definition and carries no URL. */
const DEFINITION = /^\[\^([^\]]+)\]:[ \t]*(.*(?:\n(?![ \t]*\n|\[\^)[ \t]*.*)*)/gm;
const ANGLE_LINK = /<(https?:\/\/[^>\s]+)>/;
const MD_LINK = /\]\((https?:\/\/[^)\s]+)\)/;
const BARE_LINK = /(https?:\/\/[^\s<>)\]]+)/;

/** Trailing sentence punctuation is not part of a bare URL. */
const trimUrl = (u: string): string => u.replace(/[.,;:!?]+$/, "");

function firstExternalUrl(text: string): string | null {
  for (const re of [ANGLE_LINK, MD_LINK, BARE_LINK]) {
    const m = re.exec(text);
    if (m?.[1]) return trimUrl(m[1]);
  }
  return null;
}

/**
 * Parse GitHub-Flavored Markdown footnote definitions. Pandoc accepts the same
 * syntax. Other flavours are separate adapters.
 *
 * When a footnote cites several external sources the FIRST is taken as the one
 * its claims are checked against; a footnote whose claims span two sources
 * should be split into two footnotes.
 */
export function parseGfmFootnotes(markdown: string): Document {
  const footnotes: Footnote[] = [];
  let n = 0;
  for (const m of markdown.matchAll(DEFINITION)) {
    const text = (m[2] ?? "").trim();
    n += 1;
    footnotes.push({ n, url: firstExternalUrl(text), label: text });
  }
  return { footnotes, body: markdown };
}
