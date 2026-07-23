import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { parseWinnerRows } from "@/lib/winner-reports";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const report = await prisma.winnerReport.findUnique({ where: { id }, select: { id: true } });
  if (!report) return jsonError("Reporte no encontrado.", 404);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Debe seleccionar un archivo Excel.", 422);

  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return jsonError("El archivo no contiene hojas.", 422);

  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const { rows, errors } = parseWinnerRows(jsonRows);

  if (!rows.length) {
    return NextResponse.json({ processed: jsonRows.length, created: 0, rejected: errors.length, errors }, { status: 422 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.winnerReportEntry.deleteMany({ where: { reportId: id } });
    await tx.winnerReportEntry.createMany({
      data: rows.map((row) => ({
        reportId: id,
        ref: row.ref,
        winnerId: row.winnerId,
        name: row.name,
        prize: row.prize,
        location: row.location
      }))
    });
  });

  return NextResponse.json({
    processed: jsonRows.length,
    created: rows.length,
    rejected: errors.length,
    errors
  });
}
