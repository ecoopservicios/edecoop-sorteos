import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseMemberUpload } from "@/lib/member-directory-upload";
import { importMemberDirectory, MemberDirectoryError, memberImportMode } from "@/lib/member-directory-management";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);
  const form = await request.formData();
  let mode: ReturnType<typeof memberImportMode>;
  try { mode = memberImportMode(form.get("mode"), form.get("confirmation")); }
  catch (error) { return jsonError(error instanceof Error ? error.message : "Modo de carga no válido.", 422); }
  const expectedCount = form.get("expectedCount");
  if (mode === "replace" && (typeof expectedCount !== "string" || !/^\d+$/.test(expectedCount))) return jsonError("Debes confirmar el número de socios del listado anterior.", 422);
  const enrollmentCompanyId = String(form.get("enrollmentCompanyId") || "");
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Debe seleccionar un archivo Excel o CSV.", 422);
  if (file.size > 10 * 1024 * 1024) return jsonError("El archivo no puede superar 10 MB.", 422);
  const company = await prisma.enrollmentCompany.findFirst({ where: { id: enrollmentCompanyId, isActive: true, dataUpdateEnabled: true } });
  if (!company || !company.dataUpdateLookupField) return jsonError("Empresa no disponible para actualización de datos.", 422);
  let parsed: ReturnType<typeof parseMemberUpload>;
  try {
    parsed = parseMemberUpload(Buffer.from(await file.arrayBuffer()), { name: company.name, dataUpdateLookupField: company.dataUpdateLookupField }, file.name);
  } catch {
    return jsonError("No se pudo leer el archivo. Verifica que sea un Excel o CSV válido y que use la plantilla actualizada.", 422);
  }
  try {
    const result = await prisma.$transaction(tx => importMemberDirectory(tx, parsed, {
      enrollmentCompanyId, userId: user!.id, mode, expectedCount: expectedCount === null ? undefined : Number(expectedCount), fileName: file.name
    }), { timeout: 60000 });
    return NextResponse.json(result, { status: result.applied ? 200 : 422, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MemberDirectoryError) return jsonError(error.message, error.status);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("La carga contiene socios duplicados existentes. Revisa cédula y NIE.", 409);
    throw error;
  }
}
