import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * The sentence every harvest draft carries, verbatim.
 *
 * It is the file's reason for existing. Harvest proposes what the author
 * COPIED from a source; that is not always what she CLAIMS the source shows,
 * and a span lifted from a page is evidence that a sentence was lifted, not
 * evidence that the sentence is the point of the citation (spec 8.2, "What it
 * is not"). Her confirmation is the step that turns a proposal into a claim,
 * and this sentence is what asks for it.
 */
export const DRAFT_SENTENCE =
  "every claim below is unconfirmed; harvest proposes what was copied, not what was meant";

/** The `_note` marker harvest writes: version, date, sentence. */
export function draftNote(version: string, date: string): string {
  return `testimonium ${version} harvest draft, ${date}. ${DRAFT_SENTENCE}`;
}

/**
 * Is this `_note` one harvest wrote and nobody has edited?
 *
 * Spec 8.2 says "byte-identical to the marker harvest would write". Read
 * strictly that would mean the marker for TODAY, so a draft written yesterday
 * could never be overwritten and the command would be unusable on its second
 * day. The rule exists to detect the author's edits, and every byte outside
 * the version and the date is what carries that signal, so those two fields
 * are the only ones allowed to differ. Recorded as a deliberate reading in
 * docs/superpowers/plans/2026-09-08-plan-2-harvest.md.
 */
export function isHarvestNote(note: unknown): boolean {
  if (typeof note !== "string") return false;
  const m = /^testimonium (\S+) harvest draft, (\d{4}-\d{2}-\d{2})\. ([\s\S]*)$/.exec(note);
  return m !== null && m[3] === DRAFT_SENTENCE;
}

export interface DraftInput {
  /** One entry per normalized URL, keyed by the FIRST citation spelling -
   *  two keys that normalize alike would be a collision `parseClaimsFile`
   *  refuses, on the very file the author is about to rename (Fable F8). An
   *  entry with no surviving claims is OMITTED rather than written as `[]`;
   *  see `buildDraft`. */
  readonly entries: readonly { url: string; claims: readonly string[] }[];
  readonly version: string;
  readonly date: string;
}

/**
 * The draft, in the claims-file shape, with `_note` first.
 *
 * An entry with no surviving claims is OMITTED. `harvest()` reports one
 * proposal per readable URL whether or not anything survived the filters -
 * a readable source that shares nothing with the draft, or whose every span
 * was filtered, is the ordinary case - and `parseClaimsFile` refuses `[]`
 * with "claims must be a non-empty array of strings". Writing one would hand
 * the author a file the tool's own loader rejects the moment she renames it,
 * naming a key she never wrote; spec 7.3's shape is a list of phrases or
 * `notApplicable`, and the loader is what makes the list non-empty. Nothing
 * is lost: the per-URL report line has already told her that URL proposed 0.
 */
export function buildDraft(input: DraftInput): Record<string, unknown> {
  const draft: Record<string, unknown> = { _note: draftNote(input.version, input.date) };
  for (const entry of input.entries) {
    if (entry.claims.length === 0) continue;
    draft[entry.url] = [...entry.claims];
  }
  return draft;
}

/**
 * Why harvest must not write over the file at `path`, or null when it may.
 *
 * Neither always-overwrite nor always-refuse (Fable Q6): overwrite only what
 * harvest itself wrote and nobody has touched. A file that is not JSON, or
 * whose `_note` is missing or edited, is the author's - the message names the
 * path and asks for a rename or a delete, and the caller exits 2.
 */
export function draftInTheWay(path: string): string | null {
  if (!existsSync(path)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return `${path} exists and is not a harvest draft (it is not JSON); rename or delete it and run again`;
  }
  const note = parsed && typeof parsed === "object" ? (parsed as { _note?: unknown })._note : undefined;
  if (isHarvestNote(note)) return null;
  return `${path} exists and its "_note" is missing or edited, so it is yours and not harvest's; rename or delete it and run again`;
}

/** The ONLY writer in the whole harvest feature, and the only path it is ever
 *  handed is `draftPathFor`'s. `harvest()` returns a report and writes
 *  nothing; nothing here can address `<doc>.claims.json`. */
export function writeDraftFile(path: string, draft: Record<string, unknown>): void {
  writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
}
