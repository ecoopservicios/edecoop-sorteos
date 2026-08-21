import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, ClipboardPenLine, Gift, History, Settings } from "lucide-react";
import { Prisma } from "@prisma/client";

import { AffiliationEventCreator } from "@/components/affiliation-event-creator";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EVENT_TYPE_CODES, ensureBaseEventTypes, eventStatusLabel, monthLabel } from "@/lib/events";

const adminSections = [
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Resumen operativo de la jornada de afiliacion, premios disponibles y premios otorgados.",
    icon: BarChart3
  },
  {
    href: "/ruleta/presencial",
    title: "Participacion presencial",
    description: "Ruleta presencial para promotoras y entrega de premios instantaneos.",
    icon: Gift
  },
  {
    href: "/inscripcion-virtual",
    title: "Formularios de afiliacion",
    description: "Link publico, codigo QR, carga de formularios fisicos y solicitudes recibidas.",
    icon: ClipboardPenLine
  },
  {
    href: "/historico",
    title: "Premios otorgados",
    description: "Consulta de codigos, participantes, estados y premios entregados por afiliacion.",
    icon: History
  },
  {
    href: "/configuracion",
    title: "Configuracion",
    description: "Usuarios, empresas del formulario, bitacora y listas generales de la plataforma.",
    icon: Settings
  }
];

const promoterSections = adminSections.filter((section) => section.href !== "/configuracion");
type AffiliationEventWithType = Prisma.EventEditionGetPayload<{ include: { eventType: true; prizes: true } }>;

export default async function AffiliationProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/cambiar-clave");

  const isAdmin = user.role === "ADMIN";
  const sections = user.role === "ADMIN" ? adminSections : promoterSections;
  const currentYear = new Date().getFullYear();
  let affiliationEvents: AffiliationEventWithType[] = [];

  if (isAdmin) {
    await ensureBaseEventTypes();
    affiliationEvents = await prisma.eventEdition.findMany({
      where: {
        eventType: {
          code: { in: [EVENT_TYPE_CODES.AFFILIATION_INSTANT, EVENT_TYPE_CODES.AFFILIATION_FINAL] }
        }
      },
      include: { eventType: true, prizes: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ year: "desc" }, { month: "desc" }, { eventType: { name: "asc" } }]
    });
  }

  return (
    <AppShell user={user} module="affiliation">
      <section className="w-full">
        <div className="mb-8">
          <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
            <ClipboardPenLine size={30} />
          </div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Proyecto</p>
          <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">Afiliacion</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Gestiona la jornada de afiliacion, formularios, participacion presencial, premios instantaneos y seguimiento
            de solicitudes recibidas.
          </p>
        </div>

        {isAdmin ? (
          <AffiliationEventCreator
            currentYear={currentYear}
            rows={affiliationEvents.map((event) => ({
              id: event.id,
              displayName: event.displayName,
              typeName: event.eventType.name,
              typeCode: event.eventType.code,
              month: event.month,
              monthLabel: monthLabel(event.month),
              year: event.year,
              promotionStartAt: event.promotionStartAt?.toLocaleDateString("es-DO") || "",
              promotionEndAt: event.promotionEndAt?.toLocaleDateString("es-DO") || "",
              promotionStartInput: event.promotionStartAt?.toISOString().slice(0, 10) || "",
              promotionEndInput: event.promotionEndAt?.toISOString().slice(0, 10) || "",
              status: event.status,
              prizes: event.prizes.map((prize) => ({
                id: prize.id,
                type: prize.type,
                name: prize.name,
                availableQuantity: prize.availableQuantity,
                awardedQuantity: prize.awardedQuantity,
                isActive: prize.isActive
              })),
              statusLabel: eventStatusLabel(event.status)
            }))}
          />
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group flex min-h-[190px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
              >
                <div>
                  <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
                    <Icon size={24} />
                  </div>
                  <h2 className="text-xl font-black text-slate-950">{section.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{section.description}</p>
                </div>
                <span className="mt-6 text-sm font-black text-emerald-800 group-hover:text-emerald-900">Abrir</span>
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
