import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseMemberUpload } from "@/lib/member-directory-upload";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);
  const form = await request.formData();
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
  const { rows, errors, processed } = parsed;
  if (!rows.length) return NextResponse.json({ processed, created: 0, rejected: processed || errors.length, errors }, { status: 422 });
  const existing = await prisma.memberDirectory.findMany({
    where: { enrollmentCompanyId, OR: [
      { documentId: { in: rows.map(row => row.documentId) } },
      { employeeNumber: { in: rows.map(row => row.employeeNumber).filter(Boolean) as string[] } }
    ] },
    select: { documentId: true, employeeNumber: true }
  });
  const existingDocuments = new Set(existing.map(row => row.documentId).filter(Boolean));
  const existingEmployees = new Set(existing.map(row => row.employeeNumber).filter(Boolean));
  const validRows = rows.filter(row => {
    const rowErrors: string[] = [];
    if (existingDocuments.has(row.documentId)) rowErrors.push("La cédula ya existe en la base de socios.");
    if (row.employeeNumber && existingEmployees.has(row.employeeNumber)) rowErrors.push("El NIE ya existe en la base de socios.");
    if (!rowErrors.length) return true;
    errors.push({ row: row.rowNumber, message: `Fila ${row.rowNumber} - ${row.firstName} ${row.lastName}: ${rowErrors.join(" ")}` });
    return false;
  });
  errors.sort((a, b) => a.row - b.row);
  if (!validRows.length) return NextResponse.json({ processed, created: 0, rejected: errors.length, errors }, { status: 409 });
  try {
    await prisma.memberDirectory.createMany({ data: validRows.map(row => ({
      enrollmentCompanyId, firstName: row.firstName, lastName: row.lastName,
      documentId: row.documentId, employeeNumber: row.employeeNumber, loadedById: user!.id
    })) });
    return NextResponse.json({ processed, created: validRows.length, rejected: errors.length, errors });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("La carga contiene socios duplicados existentes. Revisa cédula y NIE.", 409);
    throw error;
  }
}
