import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createDataUpdateProof, dataUpdateRateLimit, readDataUpdateProof } from "@/lib/data-update-security";

const NAME_CONNECTORS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y"]);

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

function similarToken(expected: string, actual: string) {
  if (expected === actual) return true;
  if (expected.length < 4 || actual.length < 4) return false;
  return 1 - editDistance(expected, actual) / Math.max(expected.length, actual.length) >= 0.76;
}

function nameMatch(expectedName: string, ocrText: string) {
  const expected = normalized(expectedName).split(" ").filter(token => token.length > 1 && !NAME_CONNECTORS.has(token));
  const actual = normalized(ocrText).split(" ").filter(token => /^[A-Z]+$/.test(token));
  const matched = expected.filter(token => actual.some(candidate => similarToken(token, candidate))).length;
  const required = expected.length <= 2 ? expected.length : Math.max(2, Math.ceil(expected.length * 0.6));
  return matched >= required;
}

function numberMatch(expected: string, lines: string[]) {
  return lines.some(line => {
    const digitGroups: string[] = line.match(/\d+/g) ?? [];
    return digitGroups.includes(expected) || (expected.length === 11 && digitGroups.join("") === expected);
  });
}

export async function POST(request: NextRequest) {
  try {
    const limited = await dataUpdateRateLimit(request, "document");
    if (limited) return limited;
    const payload = await request.json();
    const proof = readDataUpdateProof(payload.verificationToken);
    if (!proof) return jsonError("La validación de identidad venció. Vuelve a consultar tus datos.", 403);
    const kind = payload.kind === "EMPLOYEE_CARD" ? "EMPLOYEE_CARD" : payload.kind === "DOCUMENT_ID" ? "DOCUMENT_ID" : null;
    if (!kind || !Array.isArray(payload.lines) || payload.lines.length > 40) return jsonError("Lectura de documento no válida.", 422);
    const lines = payload.lines.map((line: unknown) => {
      if (!line || typeof line !== "object") return "";
      const item = line as { text?: unknown; score?: unknown };
      return typeof item.text === "string" && item.text.length <= 160 && typeof item.score === "number" && item.score >= 0.3 ? item.text : "";
    }).filter(Boolean);
    if (!lines.length) return jsonError("No pudimos leer el documento. Toma otra foto con mejor iluminación.", 422);

    const member = await prisma.memberDirectory.findFirst({ where: { id: proof.memberId, isActive: true }, include: { enrollmentCompany: true } });
    if (!member || !member.enrollmentCompany.dataUpdateEnabled) return jsonError("Registro no disponible.", 404);
    const expectedNumber = kind === "EMPLOYEE_CARD" ? member.employeeNumber : member.documentId;
    const expectedKind = member.enrollmentCompany.dataUpdateLookupField === "EMPLOYEE_NUMBER" ? "EMPLOYEE_CARD" : "DOCUMENT_ID";
    if (kind !== expectedKind || !expectedNumber) return jsonError("El tipo de documento no corresponde a esta consulta.", 422);
    const allText = lines.join(" ");
    const fullName = `${member.firstName} ${member.lastName}`.trim();
    if (!numberMatch(expectedNumber, lines) || !nameMatch(fullName, allText)) {
      return jsonError(`No pudimos confirmar el número y el nombre en ${kind === "EMPLOYEE_CARD" ? "el carnet" : "la cédula"}. Verifica que el documento esté completo, enfocado y sin reflejos.`, 422);
    }

    return NextResponse.json({
      verified: true,
      message: `Confirmamos el documento de ${fullName}.`,
      verificationToken: createDataUpdateProof(member.id, proof.lookup, member.documentId, "identity", true)
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo validar el documento.", 422);
  }
}
