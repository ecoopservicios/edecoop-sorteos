export type SouvenirPrintMember = {
  id: string; listNumber: number; firstName: string; lastName: string; displayDocumentId: string | null;
  employeeNumber: string | null; companyId: string; companyName: string; office: string | null; unit: string | null;
};

export function souvenirPrintUnits(members: SouvenirPrintMember[]) {
  const sorted = [...members].sort((a, b) => a.listNumber - b.listNumber);
  if (sorted[0]?.companyName.trim().toLocaleUpperCase("es") !== "EDESUR") return [{ unit: null, members: sorted }];
  const units = new Map<string, { unit: string; members: SouvenirPrintMember[] }>();
  for (const member of sorted) {
    const unit = member.unit?.trim().replace(/\s+/g, " ") || "SIN UNIDAD ASIGNADA";
    const key = unit.normalize("NFC").toLocaleUpperCase("es");
    const group = units.get(key) || { unit, members: [] };
    group.members.push(member); units.set(key, group);
  }
  return [...units.values()];
}

export function souvenirPrintSheets(members: SouvenirPrintMember[], pageSize = 10) {
  const offices = new Map<string, { office: string; members: SouvenirPrintMember[] }>();
  for (const member of members) {
    const office = member.office?.trim().replace(/\s+/g, " ") || "SIN OFICINA ASIGNADA";
    const key = `${member.companyId}:${office.normalize("NFC").toLocaleUpperCase("es")}`;
    const group = offices.get(key) || { office, members: [] };
    group.members.push(member); offices.set(key, group);
  }
  return [...offices.values()].sort((a, b) => Math.min(...a.members.map(m => m.listNumber)) - Math.min(...b.members.map(m => m.listNumber))).flatMap(group => {
    const sorted = group.members.sort((a, b) => a.listNumber - b.listNumber);
    const chunks: { members: SouvenirPrintMember[]; unit: string | null; unitTotal: number }[] = [];
    for (const section of souvenirPrintUnits(sorted)) {
    let current: SouvenirPrintMember[] = [], height = 0;
    for (const member of section.members) {
      // Reserve extra line height for long names, identifiers and company labels.
      const values = [member.firstName, member.lastName, member.displayDocumentId || "", member.employeeNumber || "", member.companyName];
      const capacities = [18, 22, 14, 12, 15];
      const lines = Math.max(...values.map((value, index) => Math.ceil(value.length / capacities[index])));
      const rowHeight = Math.max(54, lines * 15 + 17);
      if (current.length && (current.length >= pageSize || height + rowHeight > (section.unit ? 500 : 540))) { chunks.push({ members: current, unit: section.unit, unitTotal: section.members.length }); current = []; height = 0; }
      current.push(member); height += rowHeight;
    }
    if (current.length) chunks.push({ members: current, unit: section.unit, unitTotal: section.members.length });
    }
    return chunks.map((chunk, index) => ({ companyId: sorted[0].companyId, office: group.office, total: sorted.length, page: index + 1, pages: chunks.length, ...chunk }));
  });
}
