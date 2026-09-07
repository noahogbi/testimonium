/**
 * Calibrated against fixtures/corpus.json. See docs/calibration-2026-09.md for
 * the measured populations these came from.
 *
 * These are NOT tunable constants. They are the boundary between "we read a
 * document" and "we did not", and the acceptance test in
 * test/classify/acceptance.test.ts is what licenses them. Changing one without
 * rerunning scripts/calibrate.mjs against the corpus is a keystone violation.
 *
 * !! THESE VALUES ARE NOT YET LICENSED. The Task 4 gate is RED. !!
 *
 * The acceptance test does not pass at these values, and an exhaustive search
 * of 24,915 threshold pairs found that it passes at NO values: the ECB 404
 * fixture extracts 13,221 chars of navigation chrome at overlap 1.00, clearing
 * both dimensions by more than every real document must also clear them. The
 * conjunction cannot separate the populations. Assertions 1 and 3 fail on that
 * one fixture and on nothing else.
 *
 * The pair below is the best available, not a solution: it is the mid-gap
 * choice for the other 32 fixtures, picked so the residual failure is isolated
 * to the single fixture that is genuinely unseparable. Do not read it as
 * calibrated until the signal design is fixed. See the doc for the diagnosis.
 */
export const THRESHOLDS = {
  /** Extracted prose characters below which we have not read a document.
   *  Measured 2026-09: challenge shells 43-2,154 (plus the 13,221-char ECB
   *  outlier), real documents 6,858-108,257. 4,500 is the midpoint of the
   *  2,154-6,858 gap, ~2,350 clear on each side. */
  minProseChars: 4500,
  /** Fraction of the URL slug and title's content words that must appear in
   *  the body. A challenge served for /eli/reg/2024/1689 does not contain
   *  "artificial intelligence"; the regulation does.
   *
   *  Measured 2026-09: this does NOT separate the populations either. 21 of 24
   *  challenge fixtures score 0.00 only because they carry no url/title in the
   *  corpus at all; of the three that do, one scores 0.80 - above the lowest
   *  real document at 0.75 - and the ECB 404 scores 1.00. */
  minSlugTitleOverlap: 0.3,
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

/** C1's input. Content words drawn from the URL path, the document's own title,
 *  and the author's footnote label, measured against the BODY - not against the
 *  head. A paywall stub keeps the whole head, which is why head markers cannot
 *  license an accusation.
 *
 *  Returns 0, NOT 1, when there is nothing to test. A vacuous pass would let
 *  prose volume alone license an accusation for any opaque URL - a 2,500-char
 *  unlisted wall at /p?id=93714 would come back `unsupported`. Returning 0
 *  sends that case to `unreachable`, the safe direction.
 *
 *  The footnote label is why this is rarely vacuous in practice: a PDF served
 *  from a hashed URL has no slug and no <title>, but its author wrote
 *  "Jane Roe, The Committee Report, 2026" beside the link, and those words
 *  appear in the document. The label is authored rather than fetched, but so is
 *  a URL - neither is circular, because the test is whether the SOURCE contains
 *  them. */
export function slugTitleOverlap(
  extractedText: string,
  url: string,
  title: string,
  label = "",
): number {
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {
    path = url;
  }
  const words = contentWords(`${path} ${title} ${label}`);
  if (words.length === 0) return 0;
  const body = extractedText.toLowerCase();
  return words.filter((w) => body.includes(w)).length / words.length;
}
