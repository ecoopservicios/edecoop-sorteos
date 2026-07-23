"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent } from "react";

export function AuditFilters({ users }: { users: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const key of ["desde", "hasta", "usuario", "accion", "modulo", "q"]) {
      const value = String(form.get(key) || "").trim();
      if (value) params.set(key, value);
    }

    router.push(`/bitacora${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <input name="desde" type="date" defaultValue={searchParams.get("desde") || ""} className="rounded-md border border-slate-300 px-3 py-2" />
        <input name="hasta" type="date" defaultValue={searchParams.get("hasta") || ""} className="rounded-md border border-slate-300 px-3 py-2" />
        <select name="usuario" defaultValue={searchParams.get("usuario") || ""} className="rounded-md border border-slate-300 px-3 py-2">
          <option value="">Todos los usuarios</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <select name="accion" defaultValue={searchParams.get("accion") || ""} className="rounded-md border border-slate-300 px-3 py-2">
          <option value="">Todas las acciones</option>
          <option value="CREATE">Crear</option>
          <option value="UPDATE">Editar</option>
          <option value="DELETE">Eliminar</option>
          <option value="ACTIVATE">Activar</option>
          <option value="DEACTIVATE">Inactivar</option>
          <option value="RESET_PASSWORD">Resetear clave</option>
          <option value="RESET_LINK">Resetear enlace</option>
          <option value="CHANGE_PRIZE_STATUS">Cambiar estado de premio</option>
        </select>
        <select name="modulo" defaultValue={searchParams.get("modulo") || ""} className="rounded-md border border-slate-300 px-3 py-2">
          <option value="">Todos los modulos</option>
          <option value="User">Usuarios</option>
          <option value="Prize">Articulos</option>
          <option value="DigitalParticipant">Participación Virtual</option>
          <option value="DigitalLink">Enlaces Virtuales</option>
          <option value="RaffleResult">Estado de Premio</option>
        </select>
        <input name="q" defaultValue={searchParams.get("q") || ""} placeholder="Buscar motivo, registro o detalle" className="rounded-md border border-slate-300 px-3 py-2" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800">
          <Search size={17} />
          Filtrar
        </button>
        <button
          type="button"
          onClick={() => router.push("/bitacora")}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100"
        >
          <X size={17} />
          Limpiar
        </button>
      </div>
    </form>
  );
}
