import Link from "next/link";
import { redirect } from "next/navigation";
import { EventEditionStatus, RaffleEnvironment, RaffleResultStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { ExportExcelButton } from "@/components/export-excel-button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EVENT_TYPE_CODES, eventStatusLabel, monthLabel, prizeTypeLabel } from "@/lib/events";

const affiliationTypeCodes = [EVENT_TYPE_CODES.AFFILIATION_INSTANT, EVENT_TYPE_CODES.AFFILIATION_FINAL];

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = user.role === UserRole.ADMIN;
  const { evento } = await searchParams;

  const events = await prisma.eventEdition.findMany({
    where: {
      status: { not: EventEditionStatus.CLOSED },
      eventType: { code: { in: affiliationTypeCodes } }
    },
    include: {
      eventType: true,
      prizes: { orderBy: { name: "asc" } }
    },
    orderBy: [{ status: "asc" }, { year: "desc" }, { month: "desc" }]
  });
  const selectedEvent = events.find((event) => event.id === evento) || events[0] || null;

  const [results, affiliationParticipants, manualParticipants] = selectedEvent
    ? await Promise.all([
        prisma.raffleResult.findMany({
          where: { eventEditionId: selectedEvent.id },
          select: {
            id: true,
            prizeId: true,
            environment: true,
            status: true,
            responsibleUserId: true
          }
        }),
        prisma.enrollmentSubmission.count({
          where: {
            deletedAt: null,
            OR: [{ eventEditionId: selectedEvent.id }, { eventEditionId: null }]
          }
        }),
        prisma.eventParticipant.count({ where: { eventEditionId: selectedEvent.id } })
      ])
    : [[], 0, 0];

  const isAffiliation =
    selectedEvent?.eventType.code === "AFFILIATION_INSTANT" || selectedEvent?.eventType.code === "AFFILIATION_FINAL";
  const participantCount = isAffiliation ? affiliationParticipants : manualParticipants;
  const delivered = results.length;
  const presential = results.filter((result) => result.environment === RaffleEnvironment.PRESENTIAL).length;
  const digital = results.filter((result) => result.environment === RaffleEnvironment.DIGITAL).length;
  const pending = results.filter((result) => result.status === RaffleResultStatus.PENDING).length;
  const sent = results.filter((result) => result.status === RaffleResultStatus.SENT).length;
  const deliveredStatus = results.filter((result) => result.status === RaffleResultStatus.DELIVERED).length;
  const totalAvailable = selectedEvent?.prizes.reduce((sum, prize) => sum + prize.availableQuantity, 0) || 0;

  const awardedByPrize = new Map<string, number>();
  for (const result of results) {
    awardedByPrize.set(result.prizeId, (awardedByPrize.get(result.prizeId) || 0) + 1);
  }
  const prizeSummaryRows =
    selectedEvent?.prizes.map((prize) => {
      const awarded = awardedByPrize.get(prize.id) || 0;
      return {
        Premio: prize.name,
        Tipo: prizeTypeLabel(prize.type),
        Zona: prize.zone || "",
        Disponible: prize.availableQuantity,
        Otorgado: awarded,
        "Total jornada": prize.availableQuantity + awarded,
        Estado: prize.isActive ? "Activo" : "Inactivo",
        Evento: selectedEvent.displayName
      };
    }) || [];

  const eventQuery = selectedEvent ? `evento=${selectedEvent.id}` : "";
  const cards = [
    { label: "Participantes", value: participantCount, href: isAdmin ? "/inscripcion-virtual?tab=respuestas" : "/dashboard" },
    { label: "Premios configurados", value: selectedEvent?.prizes.length || 0, href: isAdmin ? "/inscripcion-virtual?tab=premios" : "/dashboard" },
    { label: "Disponibles", value: totalAvailable, href: isAdmin ? "/inscripcion-virtual?tab=premios" : "/dashboard" },
    { label: "Premios entregados", value: delivered, href: eventQuery ? `/historico?${eventQuery}` : "/historico" },
    { label: "Presenciales", value: presential, href: eventQuery ? `/historico?tipo=presencial&${eventQuery}` : "/historico?tipo=presencial" },
    { label: "Virtuales", value: digital, href: eventQuery ? `/historico?tipo=virtual&${eventQuery}` : "/historico?tipo=virtual" },
    { label: "Pendientes", value: pending, href: isAdmin && eventQuery ? `/estado-premio?estado=pendiente&${eventQuery}` : "/historico?estado=pendiente" },
    { label: "Enviados", value: sent, href: isAdmin && eventQuery ? `/estado-premio?estado=enviado&${eventQuery}` : "/historico?estado=enviado" },
    { label: "Entregados", value: deliveredStatus, href: eventQuery ? `/historico?estado=entregado&${eventQuery}` : "/historico?estado=entregado" }
  ];

  return (
    <AppShell user={user}>
      <div className="mb-5 sm:mb-6">
        <h1 className="text-xl font-black text-slate-950 sm:text-2xl">Dashboard</h1>
        <p className="text-slate-600">Resumen operativo por evento, premios y participaciones.</p>
      </div>

      <form className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Evento que alimenta los indicadores</span>
          <select name="evento" defaultValue={selectedEvent?.id || ""} className="w-full rounded-md border border-slate-300 px-3 py-2" disabled={events.length === 0}>
            {events.length === 0 ? <option value="">No hay eventos activos o inactivos</option> : null}
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.displayName} - {eventStatusLabel(event.status)}
              </option>
            ))}
          </select>
        </label>
        <button className="mt-3 w-full rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 sm:w-auto" disabled={events.length === 0}>
          Aplicar filtro
        </button>
      </form>

      {selectedEvent ? (
        <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 sm:p-4">
          <p className="text-sm font-bold text-emerald-800">Evento seleccionado</p>
          <h2 className="text-lg font-black text-emerald-950 sm:text-xl">{selectedEvent.displayName}</h2>
          <p className="text-sm text-emerald-900">
            {selectedEvent.eventType.name} · {monthLabel(selectedEvent.month)} {selectedEvent.year} · {eventStatusLabel(selectedEvent.status)}
          </p>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 sm:p-4"
            title={`Ver ${card.label.toLowerCase()}`}
          >
            <p className="text-sm font-bold text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{card.value}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="mb-1 text-lg font-black text-slate-950">Resumen de premios del evento</h2>
            <p className="text-sm text-slate-600">{selectedEvent ? selectedEvent.displayName : "Seleccione un evento para ver el resumen."}</p>
          </div>
          <ExportExcelButton rows={prizeSummaryRows} fileName="resumen-dashboard-premios" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Premio</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Zona</th>
                <th className="px-3 py-2">Disponible</th>
                <th className="px-3 py-2">Otorgado</th>
                <th className="px-3 py-2">Total jornada</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {selectedEvent?.prizes.map((prize) => {
                const awarded = awardedByPrize.get(prize.id) || 0;
                return (
                  <tr key={prize.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold">{prize.name}</td>
                    <td className="px-3 py-2">{prizeTypeLabel(prize.type)}</td>
                    <td className="px-3 py-2">{prize.zone || "-"}</td>
                    <td className="px-3 py-2">{prize.availableQuantity}</td>
                    <td className="px-3 py-2">{awarded}</td>
                    <td className="px-3 py-2">{prize.availableQuantity + awarded}</td>
                    <td className="px-3 py-2">{prize.isActive ? "Activo" : "Inactivo"}</td>
                  </tr>
                );
              })}
              {!selectedEvent || selectedEvent.prizes.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan={7}>
                    No hay premios configurados para este evento.
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
