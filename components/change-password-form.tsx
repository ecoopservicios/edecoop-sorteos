"use client";

import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { notify } from "@/lib/toast";

export function ChangePasswordForm({
  mustChangePassword,
  email
}: {
  mustChangePassword: boolean;
  email: string;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: String(form.get("currentPassword") || ""),
        newPassword: String(form.get("newPassword") || ""),
        confirmPassword: String(form.get("confirmPassword") || "")
      })
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "No se pudo cambiar la contraseña.");
      notify(data.error || "No se pudo cambiar la contraseña.", "error");
      return;
    }

    notify("Contraseña actualizada correctamente.", "success");
    window.location.assign("/proyectos");
  }

  return (
    <form
      onSubmit={submit}
      autoComplete="on"
      className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">EDECOOP</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950">Cambiar contraseña</h1>
        <p className="mt-2 text-sm text-slate-600">
          {mustChangePassword ? "Debes cambiar la clave temporal antes de continuar." : "Actualiza tu contraseña."}
        </p>
      </div>
      <input type="email" name="username" autoComplete="username" defaultValue={email} className="hidden" readOnly />
      {!mustChangePassword ? (
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Contraseña actual</span>
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      ) : null}
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Nueva contraseña</span>
        <input
          name="newPassword"
          required
          minLength={8}
          type="password"
          autoComplete="new-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Confirmar contraseña</span>
        <input
          name="confirmPassword"
          required
          minLength={8}
          type="password"
          autoComplete="new-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <button
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        <KeyRound size={18} />
        {loading ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}
