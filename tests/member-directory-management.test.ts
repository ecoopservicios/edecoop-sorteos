import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { clearMemberDirectory, importMemberDirectory, memberImportMode, planMemberImport } from "../lib/member-directory-management";
import type { MemberUploadRow } from "../lib/member-directory-upload";

const first = { id: "one", enrollmentCompanyId: "edesur", firstName: "JOSE", lastName: "PEÑA", documentId: "00112345678", employeeNumber: "12345", isActive: true, personalPhone: "8095551234" };
const second = { ...first, id: "two", documentId: "00212345678", employeeNumber: "12346" };
const other = { ...first, id: "other", enrollmentCompanyId: "edecoop", documentId: "00312345678", employeeNumber: "12347" };
const incoming = { rowNumber: 2, firstName: "JOSE MARIA", lastName: "PEÑA", documentId: first.documentId, employeeNumber: first.employeeNumber };
const newRow = { ...incoming, rowNumber: 3, documentId: "00412345678", employeeNumber: "12348" };
const options = { enrollmentCompanyId: "edesur", userId: "admin", mode: "replace" as const, expectedCount: 2, fileName: "socios.xlsx" };
const parsed = (rows: MemberUploadRow[], errors: Array<{ row: number; message: string }> = []) => ({ rows, errors, processed: rows.length + errors.length });

function database(initial = [first, second, other]) {
  const rows = structuredClone(initial);
  const submissions = [{ memberDirectoryId: "one" }, { memberDirectoryId: "two" }, { memberDirectoryId: "other" }];
  const audits: unknown[] = [];
  type Where = { enrollmentCompanyId?: string; isActive?: boolean; id?: { notIn: string[] } };
  const matches = (row: typeof first, where: Where = {}) => (!where.enrollmentCompanyId || row.enrollmentCompanyId === where.enrollmentCompanyId) && (where.isActive === undefined || row.isActive === where.isActive) && !where.id?.notIn.includes(row.id);
  const tx = {
    $executeRaw: async () => 0,
    memberDirectory: {
      findMany: async ({ where }: { where: Where }) => rows.filter(row => matches(row, where)).map(row => ({ ...row })),
      count: async ({ where }: { where: Where }) => rows.filter(row => matches(row, where)).length,
      update: async ({ where, data }: { where: { id: string }; data: Partial<typeof first> }) => Object.assign(rows.find(row => row.id === where.id)!, data),
      updateMany: async ({ where, data }: { where: Where; data: Partial<typeof first> }) => {
        const matching = rows.filter(row => matches(row, where));
        matching.forEach(row => Object.assign(row, data)); return { count: matching.length };
      },
      createMany: async ({ data }: { data: Array<Omit<typeof first, "id" | "isActive" | "personalPhone">> }) => {
        data.forEach((row, i) => rows.push({ ...row, id: `created-${i}`, isActive: true, personalPhone: "" })); return { count: data.length };
      }
    },
    memberDataUpdateSubmission: { count: async ({ where }: { where: { memberDirectory: Where } }) => submissions.filter(submission => rows.some(row => row.id === submission.memberDirectoryId && matches(row, where.memberDirectory))).length },
    auditLog: { create: async (data: unknown) => { audits.push(data); } }
  } as unknown as Prisma.TransactionClient;
  return { tx, rows, submissions, audits };
}

test("requires an explicit import choice and typed replacement confirmation", () => {
  for (const value of [null, "", "delete", "APPEND"]) assert.throws(() => memberImportMode(value, "REEMPLAZAR"));
  assert.equal(memberImportMode("append", ""), "append");
  assert.throws(() => memberImportMode("replace", ""));
  assert.equal(memberImportMode("replace", "REEMPLAZAR"), "replace");
});
test("append reports existing document and employee duplicates without changing their names", async () => {
  const db = database();
  const result = await importMemberDirectory(db.tx, parsed([incoming, newRow]), { ...options, mode: "append" });
  assert.equal(result.created, 1); assert.equal(result.rejected, 1); assert.equal(result.duplicates.length, 1);
  assert.match(result.errors[0].message, /00112345678.*12345/);
  assert.equal(db.rows[0].firstName, "JOSE"); assert.equal(db.rows[1].isActive, true);
});
test("replacement updates matches in place, archives omitted rows and never touches another company or received submissions", async () => {
  const db = database(); const received = structuredClone(db.submissions);
  const result = await importMemberDirectory(db.tx, parsed([incoming, newRow]), options);
  assert.equal(result.applied, true); assert.equal(result.updated, 1); assert.equal(result.created, 1); assert.equal(result.removed, 1);
  assert.equal(result.duplicates.length, 1); assert.equal(result.rejected, 0);
  assert.equal(db.rows[0].id, first.id); assert.equal(db.rows[0].personalPhone, first.personalPhone); assert.equal(db.rows[0].firstName, "JOSE MARIA");
  assert.equal(db.rows[1].isActive, false); assert.deepEqual(db.rows[2], other); assert.deepEqual(db.submissions, received);
  assert.equal(db.audits.length, 1);
});
test("replacement with any invalid or duplicate file row leaves the entire prior list unchanged", async () => {
  const db = database(); const before = structuredClone(db.rows);
  const result = await importMemberDirectory(db.tx, parsed([newRow], [{ row: 4, message: "NIE repetido" }]), options);
  assert.equal(result.applied, false); assert.equal(result.created, 0); assert.equal(result.removed, 0);
  assert.deepEqual(db.rows, before); assert.equal(db.audits.length, 0);
});
test("an empty replacement cannot clear the old list", async () => {
  const db = database(); const before = structuredClone(db.rows);
  const result = await importMemberDirectory(db.tx, parsed([], [{ row: 1, message: "Archivo sin socios" }]), options);
  assert.equal(result.applied, false); assert.deepEqual(db.rows, before);
});
test("crossed document and employee identifiers reject the whole replacement", async () => {
  const db = database(); const before = structuredClone(db.rows);
  const result = await importMemberDirectory(db.tx, parsed([{ ...incoming, employeeNumber: second.employeeNumber }, newRow]), options);
  assert.equal(result.applied, false); assert.match(result.errors[0].message, /socios distintos/); assert.deepEqual(db.rows, before);
});
test("an existing employee cannot be reassigned to another document", () => {
  const result = planMemberImport([{ ...incoming, documentId: "99912345678" }], [first], "replace");
  assert.equal(result.accepted.length, 0); assert.match(result.errors[0].message, /otra cédula/);
});
test("an existing document cannot be reassigned to another employee", () => {
  const result = planMemberImport([{ ...incoming, employeeNumber: "99999" }], [first], "replace");
  assert.equal(result.accepted.length, 0); assert.match(result.errors[0].message, /otro NIE/);
});
test("a changed company list requires a new replacement confirmation", async () => {
  const db = database(); const before = structuredClone(db.rows);
  await assert.rejects(() => importMemberDirectory(db.tx, parsed([newRow]), { ...options, expectedCount: 1 }), /listado cambió/);
  assert.deepEqual(db.rows, before);
});
test("clearing a company preserves received submissions and all other companies", async () => {
  const db = database(); const received = structuredClone(db.submissions);
  const result = await clearMemberDirectory(db.tx, { enrollmentCompanyId: "edesur", expectedCount: 2, userId: "admin" });
  assert.equal(result.removed, 2); assert.equal(result.preservedSubmissions, 2);
  assert.equal(db.rows.filter(row => row.enrollmentCompanyId === "edesur" && row.isActive).length, 0);
  assert.deepEqual(db.rows[2], other); assert.deepEqual(db.submissions, received); assert.equal(db.audits.length, 1);
});
test("clearing the complete list only deactivates active members and retains the full history", async () => {
  const db = database(); const received = structuredClone(db.submissions);
  const result = await clearMemberDirectory(db.tx, { enrollmentCompanyId: null, expectedCount: 3, userId: "admin" });
  assert.equal(result.removed, 3); assert.equal(db.rows.length, 3); assert.equal(db.rows.some(row => row.isActive), false); assert.deepEqual(db.submissions, received);
});
test("clearing rejects a stale member count without modifying anything", async () => {
  const db = database(); const before = structuredClone(db.rows);
  await assert.rejects(() => clearMemberDirectory(db.tx, { enrollmentCompanyId: null, expectedCount: 2, userId: "admin" }), /listado cambió/);
  assert.deepEqual(db.rows, before); assert.equal(db.audits.length, 0);
});
test("reimporting a removed member restores the original ID and its submissions", async () => {
  const db = database([{ ...first, isActive: false }, other]);
  const result = await importMemberDirectory(db.tx, parsed([incoming]), { ...options, mode: "append" });
  assert.equal(result.restored, 1); assert.equal(result.created, 0); assert.equal(db.rows[0].id, first.id); assert.equal(db.rows[0].isActive, true);
  assert.equal(db.submissions[0].memberDirectoryId, first.id);
});
test("a blank optional NIE does not erase a known identifier", async () => {
  const db = database();
  await importMemberDirectory(db.tx, parsed([{ ...incoming, employeeNumber: null }]), options);
  assert.equal(db.rows[0].employeeNumber, first.employeeNumber);
});
