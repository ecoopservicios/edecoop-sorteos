import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeDigits, normalizePersonalEmail, tenDigitContactPhone } from "@/lib/data-update";
import { validatePersonName } from "@/lib/participants";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return jsonError("No autorizado.", 403);

  try {
    const payload = await request.json();
    const enrollmentCompanyId = String(payload.enrollmentCompanyId || "");
    const firstName = validatePersonName(String(payload.firstName || ""), "Nombres");
    const lastName = validatePersonName(String(payload.lastName || ""), "Apellidos");
    const documentId = normalizeDigits(String(payload.documentId || "")) || null;
    const employeeNumber = normalizeDigits(String(payload.employeeNumber || "")) || null;
    const personalPhone = payload.personalPhone ? tenDigitContactPhone(String(payload.personalPhone), "Telefono personal") : null;
    const whatsappPhone = payload.whatsappPhone ? tenDigitContactPhone(String(payload.whatsappPhone), "WhatsApp personal") : null;
    const personalEmail = payload.personalEmail ? normalizePersonalEmail(String(payload.personalEmail)) : null;

    const company = await prisma.enrollmentCompany.findFirst({
      where: { id: enrollmentCompanyId, isActive: true, dataUpdateEnabled: true }
    });
    if (!company) return jsonError("Empresa no disponible para actualizacion de datos.", 422);
    if (!documentId && !employeeNumber) return jsonError("Debe indicar cedula o numero de empleado.", 422);

    const member = await prisma.memberDirectory.create({
      data: {
        enrollmentCompanyId,
        firstName,
        lastName,
        documentId,
        employeeNumber,
        personalPhone,
        whatsappPhone,
        personalEmail,
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
