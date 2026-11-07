import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { createDataUpdateEmailToken, sendDataUpdateVerificationEmail } from "@/lib/data-update-email";
import { DATA_UPDATE_RECEIPT, dataUpdateRateLimit, readDataUpdateProof } from "@/lib/data-update-security";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const receipt = readDataUpdateProof(request.cookies.get(DATA_UPDATE_RECEIPT)?.value, "receipt");
    if (!receipt) return jsonError("La sesión para reenviar el correo venció. Comunícate con Servicio al cliente EDECOOP.", 401);
    const limited = await dataUpdateRateLimit(request, "resend");
    if (limited) return limited;
    if (!process.env.BREVO_API_KEY?.trim() || !process.env.EMAIL_FROM_ADDRESS?.trim()) return jsonError("El servicio de correo todavía no está disponible.", 503);

    const submission = await prisma.memberDataUpdateSubmission.findFirst({
      where: { memberDirectoryId: receipt.memberId },
      include: { memberDirectory: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" }
    });
    if (!submission) return jsonError("No encontramos una actualización asociada a esta sesión.", 404);
    if (submission.emailVerifiedAt) return jsonError("Este registro ya fue validado.", 409);

    const verification = createDataUpdateEmailToken();
    const emailResult = await sendDataUpdateVerificationEmail({
      email: submission.personalEmail,
      name: `${submission.memberDirectory.firstName} ${submission.memberDirectory.lastName}`.trim(),
      token: verification.token
    });
    const emailError = emailResult.error || "No se pudo reenviar el correo.";
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `data-update-email-resend:${submission.id}`);
      await tx.memberDataUpdateSubmission.update({
        where: { id: submission.id },
        data: emailResult.sent
          ? { emailVerificationTokenHash: verification.hash, emailVerificationSentAt: new Date(), emailDeliveryStatus: "SENT", emailDeliveryError: null }
          : { emailDeliveryStatus: "FAILED", emailDeliveryError: emailError }
      });
      await tx.auditLog.create({
        data: {
          action: emailResult.sent ? "MEMBER_DATA_UPDATE_EMAIL_RESENT" : "MEMBER_DATA_UPDATE_EMAIL_RESEND_FAILED",
          entityType: "MemberDataUpdateSubmission",
          entityId: submission.id,
          reason: emailResult.sent ? "El socio solicitó reenviar su correo de validación." : "Falló el reenvío solicitado por el socio.",
          metadata: emailResult.sent ? { channel: "EMAIL" } : { channel: "EMAIL", error: emailError }
        }
      });
    });
    if (!emailResult.sent) return jsonError("No pudimos reenviar el correo en este momento. Inténtalo nuevamente más tarde.", 502);
    return NextResponse.json({ message: "Correo reenviado. Revisa tu bandeja de entrada, Spam, Correo no deseado y Promociones." });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo reenviar el correo.", 422);
  }
}
