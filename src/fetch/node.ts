import { EMPTY_RESPONSE, type RawResponse } from "./types.js";

const TIMEOUT_MS = 20_000;

export async function nodeFetch(url: string, userAgent: string): Promise<RawResponse> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        // The axios lesson. The origin's other caller omitted this and lost a
        // pass to it; it belongs on every rung, not on one.
        Accept: "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const rawBody = await r.text();
    const headers: Record<string, string> = {};
    r.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    return { rawBody, status: r.status, headers, finalUrl: r.url || url, bytes: rawBody.length };
  } catch {
    return EMPTY_RESPONSE;
  }
}
