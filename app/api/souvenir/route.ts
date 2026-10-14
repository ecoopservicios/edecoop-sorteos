import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { normalizeLookupValue } from "@/lib/data-update";
import { souvenirDeliveryMatch } from "@/lib/souvenir-deliveries";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return jsonError("Inicie sesión nuevamente.", 401);
  const companyId = request.nextUrl.searchParams.get("companyId") || "";
  const company = await prisma.enrollmentCompany.findFirst({ where: { id: companyId, isActive: true } });
  if (!company?.dataUpdateLookupField) return jsonError("Seleccione una empresa con identificación configurada.", 422);
  const lookup = request.nextUrl.searchParams.get("lookup");
  if (lookup !== null) {
    try {
      if (!/^\d+$/.test(lookup)) return jsonError("La identificación solo acepta números.", 422);
      const value = company.dataUpdateLookupField === "DOCUMENT_ID" ? normalizeLookupValue(lookup, company.dataUpdateLookupField) : lookup;
      const member = await prisma.souvenirMember.findFirst({
        where: { clearedAt: null, enrollmentCompanyId: companyId, ...(company.dataUpdateLookupField === "DOCUMENT_ID" ? { documentId: value } : { employeeNumber: value }) },
        select: { id: true, listNumber: true, firstName: true, lastName: true, displayDocumentId: true, sex: true, office: true, unit: true, approximateLocation: true, employeeNumber: true, organizationalDirection: true, physicalListPage: true, souvenirDelivery: { select: { deliveredAt: true, deliveredBy: { select: { name: true } } } } }
      });
      if (!member) return jsonError("No se encontró el socio en el listado de esta empresa.", 404);
      return NextResponse.json({ member });
    } catch (error) { return jsonError(error instanceof Error ? error.message : "Identificación inválida.", 422); }
  }
  const members = await prisma.souvenirMember.findMany({
    where: { enrollmentCompanyId: companyId, clearedAt: null },
    select: { id: true, listNumber: true, firstName: true, lastName: true, displayDocumentId: true, sex: true, office: true, unit: true, approximateLocation: true, employeeNumber: true, organizationalDirection: true, physicalListPage: true, souvenirDelivery: { select: { deliveredAt: true, deliveredBy: { select: { name: true } } } } },
    orderBy: { listNumber: "asc" }
  });
  const delivered = members.filter(member => member.souvenirDelivery).length;
  return NextResponse.json({ members, total: members.length, delivered, pending: members.length - delivered });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return jsonError("Inicie sesión nuevamente.", 401);
  try {
    const body = await request.json();
    const memberId = String(body.memberId || "");
    const companyId = String(body.companyId || "");
    const delivery = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(209831)`;
      const member = await tx.souvenirMember.findFirst({ where: { id: memberId, clearedAt: null, enrollmentCompanyId: companyId, enrollmentCompany: { isActive: true, dataUpdateLookupField: { not: null } } }, include: { enrollmentCompany: true } });
      if (!member) throw new Error("El socio o la empresa ya no están disponibles.");
      if (await tx.souvenirDelivery.findFirst({ where: souvenirDeliveryMatch(member, member.enrollmentCompany.name) })) return null;
      const record = await tx.souvenirDelivery.create({ data: {
        souvenirMemberId: member.id, listNumber: member.listNumber, deliveredById: user.id,
        companyId: member.enrollmentCompanyId, firstName: member.firstName, lastName: member.lastName,
        memberName: `${member.firstName} ${member.lastName}`, companyName: member.enrollmentCompany.name,
        documentId: member.documentId, employeeNumber: member.employeeNumber,
        displayDocumentId: member.displayDocumentId, sex: member.sex, office: member.office, unit: member.unit, approximateLocation: member.approximateLocation,
        organizationalDirection: member.organizationalDirection, physicalListPage: member.physicalListPage
      } });
      await tx.auditLog.create({ data: { action: "SOUVENIR_DELIVERED", entityType: "SouvenirDelivery", entityId: record.id, userId: user.id, reason: "Entrega de souvenir confirmada", metadata: { memberId: member.id, companyId, memberName: record.memberName } } });
      return record;
    });
    if (!delivery) return jsonError("Este socio ya recibió su souvenir. No se permite otra entrega.", 409);
    return NextResponse.json({ delivery: { id: delivery.id, deliveredAt: delivery.deliveredAt } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("Este socio ya recibió su souvenir. No se permite otra entrega.", 409);
    return jsonError(error instanceof Error ? error.message : "No se pudo confirmar la entrega.", 422);
  }
}
