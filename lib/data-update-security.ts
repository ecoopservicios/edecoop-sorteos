import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const DATA_UPDATE_RECEIPT = "edecoop_data_update_receipt";
type Proof = { purpose: "identity" | "receipt"; memberId: string; lookup: string; documentId: string | null; expiresAt: number };
function signature(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("Configuración de seguridad no disponible.");
  return createHmac("sha256", secret || "edecoop-dev-secret-change-me").update(`data-update:${value}`).digest("base64url");
}
export function createDataUpdateProof(memberId: string, lookup: string, documentId: string | null, purpose: Proof["purpose"] = "identity") {
  const body = Buffer.from(JSON.stringify({ purpose, memberId, lookup, documentId, expiresAt: Date.now() + (purpose === "receipt" ? 12 : 2) * 3600000 })).toString("base64url");
  return `${body}.${signature(body)}`;
}
export function readDataUpdateProof(value: unknown, purpose: Proof["purpose"] = "identity"): Proof | null {
  try {
    if (typeof value !== "string" || value.length > 4096) return null;
    const [body, mac, extra] = value.split(".");
    if (!body || !mac || extra !== undefined) return null;
    const expected = Buffer.from(signature(body));
    const actual = Buffer.from(mac);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const proof = JSON.parse(Buffer.from(body, "base64url").toString()) as Proof;
    return proof.purpose === purpose && typeof proof.memberId === "string" && typeof proof.lookup === "string" && (proof.documentId === null || typeof proof.documentId === "string") && Number.isFinite(proof.expiresAt) && proof.expiresAt > Date.now() ? proof : null;
  } catch { return null; }
}
export function completedDataUpdate(request: NextRequest) {
  return Boolean(readDataUpdateProof(request.cookies.get(DATA_UPDATE_RECEIPT)?.value, "receipt"));
}
export function setDataUpdateReceipt(response: NextResponse, memberId: string) {
  response.cookies.set(DATA_UPDATE_RECEIPT, createDataUpdateProof(memberId, "", null, "receipt"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

// Railway overwrites X-Real-IP at its public edge. Do not trust client-supplied X-Forwarded-For.
// Durable, namespaced counters keep the limit effective across restarts and replicas.
export async function dataUpdateRateLimit(request: NextRequest, scope: "lookup" | "submit") {
  const candidate = request.headers.get("x-real-ip") || "";
  const ip = isIP(candidate) ? candidate : "unknown";
  const key = `dataUpdate.rateLimit.${scope}.${signature(ip)}`;
  const limit = scope === "lookup" ? 120 : 60;
  const window = scope === "lookup" ? 15 * 60000 : 3600000;
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", key);
    const row = await tx.appSetting.findUnique({ where: { key } });
    const now = Date.now();
    let counter = { count: 0, resetAt: now + window };
    if (row) {
      try {
        const previous = JSON.parse(row.value);
        if (Number.isFinite(previous.resetAt) && previous.resetAt > now && Number.isInteger(previous.count) && previous.count >= 0) counter = previous;
      } catch { /* Replace an invalid counter with a fresh window. */ }
    }
    if (counter.count >= limit) return { limited: true, seconds: Math.max(1, Math.ceil((counter.resetAt - now) / 1000)) };
    counter.count++;
    await tx.appSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(counter) }, update: { value: JSON.stringify(counter) } });
    return { limited: false, seconds: 0 };
  });
  return result.limited ? NextResponse.json({ error: "Demasiados intentos desde esta conexión. Espera unos minutos antes de continuar." }, { status: 429, headers: { "Retry-After": String(result.seconds), "Cache-Control": "no-store" } }) : null;
}
