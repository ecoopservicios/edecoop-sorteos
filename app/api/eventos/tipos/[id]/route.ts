import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const isActive = Boolean(body.isActive);

  const eventType = await prisma.eventType.update({
    where: { id },
    data: { isActive }
  });

  return NextResponse.json({ eventType });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  const editions = await prisma.eventEdition.count({ where: { eventTypeId: id } });
  if (editions > 0) return jsonError("No se puede eliminar un tipo de evento que ya tiene eventos creados. Puede inactivarlo.", 409);

  await prisma.eventType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
