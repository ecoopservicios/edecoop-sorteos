import { EventEditionStatus, EventPrizeType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const current = await prisma.eventPrize.findUnique({ where: { id }, include: { eventEdition: true } });
  if (!current) return jsonError("Premio no encontrado.", 404);
  if (current.eventEdition.status === EventEditionStatus.CLOSED) return jsonError("No se puede editar un premio de un evento cerrado.", 409);

  const body = await request.json().catch(() => ({}));
  const data: {
    type?: EventPrizeType;
    name?: string;
    zone?: string | null;
    availableQuantity?: number;
    isActive?: boolean;
  } = {};

  if (body.type !== undefined) {
    const type = String(body.type) as EventPrizeType;
    if (!Object.values(EventPrizeType).includes(type)) return jsonError("Tipo de premio inválido.", 422);
    data.type = type;
  }
  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (name.length < 2) return jsonError("El nombre del premio es requerido.", 422);
    data.name = name;
  }
  if (body.availableQuantity !== undefined) {
    const availableQuantity = Number(body.availableQuantity);
    if (!Number.isInteger(availableQuantity) || availableQuantity < 0) return jsonError("Cantidad disponible invalida.", 422);
    data.availableQuantity = availableQuantity;
  }
  if (body.zone !== undefined) {
    data.zone = current.eventEdition.usesZones ? String(body.zone || "").trim() || null : null;
    if (current.eventEdition.usesZones && !data.zone) return jsonError("Debe indicar la zona para este evento.", 422);
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const prize = await prisma.eventPrize.update({ where: { id }, data });
  return NextResponse.json({ prize });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const prize = await prisma.eventPrize.findUnique({ where: { id }, include: { eventEdition: true } });
  if (!prize) return jsonError("Premio no encontrado.", 404);
  if (prize.eventEdition.status === EventEditionStatus.CLOSED) return jsonError("No se puede eliminar un premio de un evento cerrado.", 409);

  const awarded = await prisma.raffleResult.count({
    where: {
      eventEditionId: prize.eventEditionId,
      prizeId: prize.id
    }
  });
  if (awarded > 0) return jsonError("No se puede eliminar un premio con historico otorgado.", 409);

  await prisma.eventPrize.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
