import { DataUpdatePublicForm } from "@/components/data-update-public-form";
import { getDataUpdateQuestions, getDataUpdateTextSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { DATA_UPDATE_RECEIPT, readDataUpdateProof } from "@/lib/data-update-security";

export const dynamic = "force-dynamic";

export default async function PublicDataUpdatePage() {
  const completed = Boolean(readDataUpdateProof((await cookies()).get(DATA_UPDATE_RECEIPT)?.value, "receipt"));
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
        initialCompleted={completed}
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
