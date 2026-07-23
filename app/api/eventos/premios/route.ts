import { EventEditionStatus, EventPrizeType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { EVENT_TYPE_CODES } from "@/lib/events";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const body = await request.json().catch(() => ({}));
  const eventEditionId = String(body.eventEditionId || "").trim();
  const type = String(body.type || "") as EventPrizeType;
  const name = String(body.name || "").trim();
  const zone = String(body.zone || "").trim() || null;
  const availableQuantity = Number(body.availableQuantity);

  if (!eventEditionId || !Object.values(EventPrizeType).includes(type) || name.length < 2 || !Number.isInteger(availableQuantity) || availableQuantity < 0) {
    return jsonError("Datos inválidos para el premio.", 422);
  }

  const event = await prisma.eventEdition.findUnique({ where: { id: eventEditionId }, include: { eventType: true, prizes: true } });
  if (!event) return jsonError("Evento no encontrado.", 404);
  if (event.status === EventEditionStatus.CLOSED) return jsonError("No se pueden agregar premios a un evento cerrado.", 409);
  if (event.usesZones && !zone) return jsonError("Debe indicar la zona para este evento.", 422);
  if (event.eventType.code === EVENT_TYPE_CODES.AFFILIATION_FINAL && event.prizes.length >= 1) {
    return jsonError("El evento final solo puede tener un premio.", 409);
  }

  const prize = await prisma.eventPrize.create({
    data: {
      eventEditionId,
      type,
      name,
      zone: event.usesZones ? zone : null,
      availableQuantity
    }
  });

  return NextResponse.json({ prize }, { status: 201 });
}
