import { createHmac, randomBytes } from "node:crypto";

export const DATA_UPDATE_HANDOFF_TTL_MS = 10 * 60 * 1000;
export type DataUpdateDocumentKind = "DOCUMENT_ID" | "EMPLOYEE_CARD";

function handoffSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("Configuración de seguridad no disponible.");
  return secret || "edecoop-dev-secret-change-me";
}

export function createDataUpdateHandoffTokens() {
  return { scanToken: randomBytes(32).toString("base64url"), pollToken: randomBytes(32).toString("base64url") };
}

export function validDataUpdateHandoffToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function hashDataUpdateHandoffToken(token: string, purpose: "scan" | "poll") {
  return createHmac("sha256", handoffSecret()).update(`data-update-handoff:${purpose}:${token}`).digest("hex");
}

export function dataUpdateHandoffExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}
