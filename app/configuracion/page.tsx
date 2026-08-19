import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { AuditFilters } from "@/components/audit-filters";
import { ExportExcelButton } from "@/components/export-excel-button";
import { SettingsManager } from "@/components/settings-manager";
import { UserForm } from "@/components/user-form";
import { UsersTable } from "@/components/users-table";
import { getCooperativeSettings } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    CREATE: "Crear",
    UPDATE: "Editar",
    DELETE: "Eliminar",
    ACTIVATE: "Activar",
    DEACTIVATE: "Inactivar",
    RESET_PASSWORD: "Resetear clave",
    RESET_LINK: "Resetear enlace",
    CHANGE_PRIZE_STATUS: "Cambiar estado de premio"
  };
  return labels[action] || action;
}

function moduleLabel(entityType: string) {
  const labels: Record<string, string> = {
    User: "Usuarios",
    Prize: "Premios",
    DigitalParticipant: "Participacion Virtual",
    DigitalLink: "Enlaces Virtuales",
    RaffleResult: "Premios Otorgados"
  };
  return labels[entityType] || entityType;
}

function metadataSummary(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "-";
  const data = metadata as Record<string, unknown>;
  const parts = [
    data.participantName ? `Participante: ${data.participantName}` : "",
    data.participantNie ? `NIE: ${data.participantNie}` : "",
    data.participantPhone ? `Celular: ${data.participantPhone}` : "",
    data.prizeName ? `Premio: ${data.prizeName}` : "",
    data.previousStatus ? `Anterior: ${data.previousStatus}` : "",
    data.newStatus ? `Nuevo: ${data.newStatus}` : "",
    data.email ? `Correo: ${data.email}` : ""
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : JSON.stringify(data);
}

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{
    tab?: string;
    desde?: string;
    hasta?: string;
    usuario?: string;
    accion?: string;
    modulo?: string;
    q?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const { tab, desde, hasta, usuario, accion, modulo, q } = await searchParams;
  const activeTab = tab === "usuarios" || tab === "bitacora" ? tab : "general";
  const createdAt =
    desde || hasta
      ? {
          gte: desde ? new Date(`${desde}T00:00:00`) : undefined,
          lte: hasta ? new Date(`${hasta}T23:59:59`) : undefined
        }
      : undefined;
  const search = q?.trim();
  const auditWhere: Prisma.AuditLogWhereInput = {
    userId: usuario || undefined,
    action: accion || undefined,
    entityType: modulo || undefined,
    createdAt,
    OR: search
      ? [
          { reason: { contains: search, mode: "insensitive" } },
          { action: { contains: search, mode: "insensitive" } },
          { entityType: { contains: search, mode: "insensitive" } },
          { entityId: { contains: search, mode: "insensitive" } }
        ]
      : undefined
  };

  const [settings, zones, users, logs] = await Promise.all([
    getCooperativeSettings(),
    prisma.eventZone.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.user.findMany({
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
    }),
    prisma.auditLog.findMany({
      where: activeTab === "bitacora" ? auditWhere : undefined,
      include: {
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 300
    })
  ]);

  const tabs = [
    { href: "/configuracion", label: "General", key: "general" },
    { href: "/configuracion?tab=usuarios", label: "Usuarios", key: "usuarios" },
    { href: "/configuracion?tab=bitacora", label: "Bitacora", key: "bitacora" }
  ];

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-950">Configuracion</h1>
        <p className="text-slate-600">Administra datos generales de EDECOOP y listas comunes usadas en la plataforma.</p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`rounded-md px-4 py-2 text-sm font-bold ${
              activeTab === item.key ? "bg-emerald-700 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {activeTab === "usuarios" ? (
        <>
          <UserForm />
          <UsersTable
            users={users.map((item) => ({
              ...item,
              createdAt: item.createdAt.toISOString()
            }))}
          />
        </>
      ) : activeTab === "bitacora" ? (
        <>
          <AuditFilters users={users.map((item) => ({ id: item.id, name: item.name }))} basePath="/configuracion" fixedParams={{ tab: "bitacora" }} />
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex justify-end">
              <ExportExcelButton
                rows={logs.map((log) => ({
                  Fecha: log.createdAt.toLocaleString("es-DO"),
                  Usuario: log.user?.name || "Sistema",
                  Accion: actionLabel(log.action),
                  Modulo: moduleLabel(log.entityType),
                  Registro: log.entityId,
                  Motivo: log.reason,
                  Detalle: metadataSummary(log.metadata)
                }))}
                fileName="bitacora"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Usuario</th>
                    <th className="px-3 py-2">Accion</th>
                    <th className="px-3 py-2">Modulo</th>
                    <th className="px-3 py-2">Registro</th>
                    <th className="px-3 py-2">Motivo</th>
                    <th className="px-3 py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{log.createdAt.toLocaleString("es-DO")}</td>
                      <td className="px-3 py-2">{log.user?.name || "Sistema"}</td>
                      <td className="px-3 py-2">{actionLabel(log.action)}</td>
                      <td className="px-3 py-2">{moduleLabel(log.entityType)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{log.entityId}</td>
                      <td className="px-3 py-2">{log.reason}</td>
                      <td className="px-3 py-2">{metadataSummary(log.metadata)}</td>
                    </tr>
                  ))}
                  {logs.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-slate-500" colSpan={7}>
                        No hay eventos de bitacora para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <SettingsManager
          settings={settings}
          zones={zones.map((zone) => ({ id: zone.id, name: zone.name, isActive: zone.isActive }))}
        />
      )}
    </AppShell>
  );
}
