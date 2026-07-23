import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("Sesión vencida. Debe iniciar sesión nuevamente.", 403);

  const { id } = await params;
  const report = await prisma.winnerReport.findUnique({ where: { id }, select: { id: true } });
  if (!report) return jsonError("Reporte no encontrado.", 404);

  const result = await prisma.winnerReportEntry.deleteMany({ where: { reportId: id } });
  return NextResponse.json({ deleted: result.count });
}
