import { DataUpdatePublicForm } from "@/components/data-update-public-form";
import { prisma } from "@/lib/db";

export default async function PublicDataUpdatePage() {
  const companies = await prisma.enrollmentCompany.findMany({
    where: { isActive: true, dataUpdateEnabled: true, dataUpdateLookupField: { not: null } },
    orderBy: { name: "asc" }
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <DataUpdatePublicForm
        companies={companies.map((company) => ({
          id: company.id,
          companyName: company.name,
          lookupField: company.dataUpdateLookupField!
        }))}
      />
    </main>
  );
}
