import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { AppShellClient } from "@/components/app-shell-client";

export function AppShell({
  user,
  children
}: {
  user: { name: string; role: UserRole; mustChangePassword?: boolean };
  children: React.ReactNode;
}) {
  if (user.mustChangePassword) redirect("/cambiar-clave");

  return (
    <AppShellClient user={{ name: user.name, role: user.role }}>
      {children}
    </AppShellClient>
  );
}
