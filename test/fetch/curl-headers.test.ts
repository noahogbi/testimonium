import { describe, expect, it } from "vitest";
import { parseHeaderDump } from "../../src/fetch/curl.js";

const REDIRECT_CHAIN = [
  "HTTP/1.1 301 Moved Permanently",
  "Location: https://example.com/final",
  "Server: first-hop",
  "",
  "HTTP/2 200",
  "content-type: text/html",
  "cf-mitigated: challenge",
  "Server: last-hop",
  "",
].join("\r\n");

describe("parseHeaderDump", () => {
  it("returns the FINAL hop's headers, not the first", () => {
    const h = parseHeaderDump(REDIRECT_CHAIN);
    expect(h["server"]).toBe("last-hop");
    expect(h["cf-mitigated"]).toBe("challenge");
  });

  it("lowercases header names so lookup is stable across HTTP versions", () => {
    expect(parseHeaderDump("HTTP/2 200\r\nCF-Mitigated: challenge\r\n\r\n")["cf-mitigated"]).toBe("challenge");
  });

  it("skips 100 Continue blocks", () => {
    const dump = "HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 200 OK\r\nServer: real\r\n\r\n";
    expect(parseHeaderDump(dump)["server"]).toBe("real");
  });

  it("keeps the last value when a header repeats within one block", () => {
    expect(parseHeaderDump("HTTP/2 200\r\nx-a: one\r\nx-a: two\r\n\r\n")["x-a"]).toBe("two");
  });

  it("returns an empty object for an empty dump", () => {
    expect(parseHeaderDump("")).toEqual({});
  });
});
