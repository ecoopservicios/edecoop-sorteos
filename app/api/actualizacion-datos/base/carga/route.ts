import { MemberLookupField, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { jsonError } from "@/lib/api";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { normalizeDigits, tenDigitContactPhone } from "@/lib/data-update";
import { prisma } from "@/lib/db";
import { validatePersonName } from "@/lib/participants";

type ParsedRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  documentId: string | null;
  employeeNumber: string | null;
  personalPhone: string | null;
  whatsappPhone: string | null;
  personalEmail: string | null;
};

type BulkError = {
  row: number;
  message: string;
};

const HEADERS = ["nombres", "apellidos", "cedula", "numero_empleado", "telefono_actual", "whatsapp_actual", "correo_actual"];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeOptionalEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (!isValidEmail(email)) throw new Error("Correo actual invalido.");
  return email;
}

function normalizeOptionalPhone(value: string, label: string) {
  if (!value.trim()) return null;
  return tenDigitContactPhone(value, label);
}

function normalizeDocument(value: string, required: boolean) {
  const clean = normalizeDigits(value);
  if (!clean) {
    if (required) throw new Error("La cedula es requerida para esta empresa.");
    return null;
  }
  if (clean.length !== 11) throw new Error("La cedula debe contener exactamente 11 numeros.");
  return clean;
}

function normalizeEmployeeNumber(value: string, required: boolean) {
  const clean = normalizeDigits(value);
  if (!clean) {
    if (required) throw new Error("El numero de empleado es requerido para esta empresa.");
    return null;
  }
  if (clean.length > 5) throw new Error("El numero de empleado debe contener maximo 5 numeros.");
  return clean;
}

function duplicateInFile(map: Map<string, number>, value: string | null, row: number, label: string) {
  if (!value) return null;
  const existing = map.get(value);
  if (existing) return `${label} repetido en el archivo. Tambien aparece en la fila ${existing}.`;
  map.set(value, row);
  return null;
}

function parseRows(buffer: Buffer, lookupField: MemberLookupField) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const parsed: ParsedRow[] = [];
  const errors: BulkError[] = [];
  const documents = new Map<string, number>();
  const employeeNumbers = new Map<string, number>();

  if (!rows.length) {
    return { rows: parsed, errors: [{ row: 1, message: "El archivo debe incluir al menos un socio." }], processed: 0 };
  }

  const firstRowHeaders = Object.keys(rows[0] || {}).map(normalizeHeader);
  const missing = HEADERS.filter((header) => !firstRowHeaders.includes(header));
  if (missing.length) {
    return { rows: parsed, errors: [{ row: 1, message: `Faltan columnas requeridas: ${missing.join(", ")}.` }], processed: rows.length };
  }

  rows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const normalized = Object.fromEntries(Object.entries(raw).map(([key, value]) => [normalizeHeader(key), text(value)]));
    const rowErrors: string[] = [];
    let firstName = "";
    let lastName = "";
    let documentId: string | null = null;
    let employeeNumber: string | null = null;
    let personalPhone: string | null = null;
    let whatsappPhone: string | null = null;
    let personalEmail: string | null = null;

    try {
      firstName = validatePersonName(normalized.nombres || "", "Nombres");
    } catch (error) {
      rowErrors.push(error instanceof Error ? error.message : "Nombre invalido.");
    }
    try {
      lastName = validatePersonName(normalized.apellidos || "", "Apellidos");
    } catch (error) {
      rowErrors.push(error instanceof Error ? error.message : "Apellido invalido.");
    }
    try {
      documentId = normalizeDocument(normalized.cedula || "", lookupField === MemberLookupField.DOCUMENT_ID);
    } catch (error) {
      rowErrors.push(error instanceof Error ? error.message : "Cedula invalida.");
    }
    try {
      employeeNumber = normalizeEmployeeNumber(normalized.numero_empleado || "", lookupField === MemberLookupField.EMPLOYEE_NUMBER);
    } catch (error) {
      rowErrors.push(error instanceof Error ? error.message : "Numero de empleado invalido.");
    }
    try {
      personalPhone = normalizeOptionalPhone(normalized.telefono_actual || "", "Telefono actual");
    } catch (error) {
      rowErrors.push(error instanceof Error ? error.message : "Telefono actual invalido.");
    }
    try {
      whatsappPhone = normalizeOptionalPhone(normalized.whatsapp_actual || "", "WhatsApp actual");
    } catch (error) {
      rowErrors.push(error instanceof Error ? error.message : "WhatsApp actual invalido.");
    }
    try {
      personalEmail = normalizeOptionalEmail(normalized.correo_actual || "");
    } catch (error) {
      rowErrors.push(error instanceof Error ? error.message : "Correo actual invalido.");
    }

    [
      duplicateInFile(documents, documentId, rowNumber, "Cedula"),
      duplicateInFile(employeeNumbers, employeeNumber, rowNumber, "Numero de empleado")
    ].forEach((message) => {
      if (message) rowErrors.push(message);
    });

    if (rowErrors.length) {
      const name = `${normalized.nombres || ""} ${normalized.apellidos || ""}`.trim() || "SOCIO SIN NOMBRE";
      errors.push({ row: rowNumber, message: `Fila ${rowNumber} - ${name}: ${rowErrors.join(" ")}` });
      return;
    }

    parsed.push({ rowNumber, firstName, lastName, documentId, employeeNumber, personalPhone, whatsappPhone, personalEmail });
  });

  return { rows: parsed, errors, processed: rows.length };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const form = await request.formData();
  const enrollmentCompanyId = String(form.get("enrollmentCompanyId") || "");
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Debe seleccionar un archivo Excel.", 422);

  const company = await prisma.enrollmentCompany.findFirst({
    where: { id: enrollmentCompanyId, isActive: true, dataUpdateEnabled: true }
  });
  if (!company || !company.dataUpdateLookupField) return jsonError("Empresa no disponible para actualizacion de datos.", 422);

  const { rows, errors, processed } = parseRows(Buffer.from(await file.arrayBuffer()), company.dataUpdateLookupField);
  if (!rows.length) return NextResponse.json({ processed, created: 0, rejected: errors.length, errors }, { status: 422 });

  const existing = await prisma.memberDirectory.findMany({
    where: {
      enrollmentCompanyId,
      OR: [
        { documentId: { in: rows.map((row) => row.documentId).filter(Boolean) as string[] } },
        { employeeNumber: { in: rows.map((row) => row.employeeNumber).filter(Boolean) as string[] } }
      ]
    },
    select: { documentId: true, employeeNumber: true, firstName: true, lastName: true }
  });

  const existingDocuments = new Set(existing.map((row) => row.documentId).filter(Boolean));
  const existingEmployees = new Set(existing.map((row) => row.employeeNumber).filter(Boolean));
  const validRows = rows.filter((row) => {
    const rowErrors: string[] = [];
    if (row.documentId && existingDocuments.has(row.documentId)) rowErrors.push("La cedula ya existe en la base de socios.");
    if (row.employeeNumber && existingEmployees.has(row.employeeNumber)) rowErrors.push("El numero de empleado ya existe en la base de socios.");
    if (rowErrors.length) {
      errors.push({ row: row.rowNumber, message: `Fila ${row.rowNumber} - ${row.firstName} ${row.lastName}: ${rowErrors.join(" ")}` });
      return false;
    }
    return true;
  });

  if (!validRows.length) return NextResponse.json({ processed, created: 0, rejected: errors.length, errors }, { status: 409 });

  try {
    await prisma.memberDirectory.createMany({
      data: validRows.map((row) => ({
        enrollmentCompanyId,
        firstName: row.firstName,
        lastName: row.lastName,
        documentId: row.documentId,
        employeeNumber: row.employeeNumber,
        personalPhone: row.personalPhone,
        whatsappPhone: row.whatsappPhone,
        personalEmail: row.personalEmail,
        loadedById: user!.id
      }))
    });

    return NextResponse.json({ processed, created: validRows.length, rejected: errors.length, errors });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("La carga contiene socios duplicados existentes. Revise cedula y numero de empleado.", 409);
    }
    throw error;
  }
}
