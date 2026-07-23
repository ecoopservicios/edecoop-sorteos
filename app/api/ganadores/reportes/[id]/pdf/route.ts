import fs from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { absolutePublicFile, formatWinnerPrize } from "@/lib/winner-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const IMAGE_WIDTH = PAGE_WIDTH;
const MAX_HEADER_HEIGHT = 245;
const MAX_FOOTER_HEIGHT = 260;
const TABLE_HEADER_HEIGHT = 20;
const ROW_HEIGHT = 18;
const WIDTHS = [45, 75, 275, 90, 95];
const TABLE_TOP_WITHOUT_IMAGE = PAGE_HEIGHT - MARGIN - 34;

function safeText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}.` : value;
}

async function embedImage(pdf: PDFDocument, publicPath?: string | null) {
  const imagePath = absolutePublicFile(publicPath);
  if (!imagePath) return null;

  try {
    const bytes = await fs.readFile(imagePath);
    const lower = imagePath.toLowerCase();
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return pdf.embedJpg(bytes);
    if (lower.endsWith(".png")) return pdf.embedPng(bytes);
    return null;
  } catch (error) {
    console.error("No se pudo leer imagen para PDF", { imagePath, error });
    return null;
  }
}

function imageFitSize(image: any, maxWidth: number, maxHeight: number) {
  const scaled = image.scale(Math.min(maxWidth / image.width, maxHeight / image.height));
  return { width: scaled.width, height: scaled.height };
}

function drawImageFit(page: any, image: any, x: number, y: number, maxWidth: number, maxHeight: number) {
  if (!image) return { width: 0, height: 0 };
  const scaled = imageFitSize(image, maxWidth, maxHeight);
  page.drawImage(image, {
    x: x + (maxWidth - scaled.width) / 2,
    y: y + (maxHeight - scaled.height) / 2,
    width: scaled.width,
    height: scaled.height
  });
  return scaled;
}

function drawImageFillWidth(page: any, image: any, x: number, y: number, width: number, height: number) {
  if (!image) return { width: 0, height: 0 };
  page.drawImage(image, { x, y, width, height });
  return { width, height };
}

function drawTableHeader(page: any, fontBold: any, y: number) {
  let x = MARGIN;
  page.drawRectangle({
    x,
    y,
    width: WIDTHS.reduce((sum, width) => sum + width, 0),
    height: TABLE_HEADER_HEIGHT,
    color: rgb(0.78, 0.91, 0)
  });

  ["Ref.", "ID", "Nombre", "Premio RD$", "Localidad"].forEach((header, index) => {
    const width = WIDTHS[index];
    const textWidth = fontBold.widthOfTextAtSize(header, 9);
    page.drawText(header, {
      x: index === 2 ? x + 5 : x + (width - textWidth) / 2,
      y: y + 6,
      size: 9,
      font: fontBold,
      color: rgb(0.03, 0.23, 0.13)
    });
    x += width;
  });
}

function drawWinnerRow(page: any, fontBold: any, y: number, values: string[], shaded: boolean) {
  let x = MARGIN;
  const totalWidth = WIDTHS.reduce((sum, width) => sum + width, 0);
  page.drawRectangle({
    x,
    y,
    width: totalWidth,
    height: ROW_HEIGHT,
    color: shaded ? rgb(0.97, 0.98, 1) : rgb(1, 1, 1),
    borderColor: rgb(0.09, 0.63, 0.29),
    borderWidth: 0.6
  });

  values.forEach((value, index) => {
    const width = WIDTHS[index];
    page.drawLine({
      start: { x, y },
      end: { x, y: y + ROW_HEIGHT },
      thickness: 0.6,
      color: rgb(0.09, 0.63, 0.29)
    });
    const display = safeText(value, index === 2 ? 48 : 18);
    const textWidth = fontBold.widthOfTextAtSize(display, 7.5);
    page.drawText(display, {
      x: index === 2 ? x + 5 : x + Math.max(3, (width - textWidth) / 2),
      y: y + 6,
      size: 7.5,
      font: fontBold,
      color: rgb(0.07, 0.09, 0.15)
    });
    x += width;
  });
  page.drawLine({
    start: { x, y },
    end: { x, y: y + ROW_HEIGHT },
    thickness: 0.6,
    color: rgb(0.09, 0.63, 0.29)
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!canAccessAdmin(user)) return jsonError("La sesión caducó. Debe iniciar sesión nuevamente.", 403);

    const { id } = await params;
    const report = await prisma.winnerReport.findUnique({
      where: { id },
      include: { winners: { orderBy: [{ location: "asc" }, { ref: "asc" }] } }
    });
    if (!report) return jsonError("Reporte no encontrado.", 404);
    if (!report.winners.length) return jsonError("El reporte no tiene ganadores cargados.", 422);
    const reportName = report.name;

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const headerImage = await embedImage(pdf, report.headerImagePath);
    const footerImage = await embedImage(pdf, report.footerImagePath);
    const headerSize = headerImage ? imageFitSize(headerImage, IMAGE_WIDTH, MAX_HEADER_HEIGHT) : null;
    const footerSize = footerImage ? { width: IMAGE_WIDTH, height: Math.min(MAX_FOOTER_HEIGHT, IMAGE_WIDTH * (footerImage.height / footerImage.width)) } : null;
    const firstPageTableTop = PAGE_HEIGHT - (headerSize ? headerSize.height + 10 : MARGIN + 48);
    const nextPageTableTop = TABLE_TOP_WITHOUT_IMAGE;
    const bottomLimit = MARGIN;
    let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let currentPageNumber = 1;
    let y = firstPageTableTop - TABLE_HEADER_HEIGHT;

    function drawPageNumber() {
      const label = `Página ${currentPageNumber}`;
      const textWidth = font.widthOfTextAtSize(label, 9);
      page.drawText(label, {
        x: PAGE_WIDTH - MARGIN - textWidth,
        y: MARGIN / 2,
        size: 9,
        font,
        color: rgb(0.35, 0.39, 0.45)
      });
    }

    function drawPageHeader(includeMainImage: boolean) {
      if (includeMainImage && headerImage) {
        drawImageFit(page, headerImage, 0, PAGE_HEIGHT - headerSize!.height, IMAGE_WIDTH, headerSize!.height);
      } else if (includeMainImage) {
        const titleWidth = fontBold.widthOfTextAtSize(reportName, 20);
        page.drawText(reportName, {
          x: Math.max(MARGIN, (PAGE_WIDTH - titleWidth) / 2),
          y: PAGE_HEIGHT - MARGIN - 20,
          size: 20,
          font: fontBold,
          color: rgb(0.03, 0.23, 0.13)
        });
      }
      drawTableHeader(page, fontBold, y);
      y -= ROW_HEIGHT;
    }

    function drawFooter() {
      if (!footerImage || !footerSize) return;
      if (y - footerSize.height - 12 < 0) {
        drawPageNumber();
        page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        currentPageNumber += 1;
        y = PAGE_HEIGHT;
      }
      drawImageFillWidth(page, footerImage, 0, y - footerSize.height, IMAGE_WIDTH, footerSize.height);
    }

    drawPageHeader(true);
    report.winners.forEach((winner, index) => {
      if (y < bottomLimit) {
        drawPageNumber();
        page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        currentPageNumber += 1;
        y = nextPageTableTop - TABLE_HEADER_HEIGHT;
        drawPageHeader(false);
      }
      drawWinnerRow(
        page,
        fontBold,
        y,
        [String(index + 1), winner.winnerId, winner.name, formatWinnerPrize(winner.prize), winner.location],
        index % 2 === 1
      );
      y -= ROW_HEIGHT;
    });
    drawFooter();
    drawPageNumber();

    const bytes = await pdf.save();
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    const safeName = reportName.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "ganadores";

    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`
      }
    });
  } catch (error) {
    console.error("Error generando PDF de ganadores", error);
    return jsonError(error instanceof Error ? error.message : "No se pudo generar el PDF.", 500);
  }
}
