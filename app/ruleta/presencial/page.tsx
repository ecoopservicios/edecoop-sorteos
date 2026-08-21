import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PresentialWheel } from "@/components/presential-wheel";
import { canSpinPresential, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EVENT_TYPE_CODES } from "@/lib/events";

const affiliationTypeCodes = [EVENT_TYPE_CODES.AFFILIATION_INSTANT, EVENT_TYPE_CODES.AFFILIATION_FINAL];

export default async function PresentialRafflePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSpinPresential(user)) redirect("/login");
  const now = new Date();
  const events = await prisma.eventEdition.findMany({
    where: {
      status: "ACTIVE",
      eventType: { code: { in: affiliationTypeCodes } },
      promotionStartAt: { lte: now },
      promotionEndAt: { gte: now },
      prizes: {
        some: {
          isActive: true,
          availableQuantity: { gt: 0 }
        }
      }
    },
    include: { eventType: true },
    orderBy: [{ year: "desc" }, { month: "desc" }]
  });

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-950">Participación Presencial</h1>
        <p className="text-slate-600">El participante se genera automáticamente y el premio descuenta inventario.</p>
      </div>
      <PresentialWheel
        events={events.map((event) => ({
          id: event.id,
          name: event.displayName,
          typeName: event.eventType.name,
          typeCode: event.eventType.code
        }))}
      />
    </AppShell>
  );
}
