import type { Metadata } from "next";
import { DataUpdatePublicForm } from "@/components/data-update-public-form";
import { getDataUpdateQuestions, getDataUpdateTextSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { DATA_UPDATE_RECEIPT, readDataUpdateProof } from "@/lib/data-update-security";

export const dynamic = "force-dynamic";

const title = "EDECOOP - Actualizacion de datos";
const description = "Jornada de actualizar los datos de los socios";

export const metadata: Metadata = {
  metadataBase: new URL("https://eventos.edecoop.com.do"),
  title,
  description,
  alternates: { canonical: "/actualizar-datos" },
  icons: {
    icon: [
      { url: "/edecoop-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/edecoop-icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    shortcut: "/edecoop-icon-32.png",
    apple: { url: "/edecoop-apple-icon.png", sizes: "180x180", type: "image/png" }
  },
  openGraph: {
    type: "website",
    locale: "es_DO",
    url: "/actualizar-datos",
    siteName: "EDECOOP",
    title,
    description,
    images: [{ url: "/edecoop-actualizar-datos-share.png", width: 1200, height: 630, alt: "EDECOOP" }]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/edecoop-actualizar-datos-share.png"]
  }
};

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
        emailEnabled={Boolean(process.env.BREVO_API_KEY?.trim() && process.env.EMAIL_FROM_ADDRESS?.trim())}
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
