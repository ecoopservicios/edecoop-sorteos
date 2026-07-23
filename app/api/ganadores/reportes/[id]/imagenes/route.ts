import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { saveWinnerImage } from "@/lib/winner-reports";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const report = await prisma.winnerReport.findUnique({ where: { id } });
  if (!report) return jsonError("Reporte no encontrado.", 404);

  const form = await request.formData();
  const header = form.get("headerImage");
  const footer = form.get("footerImage");
  const data: { headerImagePath?: string; footerImagePath?: string } = {};

  if (header instanceof File && header.size > 0) data.headerImagePath = await saveWinnerImage(header, id, "header");
  if (footer instanceof File && footer.size > 0) data.footerImagePath = await saveWinnerImage(footer, id, "footer");
  if (!data.headerImagePath && !data.footerImagePath) return jsonError("Debe seleccionar al menos una imagen.", 422);

  const updated = await prisma.winnerReport.update({ where: { id }, data });
  return NextResponse.json({ report: updated });
}
