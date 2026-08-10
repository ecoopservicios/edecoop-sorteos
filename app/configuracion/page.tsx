import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { SettingsManager } from "@/components/settings-manager";
import { getCooperativeSettings } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureEnrollmentForm } from "@/lib/enrollment-server";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const form = await ensureEnrollmentForm(user.id);
  const [settings, zones] = await Promise.all([
    getCooperativeSettings(),
    prisma.eventZone.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] })
  ]);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-950">Configuracion</h1>
        <p className="text-slate-600">Administra datos generales de EDECOOP y listas comunes usadas en la plataforma.</p>
      </div>
      <SettingsManager
        formId={form.id}
        settings={settings}
        companies={form.companies.map((company) => ({
          id: company.id,
          name: company.name,
          isActive: company.isActive,
          dataUpdateEnabled: company.dataUpdateEnabled,
          dataUpdateLookupField: company.dataUpdateLookupField
        }))}
        zones={zones.map((zone) => ({ id: zone.id, name: zone.name, isActive: zone.isActive }))}
      />
    </AppShell>
  );
}
