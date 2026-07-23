import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const body = await request.json().catch(() => ({}));
  const formId = String(body.formId || "").trim();
  const name = String(body.name || "").trim().toUpperCase();
  if (!formId || name.length < 2) return jsonError("Debe indicar una empresa valida.", 422);

  const form = await prisma.enrollmentForm.findUnique({ where: { id: formId } });
  if (!form) return jsonError("Formulario no encontrado.", 404);

  const company = await prisma.enrollmentCompany.upsert({
    where: { formId_name: { formId, name } },
    update: { isActive: true },
    create: { formId, name, isActive: true }
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE",
      entityType: "EnrollmentCompany",
      entityId: company.id,
      reason: "Registro de empresa para formulario de inscripción",
      userId: user!.id,
      metadata: { name: company.name, formId }
    }
  });

  return NextResponse.json({ company });
}
