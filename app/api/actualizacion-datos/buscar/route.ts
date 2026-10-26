import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getCooperativeSettings, getDataUpdateTextSettings } from "@/lib/app-settings";
import { buildSupportWhatsappUrl, lookupFieldLabel, normalizeLookupValue } from "@/lib/data-update";
import { prisma } from "@/lib/db";
import { completedDataUpdate, createDataUpdateProof, dataUpdateRateLimit } from "@/lib/data-update-security";

export async function POST(request: NextRequest) {
  try {
    if (completedDataUpdate(request)) return NextResponse.json({ error: "Ya completaste una actualizacion en esta sesion.", code: "COMPLETED" }, { status: 409 });
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
    if (needsDocument && !payload.documentId) return NextResponse.json({ requiresDocument: true }, { headers: { "Cache-Control": "no-store" } });
    const documentId = needsDocument ? normalizeLookupValue(String(payload.documentId), "DOCUMENT_ID") : lookupValue;
    const member = await prisma.memberDirectory.findFirst({
      where: {
        enrollmentCompanyId: company.id,
        isActive: true,
        ...(needsDocument ? { employeeNumber: lookupValue, documentId } : { documentId: lookupValue })
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

    const existing = await prisma.memberDataUpdateSubmission.findFirst({ where: { OR: [{ memberDirectoryId: member.id }, ...(member.documentId ? [{ memberDirectory: { documentId: member.documentId } }] : [])] }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "Este socio ya tiene una actualizacion registrada.", code: "ALREADY_SUBMITTED" }, { status: 409 });

    return NextResponse.json({
      found: true,
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
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo buscar el registro.", 422);
  }
}
