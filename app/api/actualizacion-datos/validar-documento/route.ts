import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createDataUpdateProof, dataUpdateRateLimit, guardDataUpdateRequest, readDataUpdateProof } from "@/lib/data-update-security";
import { checkIdentityDocument } from "@/lib/identity-document-validation";
import { dataUpdateHandoffExpired, hashDataUpdateHandoffToken, validDataUpdateHandoffToken } from "@/lib/data-update-handoff";

export async function POST(request: NextRequest) {
  try {
    const guarded = guardDataUpdateRequest(request);
    if (guarded) return guarded;
    const limited = await dataUpdateRateLimit(request, "document");
    if (limited) return limited;
    const payload = await request.json();
    const kind = payload.kind === "EMPLOYEE_CARD" ? "EMPLOYEE_CARD" : payload.kind === "DOCUMENT_ID" ? "DOCUMENT_ID" : null;
    if (!kind || !Array.isArray(payload.lines) || payload.lines.length > 60) return jsonError("Lectura de documento no válida.", 422);
    const handoffToken = validDataUpdateHandoffToken(payload.handoffToken) ? payload.handoffToken : null;
    const handoff = handoffToken ? await prisma.dataUpdateIdentityHandoff.findUnique({ where: { scanTokenHash: hashDataUpdateHandoffToken(handoffToken, "scan") } }) : null;
    const proof = handoff ? null : readDataUpdateProof(payload.verificationToken);
    if (handoff && (handoff.status !== "PENDING" || dataUpdateHandoffExpired(handoff.expiresAt))) return jsonError("Este código QR venció o ya fue utilizado. Genera uno nuevo en la computadora.", 410);
    if (handoff && handoff.documentKind !== kind) return jsonError("El documento seleccionado no corresponde al código QR.", 422);
    if (!handoff && !proof) return jsonError("La validación de identidad venció. Vuelve a consultar tus datos.", 403);
    const lines = payload.lines.map((line: unknown) => {
      if (!line || typeof line !== "object") return "";
      const item = line as { text?: unknown; score?: unknown };
      return typeof item.text === "string" && item.text.length <= 160 && typeof item.score === "number" && item.score >= 0.3 ? item.text : "";
    }).filter(Boolean);
    if (!lines.length) return jsonError("No pudimos leer el documento. Toma otra foto con mejor iluminación.", 422);

    const member = await prisma.memberDirectory.findFirst({ where: { id: handoff?.memberDirectoryId || proof!.memberId, isActive: true }, include: { enrollmentCompany: true } });
    if (!member || !member.enrollmentCompany.dataUpdateEnabled) return jsonError("Registro no disponible.", 404);
    const fullName = `${member.firstName} ${member.lastName}`.trim();
    const failure = checkIdentityDocument({ ...member, companyName: member.enrollmentCompany.name }, kind, lines);
    if (failure) {
      const label = kind === "EMPLOYEE_CARD" ? "el carnet" : "la cédula";
      const messages = {
        TYPE: "El tipo de documento no corresponde a esta consulta.",
        FORMAT: `No pudimos reconocer ${label}. Incluye el documento completo y evita reflejos sobre el encabezado o logotipo.`,
        NUMBER: `No pudimos confirmar el número de ${label === "el carnet" ? "empleado" : "cédula"}. Acerca el documento y comprueba que todos los números estén enfocados.`,
        NAME: "El nombre leído no coincide suficientemente con el registro del socio. Evita reflejos sobre los nombres y apellidos."
      };
      return NextResponse.json({ error: messages[failure], code: `DOCUMENT_${failure}` }, { status: 422, headers: { "Cache-Control": "no-store" } });
    }

    const verificationToken = createDataUpdateProof(member.id, handoff?.lookupValue || proof!.lookup, member.documentId, "identity", true);
    if (handoff) {
      const completed = await prisma.dataUpdateIdentityHandoff.updateMany({
        where: { id: handoff.id, status: "PENDING", expiresAt: { gt: new Date() } },
        data: { status: "VERIFIED", verificationProof: verificationToken, verifiedAt: new Date() }
      });
      if (completed.count !== 1) return jsonError("Este código QR venció o ya fue utilizado. Genera uno nuevo en la computadora.", 410);
      return NextResponse.json({ verified: true, handoffComplete: true, message: "Documento validado. Puedes volver a la computadora para continuar." }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ verified: true, message: `Confirmamos el documento de ${fullName}.`, verificationToken }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo validar el documento.", 422);
  }
}
