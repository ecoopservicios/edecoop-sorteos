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
    const companyIds = [...new Set(request.nextUrl.searchParams.getAll("companyId").filter(Boolean))];
    const location = request.nextUrl.searchParams.get("location") || "";
    const records = await prisma.souvenirMember.findMany({ where: { clearedAt: null, ...(companyIds.length ? { enrollmentCompanyId: { in: companyIds } } : {}) }, include: { enrollmentCompany: { select: { name: true } }, souvenirDelivery: { select: { collectedByOther: true } } }, orderBy: { listNumber: "asc" } });
    const groups = new Map<string, { location: string; members: SouvenirPrintMember[] }>();
    for (const member of records) {
      const key = `${member.enrollmentCompanyId}:${souvenirLocationKey(member.approximateLocation)}`;
      if (location && souvenirLocationKey(member.approximateLocation) !== souvenirLocationKey(location)) continue;
      const group = groups.get(key) || { location: souvenirLocationLabel(member.approximateLocation), members: [] };
      group.members.push({ id: member.id, listNumber: member.listNumber, firstName: member.firstName, lastName: member.lastName, displayDocumentId: member.displayDocumentId, employeeNumber: member.employeeNumber, office: member.office, unit: member.unit, approximateLocation: member.approximateLocation, companyId: member.enrollmentCompanyId, companyName: member.enrollmentCompany.name, delivered: !!member.souvenirDelivery, collectedByOther: member.souvenirDelivery?.collectedByOther ?? false });
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
