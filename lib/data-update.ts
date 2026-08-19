import { ContactValidationStatus, MemberLookupField } from "@prisma/client";

const BLOCKED_EMAIL_DOMAINS = new Set(["edesur.com.do", "edeeste.com.do", "edenorte.com.do", "edecoop.com.do"]);

export function normalizeDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export function tenDigitContactPhone(value: string, label: string) {
  const digits = normalizeDigits(value);
  if (digits.length !== 10) throw new Error(`${label} debe contener exactamente 10 numeros.`);
  return digits;
}

export function normalizeLookupValue(value: string, lookupField: MemberLookupField) {
  const digits = normalizeDigits(value);
  if (lookupField === MemberLookupField.DOCUMENT_ID && digits.length !== 11) {
    throw new Error("La cedula debe contener exactamente 11 numeros.");
  }
  if (lookupField === MemberLookupField.EMPLOYEE_NUMBER && (!digits || digits.length > 5)) {
    throw new Error("El numero de empleado debe contener maximo 5 numeros.");
  }
  return digits;
}

export function normalizePersonalEmail(value: string) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Debe ingresar un correo electronico valido.");
  const domain = email.split("@")[1];
  if (BLOCKED_EMAIL_DOMAINS.has(domain)) {
    throw new Error("No se permite correo institucional. Favor ingresar su correo electronico personal.");
  }
  return email;
}

export function compareContactValue(newValue: string, previousValue?: string | null) {
  return previousValue && newValue === previousValue ? ContactValidationStatus.SAME_AS_REGISTERED : ContactValidationStatus.NEW;
}

export function lookupFieldLabel(field: MemberLookupField) {
  return field === MemberLookupField.DOCUMENT_ID ? "Cedula" : "Numero de empleado";
}

export function buildSupportWhatsappUrl(phone: string, companyName: string, messageTemplate?: string) {
  const normalized = normalizeDigits(phone);
  const text = (messageTemplate || "Hola EDECOOP, necesito actualizar mis datos y no aparezco en el portal para la empresa {empresa}.")
    .replaceAll("{empresa}", companyName);
  if (!normalized) return `https://wa.me/?text=${encodeURIComponent(text)}`;
  return `https://wa.me/${normalized.startsWith("1") ? normalized : `1${normalized}`}?text=${encodeURIComponent(text)}`;
}
