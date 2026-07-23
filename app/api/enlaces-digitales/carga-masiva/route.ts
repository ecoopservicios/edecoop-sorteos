import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/codes";
import { buildFullName, validatePersonName } from "@/lib/participants";
import { normalizePhone } from "@/lib/whatsapp";
import { checkPersonDuplicate } from "@/lib/duplicate-protection";

type ParsedRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  nie: string;
  email: string;
  phone: string;
  name: string;
};

type BulkError = {
  row: number;
  message: string;
};

const EXPECTED_HEADERS = ["nombre", "apellido", "nie", "correo_electronico", "celular_o_movil"];

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

function rejectedCount(errors: BulkError[]) {
  return new Set(errors.map((error) => error.row)).size;
}

function addDuplicateError(map: Map<string, number>, value: string, row: number, label: string, errors: BulkError[]) {
  const existingRow = map.get(value);
  if (existingRow) {
    errors.push({ row, message: `${label} repetido en el archivo. Tambien aparece en la fila ${existingRow}.` });
    return true;
  }
  map.set(value, row);
  return false;
}

function parseParticipantsCsv(text: string) {
  const errors: BulkError[] = [];
  const rows: ParsedRow[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    return { rows, errors: [{ row: 1, message: "El archivo debe incluir encabezados y al menos un participante." }], processed: 0 };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const missing = EXPECTED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) {
    return { rows, errors: [{ row: 1, message: `Faltan columnas requeridas: ${missing.join(", ")}.` }], processed: 0 };
  }

  const indexByHeader = Object.fromEntries(headers.map((header, index) => [header, index])) as Record<string, number>;
  const phones = new Map<string, number>();
  const names = new Map<string, number>();
  const nies = new Map<string, number>();
  const emails = new Map<string, number>();
  const invalidRows = new Set<number>();

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const rowNumber = lineIndex + 1;
    const columns = parseCsvLine(lines[lineIndex]);
    const rawFirstName = columns[indexByHeader.nombre] || "";
    const rawLastName = columns[indexByHeader.apellido] || "";
    const rawNie = columns[indexByHeader.nie] || "";
    const rawEmail = columns[indexByHeader.correo_electronico] || "";
    const rawPhone = columns[indexByHeader.celular_o_movil] || "";

    if (![rawFirstName, rawLastName, rawNie, rawEmail, rawPhone].every((value) => value.trim())) {
      errors.push({ row: rowNumber, message: "No se permiten campos vacios." });
      continue;
    }

    let firstName = "";
    let lastName = "";
    let phone = "";
    try {
      firstName = validatePersonName(rawFirstName, "Nombre");
      lastName = validatePersonName(rawLastName, "Apellido");
      phone = normalizePhone(rawPhone);
    } catch (error) {
      errors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Datos inválidos." });
      continue;
    }

    const nie = rawNie.trim();
    const email = rawEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      errors.push({ row: rowNumber, message: "Correo electrónico inválido." });
      continue;
    }

    const name = buildFullName(firstName, lastName);
    const hasFileDuplicate = [
      addDuplicateError(phones, phone, rowNumber, "Celular o movil", errors),
      addDuplicateError(names, name, rowNumber, "Nombre y apellido", errors),
      addDuplicateError(nies, nie, rowNumber, "NIE", errors),
      addDuplicateError(emails, email, rowNumber, "Correo electrónico", errors)
    ].some(Boolean);
    if (hasFileDuplicate) invalidRows.add(rowNumber);

    rows.push({ rowNumber, firstName, lastName, nie, email, phone, name });
  }

  return { rows: rows.filter((row) => !invalidRows.has(row.rowNumber)), errors, processed: lines.length - 1 };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Debe seleccionar un archivo CSV.", 422);
  if (!file.name.toLowerCase().endsWith(".csv")) return jsonError("El archivo debe ser CSV.", 422);

  const { rows, errors, processed } = parseParticipantsCsv(await file.text());
  if (rows.length === 0) {
    return NextResponse.json({ processed, created: 0, rejected: rejectedCount(errors), errors }, { status: 422 });
  }

  const validRows: ParsedRow[] = [];
  for (const row of rows) {
    const duplicate = await checkPersonDuplicate({
      firstName: row.firstName,
      lastName: row.lastName,
      employeeNumber: row.nie,
      phone: row.phone,
      email: row.email
    });
    if (duplicate) {
      errors.push({ row: row.rowNumber, message: duplicate.message });
      continue;
    }
    validRows.push(row);
  }

  if (validRows.length === 0) {
    return NextResponse.json({ processed, created: 0, rejected: rejectedCount(errors), errors }, { status: 422 });
  }

  try {
    const created = await prisma.$transaction(
      validRows.map((row) =>
        prisma.digitalParticipant.create({
          data: {
            firstName: row.firstName,
            lastName: row.lastName,
            nie: row.nie,
            email: row.email,
            name: row.name,
            phone: row.phone,
            links: {
              create: {
                token: generateToken(),
                createdById: user!.id
              }
            }
          }
        })
      )
    );

    return NextResponse.json({
      processed,
      created: created.length,
      rejected: rejectedCount(errors),
      errors
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("La carga contiene participantes duplicados existentes. Revise teléfono, NIE, correo o nombre.", 409);
    }
    throw error;
  }
}
