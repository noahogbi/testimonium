export interface Footnote {
  /** Position in the document, 1-based. NOT the label - claims key by URL, so
   *  this number is presentational and renumbering is harmless. */
  readonly n: number;
  /** null for a footnote with no external source: an internal cross-link, or a
   *  citation with only a back-reference. Marked not applicable, never fetched. */
  readonly url: string | null;
  readonly label: string;
}

export interface Document {
  readonly footnotes: Footnote[];
  /** The ORIGINAL markdown, line endings intact. */
  readonly body: string;
  /** The document's own words: `body` with fenced code blanked and every
   *  footnote DEFINITION removed, line endings normalized to LF.
   *
   *  This is what `harvest` compares against a source (spec 8.2 step 1). A
   *  definition's continuation lines carry the source's title, its URL and
   *  sometimes a quoted passage - text the author copied FROM the source,
   *  which harvest would otherwise propose back to her as a claim she had
   *  made. Fenced code is blanked for the same reason a code sample is not a
   *  citation. Both use the parser's own passes; a second regex would drift. */
  readonly prose: string;
}
