import { EventEditionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export const EVENT_TYPE_CODES = {
  AFFILIATION_INSTANT: "AFFILIATION_INSTANT",
  AFFILIATION_FINAL: "AFFILIATION_FINAL"
} as const;

export const FUTURE_EVENT_TYPE_NAMES = ["Madres", "Padres", "Aniversario"];

export const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" }
];

export function monthLabel(month: number) {
  return MONTHS.find((item) => item.value === month)?.label || String(month);
}

export function eventDisplayName(typeName: string, month: number, year: number) {
  return `${typeName} ${monthLabel(month)} ${year}`;
}

export function eventStatusLabel(status: EventEditionStatus) {
  const labels: Record<EventEditionStatus, string> = {
    ACTIVE: "Activo",
    INACTIVE: "Inactivo",
    CLOSED: "Cerrado"
  };
  return labels[status];
}

export function prizeTypeLabel(type: string) {
  const labels: Record<string, string> = {
    BONUS: "Bono",
    ARTICLE: "Articulo",
    FINAL: "Premio final"
  };
  return labels[type] || type;
}

export async function ensureBaseEventTypes() {
  const types = [
    { code: EVENT_TYPE_CODES.AFFILIATION_INSTANT, name: "Afiliación Premio Instantáneo" },
    { code: EVENT_TYPE_CODES.AFFILIATION_FINAL, name: "Afiliación Premio Final" }
  ];

  for (const type of types) {
    await prisma.eventType.upsert({
      where: { code: type.code },
      update: { name: type.name, isActive: true },
      create: { ...type, isActive: true }
    });
  }

  return prisma.eventType.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" }
  });
}
