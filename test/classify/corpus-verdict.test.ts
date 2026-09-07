import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { computeSignals } from "../../src/classify/signals.js";
import { verdict } from "../../src/classify/verdict.js";
import { toText } from "../../src/text/extract.js";

type Fixture = { path: string; kind: "challenge" | "document" | "known-gap"; url: string; title: string; status: number };
const corpus: Fixture[] = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));

const run = (f: Fixture, claims: string[]) =>
  verdict(
    computeSignals({
      rawBody: readFileSync(f.path, "utf8"),
      headers: {},
      finalUrl: f.url || "https://example.com/",
      status: f.status,
      claims,
      sourceLabel: f.title,
    }).signals,
  );

describe("spec 6.3 acceptance, through the verdict reducer", () => {
  it("returns unreachable for EVERY non-document, whatever the claims", () => {
    const wrong = corpus
      .filter((f) => f.kind === "challenge")
      .filter((f) => run(f, ["a claim that is certainly not present"]) !== "unreachable")
      .map((f) => f.path);
    expect(wrong).toEqual([]);
  });

  it("returns supported for a claim taken verbatim from the document itself", () => {
    // A SELF-GENERATING positive test. Asserting that documents come back
    // "unclaimed" when given no claims would be trivially true of every input,
    // challenge shells included - a test that asserts nothing. Instead, lift a
    // phrase out of each fixture's own extracted text and require the pipeline
    // to find it.
    const wrong = corpus
      .filter((f) => f.kind === "document")
      .map((f) => {
        const text = toText(readFileSync(f.path, "utf8"));
        // Word-aligned at both edges, from the middle, so the synthetic claim
        // is a real phrase rather than a fragment.
        const mid = Math.floor(text.length / 2);
        const claim = text.slice(mid, mid + 60).replace(/^\S*\s/, "").replace(/\s\S*$/, "");
        return { path: f.path, claim, got: claim.length < 15 ? "skip" : run(f, [claim]) };
      })
      .filter((r) => r.got !== "supported" && r.got !== "skip");
    expect(wrong).toEqual([]);
  });
});

describe("known gap, pinned as a fixture", () => {
  // A CHARACTERIZATION TEST. It asserts the CURRENT, WRONG-ISH behaviour on
  // purpose, so the exposure the README discloses cannot quietly change
  // without someone reading this comment.
  //
  // The ECB capture is a real 404 page carrying 13,221 characters of intact
  // navigation chrome. N4 (the status veto) is the ONLY thing that rejects it:
  // it matches no bundled challenge signature, so served at 200 it clears the
  // 4,500 prose floor and reaches an accusation against an author whose
  // citation may be perfectly accurate. The same hole is reachable a second
  // way - a wall that DOES carry bundled signatures stops being vetoed above
  // THRESHOLDS.maxChallengeChars (800 extracted characters), so padding past
  // the floor gets there too.
  //
  // No threshold is changed to "fix" this: whether the tool should accuse on a
  // body it cannot tell from chrome is a design question, and moving a
  // calibrated number is not a bug fix.
  const gap = corpus.filter((f) => f.kind === "known-gap");

  it("has the ECB capture filed at status 200", () => {
    expect(gap.map((f) => f.status)).toEqual([200]);
    expect(gap[0]?.path).toContain("ecb-europa-eu");
  });

  it("reaches `unsupported` on a claim it does not carry - the exposure itself", () => {
    for (const f of gap) {
      expect(run(f, ["a phrase this page certainly does not carry"]), f.path).toBe("unsupported");
    }
  });

  it("is rejected by N4 alone: the identical body at its real 404 is unreachable", () => {
    for (const f of gap) {
      expect(run({ ...f, status: 404 }, ["a phrase this page certainly does not carry"]), f.path).toBe("unreachable");
    }
  });
});
