import { describe, expect, it } from "vitest";
import {
  CHALLENGE_SIGNATURES,
  matchesChallengeSignature,
  matchesChallengePath,
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
