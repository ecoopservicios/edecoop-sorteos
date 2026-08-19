import { DigitalLinkStatus, EnrollmentSubmissionChannel, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { generateToken } from "@/lib/codes";
import { prisma } from "@/lib/db";
import { buildFullName, validatePersonName } from "@/lib/participants";
import { normalizePhone } from "@/lib/whatsapp";
import { parseCurrencyNumber } from "@/lib/enrollment";
import { checkPersonDuplicate } from "@/lib/duplicate-protection";
import { EVENT_TYPE_CODES } from "@/lib/events";

function text(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function required(form: FormData, key: string) {
  const value = text(form.get(key));
  if (!value) throw new Error("Debe completar todos los campos requeridos.");
  return value;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function tenDigitPhone(value: string, label: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) {
    throw new Error(`${label} debe contener exactamente 10 nÃºmeros, sin letras ni sÃ­mbolos.`);
  }
  return digits;
}

function documentIdValue(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) {
    throw new Error("La cÃ©dula debe contener exactamente 11 nÃºmeros, sin guiones ni letras.");
  }
  return digits;
}

function employeeNumberValue(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits || digits.length > 5) {
    throw new Error("El NIE solo acepta nÃºmeros y un mÃ¡ximo de 5 dÃ­gitos.");
  }
  return digits;
}

async function buildInstantPrizeLink({
  eventId,
  eventName,
  firstName,
  lastName,
  documentId,
  email,
  phone,
  request
}: {
  eventId: string;
  eventName: string;
  firstName: string;
  lastName: string;
  documentId: string;
  email: string;
  phone: string;
  request: NextRequest;
}) {
  const eventHasPrizes = await prisma.eventEdition.findFirst({
    where: {
      id: eventId,
      prizes: { some: { isActive: true, availableQuantity: { gt: 0 } } }
    }
  });
  if (!eventHasPrizes) return null;

  const name = buildFullName(firstName, lastName);
  const creator = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  if (!creator) return null;

  const existing = await prisma.digitalParticipant.findFirst({
    where: {
      OR: [{ phone }, { nie: documentId }, { name }]
    },
    include: {
      links: {
        include: { result: true },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (existing?.links.some((link) => link.result || link.status === DigitalLinkStatus.USED)) {
    return null;
  }

  const pending = existing?.links.find((link) => link.status === DigitalLinkStatus.PENDING);
  const participantId =
    existing?.id ||
    (
      await prisma.digitalParticipant.create({
        data: {
          firstName,
          lastName,
          nie: documentId,
          email,
          name,
          phone
        }
      })
    ).id;
  const link =
    pending ||
    (await prisma.digitalLink.create({
      data: {
        token: generateToken(),
        participantId,
        createdById: creator.id
      }
    }));

  const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
  return { id: link.id, participantId, url: `${baseUrl}/ruleta/digital/${link.token}`, eventEditionId: eventId, eventName };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const channel = EnrollmentSubmissionChannel.VIRTUAL;
  const formConfig = await prisma.enrollmentForm.findUnique({ where: { token } });
  if (!formConfig || !formConfig.isActive) return jsonError("Formulario no disponible.", 404);

  const form = await request.formData();
  try {
    const firstName = validatePersonName(required(form, "firstName"), "Nombres");
    const lastName = validatePersonName(required(form, "lastName"), "Apellidos");
    const documentId = documentIdValue(required(form, "documentId"));
    const rawResidencePhone = text(form.get("residencePhone"));
    const mobilePhone = normalizePhone(tenDigitPhone(required(form, "mobilePhone"), "Celular"));
    const email = required(form, "email").toLowerCase();
    const maritalStatus = required(form, "maritalStatus").toUpperCase();
    const spouseName = text(form.get("spouseName"));
    const companyName = required(form, "companyName").toUpperCase();
    const monthlySalary = parseCurrencyNumber(required(form, "monthlySalary"));
    const salaryDeductionPercent = parseCurrencyNumber(required(form, "salaryDeductionPercent"));
    const employeeNumber = employeeNumberValue(required(form, "employeeNumber"));
    const birthDate = new Date("1900-01-01T00:00:00");

    if (!isValidEmail(email)) return jsonError("Correo electrÃ³nico invÃ¡lido.", 422);
    if (!monthlySalary) return jsonError("Sueldo mensual invÃ¡lido.", 422);
    if (!salaryDeductionPercent || salaryDeductionPercent < 4) {
      return jsonError("El porcentaje de descuento debe ser 4% o mayor.", 422);
    }
    if (!["SOLTERO", "CASADO", "UNION LIBRE"].includes(maritalStatus)) return jsonError("Estado civil invÃ¡lido.", 422);
    if ((maritalStatus === "CASADO" || maritalStatus === "UNION LIBRE") && !spouseName) {
      return jsonError("Debe indicar el nombre del conyuge.", 422);
    }
    if (form.get("acceptsTerms") !== "on") return jsonError("Debe aceptar la solicitud de admisiÃ³n.", 422);

    const company = await prisma.enrollmentCompany.findFirst({
      where: { formId: formConfig.id, name: companyName, isActive: true }
    });
    if (!company) return jsonError("Empresa no disponible.", 422);
    const duplicate = await checkPersonDuplicate({ firstName, lastName, documentId, employeeNumber, phone: mobilePhone, email });
    if (duplicate) return NextResponse.json({ error: duplicate.message, field: duplicate.field }, { status: 409 });

    const shouldOfferInstantPrize = formConfig.allowInstantPrize;

    const campaignEvent = shouldOfferInstantPrize
      ? await prisma.eventEdition.findFirst({
          where: {
            status: "ACTIVE",
            eventType: { code: EVENT_TYPE_CODES.AFFILIATION_INSTANT }
          },
          orderBy: [{ year: "desc" }, { month: "desc" }],
          select: { id: true, displayName: true }
        })
      : null;

    const prizeLink = campaignEvent ? await buildInstantPrizeLink({
      eventId: campaignEvent.id,
      eventName: campaignEvent.displayName,
      firstName,
      lastName,
      documentId,
      email,
      phone: mobilePhone,
      request
    }) : null;

    const submission = await prisma.enrollmentSubmission.create({
      data: {
        formId: formConfig.id,
        firstName,
        lastName,
        documentId,
        residencePhone: rawResidencePhone ? tenDigitPhone(rawResidencePhone, "Numero de flota") : null,
        mobilePhone,
        address: required(form, "address"),
        city: required(form, "city"),
        maritalStatus,
        spouseName: spouseName || null,
        profession: "No aplica",
        birthDate,
        position: required(form, "position"),
        companyName,
        department: required(form, "department"),
        workPhone: null,
        workplace: required(form, "workplace"),
        email,
        monthlySalary,
        employeeNumber,
        bankAccountNumber: text(form.get("bankAccountNumber")) || null,
        bankName: text(form.get("bankName")) || null,
        salaryDeductionPercent,
        acceptsTerms: true,
        channel,
        eventEditionId: campaignEvent?.id || null,
        digitalParticipantId: prizeLink?.participantId || null,
        digitalLinkId: prizeLink?.id || null
      }
    });

    return NextResponse.json({
      submissionId: submission.id,
      message: formConfig.successMessage,
      prizeLink: prizeLink?.url || null,
      downloadUrl: `/api/inscripcion/solicitudes/${submission.id}/pdf`,
      eventName: campaignEvent?.displayName || null
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("Ya existe un registro con esos datos.", 409);
    }
    return jsonError(error instanceof Error ? error.message : "No se pudo enviar la solicitud.", 422);
  }
}


