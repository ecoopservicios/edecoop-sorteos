import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SouvenirManager } from "@/components/souvenir-manager";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { compareSouvenirCompanies } from "@/lib/souvenir-order";

export default async function SouvenirUploadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" || user.mustChangePassword) redirect("/entrega-souvenir");
  const companies = await prisma.enrollmentCompany.findMany({ where: { deletedAt: null, isActive: true, dataUpdateLookupField: { not: null } }, select: { id: true, name: true, dataUpdateLookupField: true }, orderBy: { name: "asc" } });
  return <AppShell user={user} module="souvenir"><SouvenirManager companies={companies.sort((a, b) => compareSouvenirCompanies(a.name, b.name))} isAdmin userId={user.id} view="carga" /></AppShell>;
}
