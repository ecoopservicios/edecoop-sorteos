import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { SouvenirPrintMember } from "@/lib/souvenir-print";

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

export async function createSouvenirLocationPdf(location: string, members: SouvenirPrintMember[], showPageNumbers = true) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all(["Vera.ttf", "VeraBd.ttf"].map(name => readFile(path.join(process.cwd(), "public", "fonts", name))));
  const font = await pdf.embedFont(regular, { subset: true });
  const headingFont = await pdf.embedFont(bold, { subset: true });
  const widths = [25, 130, 165, 100, 80, 80, 188];
  const labels = ["No.", "Nombres", "Apellidos", "Cédula", "No. empleado", "Empresa", "Firma"];
  const size = 7.5, margin = 12, bottom = 8;
  type Cell = { lines: string[]; size: number };
  type Row = { cells: Cell[]; height: number };
  const header = [
    { text: "Entrega de Souvenir Aniversario · EDECOOP", width: 210, maxSize: 8 },
    { text: "Empresa: " + (members[0]?.companyName || ""), width: 95, maxSize: 7 },
    { text: "Ubicación: " + location, width: 385, maxSize: 7 },
    { text: members.length + " socios", width: 78, maxSize: 7 }
  ].map(item => {
    const textSize = Math.max(6, Math.min(item.maxSize, (item.width - 6) / Math.max(1, headingFont.widthOfTextAtSize(item.text, 1))));
    return { ...item, size: textSize, lines: wrap(item.text, headingFont, item.width - 6, textSize) };
  });
  const headerHeight = Math.max(12, ...header.map(item => item.lines.length * (item.size + 1) + 3));
  const tableTop = 596 - headerHeight;
  const columnHeight = 14;
  const capacity = tableTop - columnHeight - 18;
  const rowHeight = Math.min(11, capacity / 50);
  const chunks: Row[][] = [];
  let chunk: Row[] = [], used = 0;
  for (const member of [...members].sort((a, b) => a.listNumber - b.listNumber)) {
    const values = [String(member.listNumber), member.firstName, member.lastName, member.displayDocumentId || "-", member.employeeNumber || "-", member.companyName, ""];
    const cells = values.map((value, i) => {
      const cellSize = Math.max(6, Math.min(size, (widths[i] - 6) / Math.max(1, font.widthOfTextAtSize(value, 1))));
      return { lines: wrap(value, font, widths[i] - 6, cellSize), size: cellSize };
    });
    const height = Math.max(rowHeight, ...cells.map(cell => cell.lines.length * (cell.size + 0.5) + 2));
    if (height > capacity) throw new Error("El socio " + member.listNumber + " tiene un dato demasiado extenso para imprimir.");
    if (chunk.length && (chunk.length >= 50 || used + height > capacity + 0.01)) { chunks.push(chunk); chunk = []; used = 0; }
    chunk.push({ cells, height }); used += height;
  }
  if (chunk.length) chunks.push(chunk);
  chunks.forEach((rows, pageIndex) => {
    const page = pdf.addPage([792, 612]);
    let headerX = margin;
    header.forEach(item => {
      item.lines.forEach((line, index) => page.drawText(line, { x: headerX + 2, y: 598 - index * (item.size + 1), size: item.size, font: headingFont }));
      headerX += item.width;
    });
    let y = tableTop;
    function cellRow(cells: Cell[], height: number, header = false) {
      let x = margin;
      cells.forEach((cell, i) => {
        page.drawRectangle({ x, y: y - height, width: widths[i], height, borderWidth: 0.35, borderColor: rgb(0.25, 0.25, 0.25), ...(header ? { color: rgb(0.93, 0.95, 0.94) } : {}) });
        const leading = cell.size + 0.5;
        const firstBaseline = y - (height - cell.lines.length * leading) / 2 - cell.size;
        cell.lines.forEach((line, j) => page.drawText(line, { x: x + 3, y: firstBaseline - j * leading, size: cell.size, font: header ? headingFont : font }));
        x += widths[i];
      });
      y -= height;
    }
    cellRow(labels.map(label => ({ lines: [label], size: 7 })), columnHeight, true);
    rows.forEach(row => cellRow(row.cells, row.height));
    if (showPageNumbers) page.drawText(`Página ${pageIndex + 1} de ${chunks.length}`, { x: 710, y: bottom, size: 6, font });
  });
  pdf.setTitle(`Souvenir Aniversario EDECOOP - ${location}`);
  return pdf.save();
}

export async function createSouvenirListPdf(groups: { location: string; members: SouvenirPrintMember[] }[]) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  for (const group of [...groups].sort((a, b) => Math.min(...a.members.map(m => m.listNumber)) - Math.min(...b.members.map(m => m.listNumber)))) {
    const officeDocument = await PDFDocument.load(await createSouvenirLocationPdf(group.location, group.members, false));
    const pages = await document.copyPages(officeDocument, officeDocument.getPageIndices());
    pages.forEach(page => document.addPage(page));
  }
  const font = await document.embedFont(await readFile(path.join(process.cwd(), "public", "fonts", "Vera.ttf")), { subset: true });
  const pages = document.getPages();
  pages.forEach((page, index) => page.drawText(`Página ${index + 1} de ${pages.length}`, { x: 710, y: 8, size: 6, font }));
  document.setTitle("Entrega de Souvenir Aniversario EDECOOP");
  return document.save();
}
