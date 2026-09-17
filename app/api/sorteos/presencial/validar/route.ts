import { MemberLookupField } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { canSpinPresential, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { EVENT_TYPE_CODES } from "@/lib/events";
import { presentialParticipantLookupSchema } from "@/lib/validators";

function onlyDigits(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function validateLookupValue(field: MemberLookupField, value: string) {
  const clean = onlyDigits(value);
  if (field === MemberLookupField.DOCUMENT_ID && clean.length !== 11) {
    return { clean, ready: false, error: "" };
  }
  if (field === MemberLookupField.EMPLOYEE_NUMBER && (!clean || clean.length > 5)) {
    return { clean, ready: false, error: "" };
  }
  return { clean, ready: true, error: "" };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canSpinPresential(user)) return jsonError("No autorizado.", 403);

  const body = await request.json().catch(() => ({}));
  const payload = presentialParticipantLookupSchema.safeParse(body);
  if (!payload.success) return jsonError("Datos inválidos.", 422);

  const companyName = payload.data.companyName.trim().toUpperCase();
  const lookupField = payload.data.lookupField as MemberLookupField;
  const validation = validateLookupValue(lookupField, payload.data.lookupValue);
  if (!validation.ready) return NextResponse.json({ exists: false, ready: false, message: "" });

  const event = await prisma.eventEdition.findFirst({
    where: {
      id: payload.data.eventEditionId,
      status: "ACTIVE",
      eventType: { code: EVENT_TYPE_CODES.AFFILIATION_INSTANT }
    },
    select: { id: true }
  });
  if (!event) return jsonError("Debe seleccionar una jornada de premio instantáneo activa.", 422);

  const company = await prisma.enrollmentCompany.findFirst({
    where: { name: companyName, isActive: true },
    select: { id: true, name: true, dataUpdateLookupField: true }
  });
  if (!company) return jsonError("Empresa no disponible en el formulario.", 422);
  if (!company.dataUpdateLookupField) {
    return jsonError("Esta empresa no tiene configurado el dato de identificacion para validar participantes.", 422);
  }
  if (company.dataUpdateLookupField !== lookupField) {
    return jsonError("El tipo de identificacion no coincide con la configuracion de la empresa.", 422);
  }

  const existingSubmission = await prisma.enrollmentSubmission.findFirst({
    where: {
      deletedAt: null,
      companyName: company.name,
      eventEditionId: event.id,
      ...(lookupField === MemberLookupField.DOCUMENT_ID ? { documentId: validation.clean } : { employeeNumber: validation.clean })
    },
    select: { id: true, firstName: true, lastName: true, prizeCode: true, raffleResultId: true }
  });

  if (existingSubmission) {
    return NextResponse.json({
      exists: true,
      ready: true,
      message:
        existingSubmission.prizeCode || existingSubmission.raffleResultId
          ? `Esta persona ya participó en esta jornada. Código: ${existingSubmission.prizeCode || "registrado"}.`
          : "Esta persona ya está registrada en esta jornada."
    });
  }

  const existingResult = await prisma.raffleResult.findFirst({
    where: {
      eventEditionId: event.id,
      participantNie: validation.clean
    },
    select: { id: true, code: true }
  });

  if (existingResult) {
    return NextResponse.json({
      exists: true,
      ready: true,
      message: `Esta persona ya participó en esta jornada. Código: ${existingResult.code}.`
    });
  }

  return NextResponse.json({ exists: false, ready: true, message: "Participante disponible para girar." });
}
