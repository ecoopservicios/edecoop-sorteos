"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { notify } from "@/lib/toast";

export function UserForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const response = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        role: form.get("role")
      })
    });

    setLoading(false);
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "No se pudo crear el usuario.");
      notify(data.error || "No se pudo crear el usuario.", "error");
      return;
    }

    formElement.reset();
    notify("Usuario creado con clave temporal 123456789.", "success");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-black text-slate-950">Nuevo usuario</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="name" required placeholder="Nombre" className="rounded-md border border-slate-300 px-3 py-2" />
        <input name="email" required type="email" placeholder="Correo" className="rounded-md border border-slate-300 px-3 py-2" />
        <select name="role" className="rounded-md border border-slate-300 px-3 py-2">
          <option value="PROMOTER">Promotora</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </div>
      <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
        La clave temporal por defecto es 123456789 y el usuario debera cambiarla al primer acceso.
      </p>
      {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white">
        <UserPlus size={17} />
        {loading ? "Guardando..." : "Crear usuario"}
      </button>
    </form>
  );
}
