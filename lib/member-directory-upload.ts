import * as XLSX from "xlsx";
import type { MemberLookupField } from "@prisma/client";

export const MEMBER_UPLOAD_HEADERS = ["nombre", "apellido", "nie", "cedula", "empresa"] as const;
export type MemberUploadError = { row: number; message: string };
export type MemberUploadRow = { rowNumber: number; firstName: string; lastName: string; documentId: string; employeeNumber: string | null };
export type MemberEditableRow = { rowNumber: number; firstName: string; lastName: string; employeeNumber: string; documentId: string; company: string };
export type MemberCorrectionRow = MemberEditableRow & { error: string };
type UploadCompany = { name: string; dataUpdateLookupField: MemberLookupField };

export function normalizeDirectoryText(value: string) {
  return value.normalize("NFD").replace(/n\u0303/gi, "\u00f1").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().trim().replace(/\s+/g, " ");
}

export function directoryName(value: string, label: string) {
  const name = normalizeDirectoryText(value);
  if (name.length < 2) throw new Error(`${label} debe tener al menos 2 letras.`);
  if (!/^[A-Z\u00d1 ]+$/.test(name)) throw new Error(`${label} solo puede contener letras y espacios.`);
  return name;
}

export function directoryDocument(value: string) {
  const text = value.trim();
  if (!text) throw new Error("La cédula es requerida.");
  if (!/^[\d\s-]+$/.test(text)) throw new Error("La cédula solo puede contener números, espacios o guiones.");
  const digits = text.replace(/[\s-]/g, "");
  if (digits.length !== 11) throw new Error("La cédula debe contener exactamente 11 dígitos. Revisa los ceros iniciales en Excel.");
  return digits;
}

export function directoryEmployee(value: string, required: boolean) {
  const text = value.trim();
  if (!text) {
    if (required) throw new Error("El NIE (número de empleado) es requerido para esta empresa.");
    return null;
  }
  if (!/^\d{1,5}$/.test(text)) throw new Error("El NIE (número de empleado) debe contener de 1 a 5 dígitos, sin letras ni símbolos.");
  return text;
}

function header(value: unknown) {
  const key = normalizeDirectoryText(String(value ?? "")).toLowerCase().replace(/[\s.-]+/g, "_");
  const aliases: Record<string, string> = { nombres: "nombre", apellidos: "apellido", numero_empleado: "nie", numero_de_empleado: "nie", empleado: "nie" };
  return aliases[key] || key;
}

function readCsv(buffer: Buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder("utf-16le").decode(buffer);
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return new TextDecoder("utf-16be").decode(buffer);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch { return new TextDecoder("windows-1252").decode(buffer); }
}

function validateMemberRows(sourceRows: MemberEditableRow[], company: UploadCompany, initialErrors = new Map<number, string[]>()) {
  const parsed: MemberUploadRow[] = [];
  const errors: MemberUploadError[] = [];
  const documents = new Map<string, number>();
  const employees = new Map<string, number>();
  for (const source of sourceRows) {
    const rowErrors = [...(initialErrors.get(source.rowNumber) || [])];
    let firstName = "", lastName = "", documentId = "";
    let employeeNumber: string | null = null;
    const validate = (action: () => void) => { try { action(); } catch (error) { rowErrors.push(error instanceof Error ? error.message : "Dato no válido."); } };
    validate(() => { firstName = directoryName(source.firstName, "Nombre"); });
    validate(() => { lastName = directoryName(source.lastName, "Apellido"); });
    validate(() => { documentId = directoryDocument(source.documentId); });
    validate(() => { employeeNumber = directoryEmployee(source.employeeNumber, company.dataUpdateLookupField === "EMPLOYEE_NUMBER"); });
    if (!source.company.trim()) rowErrors.push("La empresa es requerida.");
    else if (normalizeDirectoryText(source.company) !== normalizeDirectoryText(company.name)) rowErrors.push(`La empresa del registro no coincide con la seleccionada (${company.name}).`);
    if (!rowErrors.length) {
      const repeatedDocument = documents.get(documentId);
      const repeatedEmployee = employeeNumber ? employees.get(employeeNumber) : undefined;
      if (repeatedDocument) rowErrors.push(`La cédula ${documentId} está repetida en la fila ${repeatedDocument}.`);
      if (repeatedEmployee) rowErrors.push(`El NIE ${employeeNumber} está repetido en la fila ${repeatedEmployee}.`);
      if (!rowErrors.length) {
        documents.set(documentId, source.rowNumber);
        if (employeeNumber) employees.set(employeeNumber, source.rowNumber);
      }
    }
    if (rowErrors.length) errors.push({ row: source.rowNumber, message: `Fila ${source.rowNumber} - ${source.firstName} ${source.lastName}: ${rowErrors.join(" ")}` });
    else parsed.push({ rowNumber: source.rowNumber, firstName, lastName, documentId, employeeNumber });
  }
  if (!sourceRows.length) errors.push({ row: 1, message: "La carga debe incluir al menos un socio." });
  return { rows: parsed, errors, processed: sourceRows.length, sourceRows };
}

export function parseEditedMemberRows(value: unknown, company: UploadCompany) {
  if (!Array.isArray(value)) return validateMemberRows([], company);
  if (value.length > 10000) return { rows: [], errors: [{ row: 1, message: "La corrección no puede superar 10,000 filas." }], processed: value.length, sourceRows: [] as MemberEditableRow[] };
  const sourceRows = value.map((item, index) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const suppliedRow = Number(row.rowNumber);
    return {
      rowNumber: Number.isInteger(suppliedRow) && suppliedRow >= 2 ? suppliedRow : index + 2,
      firstName: String(row.firstName ?? "").trim(),
      lastName: String(row.lastName ?? "").trim(),
      employeeNumber: String(row.employeeNumber ?? "").trim(),
      documentId: String(row.documentId ?? "").trim(),
      company: String(row.company ?? "").trim()
    };
  });
  return validateMemberRows(sourceRows, company);
}

export function memberCorrectionRows(sourceRows: MemberEditableRow[], errors: MemberUploadError[], mode: "append" | "replace"): MemberCorrectionRow[] {
  const errorMessages = new Map<number, string[]>();
  for (const error of errors) errorMessages.set(error.row, [...(errorMessages.get(error.row) || []), error.message]);
  const rows = mode === "replace" ? sourceRows : sourceRows.filter(row => errorMessages.has(row.rowNumber));
  return rows.map(row => ({ ...row, error: (errorMessages.get(row.rowNumber) || []).join(" ") }));
}

export function parseMemberUpload(buffer: Buffer, company: UploadCompany, fileName = "socios.xlsx") {
  const workbook = fileName.toLowerCase().endsWith(".csv")
    ? XLSX.read(readCsv(buffer), { type: "string", raw: true, cellDates: true })
    : XLSX.read(buffer, { type: "buffer", cellDates: true, cellNF: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { rows: [] as MemberUploadRow[], errors: [{ row: 1, message: "El archivo no contiene una hoja de socios." }], processed: 0, sourceRows: [] as MemberEditableRow[] };
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, { range: { s: { r: 0, c: 0 }, e: range.e }, header: 1, raw: true, defval: "", blankrows: true });
  const headers = (values[0] || []).map(header);
  const missing = MEMBER_UPLOAD_HEADERS.filter(key => !headers.includes(key));
  const duplicates = MEMBER_UPLOAD_HEADERS.filter(key => headers.filter(value => value === key).length > 1);
  const records = values.slice(1).map((cells, index) => ({ cells, rowNumber: index + 2 })).filter(row => row.cells.some(value => String(value ?? "").trim()));
  if (missing.length || duplicates.length) {
    const message = [missing.length ? `Faltan columnas: ${missing.join(", ")}.` : "", duplicates.length ? `Columnas repetidas: ${duplicates.join(", ")}.` : ""].filter(Boolean).join(" ");
    return { rows: [] as MemberUploadRow[], errors: [{ row: 1, message }], processed: records.length, sourceRows: [] as MemberEditableRow[] };
  }
  const sourceRows: MemberEditableRow[] = [];
  const initialErrors = new Map<number, string[]>();
  for (const { cells, rowNumber } of records) {
    const row = Object.fromEntries(MEMBER_UPLOAD_HEADERS.map(key => {
      const column = headers.indexOf(key);
      const cell = sheet[XLSX.utils.encode_cell({ r: rowNumber - 1, c: column })];
      const value = (key === "cedula" || key === "nie") && cell?.t === "n" && /^[0 -]+$/.test(cell.z || "")
        ? XLSX.utils.format_cell(cell) : cells[column];
      return [key, String(value ?? "").trim()];
    }));
    const rowErrors: string[] = [];
    for (const key of MEMBER_UPLOAD_HEADERS) {
      if (sheet[XLSX.utils.encode_cell({ r: rowNumber - 1, c: headers.indexOf(key) })]?.f) rowErrors.push(`La columna ${key.toUpperCase()} no puede contener fórmulas.`);
    }
    if (rowErrors.length) initialErrors.set(rowNumber, rowErrors);
    sourceRows.push({ rowNumber, firstName: row.nombre, lastName: row.apellido, employeeNumber: row.nie, documentId: row.cedula, company: row.empresa });
  }
  return validateMemberRows(sourceRows, company, initialErrors);
}
