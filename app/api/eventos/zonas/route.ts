import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().toUpperCase();
  if (name.length < 2) return jsonError("Debe indicar una zona de al menos 2 caracteres.", 422);

  try {
    const zone = await prisma.eventZone.create({
      data: { name, isActive: true }
    });
    return NextResponse.json({ zone }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("Ya existe una zona con ese nombre.", 409);
    }
    throw error;
  }
}
