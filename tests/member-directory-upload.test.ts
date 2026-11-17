import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { directoryName, directoryDocument, directoryEmployee, parseMemberUpload } from "../lib/member-directory-upload";
const company = { name: "EDESUR", dataUpdateLookupField: "EMPLOYEE_NUMBER" as const };
const headers = ["NOMBRE", "APELLIDO", "NIE", "CEDULA", "EMPRESA"];
function file(rows: unknown[][], customHeaders = headers, bookType: XLSX.BookType = "xlsx") {
  const sheet = XLSX.utils.aoa_to_sheet([customHeaders, ...rows]);
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Socios");
  return XLSX.write(workbook, { type: "buffer", bookType }) as Buffer;
}
const valid = ["Jos\u00e9 Mar\u00eda", "Pe\u00f1a N\u00fa\u00f1ez", "12345", "00112345678", "edesur"];
test("uppercases names, removes accents without losing letters, and preserves composed or decomposed enye", () => {
  assert.equal(directoryName("  Jos\u00e9   Mar\u00eda ", "Nombre"), "JOSE MARIA");
  assert.equal(directoryName("Pe\u00f1a N\u00fa\u00f1ez", "Apellido"), "PE\u00d1A NU\u00d1EZ");
  assert.equal(directoryName("Pen\u0303a Nu\u0301n\u0303ez", "Apellido"), "PE\u00d1A NU\u00d1EZ");
  assert.equal(directoryName("\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc", "Nombre"), "AEIOUU");
});
test("accepts the new five-column workbook", () => {
  const result = parseMemberUpload(file([valid]), company);
  assert.equal(result.errors.length, 0); assert.equal(result.rows[0].firstName, "JOSE MARIA");
  assert.equal(result.rows[0].lastName, "PE\u00d1A NU\u00d1EZ");
  assert.equal(result.rows[0].documentId, "00112345678");
});
test("keeps former name and employee column aliases when company is included", () => {
  assert.equal(parseMemberUpload(file([valid], ["nombres", "apellidos", "numero_empleado", "C\u00e9dula", "empresa"]), company).errors.length, 0);
});
test("requires company column and rejects ambiguous aliases", () => {
  assert.match(parseMemberUpload(file([valid], ["nombre", "apellido", "nie", "cedula", "otro"]), company).errors[0].message, /empresa/);
  assert.match(parseMemberUpload(file([valid], ["nombre", "apellido", "nie", "cedula", "empresa", "empleado"]), company).errors[0].message, /repetidas/);
});
test("validates every ID length and rejects letters instead of silently deleting them", () => {
  for (const id of ["", "0011234567", "001123456789", "0011234567A8", "1.2345e10"]) assert.throws(() => directoryDocument(id));
  assert.equal(directoryDocument("001-1234567-8"), "00112345678");
});
test("employee numbers contain one to five digits with company-specific requirement", () => {
  assert.equal(directoryEmployee("1", true), "1"); assert.equal(directoryEmployee("00001", true), "00001");
  assert.equal(directoryEmployee("", false), null);
  for (const value of ["", "123456", "12A34", "12-34", "123.0", "-123"]) assert.throws(() => directoryEmployee(value, true));
});
test("ID is required even for employee lookup companies", () => {
  const row = [...valid]; row[3] = "";
  assert.equal(parseMemberUpload(file([row]), company).rows.length, 0);
});
test("document lookup companies may omit NIE but still validate populated NIE", () => {
  const row = [...valid]; row[2] = "";
  const options = { ...company, dataUpdateLookupField: "DOCUMENT_ID" as const };
  assert.equal(parseMemberUpload(file([row]), options).rows.length, 1);
  row[2] = "123456"; assert.equal(parseMemberUpload(file([row]), options).rows.length, 0);
});
test("checks that each company matches the selected company", () => {
  const row = [...valid]; row[4] = "EDECOOP";
  assert.match(parseMemberUpload(file([row]), company).errors[0].message, /no coincide/);
  row[4] = ""; assert.match(parseMemberUpload(file([row]), company).errors[0].message, /empresa es requerida/);
});
test("reports real sheet rows and ignores blank rows", () => {
  const bad = [...valid]; bad[2] = "123456";
  const result = parseMemberUpload(file([[], bad, [], valid]), company);
  assert.equal(result.processed, 2); assert.equal(result.errors[0].row, 3); assert.equal(result.rows[0].rowNumber, 5);
});
test("rejects duplicate documents and NIE within the same file", () => {
  const result = parseMemberUpload(file([valid, valid]), company);
  assert.equal(result.rows.length, 1); assert.match(result.errors[0].message, /fila 2/);
});
test("rejects invalid names rather than deleting symbols", () => {
  assert.throws(() => directoryName("JOSE123", "Nombre")); assert.throws(() => directoryName("A", "Nombre"));
});
test("supports UTF-8, UTF-16 and Windows-1252 CSV without losing enye or leading zeros", () => {
  const csv = headers.join(",") + "\n" + valid.join(",");
  for (const bytes of [Buffer.from(csv, "utf8"), Buffer.concat([Buffer.from([255, 254]), Buffer.from(csv, "utf16le")]), Buffer.from(csv, "latin1")]) {
    const result = parseMemberUpload(bytes, company, "socios.csv");
    assert.equal(result.errors.length, 0); assert.equal(result.rows[0].lastName, "PE\u00d1A NU\u00d1EZ"); assert.equal(result.rows[0].documentId, "00112345678");
  }
});
test("supports legacy Excel Unicode names", () => {
  assert.equal(parseMemberUpload(file([valid], headers, "biff8"), company, "socios.xls").rows[0].lastName, "PE\u00d1A NU\u00d1EZ");
});
test("rejects formulas even when the cached value looks valid", () => {
  const workbook = XLSX.read(file([valid]), { type: "buffer" }); workbook.Sheets.Socios.C2.f = "12345";
  assert.match(parseMemberUpload(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), company).errors[0].message, /fórmulas/);
});
test("keeps column coordinates when the sheet starts after column A", () => {
  const sheet: XLSX.WorkSheet = {};
  XLSX.utils.sheet_add_aoa(sheet, [headers, valid], { origin: "B1" });
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Socios");
  const bytes = () => XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  assert.equal(parseMemberUpload(bytes(), company).rows[0].documentId, "00112345678");
  sheet.D2.f = "12345";
  assert.match(parseMemberUpload(bytes(), company).errors[0].message, /fórmulas/);
});
test("respects explicit zero-padding number formats without guessing missing digits", () => {
  const workbook = XLSX.read(file([valid]), { type: "buffer" });
  workbook.Sheets.Socios.D2 = { t: "n", v: 112345678, z: "00000000000" };
  assert.equal(parseMemberUpload(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), company).rows[0].documentId, "00112345678");
  workbook.Sheets.Socios.D2 = { t: "n", v: 112345678 };
  assert.equal(parseMemberUpload(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), company).rows.length, 0);
});
test("download template matches the importer and stores identifiers as text", () => {
  const buffer = readFileSync("resources/templates/plantilla-base-socios.xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer", cellNF: true });
  assert.deepEqual(XLSX.utils.sheet_to_json(workbook.Sheets.Socios, { header: 1 })[0], headers);
  assert.equal(workbook.Sheets.Socios.C2.t, "s"); assert.equal(workbook.Sheets.Socios.D2.t, "s");
  assert.equal(workbook.Sheets.Socios.D2.v, "00112345678");
  assert.equal(parseMemberUpload(buffer, company).errors.length, 0);
});
