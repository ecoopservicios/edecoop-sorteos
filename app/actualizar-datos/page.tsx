import { DataUpdatePublicForm } from "@/components/data-update-public-form";
import { getDataUpdateQuestions, getDataUpdateTextSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PublicDataUpdatePage() {
  const [companies, texts, questions] = await Promise.all([
    prisma.enrollmentCompany.findMany({
      where: { isActive: true, dataUpdateEnabled: true, dataUpdateLookupField: { not: null } },
      orderBy: { name: "asc" }
    }),
    getDataUpdateTextSettings(),
    getDataUpdateQuestions()
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <DataUpdatePublicForm
        texts={texts}
        questions={questions}
        companies={companies.map((company) => ({
          id: company.id,
          companyName: company.name,
          lookupField: company.dataUpdateLookupField!
        }))}
      />
    </main>
  );
}
