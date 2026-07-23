import Link from "next/link";

import { redirect } from "next/navigation";

import { UserRole } from "@prisma/client";

import { AppShell } from "@/components/app-shell";

import { EnrollmentCompanyManager } from "@/components/enrollment-company-manager";

import { EnrollmentFormConfig } from "@/components/enrollment-form-config";

import { EnrollmentPresentialPanel } from "@/components/enrollment-presential-panel";

import { EnrollmentSharePanel } from "@/components/enrollment-share-panel";

import { EnrollmentSubmissionsTable } from "@/components/enrollment-submissions-table";

import { getCurrentUser } from "@/lib/auth";

import { DEFAULT_ENROLLMENT_TEXT } from "@/lib/enrollment";

import { ensureEnrollmentForm } from "@/lib/enrollment-server";



export default async function EnrollmentAdminPage({

  searchParams

}: {

  searchParams: Promise<{ tab?: string }>;

}) {

  const user = await getCurrentUser();

  if (!user) redirect("/login");

  const isAdmin = user.role === UserRole.ADMIN;



  const { tab } = await searchParams;

  if (!isAdmin && tab !== "presencial") redirect("/inscripcion-virtual?tab=presencial");

  const activeTab = tab === "presencial" || tab === "virtual" || tab === "respuestas" ? tab : "formulario";

  const form = await ensureEnrollmentForm(user.id);



  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3002";

  const virtualUrl = `${baseUrl}/inscripcion/${form.token}`;

  const presentialUrl = `${baseUrl}/inscripcion/${form.token}/presencial`;

  const adminTabs = [

    { href: "/inscripcion-virtual", label: "Formulario de Afiliación", key: "formulario" },

    { href: "/inscripcion-virtual?tab=presencial", label: "Afiliación Presencial", key: "presencial" },

    { href: "/inscripcion-virtual?tab=virtual", label: "Afiliación Virtual", key: "virtual" },

    { href: "/inscripcion-virtual?tab=respuestas", label: "Solicitudes Recibidas", key: "respuestas" }

  ];

  const promoterTabs = [{ href: "/inscripcion-virtual?tab=presencial", label: "Afiliación Presencial", key: "presencial" }];

  const tabs = isAdmin ? adminTabs : promoterTabs;



  return (

    <AppShell user={user}>

      <div className="mb-6">

        <h1 className="text-2xl font-black text-slate-950">Formularios de Afiliación</h1>

        <p className="text-slate-600">Gestiona el formulario único, afiliaciones presenciales, afiliaciones virtuales y solicitudes recibidas.</p>

      </div>

      <div className="mb-4 flex flex-wrap gap-2">

        {tabs.map((item) => (

          <Link

            key={item.key}

            href={item.href}

            className={`rounded-md px-4 py-2 text-sm font-bold ${

              activeTab === item.key ? "bg-emerald-700 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"

            }`}

          >

            {item.label}

          </Link>

        ))}

      </div>

      {activeTab === "formulario" ? (

        <>

          <EnrollmentFormConfig

            form={

              {

                title: form.title,

                description: form.description,

                isActive: form.isActive,

                allowInstantPrize: form.allowInstantPrize

              }

            }

            defaultText={DEFAULT_ENROLLMENT_TEXT}

          />

          <EnrollmentCompanyManager

            formId={form.id}

            companies={form.companies.map((company) => ({

              id: company.id,

              name: company.name,

              isActive: company.isActive

            }))}

          />

        </>

      ) : activeTab === "presencial" ? (

        <EnrollmentPresentialPanel url={presentialUrl} />

      ) : activeTab === "virtual" ? (

        <EnrollmentSharePanel url={virtualUrl} qrUrl={`/api/inscripcion-virtual/qr?token=${form.token}`} isActive={form.isActive} />

      ) : (

        <EnrollmentSubmissionsTable

          rows={form.submissions.map((submission) => ({

            id: submission.id,

            createdAt: submission.createdAt.toLocaleString("es-DO"),

            name: `${submission.firstName} ${submission.lastName}`,

            documentId: submission.documentId,

            mobilePhone: submission.mobilePhone,

            email: submission.email,

            companyName: submission.companyName,

            workplace: submission.workplace,

            employeeNumber: submission.employeeNumber,

            salaryDeductionPercent: submission.salaryDeductionPercent.toString(),

            channel: submission.channel,

            receivedPrize: submission.receivedPrize,

            prizeCode: submission.prizeCode || "",

            followUpStatus: submission.followUpStatus,

            prizeLink: submission.digitalLink ? `${baseUrl}/ruleta/digital/${submission.digitalLink.token}` : ""

          }))}

        />

      )}

    </AppShell>

  );

}

