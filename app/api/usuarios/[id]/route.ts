import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { userStatusSchema } from "@/lib/validators";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const payload = userStatusSchema.safeParse(await request.json());
  if (!payload.success) return jsonError("Datos inválidos.", 422);

  if (id === user!.id && payload.data.isActive === false) {
    return jsonError("No puedes inactivar tu propio usuario.", 409);
  }

  const current = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true }
  });
  if (!current) return jsonError("Usuario no encontrado.", 404);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id },
      data: payload.data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true
      }
    });

    const action =
      payload.data.isActive === true && current.isActive === false
        ? "ACTIVATE"
        : payload.data.isActive === false && current.isActive === true
          ? "DEACTIVATE"
          : "UPDATE";

    await tx.auditLog.create({
      data: {
        action,
        entityType: "User",
        entityId: id,
        reason: action === "UPDATE" ? "Actualizacion de usuario" : "Cambio de estado de usuario",
        userId: user!.id,
        metadata: {
          previous: current,
          updated: {
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            isActive: updatedUser.isActive
          }
        }
      }
    });

    return updatedUser;
  });

  return NextResponse.json({ user: updated });
}
