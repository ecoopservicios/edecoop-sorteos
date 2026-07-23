import { NextRequest, NextResponse } from "next/server";
import { EventEditionStatus } from "@prisma/client";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { EVENT_TYPE_CODES } from "@/lib/events";

async function buildPreview(eventId: string) {
  const event = await prisma.eventEdition.findUnique({
    where: { id: eventId },
    include: { eventType: true }
  });
  if (!event) return null;

  const results = await prisma.raffleResult.findMany({
    where: { eventEditionId: event.id },
    select: { prizeId: true }
  });
  const resultsByPrize = new Map<string, number>();
  for (const result of results) {
    resultsByPrize.set(result.prizeId, (resultsByPrize.get(result.prizeId) || 0) + 1);
  }

  const prizes = await prisma.eventPrize.findMany({
    where: { eventEditionId: event.id },
    select: { id: true, name: true }
  });

  let submissions = 0;
  let digitalLinks = 0;
  let digitalParticipants = 0;
  let participants = 0;

  if (event.eventType.code === EVENT_TYPE_CODES.AFFILIATION_INSTANT) {
    const rows = await prisma.enrollmentSubmission.findMany({
      where: { eventEditionId: event.id },
      select: { digitalLinkId: true, digitalParticipantId: true }
    });
    submissions = rows.length;
    digitalLinks = new Set(rows.map((row) => row.digitalLinkId).filter(Boolean)).size;
    digitalParticipants = new Set(rows.map((row) => row.digitalParticipantId).filter(Boolean)).size;
  } else if (event.eventType.code !== EVENT_TYPE_CODES.AFFILIATION_FINAL) {
    participants = await prisma.eventParticipant.count({ where: { eventEditionId: event.id } });
  }

  return {
    event: {
      id: event.id,
      name: event.displayName,
      typeCode: event.eventType.code,
      typeName: event.eventType.name,
      status: event.status
    },
    results: results.length,
    submissions,
    digitalLinks,
    digitalParticipants,
    participants,
    prizes: prizes.map((prize) => ({
      id: prize.id,
      name: prize.name,
      restoreQuantity: resultsByPrize.get(prize.id) || 0
    }))
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const preview = await buildPreview(id);
  if (!preview) return jsonError("Evento no encontrado.", 404);
  return NextResponse.json(preview);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim();
  const confirmation = String(body.confirmation || "").trim();
  const preview = await buildPreview(id);
  if (!preview) return jsonError("Evento no encontrado.", 404);
  if (preview.event.status === EventEditionStatus.CLOSED) return jsonError("No se puede resetear un evento cerrado.", 409);
  if (reason.length < 5) return jsonError("Debe indicar un motivo de al menos 5 caracteres.", 422);
  if (confirmation !== `RESET ${preview.event.name}`) return jsonError(`Debe escribir exactamente: RESET ${preview.event.name}`, 422);

  await prisma.$transaction(async (tx) => {
    const results = await tx.raffleResult.findMany({
      where: { eventEditionId: id },
      select: { id: true, prizeId: true }
    });
    const restoreByPrize = new Map<string, number>();
    for (const result of results) {
      restoreByPrize.set(result.prizeId, (restoreByPrize.get(result.prizeId) || 0) + 1);
    }

    await tx.raffleResult.deleteMany({ where: { eventEditionId: id } });
    for (const [prizeId, quantity] of restoreByPrize.entries()) {
      await tx.eventPrize.updateMany({
        where: { id: prizeId, eventEditionId: id },
        data: {
          availableQuantity: { increment: quantity },
          awardedQuantity: { decrement: quantity }
        }
      });
    }

    if (preview.event.typeCode === EVENT_TYPE_CODES.AFFILIATION_INSTANT) {
      const submissions = await tx.enrollmentSubmission.findMany({
        where: { eventEditionId: id },
        select: { id: true, digitalLinkId: true, digitalParticipantId: true }
      });
      const linkIds = submissions.map((row) => row.digitalLinkId).filter((value): value is string => Boolean(value));
      const participantIds = submissions.map((row) => row.digitalParticipantId).filter((value): value is string => Boolean(value));
      await tx.enrollmentSubmission.deleteMany({ where: { eventEditionId: id } });
      if (linkIds.length) await tx.digitalLink.deleteMany({ where: { id: { in: linkIds } } });
      for (const participantId of new Set(participantIds)) {
        const links = await tx.digitalLink.count({ where: { participantId } });
        const submissionsLeft = await tx.enrollmentSubmission.count({ where: { digitalParticipantId: participantId } });
        if (links === 0 && submissionsLeft === 0) {
          await tx.digitalParticipant.delete({ where: { id: participantId } }).catch(() => null);
        }
      }
    } else if (preview.event.typeCode !== EVENT_TYPE_CODES.AFFILIATION_FINAL) {
      await tx.eventParticipant.deleteMany({ where: { eventEditionId: id } });
    }

    await tx.auditLog.create({
      data: {
        action: "RESET",
        entityType: "EventEdition",
        entityId: id,
        reason,
        userId: user!.id,
        metadata: preview
      }
    });
  });

  return NextResponse.json({ ok: true });
}
