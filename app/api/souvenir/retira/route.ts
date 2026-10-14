import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { findSouvenirCollector } from "@/lib/souvenir-collector";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return jsonError("Inicie sesión nuevamente.", 401);
  try {
    const memberId = request.nextUrl.searchParams.get("memberId") || "";
    if (!memberId || !await prisma.souvenirMember.findFirst({ where: { id: memberId, clearedAt: null }, select: { id: true } })) return jsonError("El socio beneficiario no está disponible.", 422);
    const collector = await findSouvenirCollector(prisma, request.nextUrl.searchParams.get("employeeNumber") || "", memberId);
    return NextResponse.json({ collector });
  } catch (error) { return jsonError(error instanceof Error ? error.message : "No se pudo validar a quien retira.", 422); }
}
