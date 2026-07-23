import { redirect } from "next/navigation";
import { Prisma, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { AuditFilters } from "@/components/audit-filters";
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
    Prize: "Articulos",
    DigitalParticipant: "Participación Virtual",
    DigitalLink: "Enlaces Virtuales",
    RaffleResult: "Estado de Premio"
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

export default async function AuditPage({
  searchParams
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    usuario?: string;
    accion?: string;
    modulo?: string;
    q?: string;
  }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.role !== UserRole.ADMIN) redirect("/ruleta/presencial");

  const { desde, hasta, usuario, accion, modulo, q } = await searchParams;
  const createdAt =
    desde || hasta
      ? {
          gte: desde ? new Date(`${desde}T00:00:00`) : undefined,
          lte: hasta ? new Date(`${hasta}T23:59:59`) : undefined
        }
      : undefined;
  const search = q?.trim();

  const where: Prisma.AuditLogWhereInput = {
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

  const [logs, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 300
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    })
  ]);

  return (
    <AppShell user={currentUser}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-950">Bitácora</h1>
        <p className="text-slate-600">Consulta acciones administrativas, motivos y usuarios responsables.</p>
      </div>
      <AuditFilters users={users} />
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Acción</th>
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
    </AppShell>
  );
}
