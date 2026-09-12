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
 * shape. Below the floor, its COMPLETENESS is not what protects a citation
 * from a false ACCUSATION: the prose floor in src/classify/verdict.ts does
 * that, and it holds for walls nobody has written down (above the floor
 * neither protection applies, and the attestation exception is separate -
 * both covered further down in this comment). A match's main job is
 * triggering an early fall-through to the next rung.
 *
 * It is NOT true that a match never decides a verdict, and this comment said
 * so until 2026-09-07. A match on a body under THRESHOLDS.maxChallengeChars
 * is N3, which `isBlocked` ORs into the veto set. Since plan 1.2 that veto
 * ends the READ, not the citation: the ladder climbs past it, and the
 * citation reads `unreachable` only when no rung produced a readable read
 * and none matched in full (spec 6.6).
 *
 * The list ROTTING - failing to name a wall - can never mint a false
 * ACCUSATION: above maxChallengeChars N3 cannot fire at all, and below it an
 * unnamed wall is not excluded from check()'s cross-rung union, so nothing it
 * fails to name can turn a present claim into `missed`. It can still mint a
 * false ATTESTATION: an unvetoed wall that matches every claim - alone, or
 * completed through a later read's union (`src/check.ts:128-133`) - never
 * reaches the prose floor at all, because `verdict()` returns `supported` on
 * a full match before the floor is consulted, quoting the wall's own text as
 * the evidence (test/check.test.ts:501 pins the union shape).
 * (Spec 6.3 scopes the rot argument the same way, and records that draft 1
 * stated it without the condition. Above the floor neither protection
 * applies - that is 6.3's known gap, and rot does not widen it.) An
 * OVER-BROAD entry can cost truth. A signature matching a short REAL read
 * takes that read's matches out of check()'s cross-rung union, so a claim
 * only it carried is named in `missed` when a readable later rung is judged -
 * a false accusation, not a lost attestation (spec 6.3, corrected 2026-09-08;
 * pinned by test/check.test.ts, "N3 through the cross-read union").
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
  { pattern: /javascript is disabled in your browser/, lastConfirmed: "2026-09-11", note: "Generic JS-disabled shell. Qualified rather than bare: extract.ts does not strip <noscript>, so a bare 'javascript is disabled' would match CMS boilerplate on a genuine short document." },
  { pattern: /enable javascript and then reload/, lastConfirmed: "2026-09-11", note: "JS-disabled shell with a reload instruction." },
  { pattern: /enable javascript to run this app/, lastConfirmed: "2026-09-11", note: "Stock React/Vite noscript shell - the JS-shell-at-200 class." },
  { pattern: /please turn javascript on/, lastConfirmed: "2026-09-11", note: "JS-disabled shell, imperative phrasing." },
];

/** Redirect targets that mean a challenge, not a document. Data, not a
 *  constant: hosts add these and the list is expected to lag. */
export const CHALLENGE_PATHS: readonly Rule[] = [
  { pattern: /\/cdn-cgi\/challenge-platform\//, lastConfirmed: "2026-09-06", note: "Cloudflare challenge platform." },
  { pattern: /\/sorry\/index/, lastConfirmed: "2026-09-06", note: "Google sorry redirect." },
  { pattern: /\/(captcha|challenge|px-captcha)(\/|$|\?)/, lastConfirmed: "2026-09-06", note: "Generic captcha paths." },
  { pattern: /\/consent(\/|$|\?)/, lastConfirmed: "2026-09-06", note: "Consent-wall redirect, e.g. consent.youtube.com." },
];

export function matchesChallengeSignature(text: string, signatures: readonly Rule[] = CHALLENGE_SIGNATURES): Rule | null {
  const n = norm(text);
  return signatures.find((r) => r.pattern.test(n)) ?? null;
}

export function matchesChallengePath(finalUrl: string, paths: readonly Rule[] = CHALLENGE_PATHS): Rule | null {
  return paths.find((r) => r.pattern.test(finalUrl)) ?? null;
}
