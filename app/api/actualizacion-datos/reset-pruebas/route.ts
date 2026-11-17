import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return jsonError("No autorizado.", 403);
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
        userId: user.id,
        metadata: { previous, deleted: deleted.count }
      }
    });
    return { previous, deleted: deleted.count };
  });
  return NextResponse.json({ ...result, remaining: 0 }, { headers: { "Cache-Control": "no-store" } });
}
