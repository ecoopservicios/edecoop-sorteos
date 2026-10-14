const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Solo se permite la base local.');
  const count = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(209831)`;
    await tx.$executeRaw`UPDATE "SouvenirDelivery" d SET "companyId" = m."enrollmentCompanyId", "firstName" = m."firstName", "lastName" = m."lastName" FROM "SouvenirMember" m WHERE d."souvenirMemberId" = m.id AND d."companyId" IS NULL`;
    const result = await tx.souvenirMember.deleteMany({ where: { clearedAt: { not: null } } });
    return result.count;
  });
  console.log(`Registros retirados eliminados definitivamente: ${count}. Entregas conservadas.`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
