import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SouvenirPrint } from "@/components/souvenir-print";

export const dynamic = "force-dynamic";

export default async function SouvenirPrintPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/proyectos");
  const members = await prisma.souvenirMember.findMany({ where: { clearedAt: null }, select: { id: true, listNumber: true, firstName: true, lastName: true, displayDocumentId: true, employeeNumber: true, office: true, unit: true, approximateLocation: true, enrollmentCompanyId: true, enrollmentCompany: { select: { name: true } }, souvenirDelivery: { select: { collectedByOther: true } } } });
  return <SouvenirPrint members={members.map(m => ({ id: m.id, listNumber: m.listNumber, firstName: m.firstName, lastName: m.lastName, displayDocumentId: m.displayDocumentId, employeeNumber: m.employeeNumber, office: m.office, unit: m.unit, approximateLocation: m.approximateLocation, companyId: m.enrollmentCompanyId, companyName: m.enrollmentCompany.name, delivered: !!m.souvenirDelivery, collectedByOther: m.souvenirDelivery?.collectedByOther ?? false }))} />;
}
