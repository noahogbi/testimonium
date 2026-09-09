import { describe, expect, it } from "vitest";
import { commonSpans, dropContained } from "../../src/harvest/spans.js";
import { THRESHOLDS } from "../../src/classify/thresholds.js";
import { norm, phraseFound } from "../../src/text/normalize.js";

// Non-ASCII inputs are built with String.fromCodePoint so this file stays
// pure ASCII, as test/text/excerpt.test.ts does.
//
// Every exact value asserted below was measured on 2026-09-08 against the
// shipped foldWithMap, with the algorithm this plan's Task 5 specifies. If
// one of them is off by a word at either end, the word-boundary snap is
// asking only the SOURCE where it must ask both texts - see Step 4b.
const APOS = String.fromCodePoint(0x2019); // RIGHT SINGLE QUOTATION MARK
const DOTTED_I = String.fromCodePoint(0x130); // LATIN CAPITAL I WITH DOT ABOVE

const SHARED_DOC = "the committee's report said spending rose sharply in the fourth quarter";
const SHARED_SRC = `the committee${APOS}s report said spending rose sharply in the fourth quarter`;
const DOC = `Our draft: ${SHARED_DOC}, and more.`;
const SOURCE = `Nav Home About. ${SHARED_SRC}. Footer.`;

describe("commonSpans", () => {
  it("proposes a shared span in the SOURCE's typography, not the document's", () => {
    // Spec 7.3: a claim must be what the SOURCE says. The two texts agree in
    // fold space - foldWithMap folds the curly apostrophe to a straight one -
    // and the proposal is cut from the source through the offset map, so it
    // carries the source's own character.
    const r = commonSpans(DOC, SOURCE);
    expect(r.spans).toEqual([SHARED_SRC]);
    expect(r.spans[0]).toContain(APOS);
    expect(r.bugs).toEqual([]);
  });

  it("finds nothing when the longest shared run is shorter than the seed", () => {
    const shared = "rose sharply";
    const doc = `Our draft says spending ${shared} last year.`;
    const src = `Their page says revenue ${shared} elsewhere.`;
    expect(commonSpans(doc, src, 20).spans).toEqual([]);
  });

  it("snaps to word boundaries rather than emitting a fragment (Fable F7)", () => {
    // Extension stops where the texts diverge, which is mid-word far more
    // often than not - the review found "s the ability to" and
    // "communications w" among the emitted spans. Snapping is inward, so a
    // partial word at either end is dropped, never guessed at.
    const doc = "the quarterly report describes the committee proceedings clearly.";
    const src = "the quarterly report describes the committee proceedin. Nothing else.";
    const r = commonSpans(doc, src, 20);
    expect(r.spans).toEqual(["the quarterly report describes the committee"]);
    expect(r.bugs).toEqual([]);
  });

  it("snaps when it is the SOURCE that is mid-word, not the document", () => {
    // The mirror of the case above, and the reason the snap consults both
    // texts rather than the source alone. Here the source's next character
    // continues a word and the document's does not, so a source-only rule
    // would emit "proceedin" - a truncation, in the source's own typography,
    // proposed to the author as something the page says.
    const doc = "the quarterly report describes the committee proceedin. Nothing else.";
    const src = "the quarterly report describes the committee proceedings clearly.";
    const r = commonSpans(doc, src, 20);
    expect(r.spans).toEqual(["the quarterly report describes the committee"]);
    expect(r.bugs).toEqual([]);
  });

  it("collapses the whitespace runs the offset map would otherwise carry through", () => {
    // The map records the offset of the FIRST character of a whitespace run
    // (excerpt.ts), so an uncollapsed slice can carry a newline and an indent
    // into a claims file. Collapsing is norm-equivalent, so check() is
    // unaffected by it.
    const doc = "Draft: the committee reported that spending rose sharply last year.";
    const src = "Page. the committee reported\n   that spending rose sharply last year.";
    const r = commonSpans(doc, src, 20);
    expect(r.spans.length).toBe(1);
    expect(r.spans[0]).toContain("committee reported that spending rose sharply");
    expect(r.spans[0]).not.toMatch(/\s\s/);
    expect(r.spans[0]).not.toContain("\n");
  });

  it("emits a span once however often the source repeats it", () => {
    const src = `Header. ${SHARED_SRC}. Middle filler text. ${SHARED_SRC}. Footer.`;
    const r = commonSpans(DOC, src);
    expect(r.spans).toEqual([SHARED_SRC]);
  });

  it("a lengthening fold before the span does not shift the map (plan 1.2's repair)", () => {
    // U+0130 lowercases to TWO code units. Before plan 1.2 foldWithMap pushed
    // one map entry per INPUT unit, so every offset after such a character
    // was one late and the emitted slice was one character over - a slice the
    // source still CONTAINS, so phraseFound could not catch it. Assertion 3
    // is what catches it, and this fixture is where it would fire.
    //
    // THE FIXTURE IS CHOSEN SO THAT ASSERTION 3 IS THE ONLY ONE THAT CAN.
    // Both tails read "And more besides.", so the one-character-late slice
    // ("he committee...besides.") is still a substring of the DOCUMENT as
    // well as of the source - assertions 1 and 2 therefore both pass on it.
    // Verified 2026-09-09 by reverting foldWithMap's repair: the sole bug
    // line is `offset map round trip failed`, and with the repair restored
    // this same fixture emits the span below with no bugs. A fixture whose
    // document does NOT carry the shifted window is caught one assertion
    // earlier, by assertion 2 (`documentMismatchNote` since fix round 1), and
    // pins nothing about assertion 3.
    //
    // TO REPRODUCE THE FAILURE THIS TEST GUARDS, in about a minute: in
    // `src/text/excerpt.ts`, replace foldWithMap's
    //   `for (let k = 0; k < out.length; k++) map.push(i);`
    // with the pre-plan-1.2 `map.push(i);` and re-run this test. It fails with
    // `bugs` holding exactly one line, `offset map round trip failed: "he
    // committee...besides."` - assertion 3, alone. Restore the line afterwards
    // and check `git diff --stat src/text/excerpt.ts` is empty. Under the
    // SHIPPED map assertion 3 can never fire, so no test can pin its existence
    // without that mutation; this note is where the proof lives.
    const doc = `Our draft: ${SHARED_DOC}. And more besides. Different tail.`;
    const src = `${DOTTED_I}stanbul bureau. ${SHARED_SRC}. And more besides. Footer text here.`;
    const r = commonSpans(doc, src);
    expect(r.bugs).toEqual([]);
    expect(r.spans).toEqual([`${SHARED_SRC}. And more besides.`]);
  });

  it("defaults the seed to THRESHOLDS.harvestSeedChars, and a smaller seed never finds fewer", () => {
    // Fable's answer to Q3: extension is independent of seed length, so a
    // smaller seed finds the same maximal spans plus shorter ones - it buys
    // nothing and costs noise. The inequality is the property; the default is
    // the wiring.
    expect(commonSpans(DOC, SOURCE).spans).toEqual(commonSpans(DOC, SOURCE, THRESHOLDS.harvestSeedChars).spans);
    expect(commonSpans(DOC, SOURCE, THRESHOLDS.harvestSeedChars).spans.length).toBeLessThanOrEqual(
      commonSpans(DOC, SOURCE, THRESHOLDS.minClaimChars).spans.length,
    );
  });

  it("pins the default seed FROM BELOW: a run shorter than it is not proposed", () => {
    // The test above pins the default only from above - its shared run is 71
    // characters, so ANY default in 1..72 passes it and it would not notice
    // harvestSeedChars being set to 1. This one fails if the default drops to
    // the length of SHORT_RUN or below.
    //
    // The fixture is BUILT FROM the constant rather than restating it, so it
    // cannot go stale when the constant moves: whole three-letter words, as
    // many as fit strictly under the seed. The second assertion re-runs the
    // SAME fixture at a seed equal to the run's own length, which is how we
    // know the empty result above is the seed's doing and not an unshared
    // fixture - without it this test would pass just as happily on two texts
    // with nothing in common.
    // The seed is compared against the SHARED REGION, which is the run plus
    // the space on either side of it - both texts put a space there, so those
    // two characters match too and the seed can land across them. A run of
    // exactly seed - 2 characters is therefore still found; the run itself has
    // to be shorter than that. Getting this wrong is what the first draft of
    // this test did: a 19-character run inside a 21-character shared region
    // was proposed at the default seed of 21 and the test failed.
    const seed = THRESHOLDS.harvestSeedChars;
    const words = Math.floor((seed - 2) / 4);
    const SHORT_RUN = Array.from({ length: words }, () => "abc").join(" ");
    expect(SHORT_RUN.length + 2).toBeLessThan(seed);

    // Neighbours chosen so no character adjacent to the run agrees across the
    // two texts ("one"/"two", "omega"/"gamma"), so extension cannot reach past
    // it and lengthen the run behind the assertion's back.
    const doc = `Draft one ${SHORT_RUN} omega finish.`;
    const src = `Source two ${SHORT_RUN} gamma conclude.`;

    expect(commonSpans(doc, src).spans).toEqual([]);
    expect(commonSpans(doc, src, SHORT_RUN.length).spans).toEqual([SHORT_RUN]);
  });

  it("never proposes half of an astral character (lone surrogate)", () => {
    // Two texts can diverge BETWEEN the halves of a surrogate pair: U+1F4C8
    // and U+1F4C9 share a lead unit, so extension matches the high half and
    // stops on the low one. `wordAt` reads a lone surrogate as a non-word
    // unit, so the word snap sees a clean boundary and leaves it in place.
    // A bare high surrogate is not a character - it becomes U+FFFD on any
    // UTF-8 round trip - so a claim confirmed from such a proposal could never
    // match the page again: a false MISS the author cannot diagnose by
    // looking at it. Before the surrogate trim this emitted
    // "...rose sharply \ud83d" with bugs: [].
    const UP = String.fromCodePoint(0x1f4c8);
    const DOWN = String.fromCodePoint(0x1f4c9);
    const shared = "the committee report said spending rose sharply ";
    const doc = `Our draft: ${shared}${UP} and the tail differs here.`;
    const src = `Their page. ${shared}${DOWN} and another tail entirely.`;

    const r = commonSpans(doc, src);
    expect(r.bugs).toEqual([]);
    expect(r.spans).toEqual(["the committee report said spending rose sharply"]);

    // The property, stated directly rather than only via the expected string:
    // no emitted span may begin or end on half a pair.
    for (const span of r.spans) {
      const first = span.charCodeAt(0);
      const last = span.charCodeAt(span.length - 1);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
      expect(first >= 0xdc00 && first <= 0xdfff).toBe(false);
      // The strongest form: a UTF-16 string with no dangling half survives a
      // round trip through UTF-8 unchanged.
      expect(Buffer.from(span, "utf8").toString("utf8")).toBe(span);
    }
  });

  it("the hoisted norm() is phraseFound, memoized - not a second definition of it", () => {
    // spec 8.2 step 3: "norm(text) is computed once per read and reused by
    // every filter; it is not recomputed per span." commonSpans therefore
    // hoists norm(sourceText) and norm(docProse) above its loop and tests
    // `normSource.includes(norm(span))` instead of calling phraseFound per
    // candidate. That INLINES phraseFound's body, which is how the fold table
    // drifted from norm() three times, so the equivalence is pinned here.
    //
    // If phraseFound or norm ever grows a clause the inlined form does not
    // have, this test goes red instead of commonSpans silently disagreeing
    // with what check() will later do to the same span.
    const SHY = String.fromCodePoint(0x00ad); // SOFT HYPHEN - norm deletes it
    const NBSP = String.fromCodePoint(0x00a0);
    const ENDASH = String.fromCodePoint(0x2013);
    const LDQUO = String.fromCodePoint(0x201c);
    const RDQUO = String.fromCodePoint(0x201d);

    const cases: ReadonlyArray<readonly [string, string]> = [
      ["The Committee REPORTED it", "the committee reported"], // case folding
      [`the com${SHY}mittee reported`, "the committee reported"], // soft hyphen
      [`the committee${APOS}s report`, "the committee's report"], // curly apostrophe
      [`spending rose${NBSP}sharply`, "spending rose sharply"], // NBSP
      [`the GPT${ENDASH}4 model`, "the GPT-4 model"], // Unicode dash
      [`he said ${LDQUO}yes${RDQUO} loudly`, 'he said "yes" loudly'], // curly quotes
      ["6,000 people attended", "6000 people attended"], // comma deletion
      ["worth 6.5 billion dollars", "worth 6.5bn dollars"], // billion -> bn
      ["404 file not found . next", "404 file not found."], // space before punctuation
      ["the committee reported", "a phrase that is absent"], // the negative case
    ];

    for (const [haystack, phrase] of cases) {
      const hoisted = norm(haystack).includes(norm(phrase));
      expect(hoisted).toBe(phraseFound(haystack, phrase));
    }
    // The negative control: the list above must contain a case that is FALSE,
    // or every assertion could pass on a phraseFound that returned true always.
    expect(cases.some(([h, p]) => !phraseFound(h, p))).toBe(true);

    // And the end-to-end form: every span commonSpans actually emits satisfies
    // phraseFound against both texts, which is the property the hoist must not
    // have changed.
    for (const [doc, src] of [
      [DOC, SOURCE],
      [`Draft: ${SHARED_DOC}. Tail.`, `Page ${LDQUO}x${RDQUO}. ${SHARED_SRC}. Foot.`],
      [`the com${SHY}mittee reported that spending rose sharply last year`,
       "Page. the committee reported that spending rose sharply last year. End."],
    ] as ReadonlyArray<readonly [string, string]>) {
      const r = commonSpans(doc, src);
      expect(r.bugs).toEqual([]);
      for (const span of r.spans) {
        expect(phraseFound(src, span)).toBe(true);
        expect(phraseFound(doc, span)).toBe(true);
      }
    }
  });
});

describe("dropContained", () => {
  // Exercised DIRECTLY, not only through commonSpans. The containment rule is
  // extracted so that Task 8 can apply the same function to the union across a
  // URL's several readable reads - and the replacement branch below is
  // unreachable from commonSpans' own candidates, whose scan emits disjoint
  // regions. Tested only through commonSpans, that branch is dead code the
  // suite cannot see: neutering it leaves the rest of this file green. These
  // pin current behaviour rather than change it.

  it("drops a span contained in a LATER one, keeping the longer", () => {
    expect(dropContained(["b c", "a b c d"])).toEqual(["a b c d"]);
  });

  it("replaces in place, so the result keeps source order", () => {
    expect(dropContained(["x y z", "b c", "a b c d"])).toEqual(["x y z", "a b c d"]);
  });

  it("drops a span contained in an EARLIER one", () => {
    expect(dropContained(["a b c d", "b c"])).toEqual(["a b c d"]);
  });

  it("compares in norm() space, so typography does not hide containment", () => {
    // The two differ only in the apostrophe, so they are the same span to
    // check() and only one may be proposed. Comparing raw would keep both and
    // hand the author a duplicate.
    const straight = "the committee's report said spending rose";
    const curly = `the committee${APOS}s report said spending rose`;
    expect(dropContained([straight, curly])).toEqual([straight]);
    expect(dropContained([curly, straight])).toEqual([curly]);
  });

  it("drops a span that normalizes to nothing", () => {
    expect(dropContained(["", "   ", "a real span here"])).toEqual(["a real span here"]);
  });
});
