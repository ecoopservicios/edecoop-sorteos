import type { Metadata } from "next";
import { DataUpdatePhoneValidation } from "@/components/data-update-phone-validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Validar identidad - EDECOOP",
  referrer: "no-referrer",
  robots: { index: false, follow: false }
};

export default async function DataUpdatePhoneValidationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-8"><DataUpdatePhoneValidation token={token} /></main>;
}
