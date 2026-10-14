import type { Prisma } from "@prisma/client";

export function souvenirDeliveryMatch(member: { id: string; enrollmentCompanyId: string; documentId: string | null; employeeNumber: string | null }, companyName: string): Prisma.SouvenirDeliveryWhereInput {
  return { OR: [
    { souvenirMemberId: member.id },
    ...(member.documentId ? [{ documentId: member.documentId }] : []),
    ...(member.employeeNumber ? [{ employeeNumber: member.employeeNumber, OR: [{ companyId: member.enrollmentCompanyId }, { companyId: null, companyName }] }] : [])
  ] };
}
