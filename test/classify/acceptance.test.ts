import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toText } from "../../src/text/extract.js";
import { THRESHOLDS, proseVolume, slugLabelOverlap } from "../../src/classify/thresholds.js";
import { computeSignals } from "../../src/classify/signals.js";

// `known-gap` rows are a third kind and belong to NEITHER population: they
// file a real capture a second time under the status that exposes a documented
// hole. Every filter below keys on "challenge"/"document", so they are read by
// test/classify/corpus-verdict.test.ts and by nothing here.
type Fixture = { path: string; kind: "challenge" | "document" | "known-gap"; url: string; title: string; status: number };
const corpus: Fixture[] = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));
const read = (f: Fixture) => toText(readFileSync(f.path, "utf8"));

/** N4: the document is gone. Checked BEFORE the body-derived gate, exactly as
 *  the verdict reducer checks it, because a page the origin says does not
 *  exist needs no body analysis. */
const documentGone = (f: Fixture): boolean => f.status === 404 || f.status === 410;

/** THE ACCUSATION GATE. The verdict reducer checks whether prose volume meets
 *  the minimum threshold before it will return `unsupported`. The acceptance
 *  test is written against this gate because spec 6.3 phrases its requirement
 *  through the VERDICT, and the verdict's accusation branch enforces this
 *  prose-volume floor. */
const passesAccusationGate = (f: Fixture): boolean => proseVolume(read(f)) >= THRESHOLDS.minProseChars;

/** N5: the body is not text at all (a binary stream, e.g. a content-negotiated
 *  PDF served with no `.pdf` in the URL). Derived through the real classifier
 *  rather than restated here, because `looksBinary` is module-private and
 *  corpus.json carries no headers - `headers: {}` is the honest input for a
 *  corpus that records none. */
const notText = (f: Fixture): boolean =>
  computeSignals({ rawBody: read(f), headers: {}, finalUrl: f.url, status: f.status, claims: [] })
    .signals.notText;

/** The full rejection path: vetoed, or unable to clear the gate. */
const rejected = (f: Fixture): boolean => documentGone(f) || notText(f) || !passesAccusationGate(f);

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

  it("every challenge fixture NOT vetoed by status fails the gate with margin on prose volume", () => {
    // A fixture that only just fails is one edit away from passing. Each must
    // be clear of the prose threshold by margin - not borderline. Status- and
    // N5-vetoed fixtures are exempt: N4 and N5 reject them outright, so no
    // prose margin is needed.
    const marginal = corpus
      .filter((f) => f.kind === "challenge" && !documentGone(f) && !notText(f))
      .filter((f) => proseVolume(read(f)) > THRESHOLDS.minProseChars - 200)
      .map((f) => f.path);
    expect(marginal).toEqual([]);
  });

  it("every real document clears the prose floor with margin", () => {
    const marginal = corpus
      .filter((f) => f.kind === "document")
      .filter((f) => proseVolume(read(f)) < THRESHOLDS.minProseChars + 200)
      .map((f) => f.path);
    expect(marginal).toEqual([]);
  });
});
