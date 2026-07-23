"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent } from "react";

export function HistoryFilters({
  prizes,
  promoters,
  events
}: {
  prizes: Array<{ id: string; name: string }>;
  promoters: Array<{ id: string; name: string }>;
  events: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const key of ["desde", "hasta", "tipo", "estado", "evento", "premio", "promotora", "q"]) {
      const value = String(form.get(key) || "").trim();
      if (value) params.set(key, value);
    }

    router.push(`/historico${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input name="desde" type="date" defaultValue={searchParams.get("desde") || ""} className="rounded-md border border-slate-300 px-3 py-2" />
        <input name="hasta" type="date" defaultValue={searchParams.get("hasta") || ""} className="rounded-md border border-slate-300 px-3 py-2" />
        <select name="tipo" defaultValue={searchParams.get("tipo") || ""} className="rounded-md border border-slate-300 px-3 py-2">
          <option value="">Todos los tipos</option>
          <option value="presencial">Presencial</option>
          <option value="virtual">Virtual</option>
        </select>
        <select name="estado" defaultValue={searchParams.get("estado") || ""} className="rounded-md border border-slate-300 px-3 py-2">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="enviado">Enviado</option>
          <option value="entregado">Entregado</option>
        </select>
        <select name="evento" defaultValue={searchParams.get("evento") || ""} className="rounded-md border border-slate-300 px-3 py-2">
          <option value="">Todos los eventos</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
        <select name="premio" defaultValue={searchParams.get("premio") || ""} className="rounded-md border border-slate-300 px-3 py-2">
          <option value="">Todos los premios</option>
          {prizes.map((prize) => (
            <option key={prize.id} value={prize.id}>
              {prize.name}
            </option>
          ))}
        </select>
        <select name="promotora" defaultValue={searchParams.get("promotora") || ""} className="rounded-md border border-slate-300 px-3 py-2">
          <option value="">Todas las promotoras</option>
          {promoters.map((promoter) => (
            <option key={promoter.id} value={promoter.id}>
              {promoter.name}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={searchParams.get("q") || ""}
          placeholder="Código, nombre, NIE, celular"
          className="rounded-md border border-slate-300 px-3 py-2 xl:col-span-2"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800">
          <Search size={17} />
          Filtrar
        </button>
        <button
          type="button"
          onClick={() => router.push("/historico")}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100"
        >
          <X size={17} />
          Limpiar
        </button>
      </div>
    </form>
  );
}
