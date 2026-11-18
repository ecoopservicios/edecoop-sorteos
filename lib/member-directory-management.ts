import type { Prisma } from "@prisma/client";
import type { MemberUploadError, MemberUploadRow } from "./member-directory-upload";

export type MemberImportMode = "append" | "replace";
type ExistingMember = { id: string; firstName: string; lastName: string; documentId: string | null; employeeNumber: string | null; isActive: boolean };
type ParsedUpload = { rows: MemberUploadRow[]; errors: MemberUploadError[]; processed: number };

export class MemberDirectoryError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

export function memberImportMode(value: unknown, confirmation: unknown): MemberImportMode {
  if (value !== "append" && value !== "replace") throw new MemberDirectoryError("Selecciona si deseas agregar al listado existente o reemplazarlo.");
  if (value === "replace" && confirmation !== "REEMPLAZAR") throw new MemberDirectoryError("Escribe REEMPLAZAR para confirmar el cambio del listado de esta empresa.");
  return value;
}

export async function lockMemberDirectory(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"member-directory-management"}))`;
}

export function planMemberImport(rows: MemberUploadRow[], existing: ExistingMember[], mode: MemberImportMode) {
  const documents = new Map(existing.filter(row => row.documentId).map(row => [row.documentId, row]));
  const employees = new Map(existing.filter(row => row.employeeNumber).map(row => [row.employeeNumber, row]));
  const accepted: Array<{ row: MemberUploadRow; previous?: ExistingMember }> = [];
  const errors: MemberUploadError[] = [];
  const duplicates: MemberUploadError[] = [];
  for (const row of rows) {
    const documentMatch = documents.get(row.documentId);
    const employeeMatch = row.employeeNumber ? employees.get(row.employeeNumber) : undefined;
    const previous = documentMatch || employeeMatch;
    const matches = [documentMatch ? `cédula ${row.documentId}` : "", employeeMatch ? `NIE ${row.employeeNumber}` : ""].filter(Boolean);
    if (previous) duplicates.push({ row: row.rowNumber, message: `Fila ${row.rowNumber}: ${matches.join(" y ")} ya registrado para ${previous.firstName} ${previous.lastName}${previous.isActive ? "." : " en el historial."}` });
    let conflict = "";
    if (documentMatch && employeeMatch && documentMatch.id !== employeeMatch.id) conflict = `La cédula ${row.documentId} y el NIE ${row.employeeNumber} corresponden a socios distintos.`;
    else if (previous?.documentId && previous.documentId !== row.documentId) conflict = `El NIE ${row.employeeNumber} pertenece a otra cédula (${previous.documentId}).`;
    else if (previous?.employeeNumber && row.employeeNumber && previous.employeeNumber !== row.employeeNumber) conflict = `La cédula ${row.documentId} tiene otro NIE registrado (${previous.employeeNumber}).`;
    else if (mode === "append" && previous?.isActive) conflict = `Duplicado: ${matches.join(" y ")} ya existe en el listado. No se modificó el socio.`;
    if (conflict) errors.push({ row: row.rowNumber, message: `Fila ${row.rowNumber} - ${row.firstName} ${row.lastName}: ${conflict}` });
    else accepted.push({ row, previous });
  }
  return { accepted, errors, duplicates };
}

export async function importMemberDirectory(tx: Prisma.TransactionClient, parsed: ParsedUpload, options: {
  enrollmentCompanyId: string; userId: string; mode: MemberImportMode; expectedCount?: number; fileName: string;
}) {
  await lockMemberDirectory(tx);
  const existing = await tx.memberDirectory.findMany({
    where: { enrollmentCompanyId: options.enrollmentCompanyId },
    select: { id: true, firstName: true, lastName: true, documentId: true, employeeNumber: true, isActive: true }
  });
  const previousCount = existing.filter(row => row.isActive).length;
  if (options.mode === "replace" && previousCount !== options.expectedCount) throw new MemberDirectoryError("El listado cambió desde que abriste la ventana. Actualiza la página y confirma nuevamente el reemplazo.", 409);
  const plan = planMemberImport(parsed.rows, existing, options.mode);
  const errors = [...parsed.errors, ...plan.errors].sort((a, b) => a.row - b.row);
  const base = { processed: parsed.processed, created: 0, updated: 0, restored: 0, removed: 0, rejected: errors.length, errors, duplicates: plan.duplicates, applied: false };
  if ((options.mode === "replace" && errors.length) || !plan.accepted.length) return {
    ...base, rejected: parsed.rows.length ? errors.length : parsed.processed || errors.length,
    error: options.mode === "replace" ? "No se reemplazó el listado. Corrige todos los errores del archivo y vuelve a cargarlo." : "No hay filas nuevas válidas para agregar. Revisa los errores y duplicados."
  };
  let removed = 0;
  if (options.mode === "replace") {
    const retained = plan.accepted.flatMap(item => item.previous ? [item.previous.id] : []);
    const result = await tx.memberDirectory.updateMany({
      where: { enrollmentCompanyId: options.enrollmentCompanyId, isActive: true, id: { notIn: retained } },
      data: { isActive: false }
    });
    removed = result.count;
  }
  let updated = 0, restored = 0;
  for (const { row, previous } of plan.accepted) {
    if (!previous) continue;
    // Keep the original member ID so received submissions and validation links remain attached.
    await tx.memberDirectory.update({ where: { id: previous.id }, data: {
      firstName: row.firstName, lastName: row.lastName, documentId: row.documentId,
      employeeNumber: row.employeeNumber ?? previous.employeeNumber, isActive: true, loadedById: options.userId
    } });
    if (previous.isActive) updated++; else restored++;
  }
  const newRows = plan.accepted.filter(item => !item.previous).map(({ row }) => ({
    enrollmentCompanyId: options.enrollmentCompanyId, firstName: row.firstName, lastName: row.lastName,
    documentId: row.documentId, employeeNumber: row.employeeNumber, loadedById: options.userId
  }));
  const created = newRows.length ? (await tx.memberDirectory.createMany({ data: newRows })).count : 0;
  await tx.auditLog.create({ data: {
    action: options.mode === "replace" ? "MEMBER_DIRECTORY_REPLACED" : "MEMBER_DIRECTORY_IMPORTED",
    entityType: "MemberDirectory", entityId: options.enrollmentCompanyId, userId: options.userId,
    reason: options.mode === "replace" ? "Listado de la empresa reemplazado con confirmación. Se conservan las solicitudes recibidas." : "Socios agregados al listado existente.",
    metadata: { fileName: options.fileName, previousCount, created, updated, restored, removed, rejected: errors.length }
  } });
  return { ...base, applied: true, created, updated, restored, removed };
}

export async function clearMemberDirectory(tx: Prisma.TransactionClient, options: { enrollmentCompanyId: string | null; expectedCount: number; userId: string }) {
  await lockMemberDirectory(tx);
  const where = { isActive: true, ...(options.enrollmentCompanyId ? { enrollmentCompanyId: options.enrollmentCompanyId } : {}) };
  const previousCount = await tx.memberDirectory.count({ where });
  if (previousCount !== options.expectedCount) throw new MemberDirectoryError("El listado cambió. Actualiza la página y confirma nuevamente la eliminación.", 409);
  const preservedSubmissions = await tx.memberDataUpdateSubmission.count({ where: { memberDirectory: where } });
  // Remove members from the active list without deleting the received submissions or their history.
  const removed = await tx.memberDirectory.updateMany({ where, data: { isActive: false } });
  await tx.auditLog.create({ data: {
    action: "MEMBER_DIRECTORY_CLEARED", entityType: "MemberDirectory", entityId: options.enrollmentCompanyId || "all",
    reason: "Listado activo eliminado con confirmación. Las solicitudes recibidas y el historial se conservan.", userId: options.userId,
    metadata: { previousCount, removed: removed.count, preservedSubmissions }
  } });
  return { removed: removed.count, preservedSubmissions };
}
