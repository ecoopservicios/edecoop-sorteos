import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

function eventTypeCode(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return normalized || `EVENTO_${Date.now()}`;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (name.length < 3) return jsonError("Debe indicar un nombre de al menos 3 caracteres.", 422);

  try {
    const eventType = await prisma.eventType.create({
      data: {
        name,
        code: eventTypeCode(name),
        isActive: true
      }
    });
    return NextResponse.json({ eventType }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("Ya existe un tipo de evento con ese nombre.", 409);
    }
    throw error;
  }
}
