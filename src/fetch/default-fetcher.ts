import { hostRuleFor, type HostRule } from "../rules/hosts.js";
import { curlAvailable, curlFetch } from "./curl.js";
import { nodeFetch } from "./node.js";
import { pdfFetch, pdftotextAvailable } from "./pdf.js";
import type { Fetcher, RawResponse, RungId } from "./types.js";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export interface FetcherOptions {
  /** Declared identity for hosts that require one, e.g. sec.gov's
   *  "<app> <contact email>". testimonium ships no identity of its own. */
  readonly identity?: string;
  /** Bundled-plus-local host rules (Task 15's `loadRules().hosts`). Omitting
   *  it falls back to the bundled snapshot only - see `hostRuleFor`'s default
   *  parameter. Without this, a local host rule loads and validates but is
   *  never consulted: `hostRuleFor` closed over the module-level `HOST_RULES`
   *  and this is the one place that call happens. */
  readonly hosts?: readonly HostRule[];
}

export function userAgentFor(url: string, opts: FetcherOptions): string {
  const rule = hostRuleFor(url, opts.hosts);
  if (rule?.requiresIdentity) {
    if (!opts.identity) {
      console.warn(
        `warn ${rule.host} requires a declared identity ("<app> <contact email>"). ` +
          `None configured, so a browser UA is being sent and this host will likely refuse. ` +
          `Set identity in your config to fix it.`,
      );
      return BROWSER_UA;
    }
    return opts.identity;
  }
  return rule?.userAgent ?? BROWSER_UA;
}

export function defaultFetcher(opts: FetcherOptions = {}): Fetcher {
  const rungs: RungId[] = ["node"];
  if (curlAvailable()) rungs.push("curl");
  if (pdftotextAvailable()) rungs.push("pdftotext");

  return {
    rungs,
    async fetch(url: string, rung: RungId): Promise<RawResponse> {
      const ua = userAgentFor(url, opts);
      if (rung === "node") return nodeFetch(url, ua);
      if (rung === "curl") return curlFetch(url, ua);
      if (rung === "pdftotext") return pdfFetch(url, ua);
      // RungId is open so plugins can add rungs. The BUNDLED fetcher serves
      // only its own three; falling through to pdfFetch would hand PDF-parsed
      // bytes back for an unknown rung and libel the source.
      throw new Error(`defaultFetcher has no rung "${rung}"`);
    },
  };
}
