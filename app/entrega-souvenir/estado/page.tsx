import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SouvenirList } from "@/components/souvenir-list";
import { getCurrentUser } from "@/lib/auth";

export default async function SouvenirStatusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AppShell user={user} module="souvenir"><SouvenirList view="estado" isAdmin={user.role === "ADMIN"} /></AppShell>;
}
