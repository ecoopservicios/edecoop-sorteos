import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "edecoop_session";
const SESSION_MAX_AGE = 60 * 60 * 12;

type SessionPayload = {
  userId: string;
  expiresAt: number;
};

function getSecret() {
  return process.env.AUTH_SECRET || "edecoop-dev-secret-change-me";
}

async function sign(value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Buffer.from(signature).toString("base64url");
}

async function createSessionValue(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = await sign(body);
  return `${body}.${signature}`;
}

async function parseSessionValue(value?: string) {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = await sign(body);
  if (signature !== expected) return null;

  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
  if (payload.expiresAt < Date.now()) return null;
  return payload;
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function setSessionCookie(response: NextResponse, userId: string) {
  const value = await createSessionValue({
    userId,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000
  });

  response.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/"
  });
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
