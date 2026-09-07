import { describe, expect, it } from "vitest";
import { normalizeUrl, parseClaimsFile, joinClaims } from "../../src/io/claims.js";

describe("normalizeUrl", () => {
  it("lowercases scheme and host but never the path", () => {
    expect(normalizeUrl("HTTPS://Example.COM/Path/To")).toBe("https://example.com/Path/To");
  });

  it("strips a default port", () => {
    expect(normalizeUrl("https://example.com:443/a")).toBe("https://example.com/a");
    expect(normalizeUrl("http://example.com:80/a")).toBe("http://example.com/a");
  });

  it("strips a trailing slash on a pathless URL only", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeUrl("https://example.com/a/")).toBe("https://example.com/a/");
  });

  it("strips tracking parameters and keeps everything else", () => {
    expect(normalizeUrl("https://e.com/a?utm_source=x&id=7&utm_medium=y")).toBe("https://e.com/a?id=7");
  });

  it("preserves the fragment", () => {
    expect(normalizeUrl("https://e.com/a#sec-3")).toBe("https://e.com/a#sec-3");
  });

  it("returns a malformed input unchanged rather than throwing", () => {
    expect(normalizeUrl("not a url")).toBe("not a url");
  });
});

describe("parseClaimsFile", () => {
  it("skips keys beginning with underscore", () => {
    const c = parseClaimsFile('{"_note":"hi","https://e.com/a":["phrase"]}');
    expect([...c.keys()]).toEqual(["https://e.com/a"]);
  });

  it("normalizes keys so the join cannot miss on a trailing slash", () => {
    expect([...parseClaimsFile('{"https://E.com/":["p"]}').keys()]).toEqual(["https://e.com"]);
  });

  it("accepts the notApplicable object form with a reason", () => {
    const c = parseClaimsFile('{"https://e.com/a":{"notApplicable":"rests on the filing"}}');
    expect(c.get("https://e.com/a")).toEqual({ notApplicable: "rests on the filing" });
  });

  it("rejects an empty phrase array", () => {
    expect(() => parseClaimsFile('{"https://e.com/a":[]}')).toThrow(/non-empty/);
  });

  it("rejects a non-string phrase", () => {
    expect(() => parseClaimsFile('{"https://e.com/a":[3]}')).toThrow(/non-empty/);
  });
});

describe("joinClaims", () => {
  const footnotes = [
    { n: 1, url: "https://E.com/a?utm_source=newsletter", label: "A" },
    { n: 2, url: null, label: "internal" },
    { n: 3, url: "https://e.com/b", label: "B" },
  ];

  it("joins across host case and tracking parameters", () => {
    const j = joinClaims(footnotes, parseClaimsFile('{"https://e.com/a":["p"]}'));
    expect(j.checkable.map((c) => c.n)).toEqual([1]);
  });

  it("does NOT join /a/ with /a, because they can be different resources", () => {
    // The contract is deliberately conservative here. A path trailing slash is
    // preserved; only a PATHLESS url loses it. Failing to join surfaces as
    // "no claims recorded", which fails the run - loud, and fixable by the
    // author. Joining two different resources would be silent and wrong.
    const j = joinClaims([{ n: 1, url: "https://e.com/a/", label: "A" }], parseClaimsFile('{"https://e.com/a":["p"]}'));
    expect(j.checkable).toEqual([]);
    expect(j.unclaimed.map((c) => c.n)).toEqual([1]);
  });

  it("reports a footnote with no external URL as not applicable, not unclaimed", () => {
    const j = joinClaims(footnotes, parseClaimsFile("{}"));
    expect(j.notApplicable.map((c) => c.n)).toEqual([2]);
  });

  it("reports a cited URL with no claims as unclaimed", () => {
    const j = joinClaims(footnotes, parseClaimsFile('{"https://e.com/a":["p"]}'));
    expect(j.unclaimed.map((c) => c.n)).toEqual([3]);
  });

  it("reports a claimed URL that is no longer cited", () => {
    const j = joinClaims(footnotes, parseClaimsFile('{"https://e.com/gone":["p"]}'));
    expect(j.orphanedClaims).toEqual(["https://e.com/gone"]);
  });
});
