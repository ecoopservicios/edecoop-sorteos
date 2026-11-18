import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createDataUpdateHandoffTokens, DATA_UPDATE_HANDOFF_TTL_MS, hashDataUpdateHandoffToken, type DataUpdateDocumentKind } from "@/lib/data-update-handoff";
import { dataUpdateRateLimit, guardDataUpdateRequest, readDataUpdateProof } from "@/lib/data-update-security";

export async function POST(request: NextRequest) {
  try {
    const guarded = guardDataUpdateRequest(request);
    if (guarded) return guarded;
    const limited = await dataUpdateRateLimit(request, "handoff");
    if (limited) return limited;
    const payload = await request.json();
    const proof = readDataUpdateProof(payload.verificationToken);
    if (!proof || proof.documentVerified) return jsonError("La consulta venció. Vuelve a buscar tus datos.", 403);
    const kind: DataUpdateDocumentKind | null = payload.kind === "DOCUMENT_ID" ? "DOCUMENT_ID" : payload.kind === "EMPLOYEE_CARD" ? "EMPLOYEE_CARD" : null;
    if (!kind) return jsonError("Selecciona el documento que validarás.", 422);
    const member = await prisma.memberDirectory.findFirst({ where: { id: proof.memberId, isActive: true }, include: { enrollmentCompany: true } });
    if (!member || !member.enrollmentCompany.dataUpdateEnabled || member.documentId !== proof.documentId) return jsonError("Registro no disponible.", 404);
    const companyKey = member.enrollmentCompany.name.trim().toUpperCase();
    if (kind === "EMPLOYEE_CARD" && (!member.employeeNumber || !["EDESUR", "EDECOOP"].includes(companyKey))) return jsonError("El carnet de empleado no está disponible para esta empresa.", 422);

    const tokens = createDataUpdateHandoffTokens();
    const expiresAt = new Date(Date.now() + DATA_UPDATE_HANDOFF_TTL_MS);
    await prisma.$transaction(async tx => {
      await tx.dataUpdateIdentityHandoff.updateMany({ where: { memberDirectoryId: member.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.dataUpdateIdentityHandoff.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 3600000) } } });
      await tx.dataUpdateIdentityHandoff.create({ data: {
        memberDirectoryId: member.id,
        lookupValue: proof.lookup,
        documentKind: kind,
        scanTokenHash: hashDataUpdateHandoffToken(tokens.scanToken, "scan"),
        pollTokenHash: hashDataUpdateHandoffToken(tokens.pollToken, "poll"),
        expiresAt
      } });
    });
    const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
    const phoneUrl = `${baseUrl.replace(/\/$/, "")}/actualizar-datos/validar/${tokens.scanToken}`;
    const qrDataUrl = await QRCode.toDataURL(phoneUrl, { width: 420, margin: 2, errorCorrectionLevel: "M" });
    return NextResponse.json({ pollToken: tokens.pollToken, qrDataUrl, expiresAt: expiresAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo preparar el código QR.", 422);
  }
}
