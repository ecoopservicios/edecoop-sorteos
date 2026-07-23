import { NextRequest, NextResponse } from "next/server";
import { RaffleResultStatus, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { prizeStatusSchema } from "@/lib/validators";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const payload = prizeStatusSchema.safeParse(await request.json());
  if (!payload.success) return jsonError("Estado inválido.", 422);

  const result = await prisma.raffleResult.findUnique({
    where: { id },
    select: {
      id: true,
      responsibleUserId: true,
      code: true,
      participantName: true,
      prizeName: true,
      status: true,
    }
  });

  if (!result) return jsonError("Resultado no encontrado.", 404);

  const canUpdate =
    user.role === UserRole.ADMIN ||
    (user.role === UserRole.PROMOTER &&
      result.responsibleUserId === user.id &&
      (payload.data.status === RaffleResultStatus.PENDING || payload.data.status === RaffleResultStatus.DELIVERED));

  if (!canUpdate) return jsonError("No autorizado.", 403);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedResult = await tx.raffleResult.update({
      where: { id },
      data: { status: payload.data.status },
      include: {
        responsibleUser: {
          select: { name: true }
        }
      }
    });

    if (result.status !== payload.data.status) {
      await tx.auditLog.create({
        data: {
          action: "CHANGE_PRIZE_STATUS",
          entityType: "RaffleResult",
          entityId: id,
          reason: "Cambio de estado de premio",
          userId: user.id,
          metadata: {
            code: result.code,
            participantName: result.participantName,
            prizeName: result.prizeName,
            previousStatus: result.status,
            newStatus: payload.data.status
          }
        }
      });
    }

    return updatedResult;
  });

  return NextResponse.json({ result: updated });
}
