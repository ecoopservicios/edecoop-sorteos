import { EventEditionStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { eventDisplayName } from "@/lib/events";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const event = await prisma.eventEdition.findUnique({ where: { id }, include: { eventType: true } });
  if (!event) return jsonError("Evento no encontrado.", 404);
  if (event.status === EventEditionStatus.CLOSED) return jsonError("Un evento cerrado no se puede editar.", 409);

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").trim();

  if (action === "close") {
    const closed = await prisma.eventEdition.update({
      where: { id },
      data: { status: EventEditionStatus.CLOSED, closedAt: new Date() }
    });
    return NextResponse.json({ event: closed });
  }

  if (action === "toggle") {
    const status = event.status === EventEditionStatus.ACTIVE ? EventEditionStatus.INACTIVE : EventEditionStatus.ACTIVE;
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.eventEdition.update({ where: { id }, data: { status } });
      if (status === EventEditionStatus.INACTIVE) {
        await tx.eventPrize.updateMany({
          where: { eventEditionId: id },
          data: { isActive: false }
        });
      }
      return changed;
    });
    return NextResponse.json({ event: updated });
  }

  const month = Number(body.month || event.month);
  const year = Number(body.year || event.year);
  const usesZones = body.usesZones === undefined ? event.usesZones : Boolean(body.usesZones);
  const promotionStartAt =
    body.promotionStartAt === undefined ? event.promotionStartAt : new Date(String(body.promotionStartAt || ""));
  const promotionEndAt =
    body.promotionEndAt === undefined ? event.promotionEndAt : new Date(String(body.promotionEndAt || ""));

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2026) {
    return jsonError("Debe indicar mes y año validos.", 422);
  }
  if (promotionStartAt && Number.isNaN(promotionStartAt.getTime())) return jsonError("Fecha de inicio invalida.", 422);
  if (promotionEndAt && Number.isNaN(promotionEndAt.getTime())) return jsonError("Fecha fin invalida.", 422);
  if (promotionStartAt && promotionEndAt && promotionEndAt < promotionStartAt) {
    return jsonError("La fecha fin no puede ser menor que la fecha de inicio.", 422);
  }

  const displayName = eventDisplayName(event.eventType.name, month, year);
  const updated = await prisma.eventEdition.update({
    where: { id },
    data: {
      month,
      year,
      usesZones,
      displayName,
      eventDate: new Date(Date.UTC(year, month - 1, 1)),
      promotionStartAt,
      promotionEndAt
    }
  });

  return NextResponse.json({ event: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const event = await prisma.eventEdition.findUnique({
    where: { id },
    include: {
      prizes: true,
      participants: true,
      raffleResults: true,
      enrollmentSubmissions: true
    }
  });
  if (!event) return jsonError("Evento no encontrado.", 404);
  if (event.status === EventEditionStatus.CLOSED) return jsonError("Un evento cerrado no se puede eliminar.", 409);
  if (event.prizes.length || event.participants.length || event.raffleResults.length || event.enrollmentSubmissions.length) {
    return jsonError("Solo se pueden eliminar eventos sin participantes, premios ni resultados.", 409);
  }

  await prisma.eventEdition.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
