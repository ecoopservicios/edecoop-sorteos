import { souvenirLocationKey, souvenirLocationLabel } from "@/lib/souvenir-order";

export type SouvenirPrintMember = {
  id: string; listNumber: number; firstName: string; lastName: string; displayDocumentId: string | null;
  employeeNumber: string | null; companyId: string; companyName: string; office: string | null; unit: string | null;
  approximateLocation: string | null;
};

export function souvenirPrintSheets(members: SouvenirPrintMember[], pageSize = 10) {
  const groups = new Map<string, { location: string; members: SouvenirPrintMember[] }>();
  for (const member of [...members].sort((a, b) => a.listNumber - b.listNumber)) {
    const key = member.companyId + ":" + souvenirLocationKey(member.approximateLocation);
    const group = groups.get(key) || { location: souvenirLocationLabel(member.approximateLocation), members: [] };
    group.members.push(member); groups.set(key, group);
  }
  return [...groups.values()].flatMap(group => {
    const chunks: SouvenirPrintMember[][] = [];
    let current: SouvenirPrintMember[] = [], height = 0;
    for (const member of group.members) {
      const values = [member.firstName, member.lastName, member.displayDocumentId || "", member.employeeNumber || "", member.companyName];
      const capacities = [18, 22, 14, 12, 15];
      const lines = Math.max(...values.map((value, i) => Math.ceil(value.length / capacities[i])));
      const rowHeight = Math.max(54, lines * 15 + 17);
      if (current.length && (current.length >= pageSize || height + rowHeight > 500)) { chunks.push(current); current = []; height = 0; }
      current.push(member); height += rowHeight;
    }
    if (current.length) chunks.push(current);
    return chunks.map((members, i) => ({ companyId: members[0].companyId, companyName: members[0].companyName, location: group.location, total: group.members.length, page: i + 1, pages: chunks.length, members }));
  });
}
