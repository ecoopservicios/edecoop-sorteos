import { notFound } from "next/navigation";
import { EnrollmentPublicForm } from "@/components/enrollment-public-form";
import { prisma } from "@/lib/db";

export default async function PublicPresentialEnrollmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await prisma.enrollmentForm.findUnique({
    where: { token },
    include: {
      companies: {
        where: { isActive: true },
        orderBy: { name: "asc" }
      }
    }
  });
  if (!form) notFound();

  if (!form.isActive) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
        <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <img src="/edecoop-logo.png" alt="EDECOOP" className="mx-auto mb-4 h-auto w-36" />
          <h1 className="text-2xl font-black text-slate-950">Formulario no disponible</h1>
          <p className="mt-2 text-slate-600">Este formulario de afiliacion presencial no está activo en este momento.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <EnrollmentPublicForm
        token={form.token}
        title={form.title}
        description={form.description}
        channel="presential"
        companies={form.companies.map((company) => ({ id: company.id, name: company.name }))}
      />
    </main>
  );
}
