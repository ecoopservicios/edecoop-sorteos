const assert = require('node:assert/strict');
require('@next/env').loadEnvConfig(process.cwd());
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  assert(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname), 'Local database required');
  const existing = await db.$queryRaw`SELECT to_regclass('public."SouvenirMember"')::text AS name`;
  if (existing[0].name) { console.log('Souvenir list already separated.'); return; }
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`CREATE TABLE "SouvenirMember" (
      "id" TEXT NOT NULL, "enrollmentCompanyId" TEXT NOT NULL,
      "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL,
      "documentId" TEXT, "employeeNumber" TEXT,
      "organizationalDirection" TEXT, "physicalListPage" INTEGER,
      "loadedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "SouvenirMember_pkey" PRIMARY KEY ("id")
    )`);
    // Retain explicit souvenir data and previous deliveries, without enrolling the shared directory.
    await tx.$executeRawUnsafe(`INSERT INTO "SouvenirMember" (
      "id", "enrollmentCompanyId", "firstName", "lastName", "documentId", "employeeNumber",
      "organizationalDirection", "physicalListPage", "loadedById", "createdAt", "updatedAt"
    ) SELECT m."id", m."enrollmentCompanyId", m."firstName", m."lastName", m."documentId", m."employeeNumber",
      COALESCE(m."organizationalDirection", d."organizationalDirection"), COALESCE(m."physicalListPage", d."physicalListPage"),
      m."loadedById", m."createdAt", m."updatedAt"
      FROM "MemberDirectory" m LEFT JOIN "SouvenirDelivery" d ON d."memberDirectoryId" = m."id"
      WHERE d."id" IS NOT NULL OR m."organizationalDirection" IS NOT NULL OR m."physicalListPage" IS NOT NULL`);
    await tx.$executeRawUnsafe('ALTER TABLE "SouvenirDelivery" DROP CONSTRAINT "SouvenirDelivery_memberDirectoryId_fkey"');
    await tx.$executeRawUnsafe('ALTER TABLE "SouvenirDelivery" RENAME COLUMN "memberDirectoryId" TO "souvenirMemberId"');
    await tx.$executeRawUnsafe('ALTER INDEX "SouvenirDelivery_memberDirectoryId_key" RENAME TO "SouvenirDelivery_souvenirMemberId_key"');
    await tx.$executeRawUnsafe('CREATE UNIQUE INDEX "SouvenirMember_enrollmentCompanyId_documentId_key" ON "SouvenirMember"("enrollmentCompanyId", "documentId")');
    await tx.$executeRawUnsafe('CREATE UNIQUE INDEX "SouvenirMember_enrollmentCompanyId_employeeNumber_key" ON "SouvenirMember"("enrollmentCompanyId", "employeeNumber")');
    await tx.$executeRawUnsafe('CREATE INDEX "SouvenirMember_enrollmentCompanyId_idx" ON "SouvenirMember"("enrollmentCompanyId")');
    await tx.$executeRawUnsafe('ALTER TABLE "SouvenirMember" ADD CONSTRAINT "SouvenirMember_enrollmentCompanyId_fkey" FOREIGN KEY ("enrollmentCompanyId") REFERENCES "EnrollmentCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
    await tx.$executeRawUnsafe('ALTER TABLE "SouvenirMember" ADD CONSTRAINT "SouvenirMember_loadedById_fkey" FOREIGN KEY ("loadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE');
    await tx.$executeRawUnsafe('ALTER TABLE "SouvenirDelivery" ADD CONSTRAINT "SouvenirDelivery_souvenirMemberId_fkey" FOREIGN KEY ("souvenirMemberId") REFERENCES "SouvenirMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
    await tx.$executeRawUnsafe('ALTER TABLE "MemberDirectory" DROP COLUMN "organizationalDirection", DROP COLUMN "physicalListPage"');
  });
  console.log('Independent souvenir list created; previous deliveries preserved.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
