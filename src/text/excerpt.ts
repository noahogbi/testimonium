import { norm, phraseFound } from "./normalize.js";
import type { RungId } from "../fetch/types.js";

export interface Evidence {
  claims: string[];
  excerpt: string | null;
  rung: RungId;
}

const EXCERPT_CHARS = 240;

/** Cap on context kept BEFORE the match when no sentence boundary is available
 *  to snap to. toText flattens nav bars and pricing tables into the body, and
 *  those runs carry no punctuation to snap on - so without a cap the window
 *  opens mid-table. */
const MAX_LEAD = 90;

/** Length-preserving substitutions norm() also makes. Length-CHANGING ones
 *  (notably "6.5 billion" -> "6.5bn") are deliberately not reproduced: a
 *  per-character map cannot express them, so a claim that only matched because
 *  of one fails to locate and yields null - the safe outcome. */
const FOLD: Record<string, string> = {
  "’": "'", "‘": "'",
  "“": '"', "”": '"',
  // The FULL Unicode dash range, matching norm()'s fold exactly. All seven are
  // 1:1 length-preserving, so the index map handles them like any other
  // character. Reproducing only em and en dash meant a source using U+2011
  // (OpenAI model names) matched via phraseFound but located as null - the
  // verdict said supported while the reader saw no passage.
  "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "―": "-", "−": "-",
};

/** Characters norm() deletes outright. Dropping is safe for the index map:
 *  the map records the source offset of each character that SURVIVES.
 *
 *  The set mirrors norm()'s /[\u00AD\u200B-\u200F\u2060\uFEFF]/g exactly - the
 *  zero-widths and, since plan 1.2, the soft hyphen.
 *  Reproducing only the comma was the same defect the Unicode dash range had:
 *  a character the matcher deletes but the fold keeps is pushed into the folded
 *  string, the index map diverges, and a claim spanning one reports phraseFound
 *  true with a null excerpt - `supported` with no passage behind it. Wire
 *  mirrors inject these mid-phrase, so it is the ordinary case, not an exotic
 *  one. */
const DROP = new Set([
  ",",
  "\u00AD",
  "\u200B", "\u200C", "\u200D", "\u200E", "\u200F", "\u2060", "\uFEFF",
]);

/** Punctuation that norm() pulls back onto the preceding word, and brackets
 *  that it pulls the following word up to. Reproduced here so the matcher and
 *  the index map stay aligned. Without it every claim the punctuation clause
 *  rescues returns `supported` with a null excerpt - a verdict with no passage
 *  behind it. */
const CLOSE_PUNCT = new Set([".", ";", ":", "!", "?", "%", ")", "]", "}"]);
const OPEN_PUNCT = new Set(["(", "[", "{"]);

/**
 * Fold a copy of the text while remembering where each surviving character came
 * from.
 *
 * THIS MAP IS THE WHOLE POINT OF THE FILE. The match happens in normalized
 * space; the quote shown to a reader must be the source's own words. Walking a
 * cursor and counting "characters that normalize to something" does not bridge
 * the two, because a space normalizes to the empty string under a trimming
 * norm() while still occupying a position in the folded string - so the cursor
 * drifts about one character per word. On a five-thousand-character document
 * that drift reaches hundreds of characters and returns a passage that does not
 * contain the claim, presented under a citation as the evidence for it. That is
 * worse than showing no evidence at all. Exported for plan 2's harvest, which slices the SOURCE by these offsets and needs them exact, not merely inside excerptFor's window.
 */
export function foldWithMap(text: string): { folded: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < text.length; i++) {
    const raw = text[i] as string;
    if (DROP.has(raw)) continue;
    if (/\s/.test(raw)) {
      // \s matches U+00A0 in JS, so the NBSP fold is covered here.
      if (lastWasSpace) continue;
      // Look past the whitespace run - and any DROP character inside it, since
      // norm() deletes commas BEFORE it collapses space - to decide whether
      // norm() would have deleted this space outright.
      let j = i;
      while (j < text.length && (/\s/.test(text[j] as string) || DROP.has(text[j] as string))) j++;
      const next = text[j];
      if (next !== undefined && CLOSE_PUNCT.has(next)) continue;
      const prev = chars[chars.length - 1];
      if (prev !== undefined && OPEN_PUNCT.has(prev)) continue;
      lastWasSpace = true;
      chars.push(" ");
      map.push(i);
      continue;
    }
    lastWasSpace = false;
    // One map entry per OUTPUT code unit, not per input unit. toLowerCase()
    // can lengthen a character (U+0130 becomes "i" plus a combining dot,
    // two units), and a map that pushed one entry per input unit fell one
    // behind at every such character, for the rest of the document. Every
    // output unit points at the source character that produced it.
    const out = (FOLD[raw] ?? raw).toLowerCase();
    for (let k = 0; k < out.length; k++) map.push(i);
    chars.push(out);
  }
  return { folded: chars.join(""), map };
}

/** A sentence end is terminal punctuation followed by whitespace. Requiring the
 *  whitespace is what keeps "5.1" and "$6.5" from reading as boundaries.
 *  Two instances rather than one shared /g regex: exec carries lastIndex state
 *  between calls, and a shared object is one refactor from a cross-call bug. */
const SENTENCE_END_G = /[.!?]["')\]]?(?=\s)/g;
const SENTENCE_END = /[.!?]["')\]]?(?=\s)/;

/** Terminal punctuation ending an abbreviation, not a sentence. Without this,
 *  "The U.S. Army said" opens the quote at "Army" and "Dr. Smith" splits the
 *  name - both misquotes by truncation. ANCHORED with $: an unanchored form
 *  matches any initialism anywhere in the lead and suppresses every snap. */
const ABBREVIATION =
  /(?:\b[A-Z]|\b(?:Mr|Mrs|Ms|Dr|Prof|Sen|Rep|Gov|Gen|Inc|Ltd|Corp|Co|Jr|Sr|St|vs|etc|approx|Fig|No|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec))\.$/;

const endsAbbreviation = (text: string, punctIndex: number): boolean =>
  ABBREVIATION.test(text.slice(0, punctIndex + 1));

/** Walk index forward to the next word boundary, never past limit. */
function alignForward(text: string, index: number, limit: number): number {
  if (index <= 0) return index;
  if (/\s/.test(text[index - 1] ?? "")) return index;
  const ws = text.slice(index, limit).search(/\s/);
  return ws >= 0 ? index + ws : index;
}

/** Walk index back to the previous word boundary, never before limit. Without
 *  this the window closes mid-token and turns "23%" into "2", which reads as a
 *  different number rather than as visible truncation. */
function alignBack(text: string, index: number, limit: number): number {
  if (index >= text.length) return index;
  if (/\s/.test(text[index] ?? "")) return index;
  const lastSpace = text.lastIndexOf(" ", index);
  return lastSpace > limit ? lastSpace : index;
}

function snapStart(text: string, from: number, start: number): number {
  const lead = text.slice(from, start);
  const ends = [...lead.matchAll(SENTENCE_END_G)].filter((m) => !endsAbbreviation(text, from + (m.index ?? 0)));
  const last = ends[ends.length - 1];
  if (last) {
    const after = from + (last.index ?? 0) + last[0].length;
    if (after < start) return after;
  }
  return alignForward(text, Math.max(from, start - MAX_LEAD), start);
}

function snapEnd(text: string, endExclusive: number, to: number): number {
  // Start two characters back so a claim that itself ends in a full stop does
  // not push the window a whole sentence further on.
  let cursor = Math.max(0, endExclusive - 2);
  while (cursor < to) {
    const m = SENTENCE_END.exec(text.slice(cursor, to));
    if (!m) break;
    const punctIndex = cursor + (m.index ?? 0);
    const after = punctIndex + m[0].length;
    if (after >= endExclusive && !endsAbbreviation(text, punctIndex)) return after;
    cursor = punctIndex + 1;
  }
  return alignBack(text, to, endExclusive);
}

/**
 * The passage containing a claim, trimmed to sentence boundaries where
 * possible, capped and ellipsized - or null when it could not be located.
 *
 * CONTRACT: a non-null return always satisfies phraseFound(result, claim).
 * Callers may store it without re-checking; they must NOT substitute anything
 * of their own when this returns null. Silence is the correct failure here.
 */
export function excerptFor(text: string, claim: string): string | null {
  if (!text || !claim || !claim.trim()) return null;

  const { folded, map } = foldWithMap(text);
  const needle = foldWithMap(claim).folded.trim();
  if (!needle) return null;

  const at = folded.indexOf(needle);
  if (at < 0) return null;

  const start = map[at] as number;
  const endExclusive = (map[Math.min(at + needle.length - 1, map.length - 1)] as number) + 1;

  // Centre the window on the match. Anchoring straight to a preceding sentence
  // boundary looks tidier and is wrong on its own: lastIndexOf(".") lands on
  // the decimal point in "$6.5 billion" and opens the quote mid-number.
  const matchLen = Math.max(1, endExclusive - start);
  const pad = Math.max(0, Math.floor((EXCERPT_CHARS - matchLen) / 2));
  const rawFrom = Math.max(0, start - pad);
  const rawTo = Math.min(text.length, rawFrom + EXCERPT_CHARS);

  const from = snapStart(text, rawFrom, start);
  const to = Math.max(endExclusive, snapEnd(text, endExclusive, rawTo));

  let slice = text.slice(from, to).replace(/\s+/g, " ").trim();
  if (from > 0) slice = `…${slice}`;
  if (to < text.length) slice = `${slice}…`;

  // THE CONTRACT, ENFORCED. Snapping cannot cross the match, but a future edit
  // to the window logic might, and a wrong passage must never ship.
  return phraseFound(slice, claim) ? slice : null;
}

/**
 * Collapse evidence entries that quote the same passage.
 *
 * Two claims drawn from one sentence produce two windows CENTRED A FEW
 * CHARACTERS APART, not two identical strings - so comparing for equality does
 * not merge them. Overlap is the test.
 */
export function dedupeEvidence(evidence: readonly Evidence[]): Evidence[] {
  const kept: Evidence[] = [];
  for (const e of evidence) {
    if (e.excerpt === null) {
      // An unlocated passage never renders, but the claim is still recorded.
      kept.push({ ...e, claims: [...e.claims] });
      continue;
    }
    // Strip the elision marks before comparing: "…S1…" is not a substring of
    // "…S0 S1 S2…" while they are still attached, which defeats the whole test.
    const bare = (s: string) => norm(s.replace(/^…/, "").replace(/…$/, ""));
    const mine = bare(e.excerpt);
    const overlap = kept.find((k) => {
      if (k.excerpt === null) return false;
      const theirs = bare(k.excerpt);
      return theirs.includes(mine) || mine.includes(theirs);
    });
    if (!overlap || overlap.excerpt === null) {
      kept.push({ ...e, claims: [...e.claims] });
      continue;
    }
    overlap.claims.push(...e.claims);
    // Keep whichever window shows more of the source.
    if (e.excerpt.length > overlap.excerpt.length) overlap.excerpt = e.excerpt;
  }
  return kept;
}
