import { redirect } from "next/navigation";
import { Prisma, RaffleEnvironment, RaffleResultStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { HistoryFilters } from "@/components/history-filters";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { environmentLabel, prizeStatusLabel } from "@/lib/labels";

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
    q?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { desde, hasta, tipo, estado, evento, premio, promotora, q } = await searchParams;
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
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { id: true, displayName: true }
    })
  ]);
  const prizes = prizeGroups.map((prize) => ({ id: prize.prizeName, name: prize.prizeName }));
  const eventOptions = events.map((event) => ({ id: event.id, name: event.displayName }));

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-950">Histórico de premios</h1>
        <p className="text-slate-600">
          {tipo ? `Filtro activo: ${tipo === "presencial" ? "Presencial" : "Virtual"}. ` : ""}
          Registro de fecha, código, participante, evento, premio, tipo y responsable.
        </p>
      </div>
      <HistoryFilters prizes={prizes} promoters={promoters} events={eventOptions} />
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
    </AppShell>
  );
}
