/**
 * Minimal single-page PDF writer for the mock invoice download (Helvetica, Latin text only).
 * The real backend produces the final bilingual invoice PDF; Arabic cannot be drawn with the built-in PDF fonts,
 * so the mock prints the English description.
 */
const esc = (s: string) => s.replace(/[^\x20-\x7E]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export function simplePdf(lines: { text: string; size?: number; bold?: boolean; gap?: number }[]): Buffer {
  let y = 790;
  const ops: string[] = [];
  for (const l of lines) {
    const size = l.size ?? 11;
    ops.push(`BT /${l.bold ? "F2" : "F1"} ${size} Tf 56 ${y} Td (${esc(l.text)}) Tj ET`);
    y -= size + 8 + (l.gap ?? 0);
  }
  const stream = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
