import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { createSouvenirListPdf } from "@/lib/souvenir-print-pdf";
import { souvenirLocationKey, souvenirLocationLabel } from "@/lib/souvenir-order";
import type { SouvenirPrintMember } from "@/lib/souvenir-print";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return jsonError("Inicie sesión nuevamente.", 401);
  try {
    const companyId = request.nextUrl.searchParams.get("companyId") || "";
    const location = request.nextUrl.searchParams.get("location") || "";
    const records = await prisma.souvenirMember.findMany({ where: { clearedAt: null, ...(companyId ? { enrollmentCompanyId: companyId } : {}) }, include: { enrollmentCompany: { select: { name: true } } }, orderBy: { listNumber: "asc" } });
    const groups = new Map<string, { location: string; members: SouvenirPrintMember[] }>();
    for (const member of records) {
      const key = `${member.enrollmentCompanyId}:${souvenirLocationKey(member.approximateLocation)}`;
      if (location && souvenirLocationKey(member.approximateLocation) !== souvenirLocationKey(location)) continue;
      const group = groups.get(key) || { location: souvenirLocationLabel(member.approximateLocation), members: [] };
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
