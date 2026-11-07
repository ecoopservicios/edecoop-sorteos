"use client";

import { useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";

export function DataUpdateEmailVerification({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submitted = useRef(false);

  async function verify() {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/actualizacion-datos/validar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo validar el registro.");
      setMessage(data.message);
    } catch (failure) {
      submitted.current = false;
      setError(failure instanceof Error ? failure.message : "No se pudo validar el registro.");
    } finally {
      setBusy(false);
    }
  }

  if (message) return <div className="text-center"><CheckCircle2 size={52} className="mx-auto text-emerald-700" /><h1 className="mt-5 text-2xl font-black text-slate-950">Registro validado</h1><p role="status" className="mt-3 text-slate-600">{message}</p></div>;
  return <div className="text-center"><ShieldCheck size={52} className="mx-auto text-emerald-700" /><h1 className="mt-5 text-2xl font-black text-slate-950">Valida tu actualización</h1><p className="mt-3 leading-7 text-slate-600">Presiona el botón para confirmar que este correo te pertenece y validar tu registro.</p><button type="button" onClick={verify} disabled={busy} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{busy ? <LoaderCircle size={19} className="animate-spin" /> : <ShieldCheck size={19} />}{busy ? "Validando..." : "Validar mi registro"}</button>{error ? <p role="alert" className="mt-5 border-l-4 border-red-500 bg-red-50 p-3 text-left text-sm font-medium text-red-800">{error}</p> : null}</div>;
}
