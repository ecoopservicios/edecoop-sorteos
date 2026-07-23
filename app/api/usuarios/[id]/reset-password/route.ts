import { NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser, hashPassword } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

const DEFAULT_TEMPORARY_PASSWORD = "123456789";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const updated = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(DEFAULT_TEMPORARY_PASSWORD),
        mustChangePassword: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true
      }
    });

    await tx.auditLog.create({
      data: {
        action: "RESET_PASSWORD",
        entityType: "User",
        entityId: id,
        reason: "Reset de clave temporal",
        userId: user!.id,
        metadata: {
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role
        }
      }
    });

    return updatedUser;
  });

  return NextResponse.json({ user: updated, temporaryPassword: DEFAULT_TEMPORARY_PASSWORD });
}
