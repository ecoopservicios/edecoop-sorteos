import { EmergencyContactRelation } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getDataUpdateQuestions, getDataUpdateTextSettings } from "@/lib/app-settings";
import { compareContactValue, normalizeLookupValue, normalizePersonalEmail, tenDigitContactPhone } from "@/lib/data-update";
import { prisma } from "@/lib/db";
import { validatePersonName } from "@/lib/participants";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const memberDirectoryId = String(payload.memberDirectoryId || "");
    const member = await prisma.memberDirectory.findFirst({
      where: { id: memberDirectoryId, isActive: true },
      include: { enrollmentCompany: true }
    });
    const company = member?.enrollmentCompany;
    if (!member || !company?.isActive || !company.dataUpdateEnabled || !company.dataUpdateLookupField) {
      return jsonError("Registro no disponible.", 404);
    }

    const lookupValue = normalizeLookupValue(String(payload.lookupValue || ""), company.dataUpdateLookupField);
    const expectedLookup = company.dataUpdateLookupField === "DOCUMENT_ID" ? member.documentId : member.employeeNumber;
    if (lookupValue !== expectedLookup) return jsonError("Los datos de validacion no coinciden.", 422);

    const personalPhone = tenDigitContactPhone(String(payload.personalPhone || ""), "Telefono personal");
    const whatsappPhone = tenDigitContactPhone(String(payload.whatsappPhone || ""), "WhatsApp personal");
    const personalEmail = normalizePersonalEmail(String(payload.personalEmail || ""));
    const emergencyContactName = validatePersonName(String(payload.emergencyContactName || ""), "Contacto de emergencia");
    const emergencyContactPhone = tenDigitContactPhone(String(payload.emergencyContactPhone || ""), "Telefono de emergencia");
    const relationValues = Object.values(EmergencyContactRelation);
    const relation = String(payload.emergencyContactRelation || "");
    const emergencyContactRelation = relationValues.includes(relation as EmergencyContactRelation)
      ? (relation as EmergencyContactRelation)
      : EmergencyContactRelation.FAMILIAR;

    if (personalPhone === member.personalPhone) {
      return jsonError("El telefono ingresado coincide con el que tenemos registrado. Favor ingresar su telefono movil personal actualizado.", 422);
    }
    if (personalEmail === member.personalEmail) {
      return jsonError("El correo ingresado coincide con el que tenemos registrado. Favor ingresar su correo electronico personal actualizado.", 422);
    }

    const questions = await getDataUpdateQuestions();
    const additionalQuestions = questions.filter((question) => !question.isSystem);
    const customResponses = (payload.customResponses || {}) as Record<string, unknown>;
    const cleanResponses: Record<string, string> = {};
    for (const question of additionalQuestions) {
      const value = String(customResponses[question.fieldKey] || "").trim();
      if (question.required && !value) throw new Error(`${question.label} es obligatorio.`);
      if (!value) continue;
      cleanResponses[question.fieldKey] = value;
    }

    const submission = await prisma.memberDataUpdateSubmission.create({
      data: {
        memberDirectoryId: member.id,
        enrollmentCompanyId: member.enrollmentCompanyId,
        lookupField: company.dataUpdateLookupField,
        lookupValue,
        previousPersonalPhone: member.personalPhone,
        previousWhatsappPhone: member.whatsappPhone,
        previousPersonalEmail: member.personalEmail,
        personalPhone,
        whatsappPhone,
        personalEmail,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelation,
        customResponses: cleanResponses,
        phoneValidationStatus: compareContactValue(personalPhone, member.personalPhone),
        whatsappValidationStatus: compareContactValue(whatsappPhone, member.whatsappPhone),
        emailValidationStatus: compareContactValue(personalEmail, member.personalEmail)
      }
    });

    const texts = await getDataUpdateTextSettings();
    return NextResponse.json({
      submissionId: submission.id,
      message: texts.successMessage
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo enviar la solicitud.", 422);
  }
}
