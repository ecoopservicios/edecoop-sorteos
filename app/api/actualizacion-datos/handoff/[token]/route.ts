import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { dataUpdateHandoffExpired, hashDataUpdateHandoffToken, validDataUpdateHandoffToken } from "@/lib/data-update-handoff";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!validDataUpdateHandoffToken(token)) return jsonError("Enlace de validación no válido.", 404);
  const session = await prisma.dataUpdateIdentityHandoff.findUnique({ where: { scanTokenHash: hashDataUpdateHandoffToken(token, "scan") } });
  if (!session) return jsonError("Enlace de validación no encontrado.", 404);
  if (session.status === "VERIFIED") return NextResponse.json({ status: "VERIFIED" }, { headers: { "Cache-Control": "no-store" } });
  if (session.status !== "PENDING" || dataUpdateHandoffExpired(session.expiresAt)) {
    if (session.status === "PENDING") await prisma.dataUpdateIdentityHandoff.update({ where: { id: session.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ status: "EXPIRED" }, { status: 410, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ status: "PENDING", kind: session.documentKind, expiresAt: session.expiresAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
