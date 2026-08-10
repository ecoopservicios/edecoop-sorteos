const bcrypt = require("bcryptjs");
const { PrismaClient, UserRole } = require("@prisma/client");

const prisma = new PrismaClient();

async function ensureUser({ email, name, role }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  const passwordHash = await bcrypt.hash("123456789", 12);
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      mustChangePassword: true,
      isActive: true
    }
  });
}

async function main() {
  await ensureUser({
    name: "Administrador EDECOOP",
    email: "admin@edecoop.local",
    role: UserRole.ADMIN
  });

  await ensureUser({
    name: "Promotora Demo",
    email: "promotora@edecoop.local",
    role: UserRole.PROMOTER
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
