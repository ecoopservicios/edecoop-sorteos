import { souvenirLocationKey } from "@/lib/souvenir-order";

export const souvenirOfficeLabel = (office: string | null) => office?.trim().replace(/\s+/g, " ") || "SIN OFICINA ASIGNADA";
export const souvenirOfficeKey = (office: string | null) => souvenirOfficeLabel(office).normalize("NFC").toLocaleUpperCase("es");
export const SOUVENIR_STATUS_OPTIONS: [string, string][] = [["PENDING", "Pendientes"], ["DELIVERED", "Entregados"]];

export function matchesSouvenirFilters(member: { companyId: string; office: string | null; approximateLocation: string | null; delivered: boolean }, filters: { companies: string[]; offices: string[]; locations: string[]; states: string[] }) {
  return (!filters.companies.length || filters.companies.includes(member.companyId))
    && (!filters.offices.length || filters.offices.includes(souvenirOfficeKey(member.office)))
    && (!filters.locations.length || filters.locations.includes(souvenirLocationKey(member.approximateLocation)))
    && (!filters.states.length || filters.states.includes(member.delivered ? "DELIVERED" : "PENDING"));
}
