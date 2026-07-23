import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { deleteWithReasonSchema, prizeSchema } from "@/lib/validators";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const payload = prizeSchema.partial().safeParse(await request.json());
  if (!payload.success) return jsonError("Datos inválidos.", 422);

  const data = {
    name: payload.data.name,
    totalQuantity: payload.data.availableQuantity,
    availableQuantity: payload.data.availableQuantity,
    isActive: payload.data.isActive
  };

  const current = await prisma.prize.findUnique({ where: { id } });
  if (!current) return jsonError("Premio no encontrado.", 404);

  const prize = await prisma.$transaction(async (tx) => {
    const updated = await tx.prize.update({
      where: { id },
      data
    });

    const action =
      data.isActive === true && current.isActive === false
        ? "ACTIVATE"
        : data.isActive === false && current.isActive === true
          ? "DEACTIVATE"
          : "UPDATE";

    await tx.auditLog.create({
      data: {
        action,
        entityType: "Prize",
        entityId: id,
        reason: action === "UPDATE" ? "Actualizacion de articulo" : "Cambio de estado de articulo",
        userId: user!.id,
        metadata: {
          previous: {
            prizeName: current.name,
            totalQuantity: current.totalQuantity,
            availableQuantity: current.availableQuantity,
            isActive: current.isActive
          },
          updated: {
            prizeName: updated.name,
            totalQuantity: updated.totalQuantity,
            availableQuantity: updated.availableQuantity,
            isActive: updated.isActive
          }
        }
      }
    });

    return updated;
  });

  return NextResponse.json({ prize });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const payload = deleteWithReasonSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return jsonError(payload.error.issues[0]?.message || "Debe indicar el motivo de eliminacion.", 422);
  }

  const prize = await prisma.prize.findUnique({ where: { id } });
  if (!prize) return jsonError("Premio no encontrado.", 404);
  const delivered = await prisma.raffleResult.count({ where: { prizeId: id } });

  await prisma.$transaction(async (tx) => {
    await tx.prizeInventoryHistory.create({
      data: {
        originalPrizeId: prize.id,
        name: prize.name,
        description: prize.description,
        totalQuantity: prize.totalQuantity,
        availableQuantity: prize.availableQuantity,
        wasActive: prize.isActive,
        originalCreatedAt: prize.createdAt,
        originalUpdatedAt: prize.updatedAt,
        deletedReason: payload.data.reason,
        deletedById: user!.id,
        awardedCount: delivered
      }
    });

    await tx.prize.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        action: "DELETE",
        entityType: "Prize",
        entityId: id,
        reason: payload.data.reason,
        userId: user!.id,
        metadata: {
          prizeName: prize.name,
          totalQuantity: prize.totalQuantity,
          availableQuantity: prize.availableQuantity,
          awardedCount: delivered
        }
      }
    });
  });

  return NextResponse.json({ ok: true });
}
