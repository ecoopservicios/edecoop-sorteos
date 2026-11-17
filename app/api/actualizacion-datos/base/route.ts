import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { directoryDocument, directoryEmployee, directoryName } from "@/lib/member-directory-upload";
import { clearMemberDirectory, lockMemberDirectory, MemberDirectoryError } from "@/lib/member-directory-management";
import { guardDataUpdateRequest } from "@/lib/data-update-security";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return jsonError("No autorizado.", 403);

  try {
    const payload = await request.json();
    const enrollmentCompanyId = String(payload.enrollmentCompanyId || "");
    const firstName = directoryName(String(payload.firstName || ""), "Nombre");
    const lastName = directoryName(String(payload.lastName || ""), "Apellido");

    const company = await prisma.enrollmentCompany.findFirst({
      where: { id: enrollmentCompanyId, isActive: true, dataUpdateEnabled: true }
    });
    if (!company || !company.dataUpdateLookupField) return jsonError("Empresa no disponible para actualización de datos.", 422);
    const documentId = directoryDocument(String(payload.documentId || ""));
    const employeeNumber = directoryEmployee(String(payload.employeeNumber || ""), company.dataUpdateLookupField === "EMPLOYEE_NUMBER");

    const member = await prisma.$transaction(async tx => {
      await lockMemberDirectory(tx);
      return tx.memberDirectory.create({
        data: {
          enrollmentCompanyId,
          firstName,
          lastName,
          documentId,
          employeeNumber,
          loadedById: user.id
        }
      });
    });

    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("Ya existe un socio registrado con esa cedula o numero de empleado para esta empresa.", 409);
    }
    return jsonError(error instanceof Error ? error.message : "No se pudo guardar el socio.", 422);
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return jsonError("No autorizado.", 403);
  const guarded = guardDataUpdateRequest(request);
  if (guarded) return guarded;
  try {
    const payload = await request.json();
    if (payload.confirmation !== "ELIMINAR") return jsonError("Escribe ELIMINAR para confirmar el borrado del listado.", 422);
    if (payload.scope !== "all" && payload.scope !== "company") return jsonError("Selecciona el listado que deseas eliminar.", 422);
    if (!Number.isSafeInteger(payload.expectedCount) || payload.expectedCount < 0) return jsonError("Debes confirmar el número de socios que se eliminarán.", 422);
    const enrollmentCompanyId = payload.scope === "company" ? String(payload.enrollmentCompanyId || "") : null;
    if (payload.scope === "company" && !enrollmentCompanyId) return jsonError("Selecciona la empresa que deseas eliminar del listado.", 422);
    const result = await prisma.$transaction(tx => clearMemberDirectory(tx, {
      enrollmentCompanyId, expectedCount: payload.expectedCount, userId: user.id
    }));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MemberDirectoryError) return jsonError(error.message, error.status);
    return jsonError("No se pudo eliminar el listado. No se modificaron los socios.", 422);
  }
}
