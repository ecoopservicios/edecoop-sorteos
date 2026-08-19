import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { getDataUpdateTextSettings, upsertDataUpdateTextSettings } from "@/lib/app-settings";

function text(value: unknown) {
  return String(value || "").trim();
}

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);
  return NextResponse.json({ settings: await getDataUpdateTextSettings() });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  try {
    const body = await request.json().catch(() => ({}));
    const settings = {
      title: text(body.title) || "Actualizacion de Datos",
      description: text(body.description) || "Seleccione su empresa para validar sus datos registrados.",
      lookupQuestion: text(body.lookupQuestion) || "Digite el dato de consulta solicitado para su empresa.",
      notFoundMessage: text(body.notFoundMessage) || "No encontramos sus datos en nuestros registros.",
      successMessage:
        text(body.successMessage) ||
        "Gracias por actualizar sus datos. La informacion fue recibida correctamente por EDECOOP.",
      whatsappMessage:
        text(body.whatsappMessage) ||
        "Hola EDECOOP, necesito actualizar mis datos y no aparezco en el portal para la empresa {empresa}."
    };

    await upsertDataUpdateTextSettings(settings);
    return NextResponse.json({ settings });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudieron guardar los textos.", 422);
  }
}
