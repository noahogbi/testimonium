import { describe, it, expect } from "vitest";
import { computeSignals } from "../../src/classify/signals.js";
import { readSource } from "../../src/fetch/read-source.js";
import type { Fetcher } from "../../src/fetch/types.js";

// pdftotext output is PLAIN TEXT, not HTML. Running it through the HTML tag
// stripper deletes everything from any "<" to the next ">", and statistics
// papers are full of "p < 0.001". Measured 2026-09-23 against arXiv 2306.07458:
// 117,217 extracted characters fell to 38,302, and every claim in the deleted
// span reported missing - a false `unsupported` on an accurately quoted paper,
// which is the accusation direction.
const statsText =
  "Overreliance rose under time pressure (p < 0.008). We also find that a " +
  "participant's overreliance behaviour remains stable over the course of study " +
  "(p < 0.0001), and that accuracy fell when x > 3 for the AI-before arm.";
const claim = "remains stable over the course of study";

const sig = (rawBody: string, bodyKind?: "html" | "text") =>
  computeSignals({
    rawBody,
    headers: {},
    finalUrl: "https://arxiv.org/pdf/2306.07458",
    status: 200,
    claims: [claim],
    ...(bodyKind ? { bodyKind } : {}),
  });

describe("plain-text bodies", () => {
  it("matches a claim sitting between a '<' and a later '>' when the body is text", () => {
    const r = sig(statsText, "text");
    expect(r.signals.matched).toBe(1);
    expect(r.text).toContain("p < 0.0001");
  });

  it("still strips tags from HTML bodies (the default is unchanged)", () => {
    expect(sig("<p>" + claim + "</p>").signals.matched).toBe(1);
    expect(sig("<p>" + claim + "</p>").text).not.toContain("<p>");
  });

  it("demonstrates the defect it fixes: the same text read as HTML loses the claim", () => {
    expect(sig(statsText).signals.matched).toBe(0);
  });

  it("collapses whitespace in text bodies, so a line-broken claim still matches", () => {
    expect(sig("remains stable\n   over the course\nof study", "text").signals.matched).toBe(1);
  });
});

describe("readSource marks the pdftotext rung's body as text", () => {
  const fetcher = (): Fetcher => ({
    rungs: ["node", "curl", "pdftotext"],
    async fetch(url, rung) {
      if (rung === "pdftotext") {
        return { rawBody: statsText, status: 200, headers: {}, finalUrl: url, bytes: statsText.length };
      }
      const pdf = "%PDF-1.4\u0000\u0000\u0000stream";
      return { rawBody: pdf, status: 200, headers: { "content-type": "application/pdf" }, finalUrl: url, bytes: pdf.length };
    },
  });

  it("on a .pdf URL", async () => {
    const r = await readSource("https://e.com/paper.pdf", [claim], { fetcher: fetcher() });
    const pdfRead = r.reads.find((x) => x.rung === "pdftotext");
    expect(pdfRead?.computed.signals.matched).toBe(1);
  });

  it("on the content-type re-route from a URL with no .pdf", async () => {
    const r = await readSource("https://arxiv.org/pdf/2306.07458", [claim], { fetcher: fetcher() });
    const pdfRead = r.reads.find((x) => x.rung === "pdftotext");
    expect(pdfRead?.computed.signals.matched).toBe(1);
  });
});
