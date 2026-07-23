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

  const zone = await prisma.eventZone.update({
    where: { id },
    data: { isActive }
  });

  return NextResponse.json({ zone });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const { id } = await params;
  await prisma.eventZone.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
