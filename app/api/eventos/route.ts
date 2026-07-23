import { EventEditionStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { eventDisplayName } from "@/lib/events";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const body = await request.json().catch(() => ({}));
  const eventTypeId = String(body.eventTypeId || "").trim();
  const month = Number(body.month);
  const year = Number(body.year);
  const usesZones = Boolean(body.usesZones);

  if (!eventTypeId || month < 1 || month > 12 || year < 2026) {
    return jsonError("Debe completar tipo de evento, mes y año.", 422);
  }

  const eventType = await prisma.eventType.findUnique({ where: { id: eventTypeId } });
  if (!eventType || !eventType.isActive) return jsonError("Tipo de evento no disponible.", 422);

  const displayName = eventDisplayName(eventType.name, month, year);
  try {
    const event = await prisma.eventEdition.create({
      data: {
        eventTypeId,
        month,
        year,
        displayName,
        usesZones,
        status: EventEditionStatus.ACTIVE,
        eventDate: new Date(Date.UTC(year, month - 1, 1)),
        createdById: user!.id
      }
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(`Ya existe el evento ${displayName}. No se puede crear duplicado para el mismo tipo, mes y año.`, 409);
    }
    throw error;
  }
}
