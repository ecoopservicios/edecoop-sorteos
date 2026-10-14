import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { souvenirPrintUnits, type SouvenirPrintMember } from "@/lib/souvenir-print";

export const officeLabel = (office: string | null) => office?.trim().replace(/\s+/g, " ") || "SIN OFICINA ASIGNADA";
export const officeKey = (office: string | null) => officeLabel(office).normalize("NFC").toLocaleUpperCase("es");

function wrap(text: string, font: PDFFont, width: number, size: number) {
  const lines: string[] = [];
  let line = "";
  for (const character of text.replace(/[\r\n\t]/g, " ")) {
    if (line && font.widthOfTextAtSize(line + character, size) > width) { lines.push(line); line = ""; }
    line += character;
  }
  lines.push(line);
  return lines;
}

export async function createSouvenirOfficePdf(office: string, members: SouvenirPrintMember[], showPageNumbers = true) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all(["Vera.ttf", "VeraBd.ttf"].map(name => readFile(path.join(process.cwd(), "public", "fonts", name))));
  const font = await pdf.embedFont(regular, { subset: true });
  const headingFont = await pdf.embedFont(bold, { subset: true });
  const widths = [32, 125, 145, 90, 78, 95, 171];
  const labels = ["No.", "Nombres", "Apellidos", "Cédula", "No. empleado", "Empresa", "Firma"];
  const size = 8, leading = 11, margin = 28, bottom = 38;
  type Row = { lines: string[][]; height: number };
  const chunks: { rows: Row[]; unit: string | null; unitTotal: number }[] = [];
  for (const section of souvenirPrintUnits(members)) {
  let chunk: { lines: string[][]; height: number }[] = [], used = 0;
  const capacity = section.unit ? 436 : 466;
  for (const member of section.members) {
    const values = [String(member.listNumber), member.firstName, member.lastName, member.displayDocumentId || "-", member.employeeNumber || "-", member.companyName, ""];
    const lines = values.map((value, i) => wrap(value, font, widths[i] - 10, size));
    const height = Math.max(42, Math.max(...lines.map(l => l.length)) * leading + 12);
    if (height > capacity) throw new Error(`El socio ${member.listNumber} tiene un dato demasiado extenso para imprimir.`);
    if (chunk.length && used + height > capacity) { chunks.push({ rows: chunk, unit: section.unit, unitTotal: section.members.length }); chunk = []; used = 0; }
    chunk.push({ lines, height }); used += height;
  }
  if (chunk.length) chunks.push({ rows: chunk, unit: section.unit, unitTotal: section.members.length });
  }
  chunks.forEach(({ rows, unit, unitTotal }, pageIndex) => {
    const page = pdf.addPage([792, 612]);
    page.drawText("Entrega de Souvenir Aniversario · EDECOOP", { x: margin, y: 580, size: 13, font: headingFont });
    const officeLines = wrap(`Oficina: ${office}`, headingFont, 540, 9);
    // Long office labels stay inside the header instead of covering the table.
    if (officeLines.length > 2) throw new Error("El nombre de la oficina es demasiado largo para el encabezado.");
    officeLines.forEach((line, i) => page.drawText(line, { x: margin, y: 561 - i * 12, size: 9, font: headingFont }));
    page.drawText(`Cantidad: ${members.length} socios`, { x: 635, y: 561, size: 9, font });
    if (unit) {
      const unitLines = wrap(`Unidad: ${unit}`, headingFont, 540, 9);
      if (unitLines.length > 3) throw new Error("El nombre de la unidad es demasiado largo para el encabezado.");
      unitLines.forEach((line, i) => page.drawText(line, { x: margin, y: 532 - i * 11, size: 9, font: headingFont }));
      page.drawText(`Socios en unidad: ${unitTotal}`, { x: 635, y: 532, size: 9, font });
    }
    let y = unit ? 500 : 530;
    function cellRow(lines: string[][], height: number, header = false) {
      let x = margin;
      lines.forEach((values, i) => {
        page.drawRectangle({ x, y: y - height, width: widths[i], height, borderWidth: 0.5, borderColor: rgb(0.25, 0.25, 0.25), ...(header ? { color: rgb(0.93, 0.95, 0.94) } : {}) });
        values.forEach((line, j) => page.drawText(line, { x: x + 5, y: y - 12 - j * leading, size, font: header ? headingFont : font }));
        x += widths[i];
      });
      y -= height;
    }
    cellRow(labels.map(label => [label]), 26, true);
    rows.forEach(row => cellRow(row.lines, row.height));
    if (showPageNumbers) page.drawText(`Página ${pageIndex + 1} de ${chunks.length}`, { x: 670, y: bottom - 14, size: 8, font });
  });
  pdf.setTitle(`Souvenir Aniversario EDECOOP - ${office}`);
  return pdf.save();
}

export async function createSouvenirListPdf(groups: { office: string; members: SouvenirPrintMember[] }[]) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  for (const group of [...groups].sort((a, b) => Math.min(...a.members.map(m => m.listNumber)) - Math.min(...b.members.map(m => m.listNumber)))) {
    const officeDocument = await PDFDocument.load(await createSouvenirOfficePdf(group.office, group.members, false));
    const pages = await document.copyPages(officeDocument, officeDocument.getPageIndices());
    pages.forEach(page => document.addPage(page));
  }
  const font = await document.embedFont(await readFile(path.join(process.cwd(), "public", "fonts", "Vera.ttf")), { subset: true });
  const pages = document.getPages();
  pages.forEach((page, index) => page.drawText(`Página ${index + 1} de ${pages.length}`, { x: 670, y: 24, size: 8, font }));
  document.setTitle("Entrega de Souvenir Aniversario EDECOOP");
  return document.save();
}
