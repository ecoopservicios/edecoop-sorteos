import assert from "node:assert/strict";
import test from "node:test";
import { checkIdentityDocument } from "../lib/identity-document-validation";

const member = { companyName: "EDESUR", firstName: "ANA MARIA", lastName: "PRUEBA MUESTRA", documentId: "12345678901", employeeNumber: "54321" };
const headers = ["REPUBLICA DOMINICANA", "JUNTA CENTRAL ELECTORAL", "CEDULA DE IDENTIDAD Y ELECTORAL"];
const name = ["ANA MARIA", "PRUEBA MUESTRA"];
const id = [...headers, "123-4567890-1", ...name];
const badge = ["edesur", ...name, "54321"];

test("accepts complete ID and company badge", () => {
  assert.equal(checkIdentityDocument(member, "DOCUMENT_ID", id), null);
  assert.equal(checkIdentityDocument(member, "EMPLOYEE_CARD", badge), null);
});
test("compares formatted stored numbers using all digits", () => {
  assert.equal(checkIdentityDocument({ ...member, documentId: "123-4567890-1" }, "DOCUMENT_ID", id), null);
});
test("accepts a number split across two or three adjacent OCR lines", () => {
  assert.equal(checkIdentityDocument(member, "DOCUMENT_ID", [...headers, "123", "4567890", "1", ...name]), null);
  assert.equal(checkIdentityDocument(member, "EMPLOYEE_CARD", ["edesur", ...name, "543", "21"]), null);
});
test("normalizes letter-shaped digits without guessing missing digits", () => {
  assert.equal(checkIdentityDocument(member, "EMPLOYEE_CARD", ["edesur", ...name, "5432I"]), null);
  assert.equal(checkIdentityDocument(member, "EMPLOYEE_CARD", ["edesur", ...name, "5432"]), "NUMBER");
});
test("recognizes official headers and branding with joined or separated OCR words", () => {
  assert.equal(checkIdentityDocument(member, "DOCUMENT_ID", ["REPUBLICADOMINICANA", "CEDULADEIDENTIDAD", "12345678901", ...name]), null);
  assert.equal(checkIdentityDocument(member, "EMPLOYEE_CARD", ["ede sur", ...name, "54321"]), null);
});
test("does not concatenate numbers across unrelated text", () => {
  assert.equal(checkIdentityDocument(member, "DOCUMENT_ID", [...headers, "123", "OTRO CAMPO", "45678901", ...name]), "NUMBER");
});
test("rejects a different or longer number", () => {
  assert.equal(checkIdentityDocument(member, "DOCUMENT_ID", [...headers, "123-4567890-2", ...name]), "NUMBER");
  assert.equal(checkIdentityDocument(member, "EMPLOYEE_CARD", ["edesur", ...name, "154321"]), "NUMBER");
});
test("requires both given-name and surname evidence", () => {
  assert.equal(checkIdentityDocument(member, "EMPLOYEE_CARD", ["edesur", "ANA MARIA", "54321"]), "NAME");
  assert.equal(checkIdentityDocument(member, "EMPLOYEE_CARD", ["edesur", "OTRA PERSONA", "54321"]), "NAME");
});
test("accepts ordinary OCR name errors but not a different surname", () => {
  assert.equal(checkIdentityDocument(member, "EMPLOYEE_CARD", ["edesur", "ANA MARIA", "PRUE8A MUESTRA", "54321"]), null);
  assert.equal(checkIdentityDocument(member, "EMPLOYEE_CARD", ["edesur", "ANA MARIA", "DISTINTO APELLIDO", "54321"]), "NAME");
});
test("requires document format even with matching identity text", () => {
  assert.equal(checkIdentityDocument(member, "DOCUMENT_ID", ["12345678901", ...name]), "FORMAT");
  assert.equal(checkIdentityDocument(member, "EMPLOYEE_CARD", [...name, "54321"]), "FORMAT");
});
test("rejects badges from a different company", () => {
  assert.equal(checkIdentityDocument(member, "EMPLOYEE_CARD", ["edecoop", ...name, "54321"]), "FORMAT");
});
test("only EDESUR and EDECOOP may use employee badges", () => {
  assert.equal(checkIdentityDocument({ ...member, companyName: "EDECOOP" }, "EMPLOYEE_CARD", ["EDE COOP", ...name, "54321"]), null);
  assert.equal(checkIdentityDocument({ ...member, companyName: "OTRA EMPRESA" }, "EMPLOYEE_CARD", badge), "TYPE");
  assert.equal(checkIdentityDocument({ ...member, companyName: "OTRA EMPRESA" }, "DOCUMENT_ID", id), null);
});
test("rejects incomplete member identities", () => {
  assert.equal(checkIdentityDocument({ ...member, documentId: null }, "DOCUMENT_ID", id), "TYPE");
  assert.equal(checkIdentityDocument({ ...member, firstName: "", lastName: "" }, "DOCUMENT_ID", id), "NAME");
});
