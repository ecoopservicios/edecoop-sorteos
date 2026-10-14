import type { Prisma } from "@prisma/client";

export async function findSouvenirCollector(db: Prisma.TransactionClient, employeeNumber: string, beneficiaryId: string) {
  if (!/^\d+$/.test(employeeNumber)) throw new Error("Indique el número de empleado de quien retira; solo se permiten números.");
  const matches = await db.souvenirMember.findMany({
    where: { clearedAt: null, employeeNumber, enrollmentCompany: { name: { equals: "EDESUR", mode: "insensitive" } } },
    select: { id: true, firstName: true, lastName: true, employeeNumber: true },
    take: 2
  });
  if (!matches.length) throw new Error("No se encontró ese número de empleado en el listado de EDESUR.");
  if (matches.length > 1) throw new Error("El número de empleado tiene varias coincidencias en EDESUR. Revise el listado.");
  if (matches[0].id === beneficiaryId) throw new Error("Quien retira debe ser diferente del socio beneficiario. Desmarque el cotejo si retira su propio souvenir.");
  return matches[0];
}
