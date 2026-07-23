import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { canSpinPresential, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { spinPresential } from "@/lib/raffle";
import { presentialSpinSchema } from "@/lib/validators";
import { environmentLabel, prizeStatusLabel } from "@/lib/labels";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canSpinPresential(user)) return jsonError("No autorizado.", 403);

  const body = await request.json().catch(() => ({}));
  const payload = presentialSpinSchema.safeParse(body);
  if (!payload.success) return jsonError("Datos inválidos.", 422);

  try {
    const result = await spinPresential(user!.id, payload.data);
    return NextResponse.json({
      result: {
        id: result.id,
        code: result.code,
        participantName: result.participantName,
        participantPhone: result.participantPhone,
        participantNie: result.participantNie,
        participantEmail: result.participantEmail,
        prizeName: result.prizeName,
        eventName: result.eventName,
        environment: result.environment,
        environmentLabel: environmentLabel(result.environment),
        status: result.status,
        statusLabel: prizeStatusLabel(result.status),
        createdAt: result.createdAt
      }
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo ejecutar el sorteo.");
  }
}
