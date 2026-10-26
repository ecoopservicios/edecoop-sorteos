import { redirect } from "next/navigation";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Settings } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DataUpdateAdmin } from "@/components/data-update-admin";
import { getDataUpdateQuestions, getDataUpdateTextSettings } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DataUpdateAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const [texts, questions, members, updates, enrollmentCompanies] = await Promise.all([
    getDataUpdateTextSettings(),
    getDataUpdateQuestions(),
    prisma.memberDirectory.findMany({
      include: { enrollmentCompany: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }]
    }),
    prisma.memberDataUpdateSubmission.findMany({
      include: { enrollmentCompany: true, memberDirectory: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }]
    }),
    prisma.enrollmentCompany.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } })
  ]);
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3002";

  return (
    <AppShell user={user} module="data-update">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-950">Actualizacion de Datos</h1>
        <p className="text-slate-600">Administra el link publico, textos, base de socios y solicitudes recibidas.</p>
      </div>
      <Link
        href="/configuracion"
        className="mb-5 flex min-h-[120px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md sm:max-w-md"
      >
        <div>
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
            <Settings size={22} />
          </div>
          <h2 className="text-lg font-black text-slate-950">Configuracion</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Empresas, usuarios y parametros globales de la plataforma.</p>
        </div>
        <span className="mt-4 text-sm font-black text-emerald-800">Abrir configuracion</span>
      </Link>
      <DataUpdateAdmin
        publicUrl={`${baseUrl}/actualizar-datos`}
        texts={texts}
        questions={questions}
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
          firstName: row.firstName,
          lastName: row.lastName,
          documentId: row.documentId,
          employeeNumber: row.employeeNumber
        }))}
        updates={updates.map((row) => {
          const responses = row.customResponses && typeof row.customResponses === "object" && !Array.isArray(row.customResponses) ? row.customResponses : {};
          const firstName = typeof responses.emergencyContactFirstName === "string" ? responses.emergencyContactFirstName : "";
          const lastName = typeof responses.emergencyContactLastName === "string" ? responses.emergencyContactLastName : "";
          return {
            id: row.id,
            memberId: row.memberDirectoryId,
            documentId: row.memberDirectory.documentId,
            employeeNumber: row.memberDirectory.employeeNumber,
            registeredAt: row.createdAt.toISOString(),
            createdAt: row.createdAt.toLocaleString("es-DO", { timeZone: "America/Santo_Domingo" }),
            companyName: row.enrollmentCompany.name,
            name: `${row.memberDirectory.firstName} ${row.memberDirectory.lastName}`,
            personalPhone: row.personalPhone,
            whatsappPhone: row.whatsappPhone,
            personalEmail: row.personalEmail,
            emergencyContactName: firstName || row.emergencyContactName,
            emergencyContactLastName: lastName,
            emergencyContactPhone: row.emergencyContactPhone,
            emergencyContactRelation: row.emergencyContactRelation,
            status: row.status
          };
        })}
      />
    </AppShell>
  );
}
