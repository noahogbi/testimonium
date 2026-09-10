import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import {
  ARCHIVE_VERSION,
  archiveKeyFor,
  blobHash,
  blobRelPath,
  claimsHashFor,
  sha256Hex,
  withoutSetCookie,
} from "../../src/archive/format.js";
import { parseGfmFootnotes } from "../../src/adapters/gfm-footnotes.js";
import { joinClaims, normalizeUrl, parseClaimsFile } from "../../src/io/claims.js";

// The as-cited spelling and the claims-file spelling of ONE resource. They
// differ in host casing and in a tracking parameter, which is exactly what
// normalizeUrl folds away.
const AS_CITED = "https://Example.COM/report?utm_source=news&id=7";
const AS_CLAIMED = "https://example.com/report?id=7";
const MD = ["The claim.[^1]", "", `[^1]: A report, ${AS_CITED}`, ""].join("\n");
const CLAIMS_JSON = JSON.stringify({ [AS_CLAIMED]: ["spending rose sharply here"] });

describe("the archive format", () => {
  it("stamps version 1, the same shape the evidence file already carries", () => {
    expect(ARCHIVE_VERSION).toBe(1);
  });

  it("keys by normalizeUrl, not by the URL as cited", () => {
    expect(archiveKeyFor(AS_CITED)).toBe(normalizeUrl(AS_CITED));
    expect(archiveKeyFor(AS_CITED)).not.toBe(AS_CITED);
  });

  it("keys by the SAME key joinClaims uses, or the baseline is silently missed", () => {
    // THE TRAP WITH A LIVE MECHANISM. joinClaims keys by normalizeUrl and
    // hands check() the as-cited spelling, which is what reaches
    // CitationResult.url. An archive keyed off the result would file this
    // resource under a second entry and recheck would report "no baseline"
    // forever while exiting 0. The mutation this catches:
    // `archiveKeyFor = (url) => url`.
    const joined = joinClaims(parseGfmFootnotes(MD).footnotes, parseClaimsFile(CLAIMS_JSON));
    expect(joined.checkable).toHaveLength(1);
    expect(joined.orphanedClaims).toEqual([]);
    const cited = joined.checkable[0]?.url ?? "";
    expect(cited).toBe(AS_CITED);
    expect([archiveKeyFor(cited)]).toEqual([...parseClaimsFile(CLAIMS_JSON).keys()]);
  });

  it("hashes a blob over the raw body, NOT over the gzip", () => {
    // Hashing the .gz would make the digest a function of the zlib version
    // and break idempotency across machines for identical content: every CI
    // runner with a different zlib would add a blob for a source nobody
    // edited. The mutation this catches: `blobHash = (b) => sha256Hex(gzipSync(b))`.
    const body = "the committee reported that spending rose sharply";
    expect(blobHash(body)).toBe(sha256Hex(body));
    expect(blobHash(body)).not.toBe(sha256Hex(gzipSync(Buffer.from(body, "utf8"))));
  });

  it("produces 64 lower-case hex characters", () => {
    expect(blobHash("x")).toMatch(/^[0-9a-f]{64}$/);
    expect(blobHash("x")).toBe(blobHash("x"));
    expect(blobHash("x")).not.toBe(blobHash("y"));
  });

  it("shards a blob path on the first two hex characters of its hash", () => {
    const h = blobHash("the committee report");
    expect(blobRelPath(h)).toBe(`blobs/${h.slice(0, 2)}/${h}.gz`);
    expect(blobRelPath(h).startsWith(`blobs/${h[0]}${h[1]}/`)).toBe(true);
  });

  it("hashes claims order-insensitively, because reordering changes nothing that is checked", () => {
    // The mutation this catches: dropping `.sort()`.
    expect(claimsHashFor(["alpha claim here", "beta claim here"])).toBe(
      claimsHashFor(["beta claim here", "alpha claim here"]),
    );
  });

  it("hashes claims through norm(), so an invisible whitespace edit is not a claims change", () => {
    // norm() because it is what the MATCHER runs, so the hash tracks exactly
    // the text a verdict depends on (the same reasoning as 7.3's floor).
    // The mutation this catches: dropping `.map(norm)`.
    expect(claimsHashFor(["spending  rose   sharply"])).toBe(claimsHashFor(["spending rose sharply"]));
    expect(claimsHashFor(["spending rose sharply"])).toBe(claimsHashFor(["Spending Rose Sharply"]));
  });

  it("NEGATIVE CONTROL: a real edit to a claim does change the hash", () => {
    // Without this, a claimsHashFor that returned a constant would pass every
    // test above.
    expect(claimsHashFor(["spending rose sharply"])).not.toBe(claimsHashFor(["spending fell sharply"]));
    expect(claimsHashFor(["one claim here"])).not.toBe(claimsHashFor(["one claim here", "two claims here"]));
  });

  it("never stores set-cookie, in any casing", () => {
    // These files are committed and a session cookie in git is a credential
    // leak. Key casing does not matter to the classifier (computeSignals
    // lowercases every field name), so a fetcher may hand back any casing and
    // the denylist has to be case-insensitive too. The mutation this catches:
    // `if (k !== "set-cookie") continue;`.
    const out = withoutSetCookie({
      "Set-Cookie": "session=abc123",
      "set-cookie": "other=def456",
      "SET-COOKIE": "third=ghi789",
      "content-type": "text/html; charset=utf-8",
      "CF-Mitigated": "challenge",
    });
    expect(JSON.stringify(out)).not.toContain("abc123");
    expect(JSON.stringify(out)).not.toContain("def456");
    expect(JSON.stringify(out)).not.toContain("ghi789");
    expect(Object.keys(out).map((k) => k.toLowerCase())).not.toContain("set-cookie");
  });

  it("keeps every other header verbatim - a denylist, not an allowlist", () => {
    // Not an allowlist: the header vetoes are dated data that rot and get
    // added to (7.2), so a set frozen today would leave a rule added tomorrow
    // unable to fire on an archived read, and the control arm would answer
    // with a veto the live arm no longer agrees with. The mutation this
    // catches: an allowlist of today's two veto headers.
    expect(withoutSetCookie({ "CF-Mitigated": "challenge", "x-future-veto": "yes", "content-type": "text/html" })).toEqual({
      "CF-Mitigated": "challenge",
      "x-future-veto": "yes",
      "content-type": "text/html",
    });
  });
});
