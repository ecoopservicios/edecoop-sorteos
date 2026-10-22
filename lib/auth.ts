import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

import { SESSION_COOKIE, parseSessionValue } from "@/lib/session";
export { setSessionCookie, clearSessionCookie } from "@/lib/session";

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = await parseSessionValue(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  return prisma.user.findFirst({
    where: { id: session.userId, isActive: true }
  });
}

export async function getUserFromRequest(request: NextRequest) {
  const session = await parseSessionValue(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  return prisma.user.findFirst({
    where: { id: session.userId, isActive: true }
  });
}

export function canAccessAdmin(user: Pick<User, "role"> | null) {
  return user?.role === UserRole.ADMIN;
}

export function canSpinPresential(user: Pick<User, "role"> | null) {
  return user?.role === UserRole.ADMIN || user?.role === UserRole.PROMOTER;
}
