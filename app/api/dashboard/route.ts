import { NextResponse } from "next/server";
import { RaffleEnvironment } from "@prisma/client";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const [prizes, delivered, presential, digital, byPromoter, remaining] = await Promise.all([
    prisma.prize.count(),
    prisma.raffleResult.count(),
    prisma.raffleResult.count({ where: { environment: RaffleEnvironment.PRESENTIAL } }),
    prisma.raffleResult.count({ where: { environment: RaffleEnvironment.DIGITAL } }),
    prisma.raffleResult.groupBy({
      by: ["responsibleUserId"],
      where: { environment: RaffleEnvironment.PRESENTIAL },
      _count: { id: true }
    }),
    prisma.prize.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        totalQuantity: true,
        availableQuantity: true,
        isActive: true
      }
    })
  ]);

  const userIds = byPromoter
    .map((item) => item.responsibleUserId)
    .filter((id): id is string => Boolean(id));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true }
  });

  return NextResponse.json({
    prizes,
    delivered,
    presential,
    digital,
    totalAvailable: remaining.reduce((sum, prize) => sum + prize.availableQuantity, 0),
    remaining,
    byPromoter: byPromoter.map((item) => ({
      userId: item.responsibleUserId,
      name: users.find((promoter) => promoter.id === item.responsibleUserId)?.name || "Sin responsable",
      count: item._count.id
    }))
  });
}
