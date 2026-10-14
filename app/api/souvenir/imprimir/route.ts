import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { createSouvenirListPdf, officeKey, officeLabel } from "@/lib/souvenir-print-pdf";
import type { SouvenirPrintMember } from "@/lib/souvenir-print";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return jsonError("Inicie sesión nuevamente.", 401);
  try {
    const companyId = request.nextUrl.searchParams.get("companyId") || "";
    const office = request.nextUrl.searchParams.get("office") || "";
    const records = await prisma.souvenirMember.findMany({ where: { clearedAt: null, ...(companyId ? { enrollmentCompanyId: companyId } : {}) }, include: { enrollmentCompany: { select: { name: true } } }, orderBy: { listNumber: "asc" } });
    const groups = new Map<string, { office: string; members: SouvenirPrintMember[] }>();
    for (const member of records) {
      const key = `${member.enrollmentCompanyId}:${officeKey(member.office)}`;
      if (office && officeKey(member.office) !== officeKey(office)) continue;
      const group = groups.get(key) || { office: officeLabel(member.office), members: [] };
      group.members.push({ ...member, companyId: member.enrollmentCompanyId, companyName: member.enrollmentCompany.name });
      groups.set(key, group);
    }
    if (!groups.size) return jsonError("No hay socios para descargar.", 404);
    const bytes = await createSouvenirListPdf([...groups.values()]);
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="souvenir-aniversario.pdf"', "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Souvenir print export failed", error);
    return jsonError(error instanceof Error ? error.message : "No se pudieron generar los PDF.", 500);
  }
}
