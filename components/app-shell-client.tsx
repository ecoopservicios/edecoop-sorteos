"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardPenLine,
  Gift,
  PackageCheck,
  PanelsTopLeft,
  RefreshCw,
  Settings,
  Trophy,
  WalletCards
} from "lucide-react";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/logout-button";

type ShellRole = "ADMIN" | "PROMOTER";

const adminItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/ruleta/presencial", label: "Participacion Presencial", icon: Gift },
  { href: "/premios", label: "Eventos", icon: WalletCards },
  { href: "/historico", label: "Premios Otorgados", icon: PackageCheck },
  { href: "/inscripcion-virtual", label: "Formularios de Afiliacion", icon: ClipboardPenLine },
  { href: "/ganadores", label: "Ganadores", icon: Trophy },
  { href: "/configuracion", label: "Configuracion", icon: Settings }
];

const promoterItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/ruleta/presencial", label: "Participacion Presencial", icon: Gift },
  { href: "/inscripcion-virtual?tab=digital", label: "Afiliacion Digital", icon: ClipboardPenLine },
  { href: "/historico", label: "Premios Otorgados", icon: PackageCheck }
];

const dataUpdateItems = [{ href: "/actualizacion-datos", label: "Actualizacion de Datos", icon: RefreshCw }];

function isActive(pathname: string, href: string) {
  const baseHref = href.split("?")[0];
  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

export function AppShellClient({
  user,
  module = "affiliation",
  children
}: {
  user: { name: string; role: ShellRole };
  module?: "affiliation" | "data-update";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const items = module === "data-update" ? dataUpdateItems : user.role === "ADMIN" ? adminItems : promoterItems;
  const appTitle = module === "data-update" ? "Actualizacion de datos" : "Sorteos instantaneos";

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 px-3 py-3 sm:px-5 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">EDECOOP</p>
            <h1 className="truncate text-base font-black text-slate-900 sm:text-lg">{appTitle}</h1>
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 lg:flex">
            <nav className="flex max-w-full flex-wrap items-center justify-end gap-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-bold transition xl:px-3 xl:text-sm ${
                      active ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 xl:h-[18px] xl:w-[18px]" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <Link
              href="/proyectos"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:text-emerald-800 xl:px-3 xl:text-sm"
              title="Cambiar proyecto"
            >
              <PanelsTopLeft className="h-4 w-4 shrink-0 xl:h-[18px] xl:w-[18px]" />
              <span className="hidden whitespace-nowrap xl:inline">Cambiar proyecto</span>
            </Link>

            <div className="hidden shrink-0 border-l border-slate-200 pl-3 xl:block">
              <p className="max-w-[150px] truncate text-right text-xs font-semibold text-slate-800">{user.name}</p>
              <p className="text-right text-[11px] text-slate-500">{user.role === "ADMIN" ? "Administrador" : "Promotora"}</p>
            </div>

            <div className="shrink-0">
              <LogoutButton />
            </div>
          </div>

          <button
            type="button"
            aria-label={mobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:bg-slate-50 lg:hidden"
          >
            <span className="sr-only">{mobileMenuOpen ? "Cerrar menu" : "Abrir menu"}</span>
            <span className="relative h-5 w-6">
              <span
                className={`absolute left-0 top-0 h-0.5 w-6 rounded-full bg-slate-900 transition duration-300 ${
                  mobileMenuOpen ? "translate-y-2 rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-2 h-0.5 w-6 rounded-full bg-slate-900 transition duration-200 ${
                  mobileMenuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 top-4 h-0.5 w-6 rounded-full bg-slate-900 transition duration-300 ${
                  mobileMenuOpen ? "-translate-y-2 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 top-[68px] z-50 bg-slate-950/25 transition-opacity duration-300 lg:hidden ${
          mobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <div
        className={`fixed inset-x-3 top-[76px] z-50 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl transition duration-300 lg:hidden ${
          mobileMenuOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
        }`}
      >
        <nav className="grid gap-1 p-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold transition ${
                  active ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50 hover:text-emerald-800"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <Link
            href="/proyectos"
            className="mb-2 inline-flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-emerald-800"
          >
            <PanelsTopLeft className="h-[18px] w-[18px] shrink-0" />
            <span>Cambiar proyecto</span>
          </Link>
          <p className="mb-2 text-xs font-semibold text-slate-500">{user.name}</p>
          <LogoutButton />
        </div>
      </div>

      <main className="mx-auto min-w-0 max-w-[1680px] px-3 py-4 sm:px-5 sm:py-5 lg:px-8">{children}</main>
    </div>
  );
}
