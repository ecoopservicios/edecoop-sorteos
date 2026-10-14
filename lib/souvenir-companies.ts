export function souvenirCompanyKey(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
}

type Company = { id: string; name: string; isActive: boolean; deletedAt: Date | null; dataUpdateLookupField: "DOCUMENT_ID" | "EMPLOYEE_NUMBER" | null };
export type CompanyReview = {
  key: string; name: string; rows: number[];
  status: "SIMILAR" | "NEW" | "DELETED" | "INACTIVE" | "UNCONFIGURED" | "AMBIGUOUS";
  suggestions: { id: string; name: string }[];
  selectedId: string;
};

function distance(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length];
}

export function reviewSouvenirCompanies(entries: { name: string; row: number }[], companies: Company[], mappings: Record<string, string>) {
  const eligible = companies.filter(c => !c.deletedAt && c.isActive && c.dataUpdateLookupField);
  const groups = new Map<string, { name: string; rows: number[] }>();
  for (const entry of entries) {
    const key = souvenirCompanyKey(entry.name);
    const group = groups.get(key) || { name: entry.name || "(vacía)", rows: [] };
    group.rows.push(entry.row); groups.set(key, group);
  }
  const resolved = new Map<string, Company>();
  const review: CompanyReview[] = [];
  for (const [key, group] of groups) {
    const exact = companies.filter(c => souvenirCompanyKey(c.name) === key);
    const validExact = exact.filter(c => eligible.includes(c));
    if (validExact.length === 1) { resolved.set(key, validExact[0]); continue; }
    const ranked = eligible.map(c => ({ company: c, score: distance(key, souvenirCompanyKey(c.name)) }))
      .filter(c => key.length >= 3 && c.score <= Math.min(4, Math.max(1, Math.floor(key.length * 0.25))))
      .sort((a, b) => a.score - b.score || a.company.name.localeCompare(b.company.name));
    const selected = eligible.find(c => c.id === mappings[key]);
    if (selected && key) resolved.set(key, selected);
    const status = validExact.length > 1 ? "AMBIGUOUS" : exact.some(c => c.deletedAt) ? "DELETED" : exact.some(c => !c.isActive) ? "INACTIVE" : exact.length ? "UNCONFIGURED" : ranked.length ? "SIMILAR" : "NEW";
    review.push({ key, ...group, status, selectedId: selected?.id || "", suggestions: ranked.slice(0, 3).map(c => ({ id: c.company.id, name: c.company.name })) });
  }
  return { resolved, review, options: eligible.map(c => ({ id: c.id, name: c.name })) };
}
