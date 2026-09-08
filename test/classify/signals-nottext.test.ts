import { describe, expect, it } from "vitest";
import { computeSignals } from "../../src/classify/signals.js";
import { verdict } from "../../src/classify/verdict.js";

const CP = String.fromCodePoint;
const REPL = CP(0xfffd);      // what binary looks like decoded as UTF-8
const NL = CP(0x0a);
const CTRL = CP(0x01);        // a single C0 control byte

const base = { finalUrl: "https://e.com/paper", claims: ["a phrase"], status: 200 };
const prose = "<html><body>" + "Real sentences of ordinary prose. ".repeat(300) + "</body></html>";

describe("N5 - the body is not text", () => {
  it("vetoes on a non-textual content-type", () => {
    const s = computeSignals({ ...base, rawBody: prose, headers: { "content-type": "application/pdf" } });
    expect(s.signals.notText).toBe(true);
    expect(verdict(s.signals)).toBe("unreachable");
  });

  it("accepts the textual content-types a real page sends", () => {
    for (const ct of ["text/html; charset=utf-8", "text/plain", "application/xhtml+xml", "application/xml", "application/json", ""]) {
      const s = computeSignals({ ...base, rawBody: prose, headers: { "content-type": ct } });
      expect(s.signals.notText, ct).toBe(false);
    }
  });

  it("vetoes a binary body even when the content-type is absent or lies", () => {
    const binary = "%PDF-1.7" + NL + (" " + REPL + REPL).repeat(500) + "stream";
    const s = computeSignals({ ...base, rawBody: binary, headers: {} });
    expect(s.signals.notText).toBe(true);
  });

  it("tolerates prose carrying a stray control character", () => {
    // Pins the TOLERANCE property: density below the threshold must not veto.
    // An earlier draft of this test passed a body identical to `prose` and so
    // asserted nothing.
    const s = computeSignals({ ...base, rawBody: prose + CTRL, headers: { "content-type": "text/html" } });
    expect(s.signals.notText).toBe(false);
  });

  it("does not veto scripts with no ASCII - CJK, emoji, mathematics", () => {
    const cjk = "<html><body>" + CP(0x6587) + CP(0x66F8) + CP(0x1F600) + CP(0x2211);
    const s = computeSignals({ ...base, rawBody: cjk.repeat(200), headers: {} });
    expect(s.signals.notText).toBe(false);
  });

  it("reads header KEYS case-insensitively, whatever the fetcher hands over", () => {
    // Field names are case-insensitive on the wire (RFC 9110 5.1) and a
    // Record<string, string> is not. computeSignals normalises, so N1 and N5
    // are properties of the classifier rather than of whichever fetcher
    // happened to be installed. Before this, a plugin fetcher passing headers
    // through as the server cased them lost both vetoes silently.
    const pdfKey = computeSignals({ ...base, rawBody: prose, headers: { "Content-Type": "application/pdf" } });
    expect(pdfKey.signals.notText).toBe(true);
    const cfKey = computeSignals({ ...base, rawBody: prose, headers: { "CF-Mitigated": "challenge" } });
    expect(cfKey.signals.challengeHeader).toBe(true);
  });

  it("reads header VALUES case-insensitively, including the charset parameter", () => {
    const shouty = computeSignals({ ...base, rawBody: prose, headers: { "content-type": "APPLICATION/PDF" } });
    expect(shouty.signals.notText).toBe(true);
    for (const ct of ["TEXT/HTML; CHARSET=UTF-8", "Text/Html;CharSet=utf-8", "Application/XHTML+XML"]) {
      const s = computeSignals({ ...base, rawBody: prose, headers: { "content-type": ct } });
      expect(s.signals.notText, ct).toBe(false);
    }
    const cfValue = computeSignals({ ...base, rawBody: prose, headers: { "cf-mitigated": "CHALLENGE" } });
    expect(cfValue.signals.challengeHeader).toBe(true);
  });

  it("vetoes even a full claim match - a non-text body is not the document", () => {
    const body = "%PDF-1.7 a phrase " + (" " + REPL).repeat(400);
    const s = computeSignals({ ...base, rawBody: body, headers: { "content-type": "application/pdf" } });
    expect(s.signals.matched).toBeGreaterThan(0);
    expect(verdict(s.signals)).toBe("unreachable");
  });

  it("measures density per CODE POINT, so astral characters cannot halve it", () => {
    // The scan counts code points; it used to divide by String.length, which
    // counts UTF-16 units. Every astral character therefore added TWO to the
    // denominator and one to nothing, halving the measured density of any body
    // carrying them - and halving it in the UNDER-veto direction, which is the
    // accusation direction.
    //
    // 15 control bytes among 985 astral characters is 1,000 code points but
    // 1,985 UTF-16 units. True density 15/1000 = 0.0150, above the 0.01 veto.
    // Measured against UTF-16 units it reads 15/1985 = 0.0076 and vetoes
    // nothing.
    const CONTROLS = 15;
    const ASTRAL = 985;
    const body = CP(0x1f600).repeat(ASTRAL) + CTRL.repeat(CONTROLS);
    expect([...body].length).toBe(CONTROLS + ASTRAL);
    expect(body.length).toBe(CONTROLS + ASTRAL * 2);
    expect(CONTROLS / (CONTROLS + ASTRAL)).toBeGreaterThan(0.01);
    expect(CONTROLS / body.length).toBeLessThan(0.01);
    const s = computeSignals({ ...base, rawBody: body, headers: {} });
    expect(s.signals.notText).toBe(true);
  });
});

// These pin THRESHOLDS.maxBinaryDensity and THRESHOLDS.binarySampleCodePoints
// at the values they have TODAY. They are characterization tests, not
// calibration: neither constant has been swept against a corpus, and the
// bracket below is deliberately loose enough to survive a real calibration
// round while still killing the mutants that proved the constants were pinned
// by nothing at all (0.01 -> 0.5 and 65536 -> 1024 each killed zero tests).
describe("N5 - the two binary-detection constants, bracketed", () => {
  // `total` code points carrying exactly `bad` control bytes, spread EVENLY so
  // the density is the same in any prefix. The two density tests below must
  // discriminate the density constant and nothing else; bunching the control
  // bytes at the end would make them fail under a narrowed sample window too,
  // and then neither test would say which constant it was pinning.
  const withDensity = (total: number, bad: number): string => {
    const block = Math.floor(total / bad);
    const body = ("x".repeat(block - 1) + CTRL).repeat(bad);
    return body + "x".repeat(total - body.length);
  };

  it("vetoes at density 0.02 - the upper bracket on maxBinaryDensity", () => {
    const body = withDensity(10_000, 200);
    expect(body.length).toBe(10_000);
    expect([...body].filter((c) => c === CTRL).length / body.length).toBe(0.02);
    expect(computeSignals({ ...base, rawBody: body, headers: {} }).signals.notText).toBe(true);
  });

  it("does NOT veto at density 0.005 - the lower bracket on maxBinaryDensity", () => {
    // The tolerance side. Prose does carry the occasional stray control byte,
    // and vetoing it would cost a readable page for nothing.
    const body = withDensity(10_000, 50);
    expect(body.length).toBe(10_000);
    expect([...body].filter((c) => c === CTRL).length / body.length).toBe(0.005);
    expect(computeSignals({ ...base, rawBody: body, headers: {} }).signals.notText).toBe(false);
  });

  it("detects binary that begins ~2,000 characters in - the lower bracket on the sample window", () => {
    // A window narrower than this - 1,024, say - never reaches the binary at
    // all and reports a PDF as prose.
    const body = "x".repeat(2_000) + CTRL.repeat(500);
    expect(computeSignals({ ...base, rawBody: body, headers: {} }).signals.notText).toBe(true);
  });

  it("KNOWN GAP: binary past the sample window is not detected at all", () => {
    // NOT desired behaviour. This documents the disclosed gap in
    // docs/calibration-2026-09.md and the README: `looksBinary` samples only
    // the first THRESHOLDS.binarySampleCodePoints code points, so a body
    // deliberately shaped to keep its binary content past that boundary reads
    // as text. Pinned so the gap cannot silently change size - widening or
    // removing the window is a calibration decision, not a fix.
    const body = "x".repeat(70_000) + CTRL.repeat(5_000);
    expect(computeSignals({ ...base, rawBody: body, headers: {} }).signals.notText).toBe(false);
  });
});
