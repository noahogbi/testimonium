import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toText } from "../../src/text/extract.js";
import { THRESHOLDS, proseVolume, slugLabelOverlap } from "../../src/classify/thresholds.js";

type Fixture = { path: string; kind: "challenge" | "document"; url: string; title: string; status: number };
const corpus: Fixture[] = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));
const read = (f: Fixture) => toText(readFileSync(f.path, "utf8"));

/** N4: the document is gone. Checked BEFORE the body-derived gate, exactly as
 *  the verdict reducer checks it, because a page the origin says does not
 *  exist needs no body analysis. */
const documentGone = (f: Fixture): boolean => f.status === 404 || f.status === 410;

/** THE ACCUSATION GATE. This conjunction - not prose volume alone - is what
 *  the verdict reducer requires before it will return `unsupported`. The
 *  acceptance test is written against it because spec 6.3 phrases its
 *  requirement through the VERDICT, and the verdict's accusation branch is
 *  the conjunction. */
const passesAccusationGate = (f: Fixture): boolean => proseVolume(read(f)) >= THRESHOLDS.minProseChars;

/** The full rejection path: vetoed, or unable to clear the gate. */
const rejected = (f: Fixture): boolean => documentGone(f) || !passesAccusationGate(f);

describe("acceptance test - spec section 6.3", () => {
  it("NO challenge or error shell can reach an accusation", () => {
    const failures = corpus.filter((f) => f.kind === "challenge").filter((f) => !rejected(f)).map((f) => f.path);
    expect(failures).toEqual([]);
  });

  it("EVERY real document can reach an accusation", () => {
    // Required in this direction too: a document that cannot pass the gate can
    // never have a genuine miss reported against it, so the tool would
    // silently stop working rather than fail loudly.
    const failures = corpus.filter((f) => f.kind === "document").filter(rejected).map((f) => f.path);
    expect(failures).toEqual([]);
  });

  it("every challenge fixture NOT vetoed by status fails the gate with margin on at least one dimension", () => {
    // A fixture that only just fails is one edit away from passing. Each must
    // be clear of the threshold on prose volume OR on overlap - it does not
    // matter which, but "barely" on both is not separation. Status-vetoed
    // fixtures are exempt: N4 rejects them outright, so no margin is needed.
    const marginal = corpus
      .filter((f) => f.kind === "challenge" && !documentGone(f))
      .filter((f) => proseVolume(read(f)) > THRESHOLDS.minProseChars - 200)
      .map((f) => f.path);
    expect(marginal).toEqual([]);
  });

  it("every real document clears both thresholds with margin", () => {
    const marginal = corpus
      .filter((f) => f.kind === "document")
      .filter((f) => proseVolume(read(f)) < THRESHOLDS.minProseChars + 200)
      .map((f) => f.path);
    expect(marginal).toEqual([]);
  });
});
