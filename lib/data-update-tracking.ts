export type TrackingMember = { id: string; companyName: string };
export type TrackingUpdate = { memberId: string; companyName: string; registeredAt: string };

export function summarizeDataUpdates(members: TrackingMember[], updates: TrackingUpdate[]) {
  const updatedIds = new Set(updates.map((row) => row.memberId));
  const companies = new Map<string, { companyName: string; total: number; updated: number; pending: number; percent: number; today: number }>();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });
  for (const member of members) {
    const row = companies.get(member.companyName) || { companyName: member.companyName, total: 0, updated: 0, pending: 0, percent: 0, today: 0 };
    row.total++;
    if (updatedIds.has(member.id)) row.updated++;
    companies.set(member.companyName, row);
  }
  const todayIds = new Set<string>();
  for (const update of updates) {
    if (new Date(update.registeredAt).toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" }) !== today || todayIds.has(update.memberId)) continue;
    const row = companies.get(update.companyName);
    if (row) { row.today++; todayIds.add(update.memberId); }
  }
  return [...companies.values()].map((row) => ({ ...row, pending: row.total - row.updated, percent: row.total ? Math.round(row.updated / row.total * 100) : 0 }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName, "es"));
}
