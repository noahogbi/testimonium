/** A numeric entity's code point as a character, leaving the raw entity in
 *  place when it is out of range so a malformed entity cannot throw mid-run. */
function entityChar(n: number, raw: string): string {
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : raw;
}

/** HTML to visible prose. Script and style bodies are removed before tags are
 *  stripped, or their contents would land in the extracted text and a claim
 *  could "match" against a JSON blob. */
export function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#8217;|&rsquo;|&#39;|&apos;/g, "’")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&quot;/g, '"')
    .replace(/&#8212;|&mdash;/g, "--")
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (raw, h: string) => entityChar(parseInt(h, 16), raw))
    .replace(/&#(\d+);/g, (raw, d: string) => entityChar(Number(d), raw))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
