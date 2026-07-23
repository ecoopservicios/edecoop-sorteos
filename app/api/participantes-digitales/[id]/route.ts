import { NextRequest, NextResponse } from "next/server";
import { DigitalLinkStatus, Prisma } from "@prisma/client";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { deleteWithReasonSchema, digitalParticipantUpdateSchema } from "@/lib/validators";
import { normalizePhone } from "@/lib/whatsapp";
import { buildFullName, validatePersonName } from "@/lib/participants";
import { checkPersonDuplicate } from "@/lib/duplicate-protection";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const payload = digitalParticipantUpdateSchema.safeParse(await request.json());
  if (!payload.success) return jsonError("Datos inválidos.", 422);

  const current = await prisma.digitalParticipant.findUnique({ where: { id } });
  if (!current) return jsonError("Participante no encontrado.", 404);

  let firstName = current.firstName;
  let lastName = current.lastName;
  try {
    if (payload.data.firstName !== undefined) firstName = validatePersonName(payload.data.firstName, "Nombres");
    if (payload.data.lastName !== undefined) lastName = validatePersonName(payload.data.lastName, "Apellidos");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Nombre inválido.", 422);
  }

  const name = buildFullName(firstName, lastName);
  const phone = payload.data.phone ? normalizePhone(payload.data.phone) : current.phone;
  const nie = payload.data.nie?.trim() || current.nie;
  const email = payload.data.email?.trim().toLowerCase() || current.email;
  const duplicate = await checkPersonDuplicate({ firstName, lastName, employeeNumber: nie, phone, email, excludeDigitalParticipantId: id });
  if (duplicate) return NextResponse.json({ error: duplicate.message, field: duplicate.field }, { status: 409 });

  try {
    const participant = await prisma.$transaction(async (tx) => {
      const updated = await tx.digitalParticipant.update({
        where: { id },
        data: {
          firstName,
          lastName,
          name,
          nie,
          email,
          phone
        }
      });

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entityType: "DigitalParticipant",
          entityId: id,
          reason: "Actualizacion de participante virtual",
          userId: user!.id,
          metadata: {
            previous: {
              participantName: current.name,
              participantNie: current.nie,
              participantPhone: current.phone,
              email: current.email
            },
            updated: {
              participantName: updated.name,
              participantNie: updated.nie,
              participantPhone: updated.phone,
              email: updated.email
            }
          }
        }
      });

      return updated;
    });

    return NextResponse.json({ participant });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("Ya existe un participante digital con ese NIE, teléfono o nombre.", 409);
    }
    throw error;
  }
}

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

  const participant = await prisma.digitalParticipant.findUnique({
    where: { id },
    include: {
      results: true,
      links: {
        include: {
          result: true
        }
      }
    }
  });

  if (!participant) return jsonError("Participante no encontrado.", 404);
  if (participant.deletedAt) {
    return jsonError("Este participante ya fue eliminado.", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.digitalParticipant.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: user!.id,
        deleteReason: payload.data.reason
      }
    });

    await tx.digitalLink.updateMany({
      where: {
        participantId: id,
        status: DigitalLinkStatus.PENDING
      },
      data: {
        status: DigitalLinkStatus.CANCELLED
      }
    });

    await tx.auditLog.create({
      data: {
        action: "DELETE",
        entityType: "DigitalParticipant",
        entityId: id,
        reason: payload.data.reason,
        userId: user!.id,
        metadata: {
          participantName: participant.name,
          participantNie: participant.nie,
          participantPhone: participant.phone,
          hadPrize: participant.results.length > 0 || participant.links.some((link) => link.result)
        }
      }
    });
  });

  return NextResponse.json({ ok: true });
}
