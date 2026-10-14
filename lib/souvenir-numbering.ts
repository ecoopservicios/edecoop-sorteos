import { Prisma } from "@prisma/client";
import { compareSouvenirMembers } from "@/lib/souvenir-order";

export async function resequenceSouvenirList(tx: Prisma.TransactionClient) {
  const members = await tx.souvenirMember.findMany({ include: { enrollmentCompany: { select: { name: true } } } });
  const sorted = members.map(m => ({ ...m, companyName: m.enrollmentCompany.name })).sort(compareSouvenirMembers);
  if (!sorted.length) return;
  // Temporary negative values avoid collisions with the unique index while resequencing.
  await tx.$executeRaw`UPDATE "SouvenirMember" SET "listNumber" = -"listNumber"`;
  await tx.$executeRaw`UPDATE "SouvenirMember" AS m SET "listNumber" = v.number
    FROM (VALUES ${Prisma.join(sorted.map((member, index) => Prisma.sql`(${member.id}, ${index + 1}::integer)`))}) AS v(id, number)
    WHERE m.id = v.id`;
}
