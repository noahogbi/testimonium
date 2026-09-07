import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { computeSignals } from "../../src/classify/signals.js";
import { verdict } from "../../src/classify/verdict.js";
import { toText } from "../../src/text/extract.js";

type Fixture = { path: string; kind: "challenge" | "document"; url: string; title: string; status: number };
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
