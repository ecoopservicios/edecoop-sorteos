import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getCooperativeSettings, getDataUpdateTextSettings } from "@/lib/app-settings";
import { buildSupportWhatsappUrl, lookupFieldLabel, normalizeLookupValue } from "@/lib/data-update";
import { prisma } from "@/lib/db";
import { createDataUpdateProof, dataUpdateRateLimit, guardDataUpdateRequest, setDataUpdateReceipt } from "@/lib/data-update-security";

async function memberNotFound(companyName: string, message?: string) {
  const [settings, texts] = await Promise.all([getCooperativeSettings(), getDataUpdateTextSettings()]);
  const supportWhatsapp = settings.whatsapp || "WhatsApp de EDECOOP";
  return NextResponse.json({
    found: false,
    message: message || texts.notFoundMessage,
    supportWhatsapp,
    whatsappUrl: buildSupportWhatsappUrl(supportWhatsapp, companyName, texts.whatsappMessage)
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const guarded = guardDataUpdateRequest(request);
    if (guarded) return guarded;
    const limited = await dataUpdateRateLimit(request, "lookup");
    if (limited) return limited;
    const payload = await request.json();
    const enrollmentCompanyId = String(payload.enrollmentCompanyId || "");
    const company = await prisma.enrollmentCompany.findFirst({
      where: { id: enrollmentCompanyId, isActive: true, dataUpdateEnabled: true }
    });
    if (!company || !company.dataUpdateLookupField) return jsonError("Empresa no disponible.", 422);

    const lookupValue = normalizeLookupValue(String(payload.lookupValue || ""), company.dataUpdateLookupField);
    const needsDocument = company.dataUpdateLookupField === "EMPLOYEE_NUMBER";
    if (needsDocument && !payload.documentId) {
      const employeeExists = await prisma.memberDirectory.findFirst({
        where: { enrollmentCompanyId: company.id, isActive: true, employeeNumber: lookupValue },
        select: { id: true }
      });
      if (!employeeExists) return memberNotFound(company.name, "El número de empleado no se encuentra registrado.");
      return NextResponse.json({ requiresDocument: true }, { headers: { "Cache-Control": "no-store" } });
    }
    const documentId = needsDocument ? normalizeLookupValue(String(payload.documentId), "DOCUMENT_ID") : lookupValue;
    const member = await prisma.memberDirectory.findFirst({
      where: {
        enrollmentCompanyId: company.id,
        isActive: true,
        ...(needsDocument ? { employeeNumber: lookupValue, documentId } : { documentId: lookupValue })
      }
    });

    if (!member) {
      return memberNotFound(company.name, needsDocument ? "No pudimos confirmar los datos ingresados." : undefined);
    }

    const existing = await prisma.memberDataUpdateSubmission.findFirst({
      where: { OR: [{ memberDirectoryId: member.id }, ...(member.documentId ? [{ memberDirectory: { documentId: member.documentId } }] : [])] },
      select: { id: true, emailVerifiedAt: true },
      orderBy: { createdAt: "desc" }
    });
    if (existing?.emailVerifiedAt) return NextResponse.json({ error: "Este socio ya validó su actualización de datos.", code: "COMPLETED" }, { status: 409 });

    const response = NextResponse.json({
      found: true,
      pendingValidation: Boolean(existing),
      message: existing ? "Tienes una actualización pendiente de validación. Puedes editarla o reenviar el correo." : undefined,
      emailConfigured: Boolean(process.env.BREVO_API_KEY?.trim() && process.env.EMAIL_FROM_ADDRESS?.trim()),
      verificationToken: createDataUpdateProof(member.id, lookupValue, member.documentId),
      lookupField: company.dataUpdateLookupField,
      lookupLabel: lookupFieldLabel(company.dataUpdateLookupField),
      member: {
        id: member.id,
        companyName: company.name,
        fullName: `${member.firstName} ${member.lastName}`.trim(),
        documentId: member.documentId,
        employeeNumber: member.employeeNumber
      }
    }, { headers: { "Cache-Control": "no-store" } });
    if (existing) setDataUpdateReceipt(response, member.id);
    return response;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo buscar el registro.", 422);
  }
}
