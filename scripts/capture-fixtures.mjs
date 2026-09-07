/**
 * Capture the document half of the fixture corpus. RUN BY HAND, ONCE.
 * The test suite never invokes this: unit tests do not touch the network.
 *
 *   node scripts/capture-fixtures.mjs
 *
 * Add URLs to DOCUMENTS below. Prefer sources this tool will actually meet:
 * a government release, a wire story, a long technical post, a reference page,
 * a statistical bulletin.
 *
 * TWO RULES, both learned the hard way when a first draft of this list made
 * Task 4's gate unsatisfiable:
 *
 * 1. NO STUB PAGES. A discussion-thread permalink extracted to 513 characters,
 *    BELOW the largest challenge shell in the battery (982). One such entry
 *    makes the two populations overlap, and Task 4 then reports "the signal
 *    design is wrong" when the design is fine and the corpus is not.
 * 2. NO HOSTS KNOWN TO CHALLENGE. eur-lex serves a bot interstitial - it is a
 *    CHALLENGE fixture, not a document one. If a capture here returns a wall,
 *    that is a finding: file it under fixtures/challenge/ instead.
 *
 * Capture more than the minimum. The assertion floor is 8 documents; this list
 * has 12 so a couple of failed captures do not break the gate.
 */
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";

const DOCUMENTS = [
  "https://blog.cloudflare.com/cloudflare-incident-on-november-18-2025/",
  "https://www.theverge.com/tech",
  "https://openai.com/index/gpt-4o-system-card/",
  "https://www.federalregister.gov/documents/2024/01/29/2024-01580/",
  "https://apnews.com/hub/technology",
  "https://www.gov.uk/government/news",
  "https://en.wikipedia.org/wiki/Textual_criticism",
  "https://docs.python.org/3/library/json.html",
  "https://www.bls.gov/news.release/cpi.nr0.htm",
  "https://blog.mozilla.org/en/",
  "https://www.ecb.europa.eu/press/pr/date/2024/html/index.en.html",
  "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

mkdirSync("fixtures/documents", { recursive: true });
const manifest = JSON.parse(readFileSync("fixtures/corpus.json", "utf8"));

for (const url of DOCUMENTS) {
  const slug = url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").slice(0, 60);
  const path = `fixtures/documents/${slug}.html`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    const body = await r.text();
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1]?.trim() ?? "";
    writeFileSync(path, body, "utf8");
    manifest.push({ path, kind: "document", url, title });
    console.log(`captured ${r.status} ${body.length} bytes -> ${path}`);
  } catch (e) {
    // A capture failure is a fact about today's web, not an error. Record it
    // by hand as a challenge fixture if the body was a wall.
    console.log(`SKIP ${url}: ${e instanceof Error ? e.message : String(e)}`);
  }
  await new Promise((r) => setTimeout(r, 800));
}

writeFileSync("fixtures/corpus.json", `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`corpus now holds ${manifest.length} fixtures`);
