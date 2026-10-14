import { souvenirNameKey } from "@/lib/souvenir-names";
import { compareSouvenirCompanies } from "@/lib/souvenir-order";

export type SouvenirAuditRow = {
  firstName: string;
  lastName: string;
  documentId: string | null;
  employeeNumber: string | null;
  companyName: string;
  lookupField: "DOCUMENT_ID" | "EMPLOYEE_NUMBER" | null;
  rowLabel: string;
};

export function souvenirFullName(firstName: string, lastName: string) {
  return souvenirNameKey(`${firstName} ${lastName}`);
}

export function buildSouvenirReport(rows: SouvenirAuditRow[]) {
  const groups = new Map<string, { name: string; total: number; lookupField: SouvenirAuditRow["lookupField"]; missingDocument: number; missingEmployee: number }>();
  let byDocument = 0, byEmployee = 0, unconfigured = 0;
  const issues: string[] = [];
  const documents = new Map<string, string>();
  const employees = new Map<string, string>();
  const names = new Map<string, string>();
  for (const row of rows) {
    const label = `${row.rowLabel} · ${row.firstName} ${row.lastName} · ${row.companyName}`;
    const group = groups.get(row.companyName) || { name: row.companyName, total: 0, lookupField: row.lookupField, missingDocument: 0, missingEmployee: 0 };
    group.total++;
    if (row.lookupField === "DOCUMENT_ID") {
      byDocument++;
      if (!row.documentId) { group.missingDocument++; issues.push(`${label}: CÉDULA CONSULTA vacía; esta empresa consulta por cédula.`); }
    } else if (row.lookupField === "EMPLOYEE_NUMBER") {
      byEmployee++;
      if (!row.employeeNumber) { group.missingEmployee++; issues.push(`${label}: NO EMPLEADO vacío; esta empresa consulta por número de empleado.`); }
    } else { unconfigured++; issues.push(`${label}: empresa sin tipo de consulta configurado.`); }
    groups.set(row.companyName, group);
    for (const [value, seen, title] of [
      [row.documentId, documents, "Cédula de consulta"],
      [row.employeeNumber, employees, "Número de empleado"],
      [souvenirFullName(row.firstName, row.lastName) || null, names, "Nombre completo"]
    ] as const) {
      if (!value) continue;
      const previous = seen.get(value);
      if (previous) issues.push(`${label}: ${title} duplicado; coincide con ${previous}.`);
      else seen.set(value, label);
    }
  }
  const companies = [...groups.values()].sort((a, b) => compareSouvenirCompanies(a.name, b.name));
  return {
    total: rows.length, companyCount: companies.length, byDocument, byEmployee, unconfigured,
    missingDocument: companies.reduce((sum, c) => sum + c.missingDocument, 0),
    missingEmployee: companies.reduce((sum, c) => sum + c.missingEmployee, 0),
    companies, issues
  };
}

export type SouvenirReport = ReturnType<typeof buildSouvenirReport>;
