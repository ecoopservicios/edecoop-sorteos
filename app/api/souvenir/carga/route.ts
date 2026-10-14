import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { normalizeSouvenirHeader, SOUVENIR_HEADERS } from "@/lib/souvenir-template";
import { buildSouvenirReport, souvenirFullName } from "@/lib/souvenir-report";
import { reviewSouvenirCompanies, souvenirCompanyKey } from "@/lib/souvenir-companies";
import { souvenirDeliveryMatch } from "@/lib/souvenir-deliveries";
import { resequenceSouvenirList } from "@/lib/souvenir-numbering";

function rowValues(raw: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(raw).map(([header, value]) => {
    const key = normalizeSouvenirHeader(header);
    const text = String(value ?? "");
    return [key, key === "nombres" || key === "apellidos" ? text : text.trim()];
  }));
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN" || user.mustChangePassword) return jsonError("No autorizado.", 403);
  const members = await prisma.souvenirMember.findMany({ where: { clearedAt: null }, include: { enrollmentCompany: { select: { name: true, dataUpdateLookupField: true } } } });
  return NextResponse.json({ members: members.sort((a, b) => a.listNumber - b.listNumber).map(m => ({ id: m.id, listNumber: m.listNumber, firstName: m.firstName, lastName: m.lastName, office: m.office, approximateLocation: m.approximateLocation, companyName: m.enrollmentCompany.name })), report: buildSouvenirReport(members.map(member => ({ ...member, companyName: member.enrollmentCompany.name, lookupField: member.enrollmentCompany.dataUpdateLookupField, rowLabel: "Socio registrado" }))) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN" || user.mustChangePassword) return jsonError("No autorizado.", 403);
  try {
    const form = await request.formData();
    const companies = await prisma.enrollmentCompany.findMany({ orderBy: { name: "asc" } });
    let mappings: Record<string, string> = {};
    try {
      const parsed = JSON.parse(String(form.get("companyMappings") || "{}"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.values(parsed).some(v => typeof v !== "string")) throw new Error();
      mappings = parsed;
    } catch { return jsonError("Las asociaciones de empresas no son válidas. Analice el archivo nuevamente.", 422); }
    const file = form.get("file");
    if (!(file instanceof File) || !/\.xlsx?$/i.test(file.name)) return jsonError("Seleccione un archivo Excel.", 422);
    if (file.size > 5 * 1024 * 1024) return jsonError("El archivo no debe superar 5 MB.", 422);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(fileBuffer).digest("hex");
    const applying = form.get("action") === "apply";
    if (applying && form.get("fileHash") !== fileHash) return jsonError("El archivo cambió. Analícelo nuevamente antes de aplicar la carga.", 409);
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return jsonError("El archivo no contiene una hoja de socios.", 422);
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
    if (!rawRows.length || rawRows.length > 5000) return jsonError("Cargue entre 1 y 5000 socios por archivo.", 422);
    const companyAnalysis = reviewSouvenirCompanies(rawRows.map((raw, index) => {
      const values = rowValues(raw);
      return { name: values.empresa || "", row: index + 2 };
    }), companies, mappings);
    const companiesByName = companyAnalysis.resolved;
    const reviewPayload = { companyReview: companyAnalysis.review, companyOptions: companyAnalysis.options };
    const report = buildSouvenirReport(rawRows.map((raw, index) => {
      const values = rowValues(raw);
      const company = companiesByName.get(souvenirCompanyKey(values.empresa || ""));
      return { firstName: values.nombres || "", lastName: values.apellidos || "", documentId: values.cedula_consulta || null, employeeNumber: values.no_empleado || null, companyName: company?.name || values.empresa || "Sin empresa", lookupField: company?.dataUpdateLookupField || null, rowLabel: `Fila ${index + 2}` };
    }));
    const errors: string[] = [...report.issues];
    const rows: { enrollmentCompanyId: string; firstName: string; lastName: string; documentId: string | null; displayDocumentId: string | null; employeeNumber: string | null; sex: string | null; office: string | null; unit: string | null; approximateLocation?: string | null; row: number }[] = [];
    const keys = Object.keys(rawRows[0]).map(normalizeSouvenirHeader);
    const requiredHeaders = SOUVENIR_HEADERS.filter(header => header !== "UBICACION APROXIMADA").map(normalizeSouvenirHeader);
    const missing = requiredHeaders.filter(k => !keys.includes(k));
    if (missing.length) return NextResponse.json({ error: `Faltan columnas: ${missing.join(", ")}.`, report }, { status: 422 });
    for (const [index, raw] of rawRows.entries()) {
      const row = index + 2;
      const values = rowValues(raw);
      const company = companiesByName.get(souvenirCompanyKey(values.empresa || ""));
      if (!company) {
        errors.push(`Fila ${row} · ${values.nombres} ${values.apellidos}: empresa desconocida, inactiva o sin identificación configurada: ${values.empresa || "(vacía)"}.`);
        continue;
      }
      const issues: string[] = [];
      const firstName = values.nombres || "", lastName = values.apellidos || "";
      const documentId = values.cedula_consulta || null;
      const displayDocumentId = values.cedula_mostrar || null;
      const employeeNumber = values.no_empleado || null;
      if ((company.dataUpdateLookupField === "DOCUMENT_ID" || documentId) && !/^\d{11}$/.test(documentId || "")) issues.push("La cédula debe tener 11 números sin símbolos.");
      if ((company.dataUpdateLookupField === "EMPLOYEE_NUMBER" || employeeNumber) && !/^\d+$/.test(employeeNumber || "")) issues.push("El número de empleado debe tener uno o más dígitos, sin letras ni símbolos.");
      if (displayDocumentId && displayDocumentId.length > 40) issues.push("CÉDULA MOSTRAR admite hasta 40 caracteres.");
      if (values.sexo.length > 30) issues.push("SEXO admite hasta 30 caracteres.");
      if (values.oficina.length > 200) issues.push("OFICINA admite hasta 200 caracteres.");
      if (values.unidad.length > 200) issues.push("UNIDAD admite hasta 200 caracteres.");
      if ((values.ubicacion_aproximada || "").length > 500) issues.push("UBICACION APROXIMADA admite hasta 500 caracteres.");
      if (issues.length) errors.push(`Fila ${row} · ${values.nombres} ${values.apellidos}: ${issues.join(" ")}`);
      rows.push({ enrollmentCompanyId: company.id, firstName, lastName, documentId, displayDocumentId, employeeNumber, sex: values.sexo || null, office: values.oficina || null, unit: values.unidad || null, ...("ubicacion_aproximada" in values ? { approximateLocation: values.ubicacion_aproximada || null } : {}), row });
    }
    const inputHasErrors = errors.length > 0;
    const existing = await prisma.souvenirMember.findMany({ select: { id: true, enrollmentCompanyId: true, firstName: true, lastName: true, documentId: true, employeeNumber: true } });
    const byDocument = new Map(existing.filter(m => m.documentId).map(m => [m.documentId, m]));
    const byEmployee = new Map(existing.filter(m => m.employeeNumber).map(m => [m.employeeNumber, m]));
    const byName = new Map(existing.map(m => [souvenirFullName(m.firstName, m.lastName), m]));
    const operations = rows.map(row => {
      const docMatch = row.documentId ? byDocument.get(row.documentId) : undefined;
      const employeeMatch = row.employeeNumber ? byEmployee.get(row.employeeNumber) : undefined;
      const nameMatch = byName.get(souvenirFullName(row.firstName, row.lastName));
      const match = docMatch || employeeMatch;
      if (docMatch && docMatch.enrollmentCompanyId !== row.enrollmentCompanyId) errors.push(`Fila ${row.row} · ${row.firstName} ${row.lastName}: cédula ya registrada para ${docMatch.firstName} ${docMatch.lastName} en otra empresa.`);
      if (employeeMatch && employeeMatch.enrollmentCompanyId !== row.enrollmentCompanyId) errors.push(`Fila ${row.row} · ${row.firstName} ${row.lastName}: número de empleado ya registrado para ${employeeMatch.firstName} ${employeeMatch.lastName} en otra empresa.`);
      if (nameMatch && nameMatch.id !== match?.id) errors.push(`Fila ${row.row} · ${row.firstName} ${row.lastName}: nombre completo exactamente igual a un socio ya registrado.`);
      if ((docMatch && employeeMatch && docMatch.id !== employeeMatch.id) || (match && ((row.documentId && match.documentId && row.documentId !== match.documentId) || (row.employeeNumber && match.employeeNumber && row.employeeNumber !== match.employeeNumber)))) errors.push(`Fila ${row.row} · ${row.firstName} ${row.lastName}: la cédula y el número de empleado corresponden a registros diferentes.`);
      return { row, match };
    });
    if (errors.length) return NextResponse.json({ error: [...new Set(errors)].join("\n"), report, ...reviewPayload }, { status: inputHasErrors ? 422 : 409 });
    const created = operations.filter(op => !op.match).length;
    if (!applying) return NextResponse.json({ preview: true, created, updated: operations.length - created, report, fileHash, ...reviewPayload });
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(209831)`;
      for (const { row, match } of operations) {
        const { row: rowNumber, ...data } = row;
        void rowNumber;
        const member = match ? await tx.souvenirMember.update({ where: { id: match.id }, data: { ...data, documentId: row.documentId || match.documentId, employeeNumber: row.employeeNumber || match.employeeNumber } }) : await tx.souvenirMember.create({ data: { ...data, loadedById: user.id } });
        const company = companies.find(c => c.id === member.enrollmentCompanyId)!;
        const priorDelivery = await tx.souvenirDelivery.findFirst({ where: souvenirDeliveryMatch(member, company.name) });
        if (priorDelivery && !priorDelivery.souvenirMemberId) await tx.souvenirDelivery.update({ where: { id: priorDelivery.id }, data: { souvenirMemberId: member.id } });
      }
      await tx.auditLog.create({ data: { action: "SOUVENIR_LIST_IMPORTED", entityType: "SouvenirMember", entityId: "souvenir-list", userId: user.id, reason: "Carga de listado independiente para entrega de souvenir", metadata: { created, updated: operations.length - created, companyIds: [...new Set(rows.map(row => row.enrollmentCompanyId))], companyMappings: mappings } } });
      await resequenceSouvenirList(tx);
    }, { timeout: 60000 });
    return NextResponse.json({ created, updated: operations.length - created, report });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("Hay identificaciones duplicadas. No se guardó ningún cambio del archivo.", 409);
    return jsonError(error instanceof Error ? error.message : "No se pudo cargar el listado.", 422);
  }
}
