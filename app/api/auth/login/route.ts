import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { loginSchema } from "@/lib/validators";
import { setSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const payload = loginSchema.safeParse(await request.json());
  if (!payload.success) return jsonError("Credenciales invalidas.", 422);

  const user = await prisma.user.findUnique({
    where: { email: payload.data.email }
  });

  if (!user || !user.isActive) return jsonError("Credenciales invalidas.", 401);

  const isValid = await verifyPassword(payload.data.password, user.passwordHash);
  if (!isValid) return jsonError("Credenciales invalidas.", 401);

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword
    }
  });

  await setSessionCookie(response, user.id);
  return response;
}
