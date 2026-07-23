import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { deleteWithReasonSchema } from "@/lib/validators";

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

  const current = await prisma.enrollmentSubmission.findUnique({ where: { id } });
  if (!current) return jsonError("Solicitud no encontrada.", 404);
  if (current.deletedAt) return jsonError("La solicitud ya fue eliminada.", 409);

  await prisma.$transaction(async (tx) => {
    await tx.enrollmentSubmission.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: user!.id,
        deleteReason: payload.data.reason
      }
    });

    await tx.auditLog.create({
      data: {
        action: "DELETE",
        entityType: "EnrollmentSubmission",
        entityId: id,
        reason: payload.data.reason,
        userId: user!.id,
        metadata: {
          participantName: `${current.firstName} ${current.lastName}`,
          documentId: current.documentId,
          mobilePhone: current.mobilePhone,
          companyName: current.companyName
        }
      }
    });
  });

  return NextResponse.json({ ok: true });
}
