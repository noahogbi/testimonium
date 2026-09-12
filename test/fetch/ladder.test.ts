import { describe, expect, it } from "vitest";
import { nextAction, type Attempt } from "../../src/fetch/ladder.js";

const ALL = ["node", "curl", "pdftotext"] as const;
// The ladder sees one bit per attempt: did that rung read the document
// (spec 6.6, isReadable - no veto AND prose over the floor)? It is not told a
// prose count or which veto fired, so no caller can hand it a private
// definition of "challenged". Both copies of the loop at 6546176 did exactly
// that, and disagreed.
const read: Attempt = { rung: "node", readable: true };
const unread: Attempt = { rung: "node", readable: false };

describe("nextAction", () => {
  it("starts at the node rung for an HTML url", () => {
    expect(nextAction([], ALL, false)).toEqual({ kind: "try", rung: "node" });
  });

  it("starts at pdftotext for a PDF url, before any fetch", () => {
    // Checked BEFORE any fetch: if a large PDF fetch throws and we fall through
    // to curl, curl hands back PDF bytes as text and every claim misses.
    expect(nextAction([], ALL, true)).toEqual({ kind: "try", rung: "pdftotext" });
  });

  it("falls through to curl when the node rung did not read the document", () => {
    // Some hosts challenge node fetch and hand curl the document. The origin's
    // second caller gave up here and lost every such source.
    expect(nextAction([unread], ALL, false)).toEqual({ kind: "try", rung: "curl" });
  });

  it("stops once a rung has read a document", () => {
    expect(nextAction([read], ALL, false)).toEqual({ kind: "stop" });
  });

  it("stops when every available rung has been tried", () => {
    const history: Attempt[] = [unread, { ...unread, rung: "curl" }];
    expect(nextAction(history, ["node", "curl"], false)).toEqual({ kind: "stop" });
  });

  it("does not try a rung this machine does not have", () => {
    // A serverless caller has node only. The ladder truncates rather than
    // crashing, and the truncation is reported as provenance.
    expect(nextAction([unread], ["node"], false)).toEqual({ kind: "stop" });
  });

  it("never retries a rung it has already attempted", () => {
    expect(nextAction([unread, { ...unread, rung: "curl" }], ALL, false)).toEqual({ kind: "stop" });
  });

  it("climbs past a readable read only when told to exhaust the ladder", () => {
    const history = [{ rung: "node" as const, readable: true }];
    const rungs = ["node", "curl"] as const;
    expect(nextAction(history, rungs, false)).toEqual({ kind: "stop" });
    expect(nextAction(history, rungs, false, true)).toEqual({ kind: "try", rung: "curl" });
  });

  it("stops when exhausted even under the flag", () => {
    const history = [
      { rung: "node" as const, readable: true },
      { rung: "curl" as const, readable: true },
    ];
    expect(nextAction(history, ["node", "curl"] as const, false, true)).toEqual({ kind: "stop" });
  });

  it("never escalates a PDF, flag or not", () => {
    const history = [{ rung: "pdftotext" as const, readable: true }];
    expect(nextAction(history, ["pdftotext"] as const, true, true)).toEqual({ kind: "stop" });
  });
});
