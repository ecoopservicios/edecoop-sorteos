import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { drawAffiliationFinal } from "@/lib/raffle";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const body = await request.json().catch(() => ({}));
  const eventEditionId = String(body.eventEditionId || "").trim();
  if (!eventEditionId) return jsonError("Debe seleccionar un evento final.", 422);

  try {
    const result = await drawAffiliationFinal(user!.id, eventEditionId);
    return NextResponse.json({
      result: {
        id: result.id,
        code: result.code,
        participantName: result.participantName,
        participantNie: result.participantNie,
        participantPhone: result.participantPhone,
        participantEmail: result.participantEmail,
        prizeName: result.prizeName,
        eventName: result.eventName,
        status: result.status,
        statusLabel: "Pendiente"
      }
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo realizar el sorteo final.", 422);
  }
}
