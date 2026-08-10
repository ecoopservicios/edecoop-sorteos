import { MemberLookupField } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return jsonError("No autorizado.", 403);

  try {
    const payload = await request.json();
    const enrollmentCompanyId = String(payload.enrollmentCompanyId || "");
    const lookupField = payload.lookupField === MemberLookupField.EMPLOYEE_NUMBER ? MemberLookupField.EMPLOYEE_NUMBER : MemberLookupField.DOCUMENT_ID;

    if (!enrollmentCompanyId) return jsonError("Debe seleccionar la empresa.", 422);

    const company = await prisma.enrollmentCompany.findFirst({ where: { id: enrollmentCompanyId } });
    if (!company) return jsonError("Empresa no encontrada.", 404);

    const companyConfig = await prisma.enrollmentCompany.update({
      where: { id: company.id },
      data: {
        dataUpdateEnabled: true,
        dataUpdateLookupField: lookupField
      }
    });

    return NextResponse.json({ config: companyConfig });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo guardar la configuracion.", 422);
  }
}
