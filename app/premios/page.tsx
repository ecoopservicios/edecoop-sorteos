import Link from "next/link";
import { redirect } from "next/navigation";
import { EventEditionStatus, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { EventsManager } from "@/components/events-manager";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EVENT_TYPE_CODES, ensureBaseEventTypes } from "@/lib/events";

export default async function EventsPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");

  const { tab } = await searchParams;
  const activeTab = tab === "premios" || tab === "participantes" || tab === "historicos" || tab === "configuracion" || tab === "reset" ? tab : "eventos";
  await ensureBaseEventTypes();

  const [eventTypes, activeEvents, historicalEvents, submissions, manualParticipants, eventPrizeResults, zones] = await Promise.all([
    prisma.eventType.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    }),
    prisma.eventEdition.findMany({
      where: { status: { not: EventEditionStatus.CLOSED } },
      include: {
        eventType: true,
        prizes: { orderBy: { createdAt: "desc" } },
        participants: true,
        raffleResults: true
      },
      orderBy: [{ year: "desc" }, { month: "desc" }]
    }),
    prisma.eventEdition.findMany({
      where: { status: EventEditionStatus.CLOSED },
      include: {
        eventType: true,
        prizes: { orderBy: { createdAt: "desc" } },
        participants: true,
        raffleResults: true
      },
      orderBy: { closedAt: "desc" }
    }),
    prisma.enrollmentSubmission.findMany({
      where: { deletedAt: null },
      include: { raffleResult: true },
      orderBy: { createdAt: "desc" },
      take: 1000
    }),
    prisma.eventParticipant.findMany({
      include: { eventEdition: true },
      orderBy: { loadedAt: "desc" },
      take: 1000
    }),
    prisma.raffleResult.groupBy({
      by: ["eventEditionId", "prizeId"],
      where: { eventEditionId: { not: null } },
      _count: { _all: true }
    }),
    prisma.eventZone.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    })
  ]);

  const awardedByEventPrize = new Map<string, number>();
  for (const result of eventPrizeResults) {
    if (!result.eventEditionId) continue;
    awardedByEventPrize.set(`${result.eventEditionId}:${result.prizeId}`, result._count._all);
  }

  const enrollmentRows = submissions.map((submission) => ({
    id: submission.id,
    eventEditionId: submission.eventEditionId || "",
    name: `${submission.firstName} ${submission.lastName}`,
    documentId: submission.documentId,
    phone: submission.mobilePhone,
    email: submission.email,
    channel: submission.channel,
    prizeCode: submission.prizeCode || "",
    prizeName: submission.raffleResult?.prizeName || "",
    prizeStatus: submission.raffleResult?.status || "",
    prizeDate: submission.raffleResult?.createdAt.toISOString() || "",
    status: submission.followUpStatus,
    receivedPrize: submission.receivedPrize,
    loadedAt: submission.createdAt.toISOString()
  }));

  const instantCampaignByPeriod = new Map<string, string>();
  for (const event of [...activeEvents, ...historicalEvents]) {
    if (event.eventType.code === EVENT_TYPE_CODES.AFFILIATION_INSTANT) {
      instantCampaignByPeriod.set(`${event.month}-${event.year}`, event.id);
    }
  }

  const eventParticipantRows: Record<string, Array<{ id: string; name: string; documentId: string; phone: string; email: string; zone: string; source: string; status: string; channel: string; prizeCode: string; prizeName: string; prizeStatus: string; prizeDate: string; loadedAt: string }>> = {};
  for (const event of [...activeEvents, ...historicalEvents]) {
    const isAffiliation = event.eventType.code === EVENT_TYPE_CODES.AFFILIATION_INSTANT || event.eventType.code === EVENT_TYPE_CODES.AFFILIATION_FINAL;
    const affiliationEventId =
      event.eventType.code === EVENT_TYPE_CODES.AFFILIATION_FINAL
        ? instantCampaignByPeriod.get(`${event.month}-${event.year}`) || ""
        : event.id;
    eventParticipantRows[event.id] = isAffiliation
      ? enrollmentRows.filter((row) => row.eventEditionId === affiliationEventId).map((row) => ({
          id: row.id,
          name: row.name,
          documentId: row.documentId,
          phone: row.phone,
          email: row.email,
          zone: "",
          source: "ENROLLMENT",
          status: row.receivedPrize ? "WINNER" : row.status,
          channel: row.channel,
          prizeCode: row.prizeCode,
          prizeName: row.prizeName,
          prizeStatus: row.prizeStatus,
          prizeDate: row.prizeDate,
          loadedAt: row.loadedAt
        }))
      : manualParticipants
          .filter((participant) => participant.eventEditionId === event.id)
          .map((participant) => {
            const participantName = `${participant.firstName} ${participant.lastName}`;
            const result = event.raffleResults.find((raffleResult) =>
              Boolean(
                (participant.documentId && raffleResult.participantNie === participant.documentId) ||
                  (participant.phone && raffleResult.participantPhone === participant.phone) ||
                  (participant.email && raffleResult.participantEmail === participant.email) ||
                  raffleResult.participantName.toUpperCase() === participantName.toUpperCase()
              )
            );
            return {
              id: participant.id,
              name: participantName,
              documentId: participant.documentId || "",
              phone: participant.phone || "",
              email: participant.email || "",
              zone: participant.zone || "",
              source: participant.source,
              status: result ? "WINNER" : participant.status,
              channel: "EVENTO",
              prizeCode: result?.code || "",
              prizeName: result?.prizeName || "",
              prizeStatus: result?.status || "",
              prizeDate: result?.createdAt.toISOString() || "",
              loadedAt: participant.loadedAt.toISOString()
            };
          });
  }

  function serializeEvent(event: (typeof activeEvents)[number]) {
    const isAffiliation = event.eventType.code === EVENT_TYPE_CODES.AFFILIATION_INSTANT || event.eventType.code === EVENT_TYPE_CODES.AFFILIATION_FINAL;
    return {
      id: event.id,
      displayName: event.displayName,
      month: event.month,
      year: event.year,
      usesZones: event.usesZones,
      status: event.status,
      closedAt: event.closedAt?.toISOString() || null,
      eventType: {
        id: event.eventType.id,
        name: event.eventType.name,
        code: event.eventType.code,
        isActive: event.eventType.isActive
      },
      prizes: event.prizes.map((prize) => ({
        id: prize.id,
        type: prize.type,
        name: prize.name,
        zone: prize.zone,
        availableQuantity: prize.availableQuantity,
        awardedQuantity: awardedByEventPrize.get(`${event.id}:${prize.id}`) || 0,
        isActive: prize.isActive
      })),
      participantCount: isAffiliation ? enrollmentRows.length : event.participants.length,
      prizeResultCount: event.raffleResults.length
    };
  }

  const tabs = [
    { href: "/premios", label: "Crear Eventos", key: "eventos" },
    { href: "/premios?tab=premios", label: "Premios", key: "premios" },
    { href: "/premios?tab=participantes", label: "Participantes", key: "participantes" },
    { href: "/premios?tab=historicos", label: "Eventos Históricos", key: "historicos" },
    { href: "/premios?tab=configuracion", label: "Configuracion de eventos", key: "configuracion" },
    { href: "/premios?tab=reset", label: "Reset de eventos", key: "reset" }
  ];

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-950">Eventos</h1>
        <p className="text-slate-600">Crea eventos por mes y año, asocia premios, consulta participantes y conserva históricos cerrados.</p>
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
      <EventsManager
        activeTab={activeTab}
        eventTypes={eventTypes.map((type) => ({ id: type.id, name: type.name, code: type.code, isActive: type.isActive }))}
        events={activeEvents.map(serializeEvent)}
        historicalEvents={historicalEvents.map(serializeEvent)}
        enrollmentRows={enrollmentRows}
        eventParticipantRows={eventParticipantRows}
        zones={zones.map((zone) => ({ id: zone.id, name: zone.name, isActive: zone.isActive }))}
      />
    </AppShell>
  );
}
