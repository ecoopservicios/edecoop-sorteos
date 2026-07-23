import { EventEditionStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { EVENT_TYPE_CODES } from "@/lib/events";
import { validatePersonName } from "@/lib/participants";

type BulkError = { row: number; message: string };

const EXPECTED_HEADERS = ["nombres", "apellidos", "cedula", "nie", "telefono", "correo_electronico", "zona"];

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

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function isValidEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function rejectedCount(errors: BulkError[]) {
  return new Set(errors.map((error) => error.row)).size;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const form = await request.formData();
  const eventEditionId = String(form.get("eventEditionId") || "").trim();
  const file = form.get("file");
  if (!eventEditionId) return jsonError("Debe seleccionar un evento.", 422);
  if (!(file instanceof File)) return jsonError("Debe seleccionar un archivo CSV.", 422);

  const event = await prisma.eventEdition.findUnique({ where: { id: eventEditionId }, include: { eventType: true } });
  if (!event) return jsonError("Evento no encontrado.", 404);
  if (event.status === EventEditionStatus.CLOSED) return jsonError("No se pueden cargar participantes a un evento cerrado.", 409);
  if (event.eventType.code === EVENT_TYPE_CODES.AFFILIATION_INSTANT || event.eventType.code === EVENT_TYPE_CODES.AFFILIATION_FINAL) {
    return jsonError("Los eventos de afiliación usan la tabla de solicitudes recibidas.", 409);
  }

  const lines = (await file.text()).replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return NextResponse.json({ processed: 0, created: 0, rejected: 1, errors: [{ row: 1, message: "El archivo debe incluir encabezados y participantes." }] }, { status: 422 });
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const missing = EXPECTED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) {
    return NextResponse.json({ processed: 0, created: 0, rejected: 1, errors: [{ row: 1, message: `Faltan columnas: ${missing.join(", ")}.` }] }, { status: 422 });
  }

  const indexByHeader = Object.fromEntries(headers.map((header, index) => [header, index])) as Record<string, number>;
  const errors: BulkError[] = [];
  const rows = [];
  const seen = new Set<string>();

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const rowNumber = lineIndex + 1;
    const columns = parseCsvLine(lines[lineIndex]);
    const value = (header: string) => columns[indexByHeader[header]] || "";
    try {
      const firstName = validatePersonName(value("nombres"), "Nombres");
      const lastName = validatePersonName(value("apellidos"), "Apellidos");
      const documentId = digits(value("cedula")) || null;
      const employeeNumber = digits(value("nie")) || null;
      const phone = digits(value("telefono")) || null;
      const email = value("correo_electronico").trim().toLowerCase() || null;
      const zone = value("zona").trim().toUpperCase() || null;
      if (event.usesZones && !zone) throw new Error("Debe indicar la zona.");
      if (!documentId && !employeeNumber && !phone && !email) throw new Error("Debe incluir al menos cédula, NIE, teléfono o correo.");
      if (email && !isValidEmail(email)) throw new Error("Correo electrónico inválido.");
      const key = [documentId, employeeNumber, phone, email].filter(Boolean).join("|");
      if (seen.has(key)) throw new Error("Participante duplicado en el archivo.");
      seen.add(key);
      const or: Prisma.EventParticipantWhereInput[] = [];
      if (documentId) or.push({ documentId });
      if (employeeNumber) or.push({ employeeNumber });
      if (phone) or.push({ phone });
      if (email) or.push({ email });
      const existing = await prisma.eventParticipant.findFirst({
        where: {
          eventEditionId,
          OR: or
        },
        select: { id: true }
      });
      if (existing) throw new Error("Participante ya existe en este evento.");
      rows.push({ eventEditionId, firstName, lastName, documentId, employeeNumber, phone, email, zone });
    } catch (error) {
      errors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Datos inválidos." });
    }
  }

  if (!rows.length) {
    return NextResponse.json({ processed: lines.length - 1, created: 0, rejected: rejectedCount(errors), errors }, { status: 422 });
  }

  await prisma.eventParticipant.createMany({ data: rows });
  return NextResponse.json({ processed: lines.length - 1, created: rows.length, rejected: rejectedCount(errors), errors });
}
