import { DataUpdateEmailVerification } from "@/components/data-update-email-verification";

export default async function ValidateDataUpdatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-14"><section className="mx-auto w-full max-w-lg rounded-lg border border-slate-200 bg-white px-6 py-10 shadow-sm sm:px-10"><img src="/edecoop-logo.png" alt="EDECOOP" className="mx-auto mb-7 h-auto w-24" /><DataUpdateEmailVerification token={token} /></section></main>;
}
