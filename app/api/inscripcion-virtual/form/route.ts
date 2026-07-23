import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  DEFAULT_ENROLLMENT_SUCCESS_MESSAGE,
  DEFAULT_ENROLLMENT_TEXT,
  DEFAULT_ENROLLMENT_TITLE,
  DEFAULT_ENROLLMENT_WELCOME_MESSAGE
} from "@/lib/enrollment";
import { ensureEnrollmentForm } from "@/lib/enrollment-server";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || DEFAULT_ENROLLMENT_TITLE).trim();
  const description = String(body.description || DEFAULT_ENROLLMENT_TEXT).trim();
  const welcomeMessage = DEFAULT_ENROLLMENT_WELCOME_MESSAGE;
  const successMessage = DEFAULT_ENROLLMENT_SUCCESS_MESSAGE;
  const isActive = Boolean(body.isActive);
  const allowInstantPrize = Boolean(body.allowInstantPrize);

  if (title.length < 3) return jsonError("El titulo es requerido.", 422);
  if (description.length < 10) return jsonError("El texto del formulario es requerido.", 422);

  const existing = await ensureEnrollmentForm(user!.id);
  const form = await prisma.enrollmentForm.update({
    where: { id: existing.id },
    data: { title, description, welcomeMessage, successMessage, isActive, allowInstantPrize }
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      entityType: "EnrollmentForm",
      entityId: form.id,
      reason: "Actualizacion de formulario de afiliacion",
      userId: user!.id,
      metadata: { title: form.title, isActive: form.isActive, allowInstantPrize: form.allowInstantPrize }
    }
  });

  return NextResponse.json({ form });
}
