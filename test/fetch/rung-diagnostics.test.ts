import { describe, it, expect, vi, afterEach } from "vitest";
import { nodeFetch } from "../../src/fetch/node.js";
import { curlFetch } from "../../src/fetch/curl.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("node rung diagnostics", () => {
  it("warns with the url and the reason when the fetch throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", () => Promise.reject(new Error("ENOTFOUND example.invalid")));

    const r = await nodeFetch("https://example.invalid/a", "testimonium-test");

    expect(r.rawBody).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0]?.[0]);
    expect(msg).toContain("https://example.invalid/a");
    expect(msg).toContain("ENOTFOUND example.invalid");
  });
});

describe("curl rung diagnostics", () => {
  it("warns with the url and the reason when execFileSync throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const r = curlFetch("https://example.invalid/x", "ua");

    expect(r.rawBody).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0]?.[0]);
    expect(msg).toContain("https://example.invalid/x");
    // "Command failed" is execFileSync's own thrown message text - the
    // reason - not the static "curl" rung-name literal in the warn's format
    // string, which would stay green even if the reason were dropped.
    expect(msg).toContain("Command failed");
  });
});
