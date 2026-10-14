import { MemberLookupField, Prisma } from "@prisma/client";
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
  if (!current || current.deletedAt) return jsonError("Empresa no encontrada.", 404);

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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const current = await prisma.enrollmentCompany.findUnique({ where: { id }, include: { _count: { select: { dataUpdateMembers: true, dataUpdateSubmissions: true, souvenirMembers: true } } } });
  if (!current || current.deletedAt) return jsonError("Empresa no encontrada.", 404);

  const enrollmentCount = await prisma.enrollmentSubmission.count({ where: { formId: current.formId, companyName: current.name } });
  const linked = [
    ["socios de actualización de datos", current._count.dataUpdateMembers],
    ["actualizaciones recibidas", current._count.dataUpdateSubmissions],
    ["socios de souvenirs", current._count.souvenirMembers],
    ["solicitudes de afiliación", enrollmentCount]
  ].filter(([, count]) => Number(count) > 0).map(([label, count]) => `${count} ${label}`);
  const body = await request.json().catch(() => ({}));
  if (body.confirm !== true) return NextResponse.json({ requiresConfirmation: true, warning: `Eliminar ${current.name} de la configuración${linked.length ? ` (${linked.join(", ")})` : ""}. Los listados, entregas y datos actualizados se conservarán sin cambios.` });

  await prisma.$transaction(async tx => {
  // Preserve the identity and lookup rules used by existing lists and submissions.
  await tx.enrollmentCompany.update({ where: { id }, data: { deletedAt: new Date() } });
  await tx.auditLog.create({
    data: {
      action: "DELETE",
      entityType: "EnrollmentCompany",
      entityId: id,
      reason: "Eliminación de empresa de configuración; registros vinculados conservados",
      userId: user!.id,
      metadata: { name: current.name, formId: current.formId, preservedRecords: linked }
    }
  });
  });

  return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") return jsonError("La empresa tiene registros vinculados y no se puede eliminar. Puede inactivarla.", 409);
      if (error.code === "P2025") return jsonError("La empresa ya no existe. Actualice el listado.", 404);
    }
    console.error("Error al eliminar empresa", error);
    return jsonError("No se pudo eliminar la empresa. Intente nuevamente.", 500);
  }
}
