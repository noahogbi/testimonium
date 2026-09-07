import { norm } from "../text/normalize.js";

export interface Rule {
  readonly pattern: RegExp;
  readonly lastConfirmed: string;
  readonly note: string;
}

/**
 * Bot-challenge wording. THIS LIST ROTS, AND THAT IS TOLERATED BY DESIGN.
 *
 * A measured battery found 11 of 17 realistic walls evading a list of this
 * shape. It is an OPTIMIZATION: a match triggers an early fall-through to the
 * next rung. It never decides a verdict. The prose floor in
 * src/classify/verdict.ts is what actually protects a citation from a false
 * accusation, and it holds for walls nobody has written down.
 *
 * Patterns are tested against normalized text, so case, smart quotes and
 * zero-width characters cannot dodge them. Prefer a loose pattern over an
 * exact phrase: "verify you are human" missed "verifying you are human", and
 * "enable javascript to continue" missed "enable javascript and cookies to
 * continue".
 */
export const CHALLENGE_SIGNATURES: readonly Rule[] = [
  { pattern: /verif(y|ying|ication)[\s\S]{0,20}human/, lastConfirmed: "2026-09-06",
    note: "Cloudflare Turnstile and managed challenge. The -ing form defeated an exact-phrase list." },
  { pattern: /enable javascript[\s\S]{0,30}(continue|proceed)/, lastConfirmed: "2026-09-06",
    note: "Cloudflare noscript line; 'and cookies' is inserted mid-phrase." },
  { pattern: /(please )?enable js\b/, lastConfirmed: "2026-09-06",
    note: "DataDome abbreviates JavaScript to JS." },
  { pattern: /(are|re) you a robot|not a robot/, lastConfirmed: "2026-09-06",
    note: "EUR-Lex 202 interstitial and bloomberg.com's wall." },
  { pattern: /checking your browser before accessing/, lastConfirmed: "2023-01-01",
    note: "RETIRED pre-2023 Cloudflare wording. Kept: old edge configs still serve it." },
  { pattern: /just a moment/, lastConfirmed: "2026-09-06",
    note: "Cloudflare interstitial title." },
  { pattern: /press (and|&) hold/, lastConfirmed: "2026-09-06",
    note: "PerimeterX press-and-hold; its block page is caught by the javascript rules." },
  { pattern: /making sure you're not a robot|we just need to make sure/, lastConfirmed: "2026-09-06",
    note: "Amazon robot check, historically served at HTTP 200." },
  { pattern: /proof[- ]of[- ]work|anubis/, lastConfirmed: "2026-09-06",
    note: "Anubis, now common on FOSS hosts; serves in place at 200." },
  { pattern: /unusual traffic from your computer network/, lastConfirmed: "2026-09-06",
    note: "Google sorry page." },
  { pattern: /request unsuccessful.{0,40}incapsula/, lastConfirmed: "2026-09-06",
    note: "Imperva/Incapsula." },
  { pattern: /vercel security checkpoint/, lastConfirmed: "2026-09-06",
    note: "Vercel firewall checkpoint." },
];

/** Redirect targets that mean a challenge, not a document. Data, not a
 *  constant: hosts add these and the list is expected to lag. */
export const CHALLENGE_PATHS: readonly Rule[] = [
  { pattern: /\/cdn-cgi\/challenge-platform\//, lastConfirmed: "2026-09-06", note: "Cloudflare challenge platform." },
  { pattern: /\/sorry\/index/, lastConfirmed: "2026-09-06", note: "Google sorry redirect." },
  { pattern: /\/(captcha|challenge|px-captcha)(\/|$|\?)/, lastConfirmed: "2026-09-06", note: "Generic captcha paths." },
  { pattern: /\/consent(\/|$|\?)/, lastConfirmed: "2026-09-06", note: "Consent-wall redirect, e.g. consent.youtube.com." },
];

export function matchesChallengeSignature(text: string): Rule | null {
  const n = norm(text);
  return CHALLENGE_SIGNATURES.find((r) => r.pattern.test(n)) ?? null;
}

export function matchesChallengePath(finalUrl: string): Rule | null {
  return CHALLENGE_PATHS.find((r) => r.pattern.test(finalUrl)) ?? null;
}
