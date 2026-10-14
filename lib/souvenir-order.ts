type OrderedMember = { companyName: string; approximateLocation: string | null; employeeNumber: string | null; documentId: string | null; id: string };
const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
const key = (value: string) => value.trim().replace(/\s+/g, " ").normalize("NFC");
export const souvenirLocationLabel = (value: string | null) => key(value || "") || "SIN UBICACIÓN ASIGNADA";
export const souvenirLocationKey = (value: string | null) => souvenirLocationLabel(value).toLocaleUpperCase("es");

export function compareSouvenirCompanies(a: string, b: string) {
  const rank = (name: string) => key(name).toLocaleUpperCase("es") === "EDESUR" ? 0 : 1;
  return rank(a) - rank(b) || collator.compare(key(a), key(b));
}

export function compareSouvenirLocations(a: string | null, b: string | null) {
  const rank = (value: string | null) => {
    if (!value?.trim()) return 4;
    const label = key(value).replace(/[\u2010-\u2015]/g, "-").replace(/\s*-\s*/g, " - ").toLocaleUpperCase("es");
    if (label === "SANTO DOMINGO - TORRE SERRANO") return 0;
    if (label === "SANTO DOMINGO - TORRE CRISTAL") return 1;
    return /^SANTO DOMINGO(?:\s|$)/.test(label) ? 2 : 3;
  };
  return rank(a) - rank(b) || collator.compare(souvenirLocationKey(a), souvenirLocationKey(b));
}

export function compareSouvenirMembers(a: OrderedMember, b: OrderedMember) {
  return compareSouvenirCompanies(a.companyName, b.companyName)
    || compareSouvenirLocations(a.approximateLocation, b.approximateLocation)
    || Number(!a.employeeNumber) - Number(!b.employeeNumber)
    || collator.compare(a.employeeNumber || a.documentId || "", b.employeeNumber || b.documentId || "")
    || a.id.localeCompare(b.id);
}

