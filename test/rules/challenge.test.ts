import { describe, expect, it } from "vitest";
import {
  CHALLENGE_SIGNATURES,
  matchesChallengeSignature,
  matchesChallengeSignatureIn,
  matchesChallengePath,
  type Rule,
} from "../../src/rules/challenge.js";
import { HOST_RULES, hostRuleFor } from "../../src/rules/hosts.js";

describe("challenge signatures", () => {
  it("matches through normalization, so typography cannot dodge it", () => {
    expect(matchesChallengeSignature("Verify you are human's check")).not.toBeNull();
  });

  it("catches the -ing inflection that defeated a substring list", () => {
    // "Verifying you are human" is not a superstring of "verify you are human".
    expect(matchesChallengeSignature("Verifying you are human. This may take a few seconds.")).not.toBeNull();
  });

  it("catches insertions inside a known phrase", () => {
    expect(matchesChallengeSignature("Enable JavaScript and cookies to continue")).not.toBeNull();
  });

  it("DOES fire on an article that quotes bot-wall wording, which is harmless", () => {
    const article =
      "Cloudflare asks the visitor to verify you are human before serving the page, " +
      "and this piece explains how that mechanism works across many paragraphs.";
    // It matches - and that is fine, because a signature never decides a
    // verdict. The prose floor is what protects this article, and Task 6's
    // length conjunction is what stops the signature from vetoing it.
    expect(matchesChallengeSignature(article)).not.toBeNull();
  });

  it("every signature carries a lastConfirmed date", () => {
    expect(CHALLENGE_SIGNATURES.length).toBeGreaterThan(5);
    for (const r of CHALLENGE_SIGNATURES) {
      expect(r.lastConfirmed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.note.length).toBeGreaterThan(0);
    }
  });

  it("matches the JavaScript-disabled shells the bundled set missed", () => {
    const cases = [
      "JavaScript is disabled in your browser.",
      "Please enable JavaScript and then reload this page.",
      "You need to enable JavaScript to run this app.",
      "Please turn JavaScript on and reload the page.",
    ];
    for (const text of cases) {
      expect(matchesChallengeSignature(text), text).not.toBeNull();
    }
  });
});

describe("challenge paths", () => {
  it("matches a redirect into a challenge path", () => {
    expect(matchesChallengePath("https://example.com/cdn-cgi/challenge-platform/x")).not.toBeNull();
  });

  it("ignores an ordinary article path", () => {
    expect(matchesChallengePath("https://example.com/2026/09/an-article")).toBeNull();
  });

  it("vetoes a consent-wall redirect but not a page about consent", () => {
    // Must still be vetoed - the redirect the rule was written for.
    expect(matchesChallengePath("https://consent.youtube.com/m?continue=x")).not.toBeNull();
    expect(matchesChallengePath("https://consent.google.com/ml?continue=x")).not.toBeNull();
    // Additional consent-wall shapes - bare host, query-only, fragment-only.
    expect(matchesChallengePath("https://consent.google.com")).not.toBeNull();
    expect(matchesChallengePath("https://consent.google.com?done=x")).not.toBeNull();
    expect(matchesChallengePath("https://consent.yahoo.com#x")).not.toBeNull();
    // Must NOT be vetoed - a document whose subject is consent.
    expect(matchesChallengePath("https://www.autoriteitpersoonsgegevens.nl/en/themes/consent")).toBeNull();
    expect(matchesChallengePath("https://ico.org.uk/for-organisations/guide/consent/")).toBeNull();
    // Host anchor should not over-match hosts merely starting with "consent".
    expect(matchesChallengePath("https://consenting.example.com/article")).toBeNull();
  });
});

describe("host rules", () => {
  it("every host rule carries a lastConfirmed date and a note", () => {
    expect(HOST_RULES.length).toBeGreaterThan(0);
    for (const r of HOST_RULES) {
      expect(r.lastConfirmed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.note.length).toBeGreaterThan(0);
    }
  });

  it("no host rule ships a personal identity string", () => {
    // SEC_UA in the origin embedded a personal email address and could not be
    // bundled. Identity is per-user configuration.
    expect(HOST_RULES.length).toBeGreaterThan(0);
    for (const r of HOST_RULES) {
      expect(JSON.stringify(r)).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    }
  });

  it("resolves a rule by host suffix", () => {
    expect(hostRuleFor("https://www.sec.gov/Archives/x.htm")?.host).toBe("sec.gov");
    expect(hostRuleFor("https://example.com/x")).toBeNull();
  });

  it("does not resolve a look-alike domain to a real host rule", () => {
    // Suffix matching without the leading dot would match all three of these.
    expect(hostRuleFor("https://notsec.gov/x")).toBeNull();
    expect(hostRuleFor("https://sec.gov.evil.com/x")).toBeNull();
    expect(hostRuleFor("https://evilsec.gov/x")).toBeNull();
    expect(hostRuleFor("https://www.sec.gov/x")?.host).toBe("sec.gov");
  });
});

describe("matchesChallengeSignatureIn", () => {
  it("matches a phrase inside one region, never one that exists only across a join", () => {
    const split = ["Our report. Please turn", "javascript on to read."];
    expect(matchesChallengeSignatureIn(["Our report. Please turn javascript on to read."])).not.toBeNull();
    expect(matchesChallengeSignatureIn(split)).toBeNull();
    // The flat matcher over the same regions joined still matches: that is the
    // defect this function exists to close (spec 0.7.0 section 3).
    expect(matchesChallengeSignature(split.join(" "))).not.toBeNull();
  });

  it("reports the earliest rule in rule order, whichever region it matched", () => {
    const A: Rule = { pattern: /alpha wall/, lastConfirmed: "2026-01-01", note: "A" };
    const B: Rule = { pattern: /beta wall/, lastConfirmed: "2026-01-01", note: "B" };
    expect(matchesChallengeSignatureIn(["the beta wall here", "the alpha wall there"], [A, B])?.note).toBe("A");
    expect(matchesChallengeSignatureIn(["nothing here", "nor here"], [A, B])).toBeNull();
  });

  it("gives the same answer every time for a stateful (g) local pattern", () => {
    // Review Focus 2: RegExp.test on a g- or y-flagged pattern leaves lastIndex
    // past a match, so the NEXT test starts mid-string. A failing test resets
    // it to 0, which is why a two-region input hides the bug - the second
    // region always matches. Two single-region calls in a row do not: without
    // the reset, the second returns null (measured 2026-09-23).
    const G: Rule = { pattern: /sticky wall/g, lastConfirmed: "2026-01-01", note: "G" };
    expect(matchesChallengeSignatureIn(["the sticky wall"], [G])?.note).toBe("G");
    expect(matchesChallengeSignatureIn(["the sticky wall"], [G])?.note).toBe("G");
  });
});

describe("the flat and path matchers with a stateful (g) caller-built rule", () => {
  // The same lastIndex hazard matchesChallengeSignatureIn guards against: a
  // RuleSet built in code from g/y literals leaves lastIndex past a match, so
  // an identical second call would start mid-string and miss. A rules FILE
  // cannot produce one (loadRules sets no flags); a programmatic caller can.
  it("matchesChallengeSignature answers the same on two identical calls", () => {
    const G: Rule = { pattern: /sticky wall/g, lastConfirmed: "2026-01-01", note: "G" };
    expect(matchesChallengeSignature("the sticky wall", [G])?.note).toBe("G");
    expect(matchesChallengeSignature("the sticky wall", [G])?.note).toBe("G");
  });

  it("matchesChallengePath answers the same on two identical calls", () => {
    const P: Rule = { pattern: /\/wall\//g, lastConfirmed: "2026-01-01", note: "P" };
    expect(matchesChallengePath("https://e.com/wall/x", [P])?.note).toBe("P");
    expect(matchesChallengePath("https://e.com/wall/x", [P])?.note).toBe("P");
  });
});
