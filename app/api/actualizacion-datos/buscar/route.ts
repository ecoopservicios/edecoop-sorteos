import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getCooperativeSettings, getDataUpdateTextSettings } from "@/lib/app-settings";
import { buildSupportWhatsappUrl, lookupFieldLabel, normalizeLookupValue } from "@/lib/data-update";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const enrollmentCompanyId = String(payload.enrollmentCompanyId || "");
    const company = await prisma.enrollmentCompany.findFirst({
      where: { id: enrollmentCompanyId, isActive: true, dataUpdateEnabled: true }
    });
    if (!company || !company.dataUpdateLookupField) return jsonError("Empresa no disponible.", 422);

    const lookupValue = normalizeLookupValue(String(payload.lookupValue || ""), company.dataUpdateLookupField);
    const member = await prisma.memberDirectory.findFirst({
      where: {
        enrollmentCompanyId: company.id,
        isActive: true,
        ...(company.dataUpdateLookupField === "DOCUMENT_ID" ? { documentId: lookupValue } : { employeeNumber: lookupValue })
      }
    });

    if (!member) {
      const [settings, texts] = await Promise.all([getCooperativeSettings(), getDataUpdateTextSettings()]);
      const supportWhatsapp = settings.whatsapp || "WhatsApp de EDECOOP";
      return NextResponse.json({
        found: false,
        message: texts.notFoundMessage,
        supportWhatsapp,
        whatsappUrl: buildSupportWhatsappUrl(supportWhatsapp, company.name, texts.whatsappMessage)
      });
    }

    return NextResponse.json({
      found: true,
      lookupField: company.dataUpdateLookupField,
      lookupLabel: lookupFieldLabel(company.dataUpdateLookupField),
      member: {
        id: member.id,
        companyName: company.name,
        fullName: `${member.firstName} ${member.lastName}`.trim(),
        documentId: member.documentId,
        employeeNumber: member.employeeNumber,
        personalPhone: member.personalPhone,
        whatsappPhone: member.whatsappPhone,
        personalEmail: member.personalEmail
      }
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo buscar el registro.", 422);
  }
}
