export type BuiltinRung = "node" | "curl" | "pdftotext";

/** Open by design. A closed union would forbid the bring-your-own-reader
 *  escape hatch that spec section 12 names as the mitigation for the fetch
 *  layer's maintenance treadmill - a user on a hostile corpus brings a headless
 *  browser or a paid proxy rung. `(string & {})` keeps autocomplete on the
 *  three builtins while admitting any other id. */
export type RungId = BuiltinRung | (string & {});

/**
 * What a fetcher reports. FACTS ONLY.
 *
 * There is deliberately no `ok` and no `http2xx` field. In the origin repo the
 * keystone guarantee was a single boolean literal set inside IO code, untested,
 * one careless edit from publishing false accusations against accurate work.
 * Here that value cannot be produced by IO at all: the classifier derives every
 * epistemic judgement from these facts. A plugin author cannot break the
 * keystone because there is no field to get wrong.
 */
export interface RawResponse {
  readonly rawBody: string;
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  /** After redirects. The hop chain is itself a challenge signal (N2). */
  readonly finalUrl: string;
  readonly bytes: number;
}

export interface Fetcher {
  /** What this fetcher can attempt on this machine. A serverless caller has
   *  no curl and no pdftotext; its ladder is truncated, which is reported as
   *  provenance so an unreachable never reads as a fact about the host. */
  readonly rungs: readonly RungId[];
  fetch(url: string, rung: RungId): Promise<RawResponse>;
}

export const EMPTY_RESPONSE: RawResponse = {
  rawBody: "",
  status: 0,
  headers: {},
  finalUrl: "",
  bytes: 0,
};
