import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const isActive = Boolean(body.isActive);

  const current = await prisma.enrollmentCompany.findUnique({ where: { id } });
  if (!current) return jsonError("Empresa no encontrada.", 404);

  const company = await prisma.enrollmentCompany.update({
    where: { id },
    data: { isActive }
  });

  await prisma.auditLog.create({
    data: {
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      entityType: "EnrollmentCompany",
      entityId: company.id,
      reason: "Cambio de estado de empresa de inscripción",
      userId: user!.id,
      metadata: { name: company.name, previousStatus: current.isActive, newStatus: company.isActive }
    }
  });

  return NextResponse.json({ company });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const current = await prisma.enrollmentCompany.findUnique({ where: { id } });
  if (!current) return jsonError("Empresa no encontrada.", 404);

  await prisma.enrollmentCompany.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      action: "DELETE",
      entityType: "EnrollmentCompany",
      entityId: id,
      reason: "Eliminación de empresa de inscripción",
      userId: user!.id,
      metadata: { name: current.name, formId: current.formId }
    }
  });

  return NextResponse.json({ ok: true });
}
