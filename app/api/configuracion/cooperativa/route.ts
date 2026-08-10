import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { getCooperativeSettings, upsertCooperativeSettings } from "@/lib/app-settings";
import { normalizeDigits } from "@/lib/data-update";

function text(value: unknown) {
  return String(value || "").trim();
}

function optionalEmail(value: unknown) {
  const email = text(value).toLowerCase();
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Debe indicar un correo electronico valido.");
  return email;
}

function optionalUrl(value: unknown, label: string) {
  const url = text(value);
  if (!url) return "";
  try {
    new URL(url);
    return url;
  } catch {
    throw new Error(`${label} debe ser una URL valida.`);
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);
  return NextResponse.json({ settings: await getCooperativeSettings() });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  try {
    const body = await request.json().catch(() => ({}));
    const settings = {
      whatsapp: normalizeDigits(text(body.whatsapp)),
      phone: normalizeDigits(text(body.phone)),
      email: optionalEmail(body.email),
      website: optionalUrl(body.website, "Pagina web"),
      facebook: optionalUrl(body.facebook, "Facebook"),
      instagram: optionalUrl(body.instagram, "Instagram"),
      x: optionalUrl(body.x, "X"),
      youtube: optionalUrl(body.youtube, "YouTube")
    };

    await upsertCooperativeSettings(settings);
    return NextResponse.json({ settings });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo guardar la configuracion.", 422);
  }
}
