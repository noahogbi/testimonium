/**
 * Calibrated against fixtures/corpus.json. See docs/calibration-2026-09.md for
 * the measured populations these came from.
 *
 * These are NOT tunable constants. They are the boundary between "we read a
 * document" and "we did not", and the acceptance test in
 * test/classify/acceptance.test.ts is what licenses them. Changing one without
 * rerunning scripts/calibrate.mjs against the corpus is a keystone violation.
 *
 * !! minSlugOverlap IS NOT LICENSED. The Task 4 gate is still RED. !!
 *
 * Round 2, after ruling C6 dropped the fetched title from C1 and added N4.
 * N4 fixed the ECB fixture: it is served 404 (measured twice) and is now
 * vetoed before the body is consulted. But removing the title exposed the
 * other end of the same problem. `blog.mozilla.org/en/` is a real document
 * whose URL path contributes NO content words at all ("en" is two letters),
 * so slugLabelOverlap returns its documented vacuous 0.00 - the identical
 * score to the Federal Register challenge fixture. A threshold cannot
 * separate two equal values. Assertions 2 and 4 therefore force
 * minSlugOverlap <= -0.05, which does not calibrate C1 but switches it off.
 *
 * The value below is 0.3, the meaningful-range placeholder, deliberately NOT
 * the negative number that would turn the suite green by nullifying the
 * dimension. See the doc for the proof and the two candidate resolutions.
 */
export const THRESHOLDS = {
  /** Extracted prose characters below which we have not read a document.
   *  Measured 2026-09: challenge shells 43-2,154 (the 13,221-char ECB outlier
   *  is now handled by N4, not by this floor); real documents 6,858-108,257.
   *  4,500 sits mid-gap between the largest non-vetoed challenge (1,180) and
   *  the smallest document (6,858), ~3,300 clear on each side. THIS ONE IS
   *  LICENSED: every prose assertion passes at it. */
  minProseChars: 4500,
  /** Fraction of the URL slug and label's content words that must appear in
   *  the body. A challenge served for /eli/reg/2024/1689 does not contain
   *  "artificial intelligence"; the regulation does.
   *
   *  NOT LICENSED - see the header. Measured 2026-09 with the title removed:
   *  documents score 0.00-1.00 and the lone non-vetoed challenge with a real
   *  URL scores 0.00. The populations touch at the bottom, so C1 separates
   *  nothing in this corpus. */
  minSlugOverlap: 0.3,
  /** Above this, a body is a document even when it quotes challenge wording -
   *  an article ABOUT bot walls matches every signature in the list. Lives
   *  here rather than as a loose const beside the signatures, so every number
   *  that can change a verdict is in one place under one doctrine. */
  maxChallengeChars: 800,
} as const;

/** P2's input. Extracted prose length - NOT a text-to-markup ratio, which
 *  measurement showed discriminates in the wrong direction: modern real pages
 *  are script-dominant (0.009-0.061) while prose-shaped walls score above
 *  them. See spec section 6.5. */
export function proseVolume(extractedText: string): number {
  return extractedText.length;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "at", "by",
  "with", "from", "is", "are", "was", "were", "be", "as", "it", "that", "this",
  "html", "http", "https", "www", "com", "org", "net", "index", "page",
]);

function contentWords(s: string): string[] {
  return [
    ...new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w)),
    ),
  ];
}

/** C1's input. Content words drawn from AUTHORED sources only - the URL path
 *  the citation names, and the label the author wrote beside it - measured
 *  against the BODY.
 *
 *  **NOT the document's own <title>.** That was the shape of this function in
 *  draft 2 and calibration proved it worthless: the title arrives in the same
 *  response as the body, so every page contains its own title by construction.
 *  All 12 corpus fixtures carrying a title scored title-only overlap of exactly
 *  1.00 - challenge and document alike - which contributed no discrimination
 *  and disguised that by pinning every score to the ceiling. Only an authored
 *  input can testify that the page we read is the page that was cited.
 *
 *  Returns 0, NOT 1, when there is nothing to test. A vacuous pass would let
 *  prose volume alone license an accusation for any opaque URL. Returning 0
 *  sends that case to `unreachable`, the safe direction.
 *
 *  The footnote label is why this is rarely vacuous in practice: a PDF served
 *  from a hashed URL has no usable slug, but its author wrote "Jane Roe, The
 *  Committee Report, 2026" beside the link, and those words appear in the
 *  document.
 *
 *  This signal is WEAK and known to be. It cannot reject a page whose URL is
 *  generic site chrome (`/press/pr/date/2024/`), because those words appear in
 *  every page's navigation. Its job is narrow: deny an accusation when the
 *  cited URL is specific and its words are absent from the body. N4 is what
 *  handles the generic-path error page. */
export function slugLabelOverlap(extractedText: string, url: string, label = ""): number {
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {
    path = url;
  }
  const words = contentWords(`${path} ${label}`);
  if (words.length === 0) return 0;
  const body = extractedText.toLowerCase();
  return words.filter((w) => body.includes(w)).length / words.length;
}
