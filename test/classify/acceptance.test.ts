import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toText } from "../../src/text/extract.js";
import { THRESHOLDS, proseVolume, slugTitleOverlap } from "../../src/classify/thresholds.js";

type Fixture = { path: string; kind: "challenge" | "document"; url: string; title: string };
const corpus: Fixture[] = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));
const read = (f: Fixture) => toText(readFileSync(f.path, "utf8"));

/** THE ACCUSATION GATE. This conjunction - not prose volume alone - is what
 *  the verdict reducer requires before it will return `unsupported`. The
 *  acceptance test is written against it because spec 6.3 phrases its
 *  requirement through the VERDICT, and the verdict's accusation branch is
 *  the conjunction. */
const passesAccusationGate = (f: Fixture): boolean => {
  const text = read(f);
  return (
    proseVolume(text) >= THRESHOLDS.minProseChars &&
    slugTitleOverlap(text, f.url, f.title) >= THRESHOLDS.minSlugTitleOverlap
  );
};

describe("acceptance test - spec section 6.3", () => {
  it("NO challenge or error shell can pass the accusation gate", () => {
    const failures = corpus.filter((f) => f.kind === "challenge").filter(passesAccusationGate).map((f) => f.path);
    expect(failures).toEqual([]);
  });

  it("EVERY real document passes the accusation gate", () => {
    // Required in this direction too: a document that cannot pass the gate can
    // never have a genuine miss reported against it, so the tool would
    // silently stop working rather than fail loudly.
    const failures = corpus.filter((f) => f.kind === "document").filter((f) => !passesAccusationGate(f)).map((f) => f.path);
    expect(failures).toEqual([]);
  });

  it("every challenge fixture fails the gate with margin on at least one dimension", () => {
    // A fixture that only just fails is one edit away from passing. Each must
    // be clear of the threshold on prose volume OR on overlap - it does not
    // matter which, but "barely" on both is not separation.
    const marginal = corpus
      .filter((f) => f.kind === "challenge")
      .filter((f) => {
        const text = read(f);
        const proseClear = proseVolume(text) <= THRESHOLDS.minProseChars - 200;
        const overlapClear = slugTitleOverlap(text, f.url, f.title) <= THRESHOLDS.minSlugTitleOverlap - 0.05;
        return !proseClear && !overlapClear;
      })
      .map((f) => f.path);
    expect(marginal).toEqual([]);
  });

  it("every real document clears both thresholds with margin", () => {
    const marginal = corpus
      .filter((f) => f.kind === "document")
      .filter((f) => {
        const text = read(f);
        return (
          proseVolume(text) < THRESHOLDS.minProseChars + 200 ||
          slugTitleOverlap(text, f.url, f.title) < THRESHOLDS.minSlugTitleOverlap + 0.05
        );
      })
      .map((f) => f.path);
    expect(marginal).toEqual([]);
  });
});
