import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildFullName } from "@/lib/participants";
import { normalizePhone } from "@/lib/whatsapp";

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

export type DuplicateField = "documentId" | "employeeNumber" | "mobilePhone" | "email" | "lastName";

type DuplicateInput = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  documentId?: string | null;
  employeeNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  excludeDigitalParticipantId?: string;
  excludeEnrollmentSubmissionId?: string;
};

export type DuplicateCheckResult = {
  field: DuplicateField;
  message: string;
} | null;

function onlyDigits(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function normalizedText(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function normalizedEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizedPhone(value?: string | null) {
  const digits = onlyDigits(value);
  if (!digits) return "";
  return digits.length === 10 ? normalizePhone(digits) : digits;
}

function identityCandidates(input: DuplicateInput) {
  return [
    { field: "documentId" as const, value: onlyDigits(input.documentId), label: "cedula" },
    { field: "employeeNumber" as const, value: onlyDigits(input.employeeNumber), label: "NIE" }
  ].filter((candidate) => candidate.value);
}

function fullNameFrom(input: DuplicateInput) {
  if (input.fullName) return normalizedText(input.fullName);
  if (input.firstName && input.lastName) return buildFullName(input.firstName, input.lastName);
  return "";
}

export async function checkPersonDuplicate(input: DuplicateInput, db: PrismaClientLike = prisma): Promise<DuplicateCheckResult> {
  const ids = identityCandidates(input);
  const phone = normalizedPhone(input.phone);
  const email = normalizedEmail(input.email);
  const fullName = fullNameFrom(input);
  const firstName = normalizedText(input.firstName);
  const lastName = normalizedText(input.lastName);

  for (const candidate of ids) {
    const enrollment = await db.enrollmentSubmission.findFirst({
      where: {
        deletedAt: null,
        id: input.excludeEnrollmentSubmissionId ? { not: input.excludeEnrollmentSubmissionId } : undefined,
        OR: [{ documentId: candidate.value }, { employeeNumber: candidate.value }]
      },
      select: { id: true }
    });
    if (enrollment) {
      return { field: candidate.field, message: `Ya existe una inscripción registrada con esa ${candidate.label}.` };
    }

    const digital = await db.digitalParticipant.findFirst({
      where: {
        deletedAt: null,
        id: input.excludeDigitalParticipantId ? { not: input.excludeDigitalParticipantId } : undefined,
        nie: candidate.value
      },
      select: { id: true }
    });
    if (digital) {
      return { field: candidate.field, message: `Ya existe un participante registrado con esa ${candidate.label}.` };
    }

    const result = await db.raffleResult.findFirst({
      where: { participantNie: candidate.value },
      select: { id: true }
    });
    if (result) {
      return { field: candidate.field, message: `Ya existe un premio otorgado asociado a esa ${candidate.label}.` };
    }
  }

  if (phone) {
    const enrollment = await db.enrollmentSubmission.findFirst({
      where: {
        deletedAt: null,
        id: input.excludeEnrollmentSubmissionId ? { not: input.excludeEnrollmentSubmissionId } : undefined,
        mobilePhone: phone
      },
      select: { id: true }
    });
    if (enrollment) return { field: "mobilePhone", message: "Ya existe una inscripción registrada con ese celular." };

    const digital = await db.digitalParticipant.findFirst({
      where: {
        deletedAt: null,
        id: input.excludeDigitalParticipantId ? { not: input.excludeDigitalParticipantId } : undefined,
        phone
      },
      select: { id: true }
    });
    if (digital) return { field: "mobilePhone", message: "Ya existe un participante registrado con ese celular." };

    const result = await db.raffleResult.findFirst({
      where: { participantPhone: phone },
      select: { id: true }
    });
    if (result) return { field: "mobilePhone", message: "Ya existe un premio otorgado asociado a ese celular." };
  }

  if (email) {
    const enrollment = await db.enrollmentSubmission.findFirst({
      where: {
        deletedAt: null,
        id: input.excludeEnrollmentSubmissionId ? { not: input.excludeEnrollmentSubmissionId } : undefined,
        email
      },
      select: { id: true }
    });
    if (enrollment) return { field: "email", message: "Ya existe una inscripción registrada con ese correo electrónico." };

    const digital = await db.digitalParticipant.findFirst({
      where: {
        deletedAt: null,
        id: input.excludeDigitalParticipantId ? { not: input.excludeDigitalParticipantId } : undefined,
        email
      },
      select: { id: true }
    });
    if (digital) return { field: "email", message: "Ya existe un participante registrado con ese correo electrónico." };

    const result = await db.raffleResult.findFirst({
      where: { participantEmail: email },
      select: { id: true }
    });
    if (result) return { field: "email", message: "Ya existe un premio otorgado asociado a ese correo electrónico." };
  }

  if (fullName) {
    if (firstName && lastName) {
      const enrollment = await db.enrollmentSubmission.findFirst({
        where: {
          deletedAt: null,
          id: input.excludeEnrollmentSubmissionId ? { not: input.excludeEnrollmentSubmissionId } : undefined,
          firstName,
          lastName
        },
        select: { id: true }
      });
      if (enrollment) return { field: "lastName", message: "Ya existe una inscripción registrada con ese nombre y apellido." };
    }

    const digital = await db.digitalParticipant.findFirst({
      where: {
        deletedAt: null,
        id: input.excludeDigitalParticipantId ? { not: input.excludeDigitalParticipantId } : undefined,
        name: fullName
      },
      select: { id: true }
    });
    if (digital) return { field: "lastName", message: "Ya existe un participante registrado con ese nombre y apellido." };

    const result = await db.raffleResult.findFirst({
      where: { participantName: fullName },
      select: { id: true }
    });
    if (result) return { field: "lastName", message: "Ya existe un premio otorgado asociado a ese nombre y apellido." };
  }

  return null;
}
