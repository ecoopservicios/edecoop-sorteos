import { redirect } from "next/navigation";

import { UserRole } from "@prisma/client";

import { AppShell } from "@/components/app-shell";

import { DigitalLinksTable } from "@/components/digital-links-table";

import { getCurrentUser } from "@/lib/auth";

import { prisma } from "@/lib/db";

import { buildWhatsappUrl } from "@/lib/whatsapp";



export default async function DigitalParticipationPage() {

  const user = await getCurrentUser();

  if (!user) redirect("/login");

  if (user.role !== UserRole.ADMIN) redirect("/ruleta/presencial");



  const links = await prisma.digitalLink.findMany({

    where: {

      participant: {

        deletedAt: null

      }

    },

    include: {

      participant: true,

      result: true

    },

    orderBy: { createdAt: "desc" },

    take: 100

  });

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3002";

  const rows = links.map((link) => {

    const url = `${baseUrl}/ruleta/digital/${link.token}`;

    return {

      id: link.id,

      token: link.token,

      status: link.status,

      createdAt: link.createdAt.toISOString(),

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

  });



  return (

    <AppShell user={user}>

      <div className="mb-6">

        <h1 className="text-2xl font-black text-slate-950">Participación Virtual</h1>

        <p className="text-slate-600">

          Administra los enlaces generados desde afiliaciones presenciales masivas para quienes no recibieron premio.

        </p>

      </div>

      <DigitalLinksTable rows={rows} />

    </AppShell>

  );

}

