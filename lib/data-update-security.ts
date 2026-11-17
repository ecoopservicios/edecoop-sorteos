import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const DATA_UPDATE_RECEIPT = "edecoop_data_update_receipt";
type Proof = { purpose: "identity" | "receipt"; memberId: string; lookup: string; documentId: string | null; documentVerified?: boolean; expiresAt: number };
function signature(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("Configuración de seguridad no disponible.");
  return createHmac("sha256", secret || "edecoop-dev-secret-change-me").update(`data-update:${value}`).digest("base64url");
}
export function createDataUpdateProof(memberId: string, lookup: string, documentId: string | null, purpose: Proof["purpose"] = "identity", documentVerified = false) {
  const body = Buffer.from(JSON.stringify({ purpose, memberId, lookup, documentId, documentVerified, expiresAt: Date.now() + (purpose === "receipt" ? 12 : 2) * 3600000 })).toString("base64url");
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
    return proof.purpose === purpose && typeof proof.memberId === "string" && typeof proof.lookup === "string" && (proof.documentId === null || typeof proof.documentId === "string") && (proof.documentVerified === undefined || typeof proof.documentVerified === "boolean") && Number.isFinite(proof.expiresAt) && proof.expiresAt > Date.now() ? proof : null;
  } catch { return null; }
}
export function completedDataUpdate(request: NextRequest) {
  return Boolean(readDataUpdateProof(request.cookies.get(DATA_UPDATE_RECEIPT)?.value, "receipt"));
}
export function setDataUpdateReceipt(response: NextResponse, memberId: string) {
  response.cookies.set(DATA_UPDATE_RECEIPT, createDataUpdateProof(memberId, "", null, "receipt"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

export function guardDataUpdateRequest(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const expectedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
      if (!expectedHost || new URL(origin).host.toLowerCase() !== expectedHost.toLowerCase()) {
        return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
      }
    } catch {
      return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Formato de solicitud no permitido." }, { status: 415, headers: { "Cache-Control": "no-store" } });
  }
  return null;
}

// Railway overwrites X-Real-IP at its public edge. Do not trust client-supplied X-Forwarded-For.
// Durable, namespaced counters keep the limit effective across restarts and replicas.
export async function dataUpdateRateLimit(request: NextRequest, scope: "lookup" | "document" | "submit" | "resend") {
  const candidate = request.headers.get("x-real-ip") || "";
  const ip = isIP(candidate) ? candidate : "unknown";
  const key = `dataUpdate.rateLimit.${scope}.${signature(ip)}`;
  const limit = scope === "lookup" ? 30 : scope === "document" ? 10 : scope === "resend" ? 3 : 10;
  const window = scope === "lookup" || scope === "document" ? 15 * 60000 : 3600000;
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const row = await tx.appSetting.findUnique({ where: { key } });
    const now = Date.now();
    let counter = { count: 0, resetAt: now + window };
    if (row) {
      try {
        const previous = JSON.parse(row.value);
        if (Number.isFinite(previous.resetAt) && previous.resetAt > now && Number.isInteger(previous.count) && previous.count >= 0) counter = previous;
      } catch { /* Replace an invalid counter with a fresh window. */ }
    }
    if (counter.count >= limit) {
      const markerKey = `${key}.blocked`;
      const markerValue = String(counter.resetAt);
      const marker = await tx.appSetting.findUnique({ where: { key: markerKey } });
      if (marker?.value !== markerValue) {
        await tx.appSetting.upsert({ where: { key: markerKey }, create: { key: markerKey, value: markerValue }, update: { value: markerValue } });
        await tx.auditLog.create({
          data: {
            action: "DATA_UPDATE_RATE_LIMIT_BLOCKED",
            entityType: "DataUpdateSecurity",
            entityId: key,
            reason: "Se bloqueó temporalmente una conexión por exceder el límite del formulario público.",
            metadata: { scope, resetAt: new Date(counter.resetAt).toISOString() }
          }
        });
      }
      return { limited: true, seconds: Math.max(1, Math.ceil((counter.resetAt - now) / 1000)) };
    }
    counter.count++;
    await tx.appSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(counter) }, update: { value: JSON.stringify(counter) } });
    return { limited: false, seconds: 0 };
  });
  return result.limited ? NextResponse.json({ error: "Demasiados intentos desde esta conexión. Espera unos minutos antes de continuar." }, { status: 429, headers: { "Retry-After": String(result.seconds), "Cache-Control": "no-store" } }) : null;
}
