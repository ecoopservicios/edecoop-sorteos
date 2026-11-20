import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { guardDataUpdateRequest, readDataUpdateProof } from "@/lib/data-update-security";

function splitEmergencyName(name: string, custom: Record<string, unknown>) {
  const firstName = String(custom.emergencyContactFirstName || "").trim();
  const lastName = String(custom.emergencyContactLastName || "").trim();
  if (firstName && lastName) return { firstName, lastName };
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts.slice(0, -1).join(" ") || parts[0] || "", lastName: parts.length > 1 ? parts.at(-1)! : "" };
}

export async function POST(request: NextRequest) {
  try {
    const guarded = guardDataUpdateRequest(request);
    if (guarded) return guarded;
    const payload = await request.json();
    const proof = readDataUpdateProof(payload.verificationToken);
    if (!proof?.documentVerified) return jsonError("Debes validar nuevamente tu documento antes de editar.", 403);

    const submission = await prisma.memberDataUpdateSubmission.findFirst({
      where: { memberDirectoryId: proof.memberId },
      include: { memberDirectory: { select: { documentId: true } } },
      orderBy: { createdAt: "desc" }
    });
    if (!submission || submission.lookupValue !== proof.lookup || submission.memberDirectory.documentId !== proof.documentId) {
      return jsonError("La validación no corresponde a esta solicitud.", 403);
    }
    if (submission.emailVerifiedAt) return NextResponse.json({ error: "Esta actualización ya fue validada y no puede editarse.", verified: true }, { status: 409 });

    const custom = submission.customResponses && typeof submission.customResponses === "object" && !Array.isArray(submission.customResponses)
      ? submission.customResponses as Record<string, unknown>
      : {};
    const emergency = splitEmergencyName(submission.emergencyContactName, custom);
    const savedWhatsappMode = String(custom.whatsappPreference || "");
    const whatsappMode = ["SAME", "OTHER", "NONE"].includes(savedWhatsappMode)
      ? savedWhatsappMode
      : !submission.whatsappPhone ? "NONE" : submission.whatsappPhone === submission.personalPhone ? "SAME" : "OTHER";

    return NextResponse.json({
      whatsappMode,
      values: {
        ...Object.fromEntries(Object.entries(custom).filter(([key, value]) => !["whatsappPreference", "emergencyContactFirstName", "emergencyContactLastName"].includes(key) && typeof value === "string")),
        personalPhone: submission.personalPhone,
        whatsappPhone: whatsappMode === "OTHER" ? submission.whatsappPhone : "",
        personalEmail: submission.personalEmail,
        emergencyContactFirstName: emergency.firstName,
        emergencyContactLastName: emergency.lastName,
        emergencyContactPhone: submission.emergencyContactPhone,
        emergencyContactRelation: submission.emergencyContactRelation,
        emergencyContactRelationOther: String(custom.emergencyContactRelationOther || "")
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo recuperar la solicitud pendiente.", 422);
  }
}
