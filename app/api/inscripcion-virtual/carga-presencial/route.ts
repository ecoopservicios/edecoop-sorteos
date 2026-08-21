import { EnrollmentSubmissionChannel, Prisma, RaffleEnvironment } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { canSpinPresential, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { generateToken } from "@/lib/codes";
import { checkPersonDuplicate } from "@/lib/duplicate-protection";
import { prisma } from "@/lib/db";
import { parseCurrencyNumber } from "@/lib/enrollment";
import { ensureEnrollmentForm } from "@/lib/enrollment-server";
import { EVENT_TYPE_CODES } from "@/lib/events";
import { buildFullName, validatePersonName } from "@/lib/participants";
import { normalizePhone } from "@/lib/whatsapp";

type ParsedRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  documentId: string;
  residencePhone: string | null;
  mobilePhone: string;
  city: string;
  address: string;
  maritalStatus: string;
  spouseName: string | null;
  companyName: string;
  position: string;
  department: string;
  workplace: string;
  email: string;
  monthlySalary: number;
  employeeNumber: string;
  bankAccountNumber: string | null;
  bankName: string | null;
  salaryDeductionPercent: number;
  receivedPrize: boolean;
  prizeCode: string | null;
  raffleResultId: string | null;
};

type BulkError = {
  row: number;
  message: string;
};

const EXPECTED_HEADERS = [
  "nombres",
  "apellidos",
  "cedula",
  "numero_flota",
  "celular",
  "ciudad",
  "direccion",
  "estado_civil",
  "nombre_conyuge",
  "empresa",
  "cargo",
  "dependencia",
  "oficina",
  "correo_electronico",
  "sueldo_mensual",
  "nie",
  "cta_banco_no",
  "nombre_banco",
  "porcentaje_descuento",
  "codigo_premio"
];

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function tenDigitPhone(value: string, label: string) {
  const clean = digits(value);
  if (clean.length !== 10) throw new Error(`${label} debe contener exactamente 10 números.`);
  return clean;
}

function documentIdValue(value: string) {
  const clean = digits(value);
  if (clean.length !== 11) throw new Error("La cédula debe contener exactamente 11 números.");
  return clean;
}

function employeeNumberValue(value: string) {
  const clean = digits(value);
  if (!clean || clean.length > 5) throw new Error("El NIE solo acepta números y un máximo de 5 dígitos.");
  return clean;
}

function rejectedCount(errors: BulkError[]) {
  return new Set(errors.map((error) => error.row)).size;
}

function fileDuplicateMessage(map: Map<string, number>, value: string, row: number, label: string) {
  if (!value) return null;
  const existingRow = map.get(value);
  if (existingRow) {
    return `${label} repetido en el archivo. Tambien aparece en la fila ${existingRow}.`;
  }
  map.set(value, row);
  return null;
}

function participantErrorMessage(rowNumber: number, name: string, messages: string[]) {
  const participant = name.trim() || "PARTICIPANTE SIN NOMBRE";
  return `Fila ${rowNumber} - ${participant}: ${messages.join(" ")}`;
}

async function parseRows(text: string, formId: string) {
  const errors: BulkError[] = [];
  const rows: ParsedRow[] = [];
  const invalidRows = new Set<number>();
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    return { rows, errors: [{ row: 1, message: "El archivo debe incluir encabezados y al menos una afiliacion." }], processed: 0 };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const missing = EXPECTED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) {
    return { rows, errors: [{ row: 1, message: `Faltan columnas requeridas: ${missing.join(", ")}.` }], processed: 0 };
  }

  const indexByHeader = Object.fromEntries(headers.map((header, index) => [header, index])) as Record<string, number>;
  const phones = new Map<string, number>();
  const names = new Map<string, number>();
  const documents = new Map<string, number>();
  const employeeNumbers = new Map<string, number>();
  const emails = new Map<string, number>();
  const prizeCodes = new Map<string, number>();

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const rowNumber = lineIndex + 1;
    const columns = parseCsvLine(lines[lineIndex]);
    const value = (header: string) => columns[indexByHeader[header]] || "";

    try {
      const rowErrors: string[] = [];
      let firstName = "";
      let lastName = "";
      try {
        firstName = validatePersonName(value("nombres"), "Nombres");
      } catch (error) {
        rowErrors.push(error instanceof Error ? error.message : "Nombre inválido.");
      }
      try {
        lastName = validatePersonName(value("apellidos"), "Apellidos");
      } catch (error) {
        rowErrors.push(error instanceof Error ? error.message : "Apellido inválido.");
      }
      const displayName = buildFullName(firstName || value("nombres").toUpperCase(), lastName || value("apellidos").toUpperCase());

      let documentId = "";
      try {
        documentId = documentIdValue(value("cedula"));
      } catch (error) {
        rowErrors.push(error instanceof Error ? error.message : "Cédula inválida.");
      }
      const rawResidencePhone = value("numero_flota");
      let residencePhone: string | null = null;
      try {
        residencePhone = rawResidencePhone ? tenDigitPhone(rawResidencePhone, "Numero de flota") : null;
      } catch (error) {
        rowErrors.push(error instanceof Error ? error.message : "Numero de flota inválido.");
      }
      let mobilePhone = "";
      try {
        mobilePhone = normalizePhone(tenDigitPhone(value("celular"), "Celular"));
      } catch (error) {
        rowErrors.push(error instanceof Error ? error.message : "Celular inválido.");
      }
      const city = value("ciudad");
      const address = value("direccion");
      const maritalStatus = value("estado_civil").toUpperCase();
      const spouseName = value("nombre_conyuge") || null;
      const companyName = value("empresa").toUpperCase();
      const position = value("cargo");
      const department = value("dependencia");
      const workplace = value("oficina");
      const email = value("correo_electronico").toLowerCase();
      const monthlySalary = parseCurrencyNumber(value("sueldo_mensual"));
      let employeeNumber = "";
      try {
        employeeNumber = employeeNumberValue(value("nie"));
      } catch (error) {
        rowErrors.push(error instanceof Error ? error.message : "NIE inválido.");
      }
      const salaryDeductionPercent = parseCurrencyNumber(value("porcentaje_descuento"));
      const prizeCode = value("codigo_premio").toUpperCase() || null;
      const receivedPrize = Boolean(prizeCode);

      if (![city, address, maritalStatus, companyName, position, department, workplace, email].every(Boolean)) {
        rowErrors.push("No se permiten campos requeridos vacios.");
      }
      if (!isValidEmail(email)) rowErrors.push("Correo electrónico inválido.");
      if (!monthlySalary) rowErrors.push("Sueldo mensual inválido.");
      if (!salaryDeductionPercent || salaryDeductionPercent < 4) rowErrors.push("El porcentaje de descuento debe ser 4% o mayor.");
      if (!["SOLTERO", "CASADO", "UNION LIBRE"].includes(maritalStatus)) rowErrors.push("Estado civil inválido.");
      if ((maritalStatus === "CASADO" || maritalStatus === "UNION LIBRE") && !spouseName) {
        rowErrors.push("Debe indicar el nombre del conyuge.");
      }

      const company = await prisma.enrollmentCompany.findFirst({
        where: { formId, name: companyName, isActive: true },
        select: { id: true }
      });
      if (!company) rowErrors.push("Empresa no disponible en el formulario.");

      let raffleResultId: string | null = null;
      if (receivedPrize) {
        const code = prizeCode!;
        const result = await prisma.raffleResult.findUnique({
          where: { code },
          select: { id: true, environment: true }
        });
        if (!result) {
          rowErrors.push(`El código de premio ${code} no existe en el histórico.`);
        } else {
          if (result.environment !== RaffleEnvironment.PRESENTIAL) rowErrors.push(`El código ${code} no corresponde a un premio presencial.`);
          const linked = await prisma.enrollmentSubmission.findFirst({
            where: {
              OR: [{ raffleResultId: result.id }, { prizeCode: code }]
            },
            select: { id: true }
          });
          if (linked) rowErrors.push(`El código de premio ${code} ya está vinculado a otra solicitud.`);
          raffleResultId = result.id;
        }
      }

      const fullName = displayName;
      [
        fileDuplicateMessage(phones, mobilePhone, rowNumber, "Celular"),
        fileDuplicateMessage(names, fullName, rowNumber, "Nombre y apellido"),
        fileDuplicateMessage(documents, documentId, rowNumber, "Cédula"),
        fileDuplicateMessage(employeeNumbers, employeeNumber, rowNumber, "NIE"),
        fileDuplicateMessage(emails, email, rowNumber, "Correo electrónico"),
        prizeCode ? fileDuplicateMessage(prizeCodes, prizeCode, rowNumber, "Código de premio") : null
      ].forEach((message) => {
        if (message) rowErrors.push(message);
      });

      if (firstName && lastName && documentId && employeeNumber && mobilePhone && email) {
        const duplicate = await checkPersonDuplicate({ firstName, lastName, documentId, employeeNumber, phone: mobilePhone, email });
        if (duplicate) rowErrors.push(duplicate.message);
      }

      if (rowErrors.length) {
        errors.push({ row: rowNumber, message: participantErrorMessage(rowNumber, displayName, rowErrors) });
        invalidRows.add(rowNumber);
        continue;
      }

      rows.push({
        rowNumber,
        firstName,
        lastName,
        documentId,
        residencePhone,
        mobilePhone,
        city,
        address,
        maritalStatus,
        spouseName,
        companyName,
        position,
        department,
        workplace,
        email,
        monthlySalary: monthlySalary ?? 0,
        employeeNumber,
        bankAccountNumber: value("cta_banco_no") || null,
        bankName: value("nombre_banco") || null,
        salaryDeductionPercent: salaryDeductionPercent ?? 0,
        receivedPrize,
        prizeCode,
        raffleResultId
      });
    } catch (error) {
      errors.push({ row: rowNumber, message: participantErrorMessage(rowNumber, "", [error instanceof Error ? error.message : "Datos inválidos."]) });
    }
  }

  return { rows: rows.filter((row) => !invalidRows.has(row.rowNumber)), errors, processed: lines.length - 1 };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canSpinPresential(user)) return jsonError("No autorizado.", 403);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Debe seleccionar un archivo CSV.", 422);
  if (!file.name.toLowerCase().endsWith(".csv")) return jsonError("El archivo debe ser CSV.", 422);

  const formConfig = await ensureEnrollmentForm(user!.id);
  const now = new Date();
  const instantEvent = await prisma.eventEdition.findFirst({
    where: {
      status: "ACTIVE",
      eventType: { code: EVENT_TYPE_CODES.AFFILIATION_INSTANT },
      promotionStartAt: { lte: now },
      promotionEndAt: { gte: now },
      prizes: { some: { isActive: true, availableQuantity: { gt: 0 } } }
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { id: true }
  });
  const { rows, errors, processed } = await parseRows(await file.text(), formConfig.id);
  if (rows.length === 0) {
    return NextResponse.json({ processed, created: 0, linksCreated: 0, prizesLinked: 0, rejected: rejectedCount(errors), errors }, { status: 422 });
  }

  let linksCreated = 0;
  let prizesLinked = 0;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const submissions = [];
      for (const row of rows) {
        let digitalParticipantId: string | null = null;
        let digitalLinkId: string | null = null;

        if (!row.receivedPrize && instantEvent) {
          const participant = await tx.digitalParticipant.create({
            data: {
              firstName: row.firstName,
              lastName: row.lastName,
              nie: row.documentId,
              email: row.email,
              name: buildFullName(row.firstName, row.lastName),
              phone: row.mobilePhone,
              links: {
                create: {
                  token: generateToken(),
                  createdById: user!.id
                }
              }
            },
            include: { links: true }
          });
          digitalParticipantId = participant.id;
          digitalLinkId = participant.links[0]?.id || null;
          if (digitalLinkId) linksCreated += 1;
        } else {
          prizesLinked += 1;
        }

        const submission = await tx.enrollmentSubmission.create({
          data: {
            formId: formConfig.id,
            firstName: row.firstName,
            lastName: row.lastName,
            documentId: row.documentId,
            residencePhone: row.residencePhone,
            mobilePhone: row.mobilePhone,
            address: row.address,
            city: row.city,
            maritalStatus: row.maritalStatus,
            spouseName: row.spouseName,
            profession: "No aplica",
            birthDate: new Date("1900-01-01T00:00:00"),
            position: row.position,
            companyName: row.companyName,
            department: row.department,
            workPhone: null,
            workplace: row.workplace,
            email: row.email,
            monthlySalary: row.monthlySalary,
            employeeNumber: row.employeeNumber,
            bankAccountNumber: row.bankAccountNumber,
            bankName: row.bankName,
            salaryDeductionPercent: row.salaryDeductionPercent,
            acceptsTerms: true,
            channel: EnrollmentSubmissionChannel.PRESENTIAL_FISICO,
            receivedPrize: row.receivedPrize,
            prizeCode: row.prizeCode,
            raffleResultId: row.raffleResultId,
            eventEditionId: instantEvent?.id || null,
            digitalParticipantId,
            digitalLinkId
          }
        });
        submissions.push(submission);
      }
      return submissions;
    });

    return NextResponse.json({
      processed,
      created: created.length,
      linksCreated,
      prizesLinked,
      rejected: rejectedCount(errors),
      errors
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("La carga contiene datos duplicados existentes.", 409);
    }
    throw error;
  }
}
