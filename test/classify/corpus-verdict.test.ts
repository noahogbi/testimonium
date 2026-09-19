import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { computeSignals } from "../../src/classify/signals.js";
import { verdict } from "../../src/classify/verdict.js";
import { toText } from "../../src/text/extract.js";
import { proseVolume, THRESHOLDS } from "../../src/classify/thresholds.js";

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

// Written as a reader SEES it, not as the fixture SPELLS it: the fixture
// encodes the same sentence with HTML entities (&mdash;, &eacute;, &Eacute;,
// &hellip;), and this string must stay ASCII, so its non-ASCII characters are
// built from code points rather than typed literally.
const RENDERED_CLAIM =
  "The panel" +
  String.fromCodePoint(0x2014) + // em dash
  "chaired by Ren" +
  String.fromCodePoint(0xe9) + // e-acute
  " " +
  String.fromCodePoint(0xc9) + // E-acute
  "lodie" +
  String.fromCodePoint(0x2014) + // em dash
  "paused before the vote" +
  String.fromCodePoint(0x2026); // horizontal ellipsis

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

describe("body shapes the corpus previously never held", () => {
  it("rejects a PDF binary served at 200 with no .pdf in the url", () => {
    // The arxiv shape. Before N5 this measured over a million characters of
    // "prose", cleared every threshold, and accused an accurate citation.
    const f = corpus.find((x) => x.path.includes("pdf-binary-served-at-200"));
    expect(f, "fixture missing from corpus.json").toBeDefined();
    expect(run(f!, ["any claim at all"])).toBe("unreachable");
  });

  it("clears the prose floor on its own, so N5 - not the floor - is what rejects it", () => {
    // N5 fires either way in this file's headers:{} context, so without this
    // assertion the fixture above could be silently too small to matter and
    // every test would stay green regardless.
    const f = corpus.find((x) => x.path.includes("pdf-binary-served-at-200"));
    expect(f, "fixture missing from corpus.json").toBeDefined();
    expect(
      proseVolume(toText(readFileSync(f!.path, "utf8"))),
      "fixture must be rejected by N5, not by the prose floor",
    ).toBeGreaterThanOrEqual(THRESHOLDS.minProseChars);
  });

  it("reads an entity-heavy document and supports a claim in its RENDERED form", () => {
    // NOT `run(f, [])`: verdict() returns "unclaimed" on total === 0 before any
    // veto, so that would pass for any input including a challenge shell - the
    // test-that-asserts-nothing shape this file already warns about. The claim
    // below is written as a reader sees it; the fixture spells it with
    // entities. This is the only end-to-end pin of Task 1.
    const f = corpus.find((x) => x.path.includes("entity-heavy-article"));
    expect(f, "fixture missing from corpus.json").toBeDefined();
    expect(run(f!, [RENDERED_CLAIM])).toBe("supported");
  });
});

describe("known gap, pinned as a fixture", () => {
  // A CHARACTERIZATION TEST. It asserts the CURRENT, WRONG-ISH behaviour on
  // purpose, so the exposure the README discloses cannot quietly change
  // without someone reading this comment.
  //
  // The ECB capture is a real 404 page carrying 13,452 characters of intact
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
