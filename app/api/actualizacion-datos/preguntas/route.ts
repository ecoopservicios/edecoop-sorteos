import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDataUpdateQuestions, upsertDataUpdateQuestions, type DataUpdateQuestion } from "@/lib/app-settings";

function cleanQuestion(question: Partial<DataUpdateQuestion>): DataUpdateQuestion {
  const fieldKey = String(question.fieldKey || question.id || "").trim();
  const label = String(question.label || "").trim();
  const section = question.section === "EMERGENCY" || question.section === "ADDITIONAL" ? question.section : "CONTACT";
  const typeValues: DataUpdateQuestion["type"][] = ["TEXT", "NUMBER", "PHONE", "EMAIL", "SELECT"];
  const type = typeValues.includes(question.type as DataUpdateQuestion["type"]) ? (question.type as DataUpdateQuestion["type"]) : "TEXT";
  const optionSource = Array.isArray(question.options) ? question.options.join(",") : "";
  const options = type === "SELECT" ? optionSource.split(",").map((value) => value.trim()).filter(Boolean) : undefined;
  const helpText = String(question.helpText || "").trim();

  if (!fieldKey) throw new Error("Debe indicar el identificador de la pregunta.");
  if (!label) throw new Error("Debe indicar el texto de la pregunta.");

  return {
    id: String(question.id || fieldKey),
    fieldKey,
    label,
    section,
    type,
    required: Boolean(question.required),
    isSystem: Boolean(question.isSystem),
    helpText,
    options
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return jsonError("No autorizado.", 403);
  return NextResponse.json({ questions: await getDataUpdateQuestions() });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return jsonError("No autorizado.", 403);

  try {
    const body = await request.json().catch(() => ({}));
    const current = await getDataUpdateQuestions();
    const incoming = cleanQuestion(body.question || {});
    const questions = current.some((question) => question.id === incoming.id)
      ? current.map((question) => (question.id === incoming.id ? { ...question, ...incoming, isSystem: question.isSystem, required: question.isSystem ? true : incoming.required } : question))
      : [...current, { ...incoming, isSystem: false }];

    return NextResponse.json({ questions: await upsertDataUpdateQuestions(questions) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo guardar la pregunta.", 422);
  }
}
