import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return jsonError("Inicie sesión nuevamente.", 401);
  const history = request.nextUrl.searchParams.get("view") === "estado";
  const members = await prisma.souvenirMember.findMany({
    include: { enrollmentCompany: { select: { id: true, name: true } }, souvenirDelivery: { include: { deliveredBy: { select: { name: true } } } } },
    orderBy: [{ enrollmentCompany: { name: "asc" } }, { firstName: "asc" }, { lastName: "asc" }]
  });
  const retained = history ? await prisma.souvenirDelivery.findMany({ where: { souvenirMemberId: null }, include: { deliveredBy: { select: { name: true } } }, orderBy: { companyName: "asc" } }) : [];
  return NextResponse.json({ members: [...members.map(m => ({
    id: m.id, listNumber: m.listNumber, companyId: m.enrollmentCompanyId, companyName: history && m.souvenirDelivery ? m.souvenirDelivery.companyName : m.enrollmentCompany.name,
    firstName: history ? m.souvenirDelivery?.firstName ?? m.firstName : m.firstName, lastName: history ? m.souvenirDelivery?.lastName ?? m.lastName : m.lastName, fullName: history && m.souvenirDelivery ? m.souvenirDelivery.memberName : `${m.firstName} ${m.lastName}`,
    documentId: history && m.souvenirDelivery ? m.souvenirDelivery.documentId : m.documentId,
    displayDocumentId: history && m.souvenirDelivery ? m.souvenirDelivery.displayDocumentId : m.displayDocumentId,
    employeeNumber: history && m.souvenirDelivery ? m.souvenirDelivery.employeeNumber : m.employeeNumber,
    sex: history && m.souvenirDelivery ? m.souvenirDelivery.sex : m.sex,
    office: history && m.souvenirDelivery ? m.souvenirDelivery.office : m.office,
    unit: history && m.souvenirDelivery ? m.souvenirDelivery.unit : m.unit,
    organizationalDirection: m.souvenirDelivery?.organizationalDirection ?? m.organizationalDirection,
    physicalListPage: m.souvenirDelivery?.physicalListPage ?? m.physicalListPage,
    clearedAt: null, deliveredAt: m.souvenirDelivery?.deliveredAt ?? null, responsible: m.souvenirDelivery?.deliveredBy.name ?? null
  })), ...retained.map(d => ({ id: d.id, listNumber: d.listNumber, companyId: d.companyId || d.companyName, companyName: d.companyName, firstName: d.firstName || d.memberName, lastName: d.lastName || "", fullName: d.memberName, documentId: d.documentId, displayDocumentId: d.displayDocumentId, employeeNumber: d.employeeNumber, sex: d.sex, office: d.office, unit: d.unit, organizationalDirection: d.organizationalDirection, physicalListPage: d.physicalListPage, clearedAt: null, deliveredAt: d.deliveredAt, responsible: d.deliveredBy.name }))] });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN" || user.mustChangePassword) return jsonError("No autorizado.", 403);
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim();
  const companyId = String(body.companyId || "");
  if (body.confirmation !== "LIMPIAR" || reason.length < 5) return jsonError("Escriba LIMPIAR e indique el motivo (mínimo 5 caracteres).", 422);
  try {
    const count = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(209831)`;
      const result = await tx.souvenirMember.deleteMany({ where: companyId ? { enrollmentCompanyId: companyId } : {} });
      await tx.auditLog.create({ data: { action: "SOUVENIR_LIST_CLEARED", entityType: "SouvenirMember", entityId: "souvenir-list", userId: user.id, reason, metadata: { count: result.count, companyId: companyId || null, deliveriesPreserved: true } } });
      return result.count;
    });
    return NextResponse.json({ count });
  } catch { return jsonError("No se pudo limpiar el listado. Intente nuevamente.", 500); }
}
