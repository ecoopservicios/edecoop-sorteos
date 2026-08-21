import { redirect } from "next/navigation";
import { Prisma, RaffleEnvironment, RaffleResultStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { ExportExcelButton } from "@/components/export-excel-button";
import { HistoryFilters } from "@/components/history-filters";
import { PrizeStatusTable } from "@/components/prize-status-table";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EVENT_TYPE_CODES } from "@/lib/events";
import { environmentLabel, prizeStatusLabel } from "@/lib/labels";

const affiliationTypeCodes = [EVENT_TYPE_CODES.AFFILIATION_INSTANT, EVENT_TYPE_CODES.AFFILIATION_FINAL];

export default async function HistoryPage({
  searchParams
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    tipo?: string;
    estado?: string;
    evento?: string;
    premio?: string;
    promotora?: string;
    modulo?: string;
    q?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = user.role === UserRole.ADMIN;
  const { desde, hasta, tipo, estado, evento, premio, promotora, modulo, q } = await searchParams;
  const isRafflesModule = modulo === "sorteos";
  const moduleEventFilter: Prisma.RaffleResultWhereInput = isRafflesModule
    ? { eventEdition: { is: { eventType: { code: { notIn: affiliationTypeCodes } } } } }
    : {
        OR: [
          { eventEditionId: null },
          { eventEdition: { is: { eventType: { code: { in: affiliationTypeCodes } } } } }
        ]
      };
  const environment =
    tipo === "presencial" ? RaffleEnvironment.PRESENTIAL : tipo === "virtual" ? RaffleEnvironment.DIGITAL : undefined;
  const status =
    estado === "pendiente"
      ? RaffleResultStatus.PENDING
      : estado === "enviado"
        ? RaffleResultStatus.SENT
        : estado === "entregado"
          ? RaffleResultStatus.DELIVERED
          : undefined;

  const createdAt =
    desde || hasta
      ? {
          gte: desde ? new Date(`${desde}T00:00:00`) : undefined,
          lte: hasta ? new Date(`${hasta}T23:59:59`) : undefined
        }
      : undefined;

  const search = q?.trim();
  const where: Prisma.RaffleResultWhereInput = {
    AND: [moduleEventFilter],
    environment,
    status,
    eventEditionId: evento || undefined,
    prizeName: premio || undefined,
    responsibleUserId: promotora || undefined,
    createdAt,
    OR: search
      ? [
          { code: { contains: search, mode: "insensitive" } },
          { participantName: { contains: search, mode: "insensitive" } },
          { participantNie: { contains: search, mode: "insensitive" } },
          { participantPhone: { contains: search, mode: "insensitive" } },
          { participantEmail: { contains: search, mode: "insensitive" } },
          { prizeName: { contains: search, mode: "insensitive" } },
          { eventName: { contains: search, mode: "insensitive" } }
        ]
      : undefined
  };

  const [results, prizeGroups, promoters, events] = await Promise.all([
    prisma.raffleResult.findMany({
      where,
      include: {
        responsibleUser: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 300
    }),
    prisma.raffleResult.groupBy({
      by: ["prizeName"],
      orderBy: { prizeName: "asc" }
    }),
    prisma.user.findMany({
      where: { role: UserRole.PROMOTER },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.eventEdition.findMany({
      where: {
        eventType: { code: isRafflesModule ? { notIn: affiliationTypeCodes } : { in: affiliationTypeCodes } }
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { id: true, displayName: true }
    })
  ]);
  const prizes = prizeGroups.map((prize) => ({ id: prize.prizeName, name: prize.prizeName }));
  const eventOptions = events.map((event) => ({ id: event.id, name: event.displayName }));
  const exportRows = results.map((result) => ({
    Fecha: result.createdAt.toLocaleString("es-DO"),
    Codigo: result.code,
    Participante: result.participantName,
    NIE: result.participantNie || "",
    Correo: result.participantEmail || "",
    Telefono: result.participantPhone || "",
    Evento: result.eventName || "Sin evento",
    Premio: result.prizeName,
    Tipo: environmentLabel(result.environment),
    Promotora: result.responsibleUser?.name || "",
    Estado: prizeStatusLabel(result.status)
  }));

  return (
    <AppShell user={user} module={modulo === "sorteos" ? "raffles" : "affiliation"}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-950">Premios Otorgados</h1>
        <p className="text-slate-600">
          {tipo ? `Filtro activo: ${tipo === "presencial" ? "Presencial" : "Virtual"}. ` : ""}
          Registro de fecha, código, participante, evento, premio, tipo, responsable y estado.
        </p>
      </div>
      <HistoryFilters prizes={prizes} promoters={promoters} events={eventOptions} />
      {isAdmin ? (
        <PrizeStatusTable
          rows={results.map((result) => ({
            id: result.id,
            createdAt: result.createdAt.toISOString(),
            code: result.code,
            participantName: result.participantName,
            participantPhone: result.participantPhone,
            eventName: result.eventName || "Sin evento",
            prizeName: result.prizeName,
            environmentLabel: environmentLabel(result.environment),
            status: result.status,
            statusLabel: prizeStatusLabel(result.status),
            responsibleName: result.responsibleUser?.name || ""
          }))}
        />
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex justify-end">
            <ExportExcelButton rows={exportRows} fileName="premios-otorgados" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Participante</th>
                  <th className="px-3 py-2">NIE</th>
                  <th className="px-3 py-2">Correo</th>
                  <th className="px-3 py-2">Teléfono</th>
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2">Premio</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Promotora</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{result.createdAt.toLocaleString("es-DO")}</td>
                    <td className="px-3 py-2 font-bold">{result.code}</td>
                    <td className="px-3 py-2">{result.participantName}</td>
                    <td className="px-3 py-2">{result.participantNie || "-"}</td>
                    <td className="px-3 py-2">{result.participantEmail || "-"}</td>
                    <td className="px-3 py-2">{result.participantPhone || "-"}</td>
                    <td className="px-3 py-2">{result.eventName || "Sin evento"}</td>
                    <td className="px-3 py-2">{result.prizeName}</td>
                    <td className="px-3 py-2">{environmentLabel(result.environment)}</td>
                    <td className="px-3 py-2">{result.responsibleUser?.name || "-"}</td>
                    <td className="px-3 py-2">{prizeStatusLabel(result.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}
