import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { DataUpdateAdmin } from "@/components/data-update-admin";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DataUpdateAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const [members, updates, enrollmentCompanies] = await Promise.all([
    prisma.memberDirectory.findMany({
      include: { enrollmentCompany: true },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.memberDataUpdateSubmission.findMany({
      include: { enrollmentCompany: true, memberDirectory: true },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.enrollmentCompany.findMany({ orderBy: { name: "asc" } })
  ]);
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3002";

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-950">Actualizacion de Datos</h1>
        <p className="text-slate-600">Configura empresas, base de socios y solicitudes recibidas.</p>
      </div>
      <DataUpdateAdmin
        publicUrl={`${baseUrl}/actualizar-datos`}
        enrollmentCompanies={enrollmentCompanies.map((company) => ({
          id: company.id,
          name: company.name,
          isActive: company.isActive,
          dataUpdateEnabled: company.dataUpdateEnabled,
          dataUpdateLookupField: company.dataUpdateLookupField
        }))}
        members={members.map((row) => ({
          id: row.id,
          companyName: row.enrollmentCompany.name,
          name: `${row.firstName} ${row.lastName}`,
          documentId: row.documentId,
          employeeNumber: row.employeeNumber,
          personalPhone: row.personalPhone,
          personalEmail: row.personalEmail
        }))}
        updates={updates.map((row) => ({
          id: row.id,
          createdAt: row.createdAt.toLocaleString("es-DO"),
          companyName: row.enrollmentCompany.name,
          name: `${row.memberDirectory.firstName} ${row.memberDirectory.lastName}`,
          personalPhone: row.personalPhone,
          whatsappPhone: row.whatsappPhone,
          personalEmail: row.personalEmail,
          emergencyContactName: row.emergencyContactName,
          emergencyContactPhone: row.emergencyContactPhone,
          emergencyContactRelation: row.emergencyContactRelation,
          status: row.status
        }))}
      />
    </AppShell>
  );
}
