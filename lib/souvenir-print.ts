import { souvenirLocationKey, souvenirLocationLabel } from "@/lib/souvenir-order";

export type SouvenirPrintMember = {
  id: string; listNumber: number; firstName: string; lastName: string; displayDocumentId: string | null;
  employeeNumber: string | null; companyId: string; companyName: string; office: string | null; unit: string | null;
  approximateLocation: string | null;
  delivered: boolean;
  collectedByOther: boolean;
};

export const SOUVENIR_PRINT_COLUMNS = ["No.", "Nombres", "Apellidos", "Cédula", "No. empleado", "Empresa", "Retiró el socio", "Retiró otra persona", "Firma"];
export const SOUVENIR_PRINT_WIDTHS = [32, 108, 138, 86, 56, 60, 52, 60, 176];

export function souvenirPrintIndicators(member: Pick<SouvenirPrintMember, "delivered" | "collectedByOther">) {
  return [member.delivered && !member.collectedByOther ? "Sí" : "", member.delivered && member.collectedByOther ? "Sí" : ""];
}

export function souvenirPrintSheets(members: SouvenirPrintMember[], pageSize = 30) {
  const groups = new Map<string, { location: string; members: SouvenirPrintMember[] }>();
  for (const member of [...members].sort((a, b) => a.listNumber - b.listNumber)) {
    const key = member.companyId + ":" + souvenirLocationKey(member.approximateLocation);
    const group = groups.get(key) || { location: souvenirLocationLabel(member.approximateLocation), members: [] };
    group.members.push(member); groups.set(key, group);
  }
  return [...groups.values()].flatMap(group => {
    const chunks: SouvenirPrintMember[][] = [];
    for (let i = 0; i < group.members.length; i += pageSize) chunks.push(group.members.slice(i, i + pageSize));
    return chunks.map((members, i) => ({ companyId: members[0].companyId, companyName: members[0].companyName, location: group.location, total: group.members.length, page: i + 1, pages: chunks.length, members }));
  });
}
