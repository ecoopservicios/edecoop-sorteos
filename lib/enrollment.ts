import { EnrollmentFollowUpStatus } from "@prisma/client";



export const DEFAULT_ENROLLMENT_TEXT = `Solicito ser admitido como socio de la COOPERATIVA DE AHORROS Y CREDITOS "EDECOOP", conociendo que al ser aceptado(a) debere acoger las resoluciones adoptadas por la asamblea y los organismos directivos.



Entiendo que el ahorro mínimo que realizaré no será por debajo del 4% de mi salario mensual y que el mismo será fraccionado de la siguiente forma: Un 1% en ahorros de Capital y el restante 3% en ahorros a la vista o corriente. Podré retirar mis ahorros corrientes cuando así lo requiera siempre y cuando no representen aval alguno a los compromisos contraidos con la cooperativa.



La cuota de inscripción será de $200.00 no reembolsables, a ser cobrados en el primer descuento.`;



export const DEFAULT_ENROLLMENT_TITLE = "Solicitud de Admisión EDECOOP";

export const DEFAULT_ENROLLMENT_WELCOME_MESSAGE = "";

export const DEFAULT_ENROLLMENT_SUCCESS_MESSAGE = "Gracias por ser parte de EDECOOP.";

export const DEFAULT_ENROLLMENT_COMPANY = "EDESUR";



export function enrollmentStatusLabel(status: EnrollmentFollowUpStatus) {

  const labels: Record<EnrollmentFollowUpStatus, string> = {

    NEW: "Nuevo",

    CONTACTED: "Contactado",

    IN_PROCESS: "En proceso",

    MEMBER: "Afiliado",

    NOT_INTERESTED: "No interesado"

  };

  return labels[status];

}



export function normalizeDocument(value: string) {

  return value.replace(/\D/g, "");

}



export function parseCurrencyNumber(value: unknown) {

  const normalized = String(value || "").replace(/,/g, "").trim();

  const number = Number(normalized);

  if (!Number.isFinite(number) || number < 0) return null;

  return number;

}
