import { NextResponse } from "next/server";
import { DigitalLinkStatus } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const link = await prisma.digitalLink.findUnique({
    where: { token },
    include: {
      participant: true,
      result: true
    }
  });

  if (!link) return jsonError("El enlace no es valido.", 404);

  if (link.status === DigitalLinkStatus.PENDING && link.expiresAt && link.expiresAt < new Date()) {
    await prisma.digitalLink.update({
      where: { id: link.id },
      data: { status: DigitalLinkStatus.EXPIRED }
    });
    return jsonError("Este enlace ya expiro.", 410);
  }

  return NextResponse.json({
    link: {
      token: link.token,
      status: link.status,
      participantName: link.participant.name,
      result: link.result
        ? {
            code: link.result.code,
            prizeName: link.result.prizeName,
            participantName: link.result.participantName,
            createdAt: link.result.createdAt
          }
        : null
    }
  });
}
