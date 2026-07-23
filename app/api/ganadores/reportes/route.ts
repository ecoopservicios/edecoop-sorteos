import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const reportDate = body.reportDate ? new Date(String(body.reportDate)) : new Date();

  if (name.length < 3) return jsonError("El nombre del reporte es requerido.", 422);
  if (Number.isNaN(reportDate.getTime())) return jsonError("La fecha del reporte no es valida.", 422);

  const report = await prisma.winnerReport.create({
    data: {
      name,
      reportDate,
      createdById: user!.id
    }
  });

  return NextResponse.json({ report }, { status: 201 });
}
