import { describe, expect, it } from "vitest";
import { validateClaims } from "../../src/io/validate.js";
import { check } from "../../src/check.js";
import { EMPTY_RESPONSE, type Fetcher } from "../../src/fetch/types.js";

// A fetcher that never touches the network - every rung reads back the empty
// response. The agreement test below only needs check() to resolve rather
// than throw, so what verdict it lands on is irrelevant.
const emptyFetcher: Fetcher = {
  rungs: ["node"],
  async fetch() {
    return EMPTY_RESPONSE;
  },
};

describe("validateClaims", () => {
  it("enumerates every offender, not just the first", () => {
    const problems = validateClaims(["169", "a perfectly acceptable claim here", 42, "short"]);
    expect(problems.map((p) => p.index)).toEqual([0, 2, 3]);
    expect(problems[0]?.reason).toBe("below-floor");
    expect(problems[1]?.reason).toBe("not-a-string");
  });

  it("agrees with check() about what is acceptable", async () => {
    const good = ["a perfectly acceptable claim here"];
    expect(validateClaims(good)).toEqual([]);
    // check() must not throw on anything validateClaims accepts.
    await expect(check("https://example.invalid/x", good, { fetcher: emptyFetcher })).resolves.toBeDefined();
  });

  it("returns an empty array for an empty claims list", () => {
    expect(validateClaims([])).toEqual([]);
  });

  it("reports the not-a-string claim itself on the problem", () => {
    const problems = validateClaims([42]);
    expect(problems).toEqual([
      { index: 0, claim: 42, reason: "not-a-string", message: "claim at index 0 is not a string" },
    ]);
  });

  it("uses check()'s own claimFloorMessage, not a re-derived string", () => {
    const problems = validateClaims(["short"]);
    expect(problems[0]?.message).toBe(
      "claim at index 0: \"short\" is 5 characters once normalized, under the 16-character floor; extend it to take in the surrounding words",
    );
  });
});
