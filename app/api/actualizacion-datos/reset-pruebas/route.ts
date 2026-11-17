import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

function authorized(provided: string, expected: string) {
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

export async function POST(request: NextRequest) {
  const expected = process.env.DATA_UPDATE_RESET_TOKEN?.trim() || "";
  const provided = request.headers.get("x-data-update-reset-token") || "";
  if (!expected || !provided || !authorized(provided, expected)) return jsonError("No disponible.", 404);
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", "data-update-submissions-reset");
    const previous = await tx.memberDataUpdateSubmission.count();
    const deleted = await tx.memberDataUpdateSubmission.deleteMany();
    await tx.auditLog.create({
      data: {
        action: "MEMBER_DATA_UPDATE_SUBMISSIONS_RESET",
        entityType: "MemberDataUpdateSubmission",
        entityId: "all",
        reason: "Solicitudes recibidas restablecidas para pruebas del formulario público.",
        metadata: { previous, deleted: deleted.count }
      }
    });
    return { previous, deleted: deleted.count };
  });
  return NextResponse.json({ ...result, remaining: 0 }, { headers: { "Cache-Control": "no-store" } });
}
