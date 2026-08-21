import { EventEditionStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EVENT_TYPE_CODES, eventDisplayName, ensureBaseEventTypes } from "@/lib/events";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const body = await request.json().catch(() => ({}));
  const month = Number(body.month);
  const year = Number(body.year);
  const promotionStartAt = new Date(String(body.promotionStartAt || ""));
  const promotionEndAt = new Date(String(body.promotionEndAt || ""));
  const status = String(body.status || EventEditionStatus.ACTIVE) as EventEditionStatus;

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return jsonError("Debe seleccionar un mes valido.", 422);
  }
  if (!Number.isInteger(year) || year < 2026 || year > 2035) {
    return jsonError("Debe seleccionar un año valido.", 422);
  }
  if (Number.isNaN(promotionStartAt.getTime()) || Number.isNaN(promotionEndAt.getTime())) {
    return jsonError("Debe indicar fecha de inicio y fecha fin de promocion.", 422);
  }
  if (promotionEndAt < promotionStartAt) {
    return jsonError("La fecha fin no puede ser menor que la fecha de inicio.", 422);
  }
  if (!Object.values(EventEditionStatus).includes(status)) {
    return jsonError("Estado de jornada invalido.", 422);
  }

  await ensureBaseEventTypes();

  const eventTypes = await prisma.eventType.findMany({
    where: {
      code: { in: [EVENT_TYPE_CODES.AFFILIATION_INSTANT, EVENT_TYPE_CODES.AFFILIATION_FINAL] },
      isActive: true
    }
  });

  const instantType = eventTypes.find((type) => type.code === EVENT_TYPE_CODES.AFFILIATION_INSTANT);
  const finalType = eventTypes.find((type) => type.code === EVENT_TYPE_CODES.AFFILIATION_FINAL);

  if (!instantType || !finalType) {
    return jsonError("No se encontraron los tipos base de afiliacion.", 422);
  }

  const existing = await prisma.eventEdition.findMany({
    where: {
      month,
      year,
      eventTypeId: { in: [instantType.id, finalType.id] }
    },
    include: { eventType: true }
  });

  if (existing.length === 2) {
    return jsonError(`La jornada de afiliacion para este mes ya existe en ${year}.`, 409);
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const rows = [];

      for (const eventType of [instantType, finalType]) {
        const alreadyExists = existing.some((event) => event.eventTypeId === eventType.id);
        if (alreadyExists) continue;

        rows.push(
          await tx.eventEdition.create({
            data: {
              eventTypeId: eventType.id,
              month,
              year,
              displayName: eventDisplayName(eventType.name, month, year),
              usesZones: false,
              status,
              eventDate: new Date(Date.UTC(year, month - 1, 1)),
              promotionStartAt,
              promotionEndAt,
              createdById: user!.id
            },
            include: { eventType: true }
          })
        );
      }

      return rows;
    });

    return NextResponse.json({ created, year }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(`La jornada de afiliacion para este mes ya existe en ${year}.`, 409);
    }
    throw error;
  }
}
