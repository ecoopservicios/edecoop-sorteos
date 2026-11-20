import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { DATA_UPDATE_RECEIPT, guardDataUpdateRequest, readDataUpdateProof } from "@/lib/data-update-security";
import { isDataUpdateEmailExpired } from "@/lib/data-update-email-status";

export async function POST(request: NextRequest) {
  try {
    const guarded = guardDataUpdateRequest(request);
    if (guarded) return guarded;
    const receipt = readDataUpdateProof(request.cookies.get(DATA_UPDATE_RECEIPT)?.value, "receipt");
    if (!receipt) return jsonError("La sesión de confirmación venció.", 401);

    const submission = await prisma.memberDataUpdateSubmission.findFirst({
      where: { memberDirectoryId: receipt.memberId },
      select: { emailVerificationSentAt: true, emailVerifiedAt: true, emailDeliveryStatus: true },
      orderBy: { createdAt: "desc" }
    });
    if (!submission) return jsonError("No encontramos una actualización asociada a esta sesión.", 404);

    return NextResponse.json({
      verified: Boolean(submission.emailVerifiedAt),
      expired: !submission.emailVerifiedAt && isDataUpdateEmailExpired(submission.emailVerificationSentAt),
      verifiedAt: submission.emailVerifiedAt?.toISOString() || null,
      deliveryStatus: submission.emailDeliveryStatus
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo consultar la validación del correo.", 422);
  }
}
