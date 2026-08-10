import { MemberLookupField } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const current = await prisma.enrollmentCompany.findUnique({ where: { id } });
  if (!current) return jsonError("Empresa no encontrada.", 404);

  const data: {
    isActive?: boolean;
    dataUpdateEnabled?: boolean;
    dataUpdateLookupField?: MemberLookupField | null;
  } = {};

  if ("isActive" in body) data.isActive = Boolean(body.isActive);

  if ("dataUpdateEnabled" in body || "dataUpdateLookupField" in body) {
    const enabled = Boolean(body.dataUpdateEnabled);
    const lookupField =
      body.dataUpdateLookupField === MemberLookupField.EMPLOYEE_NUMBER ? MemberLookupField.EMPLOYEE_NUMBER : MemberLookupField.DOCUMENT_ID;

    data.dataUpdateEnabled = enabled;
    data.dataUpdateLookupField = enabled ? lookupField : null;
  }

  if (Object.keys(data).length === 0) return jsonError("No hay cambios para guardar.", 422);

  const company = await prisma.enrollmentCompany.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      action: "isActive" in data ? (data.isActive ? "ACTIVATE" : "DEACTIVATE") : "UPDATE",
      entityType: "EnrollmentCompany",
      entityId: company.id,
      reason: "Actualizacion de empresa de inscripcion",
      userId: user!.id,
      metadata: {
        name: company.name,
        previousStatus: current.isActive,
        newStatus: company.isActive,
        dataUpdateEnabled: company.dataUpdateEnabled,
        dataUpdateLookupField: company.dataUpdateLookupField
      }
    }
  });

  return NextResponse.json({ company });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      reason: "Eliminacion de empresa de inscripcion",
      userId: user!.id,
      metadata: { name: current.name, formId: current.formId }
    }
  });

  return NextResponse.json({ ok: true });
}
