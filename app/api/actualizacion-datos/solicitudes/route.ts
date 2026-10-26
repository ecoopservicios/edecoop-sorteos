import { EmergencyContactRelation } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getDataUpdateQuestions, getDataUpdateTextSettings } from "@/lib/app-settings";
import { compareContactValue, normalizeLookupValue, normalizePersonalEmail, tenDigitContactPhone } from "@/lib/data-update";
import { prisma } from "@/lib/db";
import { validatePersonName } from "@/lib/participants";
import { completedDataUpdate, dataUpdateRateLimit, readDataUpdateProof, setDataUpdateReceipt } from "@/lib/data-update-security";

class AlreadySubmitted extends Error {}

export async function POST(request: NextRequest) {
  try {
    if (completedDataUpdate(request)) return NextResponse.json({ error: "Ya completaste una actualización en esta sesión.", code: "COMPLETED" }, { status: 409 });
    const limited = await dataUpdateRateLimit(request, "submit");
    if (limited) return limited;
    const payload = await request.json();
    const proof = readDataUpdateProof(payload.verificationToken);
    if (!proof) return jsonError("La validación de identidad venció o no es válida. Vuelve a consultar tus datos.", 403);
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
    if (lookupValue !== expectedLookup) return jsonError("Los datos de validación no coinciden.", 422);
    if (proof.memberId !== member.id || proof.lookup !== lookupValue || proof.documentId !== member.documentId) return jsonError("La validación de identidad no corresponde a este socio.", 403);

    const personalPhone = tenDigitContactPhone(String(payload.personalPhone || ""), "Teléfono personal");
    const whatsappMode = String(payload.whatsappMode || "");
    if (!["SAME", "OTHER", "NONE"].includes(whatsappMode)) return jsonError("Indica si tienes WhatsApp.", 422);
    const whatsappPhone = whatsappMode === "NONE" ? "" : whatsappMode === "SAME" ? personalPhone : tenDigitContactPhone(String(payload.whatsappPhone || ""), "WhatsApp personal");
    const personalEmail = normalizePersonalEmail(String(payload.personalEmail || ""));
    const splitEmergencyContact = payload.emergencyContactFirstName !== undefined || payload.emergencyContactLastName !== undefined;
    const emergencyContactFirstName = splitEmergencyContact ? validatePersonName(String(payload.emergencyContactFirstName || ""), "Nombre del contacto de emergencia") : null;
    const emergencyContactLastName = splitEmergencyContact ? validatePersonName(String(payload.emergencyContactLastName || ""), "Apellido del contacto de emergencia") : null;
    const emergencyContactName = splitEmergencyContact
      ? `${emergencyContactFirstName} ${emergencyContactLastName}`
      : validatePersonName(String(payload.emergencyContactName || ""), "Contacto de emergencia");
    const emergencyContactPhone = tenDigitContactPhone(String(payload.emergencyContactPhone || ""), "Teléfono de emergencia");
    const relationValues = Object.values(EmergencyContactRelation);
    const relation = String(payload.emergencyContactRelation || "");
    if (!relationValues.includes(relation as EmergencyContactRelation)) return jsonError("Selecciona la relación con tu contacto de emergencia.", 422);
    const emergencyContactRelation = relation as EmergencyContactRelation;

    if (personalPhone === member.personalPhone) {
      return jsonError("El teléfono ingresado coincide con el que tenemos registrado. Favor ingresar su teléfono móvil personal actualizado.", 422);
    }
    if (personalEmail === member.personalEmail) {
      return jsonError("El correo ingresado coincide con el que tenemos registrado. Favor ingresar su correo electrónico personal actualizado.", 422);
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
    cleanResponses.whatsappPreference = whatsappMode;
    if (splitEmergencyContact) {
      cleanResponses.emergencyContactFirstName = emergencyContactFirstName!;
      cleanResponses.emergencyContactLastName = emergencyContactLastName!;
    }

    const submission = await prisma.$transaction(async tx => {
      // Serialize submissions for the same person, including requests from different tabs or replicas.
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `data-update-member:${member.documentId || member.id}`);
      const existing = await tx.memberDataUpdateSubmission.findFirst({ where: { OR: [{ memberDirectoryId: member.id }, ...(member.documentId ? [{ memberDirectory: { documentId: member.documentId } }] : [])] }, select: { id: true } });
      if (existing) throw new AlreadySubmitted("Este socio ya tiene una actualización registrada.");
      const created = await tx.memberDataUpdateSubmission.create({
        data: {
          memberDirectoryId: member.id,
          enrollmentCompanyId: member.enrollmentCompanyId,
          lookupField: company.dataUpdateLookupField!,
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
      await tx.auditLog.create({ data: { action: "MEMBER_DATA_UPDATE_SUBMITTED", entityType: "MemberDataUpdateSubmission", entityId: created.id, reason: "Actualizacion publica con identidad validada y un envio por socio.", metadata: { memberDirectoryId: member.id, whatsappMode } } });
      return created;
    });

    const texts = await getDataUpdateTextSettings();
    const response = NextResponse.json({
      submissionId: submission.id,
      message: texts.successMessage
    });
    setDataUpdateReceipt(response, member.id);
    return response;
  } catch (error) {
    if (error instanceof AlreadySubmitted) return NextResponse.json({ error: error.message, code: "ALREADY_SUBMITTED" }, { status: 409 });
    return jsonError(error instanceof Error ? error.message : "No se pudo enviar la solicitud.", 422);
  }
}
