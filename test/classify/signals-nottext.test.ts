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

  it("vetoes even a full claim match - a non-text body is not the document", () => {
    const body = "%PDF-1.7 a phrase " + (" " + REPL).repeat(400);
    const s = computeSignals({ ...base, rawBody: body, headers: { "content-type": "application/pdf" } });
    expect(s.signals.matched).toBeGreaterThan(0);
    expect(verdict(s.signals)).toBe("unreachable");
  });
});
