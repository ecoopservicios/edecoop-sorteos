import { redirect } from "next/navigation";
import { Prisma, RaffleEnvironment, RaffleResultStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { PrizeStatusFilters } from "@/components/prize-status-filters";
import { PrizeStatusTable } from "@/components/prize-status-table";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { environmentLabel, prizeStatusLabel } from "@/lib/labels";

export default async function PrizeStatusPage({
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
  if (user.role !== UserRole.ADMIN) redirect("/ruleta/presencial");
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
  const statusFilter = status ? status : { not: RaffleResultStatus.DELIVERED };
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
    status: statusFilter,
    eventEditionId: evento || undefined,
    prizeName: premio || undefined,
    responsibleUserId: promotora || undefined,
    createdAt,
    OR: search
      ? [
          { code: { contains: search, mode: "insensitive" } },
          { participantName: { contains: search, mode: "insensitive" } },
          { participantPhone: { contains: search, mode: "insensitive" } },
          { participantNie: { contains: search, mode: "insensitive" } },
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
        <h1 className="text-2xl font-black text-slate-950">Estado de Premio</h1>
        <p className="text-slate-600">
          {tipo ? `Filtro tipo: ${tipo === "presencial" ? "Presencial" : "Virtual"}. ` : ""}
          {estado ? `Filtro estado: ${estado}. ` : ""}
          Consulta premios pendientes o enviados. Los entregados pasan al Histórico.
        </p>
      </div>
      <PrizeStatusFilters prizes={prizes} promoters={promoters} events={eventOptions} />
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
    </AppShell>
  );
}
