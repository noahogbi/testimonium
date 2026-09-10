import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { USAGE } from "../src/bin.js";

describe("the README", () => {
  it("says that recheck detects change, never correctness - in those words", () => {
    // Spec 8.3 requires this sentence and, until plan 3, asserted it was
    // already there. It was not: the section shipped a present-tense factual
    // claim about another document that was false when written, which is the
    // defect class section 0 exists to catch. It is a requirement now, and this
    // test is what keeps it one.
    expect(readFileSync("README.md", "utf8")).toContain("detects change, never correctness");
  });

  it("names every command the usage string names", () => {
    // A command the usage line does not name is a command nobody finds; a
    // command the README does not name is one nobody looks for.
    const readme = readFileSync("README.md", "utf8");
    for (const command of ["check", "harvest", "recheck", "reachability"]) {
      expect(USAGE, command).toContain(command);
      expect(readme, command).toContain(`testimonium ${command} <doc.md>`);
    }
  });
});
