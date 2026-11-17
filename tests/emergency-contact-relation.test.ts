import assert from "node:assert/strict";
import test from "node:test";
import { EMERGENCY_CONTACT_RELATIONS, emergencyContactRelationLabel, normalizeOtherEmergencyRelation, parseEmergencyContactRelation } from "../lib/emergency-contact-relation";

test("lists the requested emergency contact relationships in order", () => {
  assert.deepEqual(EMERGENCY_CONTACT_RELATIONS, ["ESPOSA", "PAREJA", "HIJO", "AMIGO", "FAMILIAR", "OTRO"]);
  assert.deepEqual(EMERGENCY_CONTACT_RELATIONS.map(value => emergencyContactRelationLabel(value)), ["Esposo(a)", "Pareja", "Hijo(a)", "Amigo(a)", "Familiar", "Otros"]);
});

test("requires and normalizes the description when the relationship is other", () => {
  assert.equal(normalizeOtherEmergencyRelation("  compañero de trabajo "), "COMPAÑERO DE TRABAJO");
  assert.equal(emergencyContactRelationLabel("OTRO", "COMPAÑERO DE TRABAJO"), "Otros: COMPAÑERO DE TRABAJO");
  for (const value of ["", "A", "123", "RELACIÓN @ TRABAJO", "X".repeat(51)]) assert.throws(() => normalizeOtherEmergencyRelation(value));
});

test("validates the relationship and requires the Other description", () => {
  assert.deepEqual(parseEmergencyContactRelation("PAREJA", "ignorado"), { relation: "PAREJA", other: "" });
  assert.deepEqual(parseEmergencyContactRelation("OTRO", "vecino"), { relation: "OTRO", other: "VECINO" });
  assert.throws(() => parseEmergencyContactRelation("", ""), /Selecciona la relación/);
  assert.throws(() => parseEmergencyContactRelation("OTRO", ""), /Especifica la relación/);
});
