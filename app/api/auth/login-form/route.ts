import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validators";
import { setSessionCookie, verifyPassword } from "@/lib/auth";

function redirectTo(request: NextRequest, path: string) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost || request.headers.get("host");
  const proto = forwardedProto || (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : request.nextUrl.origin;
  return NextResponse.redirect(new URL(path, origin), { status: 303 });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const payload = loginSchema.safeParse({
    email: form.get("username"),
    password: form.get("password")
  });

  if (!payload.success) return redirectTo(request, "/login?error=1");

  const user = await prisma.user.findUnique({
    where: { email: payload.data.email }
  });

  if (!user || !user.isActive) return redirectTo(request, "/login?error=1");

  const isValid = await verifyPassword(payload.data.password, user.passwordHash);
  if (!isValid) return redirectTo(request, "/login?error=1");

  const destination = user.mustChangePassword
    ? "/cambiar-clave"
    : user.role === "ADMIN"
      ? "/dashboard"
      : "/ruleta/presencial";
  const response = redirectTo(request, destination);
  await setSessionCookie(response, user.id);
  return response;
}
