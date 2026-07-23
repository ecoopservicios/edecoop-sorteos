const NAME_PATTERN = /^[A-Z ]+$/;

export function normalizePersonName(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function validatePersonName(value: string, label: string) {
  const normalized = normalizePersonName(value);
  if (normalized.length < 2) {
    throw new Error(`${label} debe tener al menos 2 letras.`);
  }
  if (!NAME_PATTERN.test(normalized)) {
    throw new Error(`${label} solo puede contener letras A-Z y espacios, sin acentos ni simbolos.`);
  }
  return normalized;
}

export function buildFullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim().replace(/\s+/g, " ");
}
