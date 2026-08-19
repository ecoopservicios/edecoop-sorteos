import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDataUpdateQuestions, upsertDataUpdateQuestions } from "@/lib/app-settings";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return jsonError("No autorizado.", 403);

  const { id } = await params;
  const questions = await getDataUpdateQuestions();
  const found = questions.find((question) => question.id === id);
  if (!found) return jsonError("Pregunta no encontrada.", 404);
  if (found.isSystem) return jsonError("Esta pregunta es obligatoria del sistema y no puede eliminarse.", 409);

  return NextResponse.json({ questions: await upsertDataUpdateQuestions(questions.filter((question) => question.id !== id)) });
}
