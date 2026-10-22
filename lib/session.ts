import { NextResponse } from "next/server";

export const SESSION_COOKIE = "edecoop_session";
export const DOCUMENT_ENTRY_COOKIE = "edecoop_document_entry";
export const SESSION_MAX_AGE = 60 * 60 * 12;

export type SessionPayload = { userId: string; expiresAt: number };

async function sign(value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(process.env.AUTH_SECRET || "edecoop-dev-secret-change-me"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Buffer.from(await crypto.subtle.sign("HMAC", key, encoder.encode(value))).toString("base64url");
}

export async function createSessionValue(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${await sign(body)}`;
}

export async function parseSessionValue(value?: string): Promise<SessionPayload | null> {
  try {
    if (!value) return null;
    const parts = value.split(".");
    if (parts.length !== 2 || parts[1] !== await sign(parts[0])) return null;
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    if (typeof payload.userId !== "string" || !payload.userId || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
    return { userId: payload.userId, expiresAt: payload.expiresAt };
  } catch { return null; }
}

export const documentEntryValue = (session: string) => sign(`document-entry:${session}`);
const cookieOptions = () => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" });

export async function setSessionCookie(response: NextResponse, userId: string) {
  const value = await createSessionValue({ userId, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 });
  response.cookies.set(SESSION_COOKIE, value, cookieOptions());
  // Only the document immediately following a successful login may use this entry cookie.
  response.cookies.set(DOCUMENT_ENTRY_COOKIE, await documentEntryValue(value), { ...cookieOptions(), maxAge: 60 });
}

export function clearDocumentEntry(response: NextResponse) {
  response.cookies.set(DOCUMENT_ENTRY_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  clearDocumentEntry(response);
}
