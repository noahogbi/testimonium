import { describe, it, expect } from "vitest";
import { toText } from "../../src/text/extract.js";

const BODY = "<html><body><p>Visible body text.</p></body></html>";

describe("toText: description attributes", () => {
  it("reads name=description", () => {
    const h = `<meta name="description" content="A harvested sentence."></head>${BODY}`;
    expect(toText(h)).toContain("A harvested sentence.");
  });

  it("reads property=og:description, which does NOT use name=", () => {
    const h = `<meta property="og:description" content="Open graph sentence.">${BODY}`;
    expect(toText(h)).toContain("Open graph sentence.");
  });

  it("reads twitter:description", () => {
    const h = `<meta name="twitter:description" content="Twitter sentence.">${BODY}`;
    expect(toText(h)).toContain("Twitter sentence.");
  });

  it("does not assume attribute order - content may come first", () => {
    const h = `<meta content="Order-swapped sentence." name="description">${BODY}`;
    expect(toText(h)).toContain("Order-swapped sentence.");
  });

  it("accepts single quotes", () => {
    const h = `<meta name='description' content='Single quoted sentence.'>${BODY}`;
    expect(toText(h)).toContain("Single quoted sentence.");
  });

  it("decodes entities inside content", () => {
    const h = `<meta name="description" content="Tom &amp; Jerry &#8212; a pair.">${BODY}`;
    const out = toText(h);
    expect(out).toContain("Tom & Jerry");
    expect(out).not.toContain("&amp;");
    expect(out).toContain(String.fromCodePoint(0x2014));
  });

  it("DEDUPLICATES the three tags when they carry the same sentence", () => {
    const s = "One sentence, three tags.";
    const h = `<meta name="description" content="${s}">` +
              `<meta property="og:description" content="${s}">` +
              `<meta name="twitter:description" content="${s}">${BODY}`;
    const out = toText(h);
    // Counting occurrences, not just presence: triple-counting inflates prose
    // toward the floor and toward srccheck's originality haystack.
    expect(out.split(s).length - 1).toBe(1);
  });

  it("keeps three DISTINCT description values, rather than only the first tag", () => {
    const h = `<meta name="description" content="First distinct sentence.">` +
              `<meta property="og:description" content="Second distinct sentence.">` +
              `<meta name="twitter:description" content="Third distinct sentence.">${BODY}`;
    const out = toText(h);
    expect(out).toContain("First distinct sentence.");
    expect(out).toContain("Second distinct sentence.");
    expect(out).toContain("Third distinct sentence.");
  });

  it("APPENDS, never prepends - body text must still be found first", () => {
    const h = `<meta name="description" content="Description first in source.">${BODY}`;
    const out = toText(h);
    expect(out.indexOf("Visible body text")).toBeLessThan(out.indexOf("Description first in source"));
  });

  it("ignores a meta tag that is not a description", () => {
    const h = `<meta name="viewport" content="width=device-width">${BODY}`;
    expect(toText(h)).not.toContain("width=device-width");
  });

  it("leaves a page with no description byte-identical", () => {
    expect(toText(BODY)).toBe("Visible body text.");
  });

  it("does NOT harvest a meta tag that exists only inside a script body", () => {
    // Text no reader ever sees. Harvesting it would feed the classifier prose
    // that is not on the page - a route to a false `supported`.
    const h = `<head><script>document.write('<meta name="description" content="INJECTED">');</script></head>${BODY}`;
    expect(toText(h)).not.toContain("INJECTED");
  });

  it("does NOT harvest a meta inside an inert <template>", () => {
    const h = `<head><template><meta name="description" content="TEMPLATE_INJECTED"></template></head>${BODY}`;
    expect(toText(h)).not.toContain("TEMPLATE_INJECTED");
  });

  it("does NOT harvest a commented-out meta", () => {
    // Stale meta tags left in comments are ordinary in CMS output.
    const h = `<head><!-- <meta name="description" content="COMMENT_INJECTED"> --></head>${BODY}`;
    expect(toText(h)).not.toContain("COMMENT_INJECTED");
  });

  it("does NOT harvest a commented-out meta when the comment contains an earlier >", () => {
    // The quote-aware scan alone does NOT close this one - the comment strip does.
    const h = `<head><!-- a > b <meta name="description" content="COMMENT_GT"> --></head>${BODY}`;
    expect(toText(h)).not.toContain("COMMENT_GT");
  });

  it("does NOT harvest a meta-shaped string sitting in another tag's attribute", () => {
    // Markup as data, not an element. The strips do NOT close this one - the scan does.
    const h = `<div data-raw='<meta name="description" content="ATTR_INJECTED">'>hi</div>${BODY}`;
    expect(toText(h)).not.toContain("ATTR_INJECTED");
  });

  it("DOES still harvest a meta inside <noscript>", () => {
    // We fetch without running JS, so noscript content is precisely what our
    // reader sees. Excluding it would discard real prose.
    const h = `<head><noscript><meta name="description" content="Noscript sentence."></noscript></head>${BODY}`;
    expect(toText(h)).toContain("Noscript sentence.");
  });

  it("DOES harvest a genuine description whose content contains >", () => {
    // Fixed by the scan; the old tag regex truncated the tag and harvested nothing.
    const h = `<head><meta name="description" content="Rates a > b explained."></head>${BODY}`;
    expect(toText(h)).toContain("Rates a > b explained.");
  });

  it("does NOT harvest a meta inside an UNCLOSED <template>", () => {
    const h = `<head><template><meta name="description" content="TEMPLATE_UNCLOSED"></head>${BODY}`;
    expect(toText(h)).not.toContain("TEMPLATE_UNCLOSED");
  });

  it("does NOT harvest a meta inside an UNCLOSED comment containing an earlier >", () => {
    const h = `<head><!-- a > b <meta name="description" content="COMMENT_UNCLOSED"></head>${BODY}`;
    expect(toText(h)).not.toContain("COMMENT_UNCLOSED");
  });

  it("does NOT harvest a meta inside an UNCLOSED script containing an earlier >", () => {
    // The script strip predates this release, but the harvest is what turns it
    // into a route to a false `supported`, so it is closed on the harvest side.
    const h = `<head><script>x > 1; document.write(0);<meta name="description" content="SCRIPT_UNCLOSED"></head>${BODY}`;
    expect(toText(h)).not.toContain("SCRIPT_UNCLOSED");
  });

  it("still harvests normally when an unrelated comment IS closed", () => {
    // Guards against the tolerant `$` alternation over-matching and swallowing
    // the document from the first comment onward.
    const h = `<head><!-- housekeeping --><meta name="description" content="Genuine after comment."></head>${BODY}`;
    expect(toText(h)).toContain("Genuine after comment.");
  });

  it("does NOT treat a keywords tag as a description", () => {
    const h = `<meta name="keywords" content="'x' name='description' LEAKED">${BODY}`;
    expect(toText(h)).not.toContain("LEAKED");
  });

  it("does NOT accept data-content as content, and keeps the real description", () => {
    const h = `<meta name="description" data-content="WRONG" content="THE REAL ONE">${BODY}`;
    const out = toText(h);
    expect(out).not.toContain("WRONG");
    expect(out).toContain("THE REAL ONE");
  });

  it("does NOT accept a content= that lives inside another attribute's value", () => {
    const h = `<meta name="description" title='use content="INJECTED" here' content="THE REAL ONE">${BODY}`;
    const out = toText(h);
    expect(out).not.toContain("INJECTED");
    expect(out).toContain("THE REAL ONE");
  });

  it("matches attribute VALUES case-insensitively, not just names", () => {
    // Ordinary legacy CMS output. A parser that lowercases names but compares
    // the value with === "description" drops these silently.
    expect(toText(`<meta name="DeScRiPtIoN" content="Mixed name.">${BODY}`)).toContain("Mixed name.");
    expect(toText(`<meta property="OG:Description" content="Mixed prop.">${BODY}`)).toContain("Mixed prop.");
    expect(toText(`<META name="description" content="Upper tag.">${BODY}`)).toContain("Upper tag.");
  });

  it("permits whitespace around =", () => {
    expect(toText(`<meta name = "description" content = "Spaced.">${BODY}`)).toContain("Spaced.");
  });

  it("still does NOT harvest unquoted attribute values", () => {
    // Preserves 0.5.0 behaviour exactly; spec section 7 discloses it.
    expect(toText(`<meta name=description content=UNQUOTED>${BODY}`)).not.toContain("UNQUOTED");
  });

  it("takes the FIRST duplicate content attribute", () => {
    const h = `<meta name="description" content="DUP_FIRST" content="DUP_SECOND">${BODY}`;
    const out = toText(h);
    expect(out).toContain("DUP_FIRST");
    expect(out).not.toContain("DUP_SECOND");
  });

  it("treats a trailing / as inert", () => {
    // The no-space form appears in fixtures/documents/apnews-com-hub-technology.html.
    expect(toText(`<meta name="twitter:description" content="Self closed."/>${BODY}`)).toContain("Self closed.");
  });

  it("micro-divergence: trims the key, so padded whitespace around the value now matches", () => {
    // 0.5.0's substring regex did not trim; this parser's `.trim()` on the key
    // is strictly more permissive and matches what a browser does. Decided,
    // not overlooked - see the comment above the filter in descriptionText.
    expect(toText(`<meta name=" description " content="Padded name.">${BODY}`)).toContain("Padded name.");
  });

  it("micro-divergence: prefers property over name when name is not a description value", () => {
    // 0.5.0's IS_DESCRIPTION regex matched `property="og:description"` as a
    // substring anywhere in the tag, so a tag also carrying name="author"
    // still harvested. Preferring `name` blindly here would silently drop it;
    // the candidates fallback keeps 0.5.0's behaviour.
    const h = `<meta name="author" property="og:description" content="Author plus OG.">${BODY}`;
    expect(toText(h)).toContain("Author plus OG.");
  });
});
