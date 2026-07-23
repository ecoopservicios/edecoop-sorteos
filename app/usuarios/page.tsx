import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { UserForm } from "@/components/user-form";
import { UsersTable } from "@/components/users-table";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== UserRole.ADMIN) redirect("/ruleta/presencial");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true
    }
  });

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-950">Usuarios</h1>
        <p className="text-slate-600">Crea administradores o promotoras para jornadas presenciales.</p>
      </div>
      <UserForm />
      <UsersTable
        users={users.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString()
        }))}
      />
    </AppShell>
  );
}
