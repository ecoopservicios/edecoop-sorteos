import { NextRequest, NextResponse } from "next/server";
import { PrizeEnvironment } from "@prisma/client";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { prizeSchema } from "@/lib/validators";

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const prizes = await prisma.prize.findMany({
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ prizes });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const payload = prizeSchema.safeParse(await request.json());
  if (!payload.success) return jsonError("Datos inválidos.", 422);

  const prize = await prisma.$transaction(async (tx) => {
    const created = await tx.prize.create({
      data: {
        name: payload.data.name,
        description: null,
        totalQuantity: payload.data.availableQuantity,
        availableQuantity: payload.data.availableQuantity,
        isActive: payload.data.isActive ?? true,
        environment: PrizeEnvironment.BOTH
      }
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        entityType: "Prize",
        entityId: created.id,
        reason: "Creacion de articulo",
        userId: user!.id,
        metadata: {
          prizeName: created.name,
          totalQuantity: created.totalQuantity,
          availableQuantity: created.availableQuantity,
          isActive: created.isActive
        }
      }
    });

    return created;
  });

  return NextResponse.json({ prize }, { status: 201 });
}
