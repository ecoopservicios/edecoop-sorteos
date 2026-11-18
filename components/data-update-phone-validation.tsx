"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import { IdentityDocumentCapture } from "@/components/identity-document-capture";

type Session = { status: "PENDING"; kind: "DOCUMENT_ID" | "EMPLOYEE_CARD"; expiresAt: string };

export function DataUpdatePhoneValidation({ token }: { token: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/actualizacion-datos/handoff/${encodeURIComponent(token)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (data.status === "VERIFIED") { setDone(true); return; }
        if (!response.ok) throw new Error(data.error || "El código QR venció o no es válido.");
        setSession(data);
      })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudo abrir la validación."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);

  if (loading) return <PhoneShell><div role="status" className="flex min-h-72 items-center justify-center gap-3 text-slate-700"><LoaderCircle size={25} className="animate-spin text-emerald-700" />Preparando validación...</div></PhoneShell>;
  if (done) return <PhoneShell><div className="px-5 py-12 text-center sm:px-8"><CheckCircle2 size={52} className="mx-auto text-emerald-700" /><h1 className="mt-5 text-2xl font-black text-slate-950">Documento validado</h1><p className="mt-3 leading-relaxed text-slate-600">Puedes volver a la computadora. El formulario continuará automáticamente.</p></div></PhoneShell>;
  if (error || !session) return <PhoneShell><div role="alert" className="px-5 py-12 text-center sm:px-8"><TriangleAlert size={48} className="mx-auto text-amber-600" /><h1 className="mt-5 text-2xl font-black text-slate-950">No pudimos abrir la validación</h1><p className="mt-3 leading-relaxed text-slate-600">{error || "Genera un código QR nuevo desde la computadora."}</p></div></PhoneShell>;

  return <PhoneShell>
    <div className="px-5 py-6 sm:px-8">
      <h1 className="text-xl font-black text-slate-950">Valida tu {session.kind === "EMPLOYEE_CARD" ? "carnet de empleado" : "cédula dominicana"}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">Toma la fotografía desde este teléfono. Cuando el documento sea confirmado, la computadora continuará automáticamente.</p>
      <div className="mt-6"><IdentityDocumentCapture kind={session.kind} handoffToken={token} verified={false} onVerified={() => setDone(true)} /></div>
    </div>
  </PhoneShell>;
}

function PhoneShell({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><header className="flex items-center gap-4 border-b border-slate-200 px-5 py-4"><img src="/edecoop-logo.png" alt="EDECOOP" className="h-auto w-16" /><p className="font-black text-slate-950">Validación de identidad</p></header>{children}</section>;
}
