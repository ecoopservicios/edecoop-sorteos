import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { canAccessAdmin, getCurrentUser, hashPassword } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { userSchema } from "@/lib/validators";

const DEFAULT_TEMPORARY_PASSWORD = "123456789";

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true
    }
  });

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const payload = userSchema.safeParse(await request.json());
  if (!payload.success) return jsonError("Datos inválidos.", 422);

  const created = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name: payload.data.name,
        email: payload.data.email,
        passwordHash: await hashPassword(DEFAULT_TEMPORARY_PASSWORD),
        role: payload.data.role || UserRole.PROMOTER,
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
        action: "CREATE",
        entityType: "User",
        entityId: newUser.id,
        reason: "Creacion de usuario",
        userId: user!.id,
        metadata: {
          name: newUser.name,
          email: newUser.email,
          role: newUser.role
        }
      }
    });

    return newUser;
  });

  return NextResponse.json({ user: created }, { status: 201 });
}
