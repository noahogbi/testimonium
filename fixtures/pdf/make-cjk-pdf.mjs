// Writes fixtures/pdf/cjk.pdf: a minimal hand-built PDF with one line of
// Chinese and one line of accented Latin. No embedded font program - the
// Chinese line uses Helvetica with a ToUnicode CMap mapping single-byte codes
// to CJK code points, which is all a text extractor reads. Run with
// `node fixtures/pdf/make-cjk-pdf.mjs` to regenerate.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const CJK_LINE = "技术创新，探索通用人工智能发展路径";
export const LATIN1_LINE = "Café déjà vu, naïve façade";

const cps = [...CJK_LINE].map((c) => c.codePointAt(0));
const codes = cps.map((_, i) => 0x41 + i);
const hex = (n, w) => n.toString(16).toUpperCase().padStart(w, "0");

const cmap = [
  "/CIDInit /ProcSet findresource begin",
  "12 dict begin",
  "begincmap",
  "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
  "/CMapName /Testimonium-CJK def",
  "/CMapType 2 def",
  "1 begincodespacerange <00> <FF> endcodespacerange",
  `${cps.length} beginbfchar`,
  ...cps.map((cp, i) => `<${hex(codes[i], 2)}> <${hex(cp, 4)}>`),
  "endbfchar",
  "endcmap",
  "CMapName currentdict /CMap defineresource pop",
  "end",
  "end",
].join("\n");

// WinAnsiEncoding: the accented letters are single bytes, written as octal escapes.
const latin = [...LATIN1_LINE]
  .map((c) => {
    const n = c.charCodeAt(0);
    return n > 0x7e ? "\\" + n.toString(8) : c.replace(/[()\\]/g, "\\$&");
  })
  .join("");
const cjk = codes.map((c) => String.fromCharCode(c)).join("");
const content = `BT /F2 18 Tf 72 720 Td (${cjk}) Tj ET\nBT /F1 18 Tf 72 680 Td (${latin}) Tj ET`;

const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
  `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /ToUnicode 7 0 R >>",
  `<< /Length ${Buffer.byteLength(cmap, "latin1")} >>\nstream\n${cmap}\nendstream`,
];

let out = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(Buffer.byteLength(out, "latin1"));
  out += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = Buffer.byteLength(out, "latin1");
out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL("./cjk.pdf", import.meta.url), Buffer.from(out, "latin1"));
}
