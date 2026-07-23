"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { notify } from "@/lib/toast";

export function PrizeForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const response = await fetch("/api/premios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        availableQuantity: Number(form.get("availableQuantity")),
        isActive: true
      })
    });

    setLoading(false);
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "No se pudo crear el premio.");
      notify(data.error || "No se pudo crear el premio.", "error");
      return;
    }

    formElement.reset();
    notify("Premio creado correctamente.", "success");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-black text-slate-950">Nuevo articulo</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="name" required placeholder="Nombre del premio" className="rounded-md border border-slate-300 px-3 py-2" />
        <input name="availableQuantity" required min="0" type="number" placeholder="Disponibilidad" className="rounded-md border border-slate-300 px-3 py-2" />
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white">
        <Plus size={17} />
        {loading ? "Guardando..." : "Crear premio"}
      </button>
    </form>
  );
}
