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
});
