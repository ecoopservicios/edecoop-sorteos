import { notFound, redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function Field({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={`grid grid-cols-[108px_1fr] border border-slate-300 ${wide ? "md:col-span-2" : ""}`}>
      <div className="bg-slate-200 px-1.5 py-1 text-[10px] font-bold leading-tight text-slate-800">{label}</div>
      <div className="min-h-6 px-1.5 py-1 text-[10px] leading-tight text-slate-950">{value || ""}</div>
    </div>
  );
}

export default async function PrintEnrollmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== UserRole.ADMIN) redirect("/ruleta/presencial");

  const { id } = await params;
  const submission = await prisma.enrollmentSubmission.findUnique({
    where: { id },
    include: { form: true }
  });
  if (!submission || submission.deletedAt) notFound();

  return (
    <main className="bg-white p-4 text-slate-950 print:p-0">
      <style>{`
        @page { size: Letter; margin: 0.28in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          main { padding: 0; }
        }
      `}</style>
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <section className="mx-auto max-w-[7.9in] border border-slate-300 p-3">
        <div className="mb-2 flex items-center gap-3">
          <img src="/edecoop-logo.png" alt="EDECOOP" className="h-auto w-20" />
          <div>
            <h1 className="text-base font-black leading-tight">SOLICITUD DE ADMISIÓN</h1>
            <p className="text-xs font-semibold leading-tight">COOPERATIVA DE AHORROS Y CREDITOS EDECOOP</p>
          </div>
        </div>
        <div className="mb-3 whitespace-pre-line rounded-md border border-slate-300 bg-slate-50 p-2 text-[10px] leading-[1.25]">
          {submission.form.description}
          {"\n\n"}
          Autorizo a mi EMPLEADOR a descontar la suma equivalente al {submission.salaryDeductionPercent.toString()} % de mi salario para ser depositados a mi cuenta de ahorros corriente y de capital.
        </div>

        <h2 className="mb-1 border-y border-slate-400 py-0.5 text-center text-xs font-black">DATOS PERSONALES</h2>
        <div className="grid gap-1 md:grid-cols-2">
          <Field label="Nombres" value={submission.firstName} />
          <Field label="Apellidos" value={submission.lastName} />
          <Field label="Cédula No." value={submission.documentId} />
          <Field label="Número de flota" value={submission.residencePhone} />
          <Field label="Celular" value={submission.mobilePhone} />
          <Field label="Ciudad" value={submission.city} />
          <Field label="Dirección de residencia" value={submission.address} wide />
          <Field label="Estado Civil" value={submission.maritalStatus} />
          <Field label="Nombre cónyuge" value={submission.spouseName} />
        </div>

        <h2 className="mb-1 mt-3 border-y border-slate-400 py-0.5 text-center text-xs font-black">DATOS DEL EMPLEADO</h2>
        <div className="grid gap-1 md:grid-cols-2">
          <Field label="Empresa" value={submission.companyName} />
          <Field label="Cargo" value={submission.position} />
          <Field label="Dependencia" value={submission.department} />
          <Field label="Oficina" value={submission.workplace} />
          <Field label="E-Mail" value={submission.email} />
          <Field label="Sueldo Mensual" value={`RD$ ${submission.monthlySalary.toString()}`} />
          <Field label="No. Empl" value={submission.employeeNumber} />
          <Field label="Cta Banco No." value={submission.bankAccountNumber} />
          <Field label="Nombre Banco" value={submission.bankName} />
        </div>

        <div className="mt-9 grid grid-cols-2 gap-16 text-center text-xs">
          <div>
            <div className="border-t border-slate-600 pt-1">Firma</div>
          </div>
          <div>
            <div className="border-t border-slate-600 pt-1">Fecha</div>
          </div>
        </div>
      </section>
    </main>
  );
}
