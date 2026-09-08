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
  /** Response headers as the server sent them. **Key casing does not matter**:
   *  `computeSignals` lowercases every field name before N1 or N5 reads one,
   *  so a fetcher may pass a server's own casing straight through and need not
   *  lowercase anything. Values are consumed case-insensitively too. The two
   *  bundled fetchers still lowercase their keys, but that is now their own
   *  convenience rather than something the vetoes depend on - when it WAS a
   *  dependency, a plugin fetcher returning `CF-Mitigated: challenge` lost N1
   *  silently and the page came back as an accusation. */
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
  /**
   * CONTRACT: THIS MUST NOT THROW.
   *
   * An unreachable source is a RESULT, not an error. Report failure by
   * returning `EMPTY_RESPONSE` - or any `RawResponse` with an empty body -
   * exactly as the three bundled rungs do internally.
   *
   * A throw is caught by `check()` and degraded to an unread rung with a
   * warning, so a misbehaving third-party fetcher cannot abort a run partway
   * through a document. It is warned about rather than swallowed: a rung that
   * silently vanishes is the failure shape this project keeps finding.
   */
  fetch(url: string, rung: RungId): Promise<RawResponse>;
}

export const EMPTY_RESPONSE: RawResponse = {
  rawBody: "",
  status: 0,
  headers: {},
  finalUrl: "",
  bytes: 0,
};
