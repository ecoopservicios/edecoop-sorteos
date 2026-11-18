"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, QrCode, RefreshCw, Smartphone } from "lucide-react";

type HandoffSession = { pollToken: string; qrDataUrl: string; expiresAt: string };

export function DataUpdateIdentityHandoff({ kind, verificationToken, onVerified }: {
  kind: "DOCUMENT_ID" | "EMPLOYEE_CARD";
  verificationToken: string;
  onVerified: (token: string) => void;
}) {
  const [session, setSession] = useState<HandoffSession | null>(null);
  const [status, setStatus] = useState<"CREATING" | "PENDING" | "VERIFIED" | "EXPIRED" | "ERROR">("CREATING");
  const [message, setMessage] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(600);
  const verified = useRef(false);
  const onVerifiedRef = useRef(onVerified);
  useEffect(() => { onVerifiedRef.current = onVerified; }, [onVerified]);

  const createSession = useCallback(async (signal?: AbortSignal) => {
    setStatus("CREATING"); setMessage(""); setSession(null); verified.current = false;
    try {
      const response = await fetch("/api/actualizacion-datos/handoff", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal,
        body: JSON.stringify({ kind, verificationToken })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo generar el código QR.");
      setSession(data); setStatus("PENDING");
    } catch (error) {
      if (signal?.aborted) return;
      setStatus("ERROR"); setMessage(error instanceof Error ? error.message : "No se pudo generar el código QR.");
    }
  }, [kind, verificationToken]);

  useEffect(() => {
    const controller = new AbortController();
    void createSession(controller.signal);
    return () => controller.abort();
  }, [createSession]);

  useEffect(() => {
    if (!session || status !== "PENDING") return;
    const updateTime = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / 1000)));
    updateTime();
    const timer = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(timer);
  }, [session, status]);

  useEffect(() => {
    if (!session || status !== "PENDING") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const response = await fetch("/api/actualizacion-datos/handoff/estado", {
          method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
          body: JSON.stringify({ pollToken: session.pollToken })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo consultar la validación.");
        if (cancelled) return;
        if (data.status === "VERIFIED" && typeof data.verificationToken === "string" && !verified.current) {
          verified.current = true; setStatus("VERIFIED"); onVerifiedRef.current(data.verificationToken); return;
        }
        if (data.status === "EXPIRED") { setStatus("EXPIRED"); return; }
        timer = setTimeout(poll, 1800);
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "No se pudo consultar la validación.");
        timer = setTimeout(poll, 3500);
      }
    };
    void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [session, status]);

  if (status === "CREATING") return <div role="status" className="flex min-h-64 items-center justify-center gap-3 border-y border-slate-200 text-slate-700"><LoaderCircle className="animate-spin text-emerald-700" size={24} />Generando código QR seguro...</div>;
  if (status === "VERIFIED") return <div role="status" className="border-l-4 border-emerald-600 bg-emerald-50 p-5"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={24} /><div><p className="font-black text-emerald-950">Documento validado</p><p className="mt-1 text-sm text-emerald-900">La validación se recibió desde el teléfono. Continuando automáticamente...</p></div></div></div>;
  if (status === "ERROR" || status === "EXPIRED") return <div role="alert" className="border-l-4 border-amber-500 bg-amber-50 p-5"><p className="font-black text-amber-950">{status === "EXPIRED" ? "El código QR venció" : "No pudimos generar el código QR"}</p><p className="mt-2 text-sm text-amber-900">{message || "Genera un código nuevo para continuar con la validación."}</p><button type="button" onClick={() => void createSession()} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800"><RefreshCw size={18} />Generar otro código</button></div>;

  return <div data-current-field tabIndex={-1} className="text-center">
    <div className="mx-auto flex max-w-sm items-center gap-3 border-l-4 border-emerald-600 bg-emerald-50 p-4 text-left"><Smartphone size={25} className="shrink-0 text-emerald-800" /><p className="text-sm font-medium text-emerald-950">Escanea este código con la cámara de tu teléfono. No necesitas instalar ninguna aplicación.</p></div>
    {session ? <div className="mx-auto mt-5 w-full max-w-[290px] border border-slate-300 bg-white p-3"><img src={session.qrDataUrl} alt="Código QR temporal para validar el documento desde el teléfono" className="h-auto w-full" /></div> : null}
    <div className="mt-4 flex items-center justify-center gap-2 font-bold text-slate-900"><QrCode size={19} />Esperando validación desde el teléfono</div>
    <p className="mt-2 text-sm tabular-nums text-slate-600">Este código vence en {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</p>
    {message ? <p role="status" className="mt-3 text-sm text-amber-800">{message}</p> : null}
  </div>;
}
