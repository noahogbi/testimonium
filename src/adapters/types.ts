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
  readonly body: string;
}
