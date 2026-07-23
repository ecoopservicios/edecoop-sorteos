import { PrismaClient, PrizeEnvironment, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12);
  const promoterPassword = await bcrypt.hash("promo123", 12);

  await prisma.user.upsert({
    where: { email: "admin@edecoop.local" },
    update: {},
    create: {
      name: "Administrador EDECOOP",
      email: "admin@edecoop.local",
      passwordHash: adminPassword,
      role: UserRole.ADMIN
    }
  });

  await prisma.user.upsert({
    where: { email: "promotora@edecoop.local" },
    update: {},
    create: {
      name: "Promotora Demo",
      email: "promotora@edecoop.local",
      passwordHash: promoterPassword,
      role: UserRole.PROMOTER
    }
  });

  const prizes = [
    ["Sombrilla EDECOOP", "Premio promocional para jornadas", 30, PrizeEnvironment.BOTH],
    ["Taza institucional", "Articulo utilitario", 45, PrizeEnvironment.PRESENTIAL],
    ["Bono especial", "Premio exclusivo digital", 10, PrizeEnvironment.DIGITAL],
    ["Gorra EDECOOP", "Articulo promocional", 25, PrizeEnvironment.BOTH]
  ] as const;

  for (const [name, description, quantity, environment] of prizes) {
    const existing = await prisma.prize.findFirst({ where: { name } });
    if (!existing) {
      await prisma.prize.create({
        data: {
          name,
          description,
          totalQuantity: quantity,
          availableQuantity: quantity,
          environment
        }
      });
    }
  }

  await prisma.appCounter.upsert({
    where: { key: "PRESENTIAL_PARTICIPANT_SEQUENCE" },
    update: {},
    create: { key: "PRESENTIAL_PARTICIPANT_SEQUENCE", value: 0 }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
