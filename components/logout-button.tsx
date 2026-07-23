"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { notify } from "@/lib/toast";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    notify("Sesion cerrada.", "info");
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
      title="Cerrar sesion"
    >
      <LogOut size={16} />
      <span>Salir</span>
    </button>
  );
}
