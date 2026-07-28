import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/db";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 42;
const LINE = rgb(0.72, 0.76, 0.82);
const TEXT = rgb(0.08, 0.12, 0.2);
const MUTED = rgb(0.36, 0.43, 0.52);
const BRAND = rgb(0.04, 0.48, 0.36);
const AMBER = rgb(0.88, 0.62, 0.13);

function formatDate(date: Date) {
  return date.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function value(text?: string | number | null) {
  return text === null || text === undefined || text === "" ? "-" : String(text);
}

function drawTextBox({
  page,
  font,
  bold,
  label,
  text,
  x,
  y,
  width
}: {
  page: ReturnType<PDFDocument["addPage"]>;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  label: string;
  text?: string | number | null;
  x: number;
  y: number;
  width: number;
}) {
  page.drawRectangle({ x, y, width, height: 28, borderColor: LINE, borderWidth: 1 });
  page.drawRectangle({ x, y, width: 112, height: 28, color: rgb(0.91, 0.93, 0.95) });
  page.drawText(label, { x: x + 6, y: y + 10, size: 8, font: bold, color: TEXT });
  page.drawText(value(text).slice(0, 55), { x: x + 120, y: y + 10, size: 8.5, font, color: TEXT });
}

function drawWrappedText({
  page,
  text,
  x,
  y,
  maxWidth,
  font,
  size,
  lineHeight,
  color = TEXT
}: {
  page: ReturnType<PDFDocument["addPage"]>;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  size: number;
  lineHeight: number;
  color?: ReturnType<typeof rgb>;
}) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  let line = "";
  let currentY = y;

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      page.drawText(line, { x, y: currentY, size, font, color });
      currentY -= lineHeight;
      line = word;
    } else {
      line = next;
    }
  }

  if (line) page.drawText(line, { x, y: currentY, size, font, color });
  return currentY - lineHeight;
}

async function drawHeader(pdf: PDFDocument, page: ReturnType<PDFDocument["addPage"]>, bold: Awaited<ReturnType<PDFDocument["embedFont"]>>) {
  const logoPath = path.join(process.cwd(), "public", "edecoop-logo.png");
  try {
    const logoBytes = await fs.readFile(logoPath);
    const logo = await pdf.embedPng(logoBytes);
    page.drawImage(logo, { x: MARGIN, y: PAGE_HEIGHT - 82, width: 78, height: 50 });
  } catch {
    page.drawText("EDECOOP", { x: MARGIN, y: PAGE_HEIGHT - 60, size: 16, font: bold, color: BRAND });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const submission = await prisma.enrollmentSubmission.findUnique({
    where: { id },
    include: {
      form: true,
      raffleResult: true,
      digitalLink: { include: { result: true } }
    }
  });

  if (!submission || submission.deletedAt) {
    return NextResponse.json({ error: "Solicitud no disponible." }, { status: 404 });
  }

  const result = submission.raffleResult || submission.digitalLink?.result || null;
  const fullName = `${submission.firstName} ${submission.lastName}`.trim();
  const contact = process.env.PRIZE_CONTACT_WHATSAPP || "WhatsApp de EDECOOP";

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  await drawHeader(pdf, page, bold);

  page.drawText("SOLICITUD DE ADMISION", { x: 132, y: PAGE_HEIGHT - 48, size: 16, font: bold, color: TEXT });
  page.drawText("COOPERATIVA DE AHORROS Y CREDITOS EDECOOP", { x: 132, y: PAGE_HEIGHT - 64, size: 9, font: bold, color: MUTED });

  page.drawRectangle({ x: MARGIN, y: 612, width: PAGE_WIDTH - MARGIN * 2, height: 88, borderColor: LINE, borderWidth: 1, color: rgb(0.98, 0.99, 1) });
  drawWrappedText({
    page,
    text: `${submission.form.description} Autorizo a mi EMPLEADOR a descontar la suma equivalente al ${submission.salaryDeductionPercent.toString()} % de mi salario para ser depositados a mi cuenta de ahorros corriente y de capital.`,
    x: MARGIN + 10,
    y: 682,
    maxWidth: PAGE_WIDTH - MARGIN * 2 - 20,
    font,
    size: 7.8,
    lineHeight: 10
  });

  page.drawText("DATOS PERSONALES", { x: 245, y: 590, size: 11, font: bold, color: TEXT });
  let y = 554;
  const colWidth = 254;
  drawTextBox({ page, font, bold, label: "Nombres", text: submission.firstName, x: MARGIN, y, width: colWidth });
  drawTextBox({ page, font, bold, label: "Apellidos", text: submission.lastName, x: MARGIN + colWidth + 20, y, width: colWidth });
  y -= 34;
  drawTextBox({ page, font, bold, label: "Cedula No.", text: submission.documentId, x: MARGIN, y, width: colWidth });
  drawTextBox({ page, font, bold, label: "Numero flota", text: submission.residencePhone, x: MARGIN + colWidth + 20, y, width: colWidth });
  y -= 34;
  drawTextBox({ page, font, bold, label: "Celular", text: submission.mobilePhone, x: MARGIN, y, width: colWidth });
  drawTextBox({ page, font, bold, label: "Ciudad", text: submission.city, x: MARGIN + colWidth + 20, y, width: colWidth });
  y -= 34;
  drawTextBox({ page, font, bold, label: "Direccion", text: submission.address, x: MARGIN, y, width: PAGE_WIDTH - MARGIN * 2 });
  y -= 34;
  drawTextBox({ page, font, bold, label: "Estado Civil", text: submission.maritalStatus, x: MARGIN, y, width: colWidth });
  drawTextBox({ page, font, bold, label: "Conyuge", text: submission.spouseName, x: MARGIN + colWidth + 20, y, width: colWidth });

  y -= 52;
  page.drawText("DATOS DEL EMPLEADO", { x: 242, y: y + 22, size: 11, font: bold, color: TEXT });
  drawTextBox({ page, font, bold, label: "Empresa", text: submission.companyName, x: MARGIN, y, width: colWidth });
  drawTextBox({ page, font, bold, label: "Cargo", text: submission.position, x: MARGIN + colWidth + 20, y, width: colWidth });
  y -= 34;
  drawTextBox({ page, font, bold, label: "Dependencia", text: submission.department, x: MARGIN, y, width: colWidth });
  drawTextBox({ page, font, bold, label: "Oficina", text: submission.workplace, x: MARGIN + colWidth + 20, y, width: colWidth });
  y -= 34;
  drawTextBox({ page, font, bold, label: "Correo", text: submission.email, x: MARGIN, y, width: colWidth });
  drawTextBox({ page, font, bold, label: "Sueldo", text: `RD$ ${submission.monthlySalary.toString()}`, x: MARGIN + colWidth + 20, y, width: colWidth });
  y -= 34;
  drawTextBox({ page, font, bold, label: "NIE", text: submission.employeeNumber, x: MARGIN, y, width: colWidth });
  drawTextBox({ page, font, bold, label: "Cta Banco No.", text: submission.bankAccountNumber, x: MARGIN + colWidth + 20, y, width: colWidth });
  y -= 34;
  drawTextBox({ page, font, bold, label: "Nombre Banco", text: submission.bankName, x: MARGIN, y, width: PAGE_WIDTH - MARGIN * 2 });

  page.drawText(fullName, { x: MARGIN + 20, y: 86, size: 10, font: bold, color: TEXT });
  page.drawLine({ start: { x: MARGIN, y: 80 }, end: { x: 260, y: 80 }, thickness: 1, color: TEXT });
  page.drawText("Firma", { x: 130, y: 64, size: 9, font, color: MUTED });
  page.drawText(formatDate(submission.createdAt), { x: 366, y: 86, size: 10, font: bold, color: TEXT });
  page.drawLine({ start: { x: 326, y: 80 }, end: { x: PAGE_WIDTH - MARGIN, y: 80 }, thickness: 1, color: TEXT });
  page.drawText("Fecha", { x: 430, y: 64, size: 9, font, color: MUTED });

  if (result) {
    const prizePage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    await drawHeader(pdf, prizePage, bold);
    prizePage.drawText("CONSTANCIA DE PREMIO INSTANTANEO", { x: 122, y: PAGE_HEIGHT - 52, size: 16, font: bold, color: TEXT });
    prizePage.drawText(value(result.eventName || submission.eventEditionId), { x: 122, y: PAGE_HEIGHT - 70, size: 10, font, color: MUTED });

    prizePage.drawRectangle({ x: MARGIN, y: 500, width: PAGE_WIDTH - MARGIN * 2, height: 150, borderColor: rgb(0.72, 0.9, 0.82), borderWidth: 1.5, color: rgb(0.93, 0.99, 0.96) });
    prizePage.drawText("Premio ganado", { x: MARGIN + 24, y: 610, size: 11, font: bold, color: BRAND });
    prizePage.drawText(result.prizeName, { x: MARGIN + 24, y: 574, size: 26, font: bold, color: BRAND });
    prizePage.drawText("Codigo unico", { x: MARGIN + 24, y: 536, size: 11, font: bold, color: AMBER });
    prizePage.drawText(result.code, { x: MARGIN + 24, y: 512, size: 22, font: bold, color: rgb(0.42, 0.28, 0.05) });

    let prizeY = 446;
    prizePage.drawText("Datos del participante", { x: MARGIN, y: prizeY, size: 13, font: bold, color: TEXT });
    prizeY -= 34;
    drawTextBox({ page: prizePage, font, bold, label: "Participante", text: result.participantName, x: MARGIN, y: prizeY, width: PAGE_WIDTH - MARGIN * 2 });
    prizeY -= 34;
    drawTextBox({ page: prizePage, font, bold, label: "Telefono", text: result.participantPhone || submission.mobilePhone, x: MARGIN, y: prizeY, width: 254 });
    drawTextBox({ page: prizePage, font, bold, label: "NIE", text: result.participantNie || submission.employeeNumber, x: MARGIN + 274, y: prizeY, width: 254 });
    prizeY -= 34;
    drawTextBox({ page: prizePage, font, bold, label: "Correo", text: result.participantEmail || submission.email, x: MARGIN, y: prizeY, width: PAGE_WIDTH - MARGIN * 2 });
    prizeY -= 34;
    drawTextBox({ page: prizePage, font, bold, label: "Fecha premio", text: result.createdAt.toLocaleString("es-DO"), x: MARGIN, y: prizeY, width: PAGE_WIDTH - MARGIN * 2 });

    prizePage.drawRectangle({ x: MARGIN, y: 122, width: PAGE_WIDTH - MARGIN * 2, height: 96, borderColor: rgb(0.98, 0.78, 0.38), borderWidth: 1, color: rgb(1, 0.98, 0.9) });
    drawWrappedText({
      page: prizePage,
      text: `Favor comunicarse al ${contact} para programar la entrega del premio. En caso de no contactarnos, el equipo de EDECOOP intentara contactarle dentro de 24 a 72 horas.`,
      x: MARGIN + 18,
      y: 186,
      maxWidth: PAGE_WIDTH - MARGIN * 2 - 36,
      font: bold,
      size: 12,
      lineHeight: 16,
      color: rgb(0.36, 0.24, 0.04)
    });
  }

  const bytes = await pdf.save();
  const fileName = result ? `solicitud-premio-${submission.id}.pdf` : `solicitud-afiliacion-${submission.id}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`
    }
  });
}
