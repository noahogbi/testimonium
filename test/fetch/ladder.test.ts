import { describe, expect, it } from "vitest";
import { hasUntriedClimbableRung, nextAction, type Attempt } from "../../src/fetch/ladder.js";

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

describe("hasUntriedClimbableRung", () => {
  // Fix round 2, Task 9: this predicate used to be a second copy of "which
  // rungs are climbable", reimplemented inline in check.ts. That copy's wrong
  // form (counting ANY rung the fetcher offers, `pdftotext` included, as
  // untried) turned out to be unobservable through check() end to end -
  // nextAction above already restricts its own candidates to HTML_ORDER, so
  // the wrong form cost one no-op call and nothing else (see
  // task-9-report.md's fix-round-1 section for the mutation proof). Moving
  // the question here, against the one HTML_ORDER this module owns, is what
  // makes the wrong form directly observable as a boolean - the first
  // assertion below is exactly that boolean, and fix-round-2 in
  // task-9-report.md pastes the mutation that reddens it.
  it("does not count a rung the HTML ladder would never climb to", () => {
    // Both HTML rungs tried, pdftotext available but never climbable from HTML.
    expect(hasUntriedClimbableRung(["node", "curl"], ["node", "curl", "pdftotext"], false)).toBe(false);
    expect(hasUntriedClimbableRung(["node"], ["node", "curl"], false)).toBe(true);
    expect(hasUntriedClimbableRung([], ["pdftotext"], true)).toBe(false);
  });

  it("I2: refuses to call curl climbable once the PDF re-route has fired, even though isPdfUrl is false", () => {
    // The re-route (src/fetch/read-source.ts) fires on a URL that did NOT
    // look like a PDF by shape - isPdfUrl (source.pdfUrl) stays false - so
    // before this guard, check()'s escalation trigger read attempted =
    // ["node", "pdftotext"], available = ["node", "curl", "pdftotext"],
    // isPdfUrl = false, and answered true: "curl" is in HTML_ORDER, in
    // available, and not in attempted. That is exactly the rung the
    // re-route's own `break` exists to prevent (measured through check():
    // fetch calls ["node","pdftotext","curl"]). A `pdftotext` attempt in the
    // history is the only signal available here that the re-route happened,
    // since `isPdfUrl` alone cannot distinguish "URL looked like a PDF" from
    // "the host told us at fetch time" - both must return false.
    expect(hasUntriedClimbableRung(["node", "pdftotext"], ["node", "curl", "pdftotext"], false)).toBe(false);
  });
});
