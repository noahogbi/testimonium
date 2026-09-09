import { describe, expect, it } from "vitest";
import { commonSpans } from "../../src/harvest/spans.js";
import { THRESHOLDS } from "../../src/classify/thresholds.js";

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
    // earlier, by `not found in the document`, and pins nothing about
    // assertion 3.
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
});
