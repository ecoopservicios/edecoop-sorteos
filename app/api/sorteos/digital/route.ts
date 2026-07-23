import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { spinDigital } from "@/lib/raffle";
import { digitalSpinSchema } from "@/lib/validators";
import { environmentLabel, prizeStatusLabel } from "@/lib/labels";

export async function POST(request: NextRequest) {
  const payload = digitalSpinSchema.safeParse(await request.json());
  if (!payload.success) return jsonError("Enlace inválido.", 422);

  try {
    const result = await spinDigital(payload.data.token);
    return NextResponse.json({
      result: {
        id: result.id,
        code: result.code,
        participantName: result.participantName,
        participantPhone: result.participantPhone,
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
