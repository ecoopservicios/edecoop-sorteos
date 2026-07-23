import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { changePasswordSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("No autorizado.", 403);

  const payload = changePasswordSchema.safeParse(await request.json());
  if (!payload.success) {
    return jsonError(payload.error.issues[0]?.message || "Datos inválidos.", 422);
  }

  if (!user.mustChangePassword) {
    if (!payload.data.currentPassword) return jsonError("Debe indicar la contraseña actual.", 422);
    const isCurrentValid = await verifyPassword(String(payload.data.currentPassword), user.passwordHash);
    if (!isCurrentValid) return jsonError("La contraseña actual no es correcta.", 401);
  }

  if (payload.data.newPassword === "123456789") {
    return jsonError("La nueva contraseña no puede ser la clave temporal.", 422);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(payload.data.newPassword),
      mustChangePassword: false
    }
  });

  return NextResponse.json({ ok: true });
}
