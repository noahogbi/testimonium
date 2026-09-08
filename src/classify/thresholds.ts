/**
 * Every number that can change a verdict, in one place. See
 * docs/calibration-2026-09.md for the measured populations behind them.
 *
 * These are NOT tunable constants. They are the boundary between "we read a
 * document" and "we did not". Changing one without rerunning
 * scripts/calibrate.mjs against the corpus is a keystone violation.
 *
 * **They are not all licensed the same way, and the difference matters.**
 * `minProseChars` is calibrated: the acceptance test in
 * test/classify/acceptance.test.ts licenses it against the corpus, and
 * scripts/sweep-floor.mjs re-derives the range it may live in.
 * `maxChallengeChars`, `maxBinaryDensity` and `binarySampleCodePoints` are
 * NOT swept against anything - each one's own docstring says so, and says what
 * evidence there is instead. Do not read this file as though every entry
 * carried the floor's evidence base.
 */
export const THRESHOLDS = {
  /** Extracted prose characters below which we have not read a document.
   *  Measured 2026-09 against the 35-fixture corpus (25 challenge, 10
   *  document; excludes the known-gap row - re-run scripts/calibrate.mjs to
   *  reproduce): the largest challenge shell that no veto rejects is 1,180
   *  chars and the smallest real document is 6,394, so 4,500 sits in that gap
   *  with 3,320 of clear air below and 1,894 above - both well past the
   *  200-char margin the acceptance test demands. (Three challenge fixtures
   *  extract far more than 1,180 but never reach this floor: 2,154 and
   *  13,216 are both served 404, vetoed by N4; 6,221 is a content-negotiated
   *  PDF, vetoed by N5 as non-text.) */
  minProseChars: 4500,
  // minSlugOverlap is DELIBERATELY ABSENT. C1 was withdrawn from the verdict
  // after two calibration rounds proved it cannot separate the populations:
  // with the fetched title included every page scored 1.00 by construction,
  // and with it removed a real blog index scored a vacuous 0.00 identical to
  // an anti-scraping wall. Where measurable at all the ordering is inverted -
  // the highest challenge (0.80) outranks the lowest document (0.75). The
  // overlap is still COMPUTED and REPORTED; it just does not gate.
  /** Above this, a body is a document even when it quotes challenge wording -
   *  an article ABOUT bot walls matches every signature in the list. Lives
   *  here rather than as a loose const beside the signatures, so every number
   *  that can change a verdict is in one place under one doctrine. */
  maxChallengeChars: 800,
  /** N5's second trigger. The fraction of a body's sampled code points that
   *  may be U+FFFD or a C0 control byte before the body is not text at all.
   *
   *  **HONESTY NOTE - unlike `minProseChars`, this was never swept.** There is
   *  no corpus sweep behind it and `scripts/sweep-floor.mjs` does not vary it.
   *  It lives here because a number that can change a verdict belongs under
   *  one doctrine, not because it has been calibrated. What licenses it is a
   *  gap, not a boundary - the two populations it has been measured on sit
   *  nowhere near each other:
   *
   *  - 0.0000 across all 34 pre-Task-3 corpus fixture rows. Re-measured
   *    2026-09-07 against the current files: the maximum over all 34 is
   *    0.000000, not merely a small number.
   *  - 0.5315 on `fixtures/challenge/pdf-binary-served-at-200.bin`, the
   *    synthetic-but-structurally-faithful PDF this repo carries. Also
   *    re-measured 2026-09-07.
   *  - 0.5888 on the bytes of a real arxiv PDF, and 0.316 on constructed
   *    binary wrapped in tag-shaped spans. Both are the plan-1.1 reviewer's
   *    measurements: this repo holds no copy of either body, so neither was
   *    re-measured here. The reviewer reported 0.5887, computed against the
   *    65,536-UNIT window that shipped before this round. Its own raw counts
   *    are 38,579 binary of 65,517 sampled CODE POINTS, which is 0.5888 on
   *    the code-point denominator the scan uses now. The gap between those
   *    two figures IS the unit mismatch this round closed, visible on a real
   *    body: the old denominator flattered every density it measured.
   *
   *  So every measurement to date is either exactly zero or above 0.3, and
   *  0.01 is an arbitrary point in a 0.3-wide empty band. **What has NOT been
   *  done is the measurement that would matter: a sweep over legitimate pages
   *  with genuinely low but non-zero binary density.** Until that exists,
   *  nobody knows where the true boundary is or how much room this value has
   *  on the tolerant side. That sweep is deferred, not done.
   *
   *  It is also the number a disclosed evasion turns on (see the README's
   *  known gaps: an uncompressed PDF measures 0.00898 and passes). Tightening
   *  it would close that by guesswork against an unmeasured population, which
   *  is a calibration decision and not a fix. `test/classify/
   *  signals-nottext.test.ts` brackets it at 0.02 and 0.005 so it cannot move
   *  silently. */
  maxBinaryDensity: 0.01,
  /** How much of a raw body N5's binary scan looks at, in CODE POINTS - the
   *  same unit `maxBinaryDensity` is measured in, so the window and the ratio
   *  cannot disagree about what a character is.
   *
   *  **Also never swept**, and the same honesty note applies. It is a cost
   *  bound rather than a measurement: scanning an entire multi-megabyte body
   *  to answer a yes/no question is waste, and 65,536 is a round number that
   *  covers every fixture in the corpus whole. No page was ever measured to
   *  find a window that separates two populations, because the sweep that
   *  would produce such a measurement has not been done.
   *
   *  It buys the cost bound at a disclosed price: binary past the window is
   *  invisible, a gap recorded in `docs/calibration-2026-09.md` and the README
   *  and pinned by a characterization test. Widening or removing the window
   *  changes a shipped veto's behavior on real bodies and is calibration work,
   *  not a fix-round edit. */
  binarySampleCodePoints: 65_536,
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
 *  **THIS DOES NOT GATE THE VERDICT.** Ruling C7 withdrew it after two
 *  calibration rounds measured it and found it cannot separate the corpus.
 *  It is computed, exported and printed by scripts/calibrate.mjs because it is
 *  useful `--explain-fetch` material and the natural starting point if someone
 *  later finds a corpus where it does discriminate. Nothing may reintroduce it
 *  to the accusation path without a fresh calibration run showing separation.
 *
 *  **NOT the document's own <title>.** That was the shape of this function in
 *  draft 2 and calibration proved it worthless: the title arrives in the same
 *  response as the body, so every page contains its own title by construction.
 *  All 12 corpus fixtures carrying a title scored title-only overlap of exactly
 *  1.00 - challenge and document alike - which contributed no discrimination
 *  and disguised that by pinning every score to the ceiling. Only an authored
 *  input can testify that the page we read is the page that was cited.
 *
 *  Returns 0, NOT 1, when there is nothing to test. A vacuous pass would read
 *  as full correlation in `--explain-fetch` output and misreport an opaque
 *  URL as confirmed against authored content it was never checked against.
 *  THIS DOES NOT GATE THE VERDICT (see above), so today 0 sends the case
 *  nowhere - the number is reported, not consulted - but it is still the
 *  honest answer to the question the function asks, and staying honest here
 *  is what keeps the number usable if a future calibration round finds a
 *  corpus where it can be reintroduced. Removing the title made this vacuous
 *  case common enough to matter: blog.mozilla.org/en/ has path /en/, which
 *  yields no content words at all.
 *
 *  The footnote label is why this is rarely vacuous in practice: a PDF served
 *  from a hashed URL has no usable slug, but its author wrote "Jane Roe, The
 *  Committee Report, 2026" beside the link, and those words appear in the
 *  document.
 *
 *  This signal is WEAK and known to be. It cannot reject a page whose URL is
 *  generic site chrome (`/press/pr/date/2024/`), because those words appear in
 *  every page's navigation. N4 is what handles the generic-path error page. */
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
