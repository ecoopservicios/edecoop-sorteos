import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardPenLine, RefreshCw } from "lucide-react";
import { UserRole } from "@prisma/client";

import { LogoutButton } from "@/components/logout-button";
import { getCurrentUser } from "@/lib/auth";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = user.role === UserRole.ADMIN;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">EDECOOP</p>
          <p className="truncate text-sm font-semibold text-slate-600">{user.name}</p>
        </div>
        <LogoutButton />
      </div>

      <section className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-5xl flex-col justify-center">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">EDECOOP</p>
          <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">Selecciona un proyecto</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Accede al modulo de afiliacion o al modulo de actualizacion de datos desde una sola plataforma.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Link
            href="/dashboard"
            className="group flex min-h-[230px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
          >
            <div>
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
                <ClipboardPenLine size={26} />
              </div>
              <h2 className="text-2xl font-black text-slate-950">Afiliacion</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Gestiona sorteos instantaneos, formularios de afiliacion, premios, historicos, eventos y participantes.
              </p>
            </div>
            <span className="mt-6 text-sm font-black text-emerald-800 group-hover:text-emerald-900">Entrar a afiliacion</span>
          </Link>

          {isAdmin ? (
            <Link
              href="/actualizacion-datos"
              className="group flex min-h-[230px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
            >
              <div>
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                  <RefreshCw size={26} />
                </div>
                <h2 className="text-2xl font-black text-slate-950">Actualizacion de datos</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Administra la base de socios, configuracion por empresa y solicitudes de actualizacion recibidas.
                </p>
              </div>
              <span className="mt-6 text-sm font-black text-emerald-800 group-hover:text-emerald-900">
                Entrar a actualizacion
              </span>
            </Link>
          ) : (
            <div className="flex min-h-[230px] flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-6 opacity-80">
              <div>
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                  <RefreshCw size={26} />
                </div>
                <h2 className="text-2xl font-black text-slate-500">Actualizacion de datos</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Este proyecto esta disponible solo para usuarios administradores.
                </p>
              </div>
              <span className="mt-6 text-sm font-black text-slate-500">Acceso restringido</span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
