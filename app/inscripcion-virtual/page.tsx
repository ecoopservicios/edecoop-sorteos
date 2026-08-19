import Link from "next/link";

import { redirect } from "next/navigation";

import { UserRole } from "@prisma/client";

import { AppShell } from "@/components/app-shell";

import { EnrollmentFormConfig } from "@/components/enrollment-form-config";

import { EnrollmentBulkUpload } from "@/components/enrollment-bulk-upload";

import { EnrollmentSharePanel } from "@/components/enrollment-share-panel";

import { EnrollmentSubmissionsTable } from "@/components/enrollment-submissions-table";

import { DigitalLinksTable } from "@/components/digital-links-table";

import { getCurrentUser } from "@/lib/auth";

import { DEFAULT_ENROLLMENT_TEXT } from "@/lib/enrollment";

import { ensureEnrollmentForm } from "@/lib/enrollment-server";

import { prisma } from "@/lib/db";

import { buildWhatsappUrl } from "@/lib/whatsapp";



export default async function EnrollmentAdminPage({

  searchParams

}: {

  searchParams: Promise<{ tab?: string }>;

}) {

  const user = await getCurrentUser();

  if (!user) redirect("/login");

  const isAdmin = user.role === UserRole.ADMIN;



  const { tab } = await searchParams;

  if (tab === "virtual" || tab === "presencial") redirect("/inscripcion-virtual?tab=digital");
  if (!isAdmin && tab !== "digital") redirect("/inscripcion-virtual?tab=digital");

  const activeTab = tab === "digital" || tab === "respuestas" || tab === "premios" ? tab : "formulario";

  const form = await ensureEnrollmentForm(user.id);
  const digitalLinks =
    isAdmin && activeTab === "premios"
      ? await prisma.digitalLink.findMany({
          where: {
            participant: {
              deletedAt: null
            },
            enrollmentSubmissions: {
              some: {
                deletedAt: null
              }
            }
          },
          include: {
            participant: true,
            result: true,
            enrollmentSubmissions: {
              where: { deletedAt: null },
              include: {
                eventEdition: {
                  select: { displayName: true }
                }
              },
              orderBy: { createdAt: "desc" },
              take: 1
            }
          },
          orderBy: { createdAt: "desc" },
          take: 100
        })
      : [];



  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3002";

  const virtualUrl = `${baseUrl}/inscripcion/${form.token}`;

  const adminTabs = [

    { href: "/inscripcion-virtual", label: "Formulario de Afiliación", key: "formulario" },

    { href: "/inscripcion-virtual?tab=digital", label: "Afiliación Digital", key: "digital" },

    { href: "/inscripcion-virtual?tab=premios", label: "Premios Instantáneos", key: "premios" },

    { href: "/inscripcion-virtual?tab=respuestas", label: "Solicitudes Recibidas", key: "respuestas" }

  ];

  const promoterTabs = [{ href: "/inscripcion-virtual?tab=digital", label: "Afiliación Digital", key: "digital" }];

  const tabs = isAdmin ? adminTabs : promoterTabs;



  return (

    <AppShell user={user}>

      <div className="mb-6">

        <h1 className="text-2xl font-black text-slate-950">Formularios de Afiliación</h1>

        <p className="text-slate-600">Gestiona el formulario único de afiliación digital, premios instantáneos y solicitudes recibidas.</p>

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

        </>

      ) : activeTab === "digital" ? (

        <div className="grid gap-4">
          <EnrollmentSharePanel url={virtualUrl} qrUrl={`/api/inscripcion-virtual/qr?token=${form.token}`} isActive={form.isActive} />
          <EnrollmentBulkUpload />
        </div>

      ) : activeTab === "premios" ? (

        <DigitalLinksTable
          rows={digitalLinks.map((link) => {
            const url = `${baseUrl}/ruleta/digital/${link.token}`;
            const submission = link.enrollmentSubmissions[0] || null;
            return {
              id: link.id,
              token: link.token,
              status: link.status,
              createdAt: link.createdAt.toISOString(),
              sourceChannel: submission?.channel || "",
              sourceEventName: submission?.eventEdition?.displayName || "",
              participant: {
                id: link.participant.id,
                firstName: link.participant.firstName,
                lastName: link.participant.lastName,
                nie: link.participant.nie,
                email: link.participant.email,
                phone: link.participant.phone,
                name: link.participant.name
              },
              result: link.result
                ? {
                    code: link.result.code,
                    prizeName: link.result.prizeName
                  }
                : null,
              url,
              whatsappUrl: buildWhatsappUrl(link.participant.phone, url)
            };
          })}
        />

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
