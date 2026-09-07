import { describe, expect, it } from "vitest";
import { verdict, type Signals } from "../../src/classify/verdict.js";

const base: Signals = {
  matched: 0,
  total: 3,
  proseChars: 20_000,
  slugLabelOverlap: 0.9,
  headMarkers: false,
  challengeHeader: false,
  challengePath: false,
  challengeSignature: false,
  documentGone: false,
};

describe("verdict", () => {
  it("returns unclaimed when there are no claims, never supported", () => {
    expect(verdict({ ...base, total: 0, matched: 0 })).toBe("unclaimed");
  });

  it("returns supported when every claim matched", () => {
    expect(verdict({ ...base, matched: 3 })).toBe("supported");
  });

  it("returns unsupported on a partial match of a read document", () => {
    expect(verdict({ ...base, matched: 1 })).toBe("unsupported");
  });

  it("returns unsupported on zero matches when the read is proven", () => {
    expect(verdict({ ...base, matched: 0 })).toBe("unsupported");
  });

  // THE KEYSTONE. Each of these would be a false accusation.
  it("a vendor challenge header vetoes, even over a full match", () => {
    expect(verdict({ ...base, matched: 3, challengeHeader: true })).toBe("unreachable");
  });

  it("a challenge redirect path vetoes", () => {
    expect(verdict({ ...base, matched: 2, challengePath: true })).toBe("unreachable");
  });

  it("a challenge signature vetoes", () => {
    expect(verdict({ ...base, matched: 1, challengeSignature: true })).toBe("unreachable");
  });

  it("a 404 or 410 vetoes, even over a full match - the document is gone", () => {
    // N4. A real ECB 404 served 13,221 characters of nav chrome and cleared
    // every body-derived test; body shape cannot see what the status line says.
    expect(verdict({ ...base, matched: 3, documentGone: true })).toBe("unreachable");
  });

  it("a partial match inside a low-prose body is unreachable, not unsupported", () => {
    // The wall mints the accusation: one boilerplate phrase matches while the
    // real claims miss. Draft 1 of the spec returned unsupported here.
    expect(verdict({ ...base, matched: 1, proseChars: 900 })).toBe("unreachable");
  });

  it("a paywall stub with an intact head is unreachable, not unsupported", () => {
    // og:type=article and json-ld survive on a stub. Head markers are reported,
    // never licensing.
    expect(verdict({ ...base, matched: 0, proseChars: 400, headMarkers: true })).toBe("unreachable");
  });

  it("a document whose slug and title do not appear in the body is unreachable", () => {
    expect(verdict({ ...base, matched: 0, slugLabelOverlap: 0.05 })).toBe("unreachable");
  });

  it("head markers alone never license an accusation", () => {
    expect(verdict({ ...base, matched: 0, proseChars: 300, slugLabelOverlap: 0, headMarkers: true })).toBe(
      "unreachable",
    );
  });
});
