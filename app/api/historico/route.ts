import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const searchParams = request.nextUrl.searchParams;
  const environment = searchParams.get("environment") || undefined;
  const query = searchParams.get("q") || undefined;

  const results = await prisma.raffleResult.findMany({
    where: {
      environment: environment === "PRESENTIAL" || environment === "DIGITAL" ? environment : undefined,
      OR: query
        ? [
            { code: { contains: query, mode: "insensitive" } },
            { participantName: { contains: query, mode: "insensitive" } },
            { participantPhone: { contains: query, mode: "insensitive" } },
            { prizeName: { contains: query, mode: "insensitive" } }
          ]
        : undefined
    },
    include: {
      responsibleUser: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return NextResponse.json({ results });
}
