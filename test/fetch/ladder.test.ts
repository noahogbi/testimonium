import { describe, expect, it } from "vitest";
import { nextAction, type Attempt } from "../../src/fetch/ladder.js";

const ALL = ["node", "curl", "pdftotext"] as const;
const read: Attempt = { rung: "node", proseChars: 20_000, challenged: false };
const challenged: Attempt = { rung: "node", proseChars: 120, challenged: true };
const empty: Attempt = { rung: "node", proseChars: 0, challenged: false };

describe("nextAction", () => {
  it("starts at the node rung for an HTML url", () => {
    expect(nextAction([], ALL, false)).toEqual({ kind: "try", rung: "node" });
  });

  it("starts at pdftotext for a PDF url, before any fetch", () => {
    // Checked BEFORE any fetch: if a large PDF fetch throws and we fall through
    // to curl, curl hands back PDF bytes as text and every claim misses.
    expect(nextAction([], ALL, true)).toEqual({ kind: "try", rung: "pdftotext" });
  });

  it("falls through to curl when the node rung was challenged", () => {
    // Some hosts challenge node fetch and hand curl the document. The origin's
    // second caller gave up here and lost every such source.
    expect(nextAction([challenged], ALL, false)).toEqual({ kind: "try", rung: "curl" });
  });

  it("falls through to curl when the node rung returned nothing", () => {
    expect(nextAction([empty], ALL, false)).toEqual({ kind: "try", rung: "curl" });
  });

  it("stops once a rung has read a document", () => {
    expect(nextAction([read], ALL, false)).toEqual({ kind: "stop" });
  });

  it("stops when every available rung has been tried", () => {
    const history: Attempt[] = [challenged, { ...challenged, rung: "curl" }];
    expect(nextAction(history, ["node", "curl"], false)).toEqual({ kind: "stop" });
  });

  it("does not try a rung this machine does not have", () => {
    // A serverless caller has node only. The ladder truncates rather than
    // crashing, and the truncation is reported as provenance.
    expect(nextAction([challenged], ["node"], false)).toEqual({ kind: "stop" });
  });

  it("never retries a rung it has already attempted", () => {
    expect(nextAction([challenged, { ...challenged, rung: "curl" }], ALL, false)).toEqual({ kind: "stop" });
  });
});
