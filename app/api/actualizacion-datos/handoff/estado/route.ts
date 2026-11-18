import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { dataUpdateHandoffExpired, hashDataUpdateHandoffToken, validDataUpdateHandoffToken } from "@/lib/data-update-handoff";
import { guardDataUpdateRequest } from "@/lib/data-update-security";

export async function POST(request: NextRequest) {
  const guarded = guardDataUpdateRequest(request);
  if (guarded) return guarded;
  const payload = await request.json().catch(() => null);
  if (!validDataUpdateHandoffToken(payload?.pollToken)) return jsonError("Sesión de validación no válida.", 422);
  const session = await prisma.dataUpdateIdentityHandoff.findUnique({ where: { pollTokenHash: hashDataUpdateHandoffToken(payload.pollToken, "poll") } });
  if (!session) return jsonError("Sesión de validación no encontrada.", 404);
  if (session.status === "VERIFIED" && session.verificationProof) {
    return NextResponse.json({ status: "VERIFIED", verificationToken: session.verificationProof }, { headers: { "Cache-Control": "no-store" } });
  }
  if (session.status !== "PENDING" || dataUpdateHandoffExpired(session.expiresAt)) {
    if (session.status === "PENDING") await prisma.dataUpdateIdentityHandoff.update({ where: { id: session.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ status: "EXPIRED" }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ status: "PENDING" }, { headers: { "Cache-Control": "no-store" } });
}
