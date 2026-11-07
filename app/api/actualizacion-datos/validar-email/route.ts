import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { hashDataUpdateEmailToken } from "@/lib/data-update-email";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const token = String(payload.token || "");
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return jsonError("El enlace de validación no es válido o ya fue utilizado.", 404);
    const tokenHash = hashDataUpdateEmailToken(token);
    const result = await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `data-update-email:${tokenHash}`);
      const submission = await tx.memberDataUpdateSubmission.findFirst({ where: { emailVerificationTokenHash: tokenHash }, select: { id: true } });
      if (!submission) return null;
      const verifiedAt = new Date();
      await tx.memberDataUpdateSubmission.update({
        where: { id: submission.id },
        data: { emailVerificationTokenHash: null, emailVerifiedAt: verifiedAt, emailDeliveryStatus: "VERIFIED", emailDeliveryError: null }
      });
      await tx.auditLog.create({ data: { action: "MEMBER_DATA_UPDATE_EMAIL_VERIFIED", entityType: "MemberDataUpdateSubmission", entityId: submission.id, reason: "El socio validó su actualización mediante el enlace enviado por correo.", metadata: { channel: "EMAIL" } } });
      return { verifiedAt };
    });
    if (!result) return jsonError("El enlace de validación no es válido o ya fue utilizado.", 404);
    return NextResponse.json({ message: "Tu actualización de datos fue validada correctamente." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo validar la actualización.", 422);
  }
}
