type OrderedMember = { companyName: string; office: string | null; unit: string | null; firstName: string; lastName: string; id: string };
const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
const key = (value: string) => value.trim().replace(/\s+/g, " ").normalize("NFC");

export function compareSouvenirCompanies(a: string, b: string) {
  const rank = (name: string) => key(name).toLocaleUpperCase("es") === "EDESUR" ? 0 : 1;
  return rank(a) - rank(b) || collator.compare(key(a), key(b));
}

export function compareSouvenirMembers(a: OrderedMember, b: OrderedMember) {
  return compareSouvenirCompanies(a.companyName, b.companyName)
    || Number(!a.office?.trim()) - Number(!b.office?.trim())
    || collator.compare(key(a.office || ""), key(b.office || ""))
    || Number(!a.unit?.trim()) - Number(!b.unit?.trim())
    || collator.compare(key(a.unit || ""), key(b.unit || ""))
    || collator.compare(key(a.lastName), key(b.lastName))
    || collator.compare(key(a.firstName), key(b.firstName))
    || a.id.localeCompare(b.id);
}

