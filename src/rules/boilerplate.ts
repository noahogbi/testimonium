import type { Rule } from "./challenge.js";

/**
 * Phrases harvest must never propose as a claim, tested as regexes against
 * `norm(span)` in filter 3 (spec 8.2 step 5.3).
 *
 * IT SHIPS EMPTY, AND THAT IS THE DESIGN, NOT AN OMISSION. A rule in this
 * repository carries a `lastConfirmed` date, and a date asserts that somebody
 * saw the phrase on a live page that day. Plan 2's calibration found the
 * usual furniture - "Terms of Use Privacy Policy", "All Rights Reserved.",
 * "Accessibility Statement" - in the fixture corpus, which is a recording,
 * not an observation, so none of it earns a dated entry here.
 *
 * The primary mechanism is filter 2, cross-source frequency, which needs no
 * list at all (spec 13 Q5). This list exists for the case frequency cannot
 * see: a phrase that recurs across ONE outlet's pages when the draft cites
 * that outlet once. The author writing her own `--rules` file is the only
 * cure for that, and additive-only means her file can add to this list and
 * never delete from it.
 *
 * A rule is an UNANCHORED REGEX test against normalized text once it is
 * compiled - `toRule` builds it with `new RegExp(pattern)`, no flags and no
 * `^`/`$` - so a plain-text pattern like `all rights reserved` behaves as a
 * substring match and will also delete a real claim quoting a copyright
 * dispute. That makes the list a recall risk, not a correctness one: a span
 * it removes is a span the author does not see, and nothing it removes can
 * produce a false verdict.
 */
export const BOILERPLATE_RULES: readonly Rule[] = [];
