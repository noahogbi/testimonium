import { describe, expect, it, vi } from "vitest";
import { buildFetcher } from "../../src/fetch/build-fetcher.js";
import { userAgentFor, type FetcherOptions } from "../../src/fetch/default-fetcher.js";
import type { Fetcher, RungId } from "../../src/fetch/types.js";
import type { RuleSet } from "../../src/rules/load.js";
import type { HostRule } from "../../src/rules/hosts.js";

describe("buildFetcher", () => {
  it("returns the caller's fetcher untouched, without building a default", () => {
    const mine: Fetcher = {
      rungs: [],
      async fetch() {
        throw new Error("never");
      },
    };
    expect(buildFetcher({ fetcher: mine })).toBe(mine);
  });

  it("spreads hosts and identity conditionally, never as undefined keys", () => {
    const f = buildFetcher({ identity: "example-app contact@example.com" });
    expect(f).toBeDefined();
    // The wire is observable through the UA decision for a requiresIdentity host.
    expect(userAgentFor("https://www.sec.gov/x", { identity: "example-app contact@example.com" })).toBe(
      "example-app contact@example.com",
    );
  });

  // Both remaining tests replace the real defaultFetcher with a spy and
  // inspect the raw FetcherOptions object buildFetcher constructs for it -
  // the same technique test/bin.test.ts's "passes the loaded host rules into
  // the fetcher it builds" uses on archiveContextFor, and test/check.test.ts
  // uses on check() itself. A test that only probes UA side effects (as the
  // one above does for identity) cannot tell "hosts propagated" from "hosts
  // happened to match the bundled default", because sec.gov already requires
  // identity in HOST_RULES; capturing the constructed object is what proves
  // the wire rather than a coincidence.

  it("passes rules.hosts through to the default fetcher it builds, and omits the key entirely when rules is absent", async () => {
    vi.resetModules();
    const spy = vi.fn((_opts: FetcherOptions = {}) => ({
      rungs: [] as RungId[],
      fetch: async () => {
        throw new Error("must not be called: rungs is empty");
      },
    }));
    vi.doMock("../../src/fetch/default-fetcher.js", () => ({ defaultFetcher: spy }));
    try {
      const { buildFetcher: freshBuildFetcher } = await import("../../src/fetch/build-fetcher.js");
      const RULE: HostRule = { host: "not-in-bundle.example", lastConfirmed: "2026-09-01", note: "local" };
      const rules: RuleSet = { signatures: [], paths: [], boilerplate: [], hosts: [RULE] };

      freshBuildFetcher({ rules });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ hosts: [RULE] }));

      spy.mockClear();
      freshBuildFetcher({});
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).not.toHaveProperty("hosts");
    } finally {
      vi.doUnmock("../../src/fetch/default-fetcher.js");
      vi.resetModules();
    }
  });

  it("never passes identity as an explicit undefined key to defaultFetcher - exactOptionalPropertyTypes is on", async () => {
    vi.resetModules();
    const spy = vi.fn((_opts: FetcherOptions = {}) => ({
      rungs: [] as RungId[],
      fetch: async () => {
        throw new Error("must not be called: rungs is empty");
      },
    }));
    vi.doMock("../../src/fetch/default-fetcher.js", () => ({ defaultFetcher: spy }));
    try {
      const { buildFetcher: freshBuildFetcher } = await import("../../src/fetch/build-fetcher.js");

      freshBuildFetcher({ identity: "example-app contact@example.com" });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({ identity: "example-app contact@example.com" }),
      );

      spy.mockClear();
      freshBuildFetcher({});
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).not.toHaveProperty("identity");
    } finally {
      vi.doUnmock("../../src/fetch/default-fetcher.js");
      vi.resetModules();
    }
  });
});
