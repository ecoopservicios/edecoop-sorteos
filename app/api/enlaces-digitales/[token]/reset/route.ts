import { NextRequest, NextResponse } from "next/server";
import { DigitalLinkStatus } from "@prisma/client";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/codes";
import { buildWhatsappUrl } from "@/lib/whatsapp";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { token: currentToken } = await params;
  const currentLink = await prisma.digitalLink.findUnique({
    where: { token: currentToken },
    include: {
      participant: true,
      result: true
    }
  });

  if (!currentLink) return jsonError("Enlace no encontrado.", 404);
  if (currentLink.result) {
    return jsonError("No se puede resetear un enlace que ya otorgo premio.", 409);
  }

  const token = generateToken();
  const newLink = await prisma.$transaction(async (tx) => {
    await tx.digitalLink.update({
      where: { id: currentLink.id },
      data: {
        status: DigitalLinkStatus.CANCELLED
      }
    });

    const created = await tx.digitalLink.create({
      data: {
        token,
        participantId: currentLink.participantId,
        createdById: user!.id
      },
      include: {
        participant: true
      }
    });

    await tx.auditLog.create({
      data: {
        action: "RESET_LINK",
        entityType: "DigitalLink",
        entityId: created.id,
        reason: "Reset de enlace virtual",
        userId: user!.id,
        metadata: {
          previousLinkId: currentLink.id,
          participantName: currentLink.participant.name,
          participantNie: currentLink.participant.nie,
          participantPhone: currentLink.participant.phone
        }
      }
    });

    return created;
  });

  const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
  const link = `${baseUrl}/ruleta/digital/${newLink.token}`;
  const whatsappUrl = buildWhatsappUrl(newLink.participant.phone, link);

  return NextResponse.json({ link: newLink, url: link, whatsappUrl });
}
