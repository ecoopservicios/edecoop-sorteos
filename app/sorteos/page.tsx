import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, FileSpreadsheet, Gift, History, Trophy, UsersRound } from "lucide-react";
import { UserRole } from "@prisma/client";

import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";

const raffleSections = [
  {
    href: "/sorteos/eventos",
    title: "Otros sorteos",
    description: "Crear eventos especiales distintos de afiliacion, asociar premios, configurar zonas y consultar historicos.",
    icon: CalendarDays
  },
  {
    href: "/sorteos/participantes",
    title: "Participantes",
    description: "Cargar bases de participantes, revisar registros por evento y descargar informacion.",
    icon: UsersRound
  },
  {
    href: "/sorteos/ganadores",
    title: "Ganadores",
    description: "Preparar listados de ganadores, imagenes y PDF para publicaciones especiales.",
    icon: Trophy
  },
  {
    href: "/sorteos/historico",
    title: "Premios otorgados",
    description: "Ver el historico de premios, estados, codigos y participantes ganadores.",
    icon: History
  },
  {
    href: "/sorteos/reset",
    title: "Reset de pruebas",
    description: "Limpiar pruebas por evento antes de iniciar una jornada formal.",
    icon: FileSpreadsheet
  }
];

export default async function RafflesProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/cambiar-clave");
  if (user.role !== UserRole.ADMIN) redirect("/proyectos");

  return (
    <AppShell user={user} module="raffles">
      <section className="w-full">
        <div className="mb-8">
          <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-md bg-sky-50 text-sky-800">
            <Gift size={30} />
          </div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Proyecto</p>
          <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">Sorteos</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Gestiona eventos especiales distintos de afiliacion, bases de participantes, premios, ganadores, historicos
            y reset de pruebas.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {raffleSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group flex min-h-[190px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
              >
                <div>
                  <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
                    <Icon size={24} />
                  </div>
                  <h2 className="text-xl font-black text-slate-950">{section.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{section.description}</p>
                </div>
                <span className="mt-6 text-sm font-black text-emerald-800 group-hover:text-emerald-900">Abrir</span>
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
