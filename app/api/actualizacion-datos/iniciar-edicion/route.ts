import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createDataUpdateProof, DATA_UPDATE_RECEIPT, guardDataUpdateRequest, readDataUpdateProof } from "@/lib/data-update-security";

export async function POST(request: NextRequest) {
  try {
    const guarded = guardDataUpdateRequest(request);
    if (guarded) return guarded;
    const receipt = readDataUpdateProof(request.cookies.get(DATA_UPDATE_RECEIPT)?.value, "receipt");
    if (!receipt) return jsonError("La sesión para editar venció. Valida nuevamente tu número de empleado y cédula.", 401);

    const submission = await prisma.memberDataUpdateSubmission.findFirst({
      where: { memberDirectoryId: receipt.memberId },
      include: { memberDirectory: true, enrollmentCompany: true },
      orderBy: { createdAt: "desc" }
    });
    if (!submission) return jsonError("No encontramos una actualización asociada a esta sesión.", 404);
    if (submission.emailVerifiedAt) return NextResponse.json({ error: "Esta actualización ya fue validada y no puede editarse.", verified: true }, { status: 409 });

    return NextResponse.json({
      verificationToken: createDataUpdateProof(submission.memberDirectoryId, submission.lookupValue, submission.memberDirectory.documentId),
      lookupValue: submission.lookupValue,
      companyId: submission.enrollmentCompanyId,
      member: {
        id: submission.memberDirectory.id,
        companyName: submission.enrollmentCompany.name,
        fullName: `${submission.memberDirectory.firstName} ${submission.memberDirectory.lastName}`.trim(),
        documentId: submission.memberDirectory.documentId,
        employeeNumber: submission.memberDirectory.employeeNumber
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo iniciar la edición.", 422);
  }
}
