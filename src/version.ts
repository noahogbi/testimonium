/**
 * The tool's version, in ONE place inside `src/`.
 *
 * It used to live as a literal in src/index.ts, hand-kept equal to
 * package.json's `version` by a test. Harvest stamps it into
 * `<doc>.claims.draft.json`, a file the author keeps and reads later, so a
 * second copy that could drift is a version stamped on a file that means
 * something slightly untrue. `test/exports.test.ts` still holds this equal to
 * package.json - two files are still two files, and the test is the join.
 */
export const VERSION = "0.1.0";
