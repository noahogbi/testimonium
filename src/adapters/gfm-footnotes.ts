import type { Document, Footnote } from "./types.js";

/** A GFM footnote DEFINITION at the start of a line. A reference in running
 *  prose - "text.[^1]" - is not a definition and carries no URL. */
const DEFINITION = /^\[\^([^\]]+)\]:[ \t]*(.*(?:\n[ \t]+\S.*)*)/gm;
const ANGLE_LINK = /<(https?:\/\/[^>\s]+)>/;
/** Greedy to the last closing paren on the run so a parenthesised path
 *  survives; balance is restored by trimUrl. */
const MD_LINK = /\]\((https?:\/\/[^\s]+)\)/;
const BARE_LINK = /(https?:\/\/[^\s<>\]]+)/;

/**
 * Strip trailing sentence punctuation, and any UNBALANCED closing paren.
 *
 * Parens cannot simply be excluded from a URL. Wikipedia and many reference
 * sites use parenthesised disambiguators - /wiki/Mercury_(planet) - and
 * excluding ")" truncated them mid-URL. A truncated URL fetches, 404s, and
 * reports `unreachable`, which is indistinguishable from an author's genuinely
 * broken link. The same flaw sat in MD_LINK, so writing it as a markdown link
 * did not help either.
 *
 * But a bare URL inside a prose aside - "(see https://example.com/x)" - must
 * still not swallow the closing paren. BALANCE separates the two cases, so
 * count rather than exclude. The loop runs to a fixed point because
 * punctuation and parens interleave: "...(planet)." needs both passes.
 */
function trimUrl(u: string): string {
  let out = u;
  for (;;) {
    const before = out;
    out = out.replace(/[.,;:!?]+$/, "");
    if (out.endsWith(")")) {
      const opens = (out.match(/\(/g) ?? []).length;
      const closes = (out.match(/\)/g) ?? []).length;
      if (closes > opens) out = out.slice(0, -1);
    }
    if (out === before) return out;
  }
}

/**
 * Blank out fenced code blocks before parsing.
 *
 * A code sample demonstrating footnote syntax is documentation, not a
 * citation - and without this it yields a phantom footnote carrying a real,
 * fetchable URL. Lines are blanked rather than removed so nothing outside the
 * fence shifts.
 */
function blankFencedCode(text: string): string {
  // The OPENING run, verbatim - not truncated to three characters.
  //
  // CommonMark closes a fence only with a run of the SAME character that is AT
  // LEAST AS LONG as the opener. An earlier version compared against the first
  // three characters, so an inner ``` closed a ```` fence early: the trapped
  // example leaked out as a live citation with a fetchable URL, and the real
  // closing ```` line - now seen with no fence open - became a NEW opener that
  // never closed, silently swallowing every real footnote after it. Four-tick
  // fences wrapping a three-tick example are the ordinary way to write
  // documentation about markdown.
  let fence: string | null = null;
  return text
    .split("\n")
    .map((line) => {
      const m = /^\s*(`{3,}|~{3,})/.exec(line);
      const open = fence;
      if (open === null) {
        if (!m) return line;
        fence = m[1]!;
        return "";
      }
      // Inside a fence every line is blanked; the only question is whether
      // this one ends it.
      if (m && m[1]![0] === open[0] && m[1]!.length >= open.length) fence = null;
      return "";
    })
    .join("\n");
}

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
  // NORMALIZE LINE ENDINGS FIRST. A JS regex `.` never matches \r, so on a
  // CRLF document the continuation alternative fails to match at all: the URL
  // on the continuation line is silently dropped and the citation reads as
  // having no external source, with nothing to indicate anything went wrong.
  // Windows is the native home of CRLF, and of this project.
  const text = blankFencedCode(markdown.replace(/\r\n?/g, "\n"));

  const footnotes: Footnote[] = [];
  let n = 0;
  for (const m of text.matchAll(DEFINITION)) {
    const body = (m[2] ?? "").trim();
    n += 1;
    footnotes.push({ n, url: firstExternalUrl(body), label: body });
  }
  // `body` is the ORIGINAL markdown, line endings intact.
  return { footnotes, body: markdown };
}
