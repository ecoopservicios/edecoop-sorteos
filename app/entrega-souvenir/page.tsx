import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SouvenirManager } from "@/components/souvenir-manager";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { compareSouvenirCompanies } from "@/lib/souvenir-order";

export default async function SouvenirPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const companies = await prisma.enrollmentCompany.findMany({
    where: { isActive: true, dataUpdateLookupField: { not: null } },
    select: { id: true, name: true, dataUpdateLookupField: true },
    orderBy: { name: "asc" }
  });
  return <AppShell user={user} module="souvenir"><SouvenirManager companies={companies.sort((a, b) => compareSouvenirCompanies(a.name, b.name))} isAdmin={user.role === "ADMIN"} userId={user.id} /></AppShell>;
}
