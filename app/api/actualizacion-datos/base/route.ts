import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { directoryDocument, directoryEmployee, directoryName } from "@/lib/member-directory-upload";

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

    const member = await prisma.memberDirectory.create({
      data: {
        enrollmentCompanyId,
        firstName,
        lastName,
        documentId,
        employeeNumber,
        loadedById: user.id
      }
    });

    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("Ya existe un socio registrado con esa cedula o numero de empleado para esta empresa.", 409);
    }
    return jsonError(error instanceof Error ? error.message : "No se pudo guardar el socio.", 422);
  }
}
