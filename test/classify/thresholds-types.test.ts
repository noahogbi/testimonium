import { describe, it, expect } from "vitest";

describe("THRESHOLDS types", () => {
  it("values are typed number, not literals - recalibration must not be breaking", async () => {
    const { THRESHOLDS } = await import("../../src/index.js");
    // Same probe shape: a literal on the right-hand side.
    expect(THRESHOLDS.minProseChars === 5000).toBe(false);
    expect(THRESHOLDS.maxChallengeChars === 999).toBe(false);
    expect(Object.isFrozen(THRESHOLDS)).toBe(true);
  });
});
