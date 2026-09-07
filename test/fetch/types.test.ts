import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

/** Strip comments so the enforcement tests read CODE, not prose. The doc
 *  comment in types.ts necessarily says the words "ok" and "http2xx" in order
 *  to explain why they are absent, and a naive grep fails on its own
 *  explanation. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("RawResponse type", () => {
  it("declares no ok or http2xx field", () => {
    // The keystone guarantee was once a single untested boolean literal set in
    // IO code. It is now impossible to set one there: the field is gone.
    const src = code("src/fetch/types.ts");
    expect(src).not.toMatch(/\bok\s*[?:]/);
    expect(src).not.toMatch(/\bhttp2xx\b/);
  });

  it("NO file under src/fetch produces an ok or http2xx value", () => {
    // A directory scan, not an enumerated list: a list exempts every rung file
    // added later, which is precisely when this guarantee needs enforcing.
    const files = readdirSync("src/fetch").filter((f) => f.endsWith(".ts"));
    // 5 at this task: types, node, curl, pdf, default-fetcher. ladder.ts
    // arrives in Task 8. The floor exists so the scan cannot silently pass
    // against an empty directory.
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const f of files) {
      expect(code(`src/fetch/${f}`), f).not.toMatch(/\bhttp2xx\b/);
      expect(code(`src/fetch/${f}`), f).not.toMatch(/\bok\s*[?:]/);
    }
  });
});
