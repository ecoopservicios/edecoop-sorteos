export const EMERGENCY_CONTACT_RELATIONS = ["ESPOSA", "PAREJA", "HIJO", "AMIGO", "FAMILIAR", "OTRO"] as const;
export type EmergencyContactRelationValue = typeof EMERGENCY_CONTACT_RELATIONS[number];

export const EMERGENCY_CONTACT_RELATION_LABELS: Record<EmergencyContactRelationValue, string> = {
  ESPOSA: "Esposo(a)",
  PAREJA: "Pareja",
  HIJO: "Hijo(a)",
  AMIGO: "Amigo(a)",
  FAMILIAR: "Familiar",
  OTRO: "Otros"
};

export function emergencyContactRelationLabel(value: string, other = "") {
  const label = EMERGENCY_CONTACT_RELATION_LABELS[value as EmergencyContactRelationValue] || value;
  return value === "OTRO" && other.trim() ? `${label}: ${other.trim()}` : label;
}

export function normalizeOtherEmergencyRelation(value: unknown) {
  const relation = String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
  if (relation.length < 2 || relation.length > 50) throw new Error("Especifica la relación con el contacto de emergencia (entre 2 y 50 caracteres).");
  if (!/^[A-ZÁÉÍÓÚÜÑ' -]+$/u.test(relation)) throw new Error("La relación solo puede contener letras, espacios, apóstrofes o guiones.");
  return relation;
}

export function parseEmergencyContactRelation(value: unknown, other: unknown) {
  const relation = String(value || "") as EmergencyContactRelationValue;
  if (!EMERGENCY_CONTACT_RELATIONS.includes(relation)) {
    throw new Error("Selecciona la relación con tu contacto de emergencia.");
  }
  return {
    relation,
    other: relation === "OTRO" ? normalizeOtherEmergencyRelation(other) : ""
  };
}
