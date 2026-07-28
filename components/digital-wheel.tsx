"use client";

import { useState } from "react";
import { DoorClosed, Download, FilePlus2, RotateCw } from "lucide-react";
import { notify } from "@/lib/toast";

type DigitalState = {
  token: string;
  status: string;
  participantName: string;
  downloadUrl?: string | null;
  eventName?: string | null;
  result: null | {
    code: string;
    prizeName: string;
    participantName: string;
    eventName?: string | null;
  };
};

export function DigitalWheel({ initialLink, enrollmentUrl }: { initialLink: DigitalState; enrollmentUrl?: string | null }) {
  const [link, setLink] = useState(initialLink);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [spinKey, setSpinKey] = useState(0);
  const [closed, setClosed] = useState(false);

  async function spin() {
    setLoading(true);
    setError("");
    setSpinKey((value) => value + 1);

    const response = await fetch("/api/sorteos/digital", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: link.token })
    });
    const data = await response.json();

    setTimeout(() => {
      setLoading(false);
      if (!response.ok) {
        setError(data.error || "No se pudo realizar el sorteo.");
        notify(data.error || "No se pudo realizar el sorteo.", "error");
        return;
      }
      setLink({
        ...link,
        status: "USED",
        result: {
          code: data.result.code,
          prizeName: data.result.prizeName,
          participantName: data.result.participantName,
          eventName: data.result.eventName
        }
      });
    }, 2100);
  }

  function closeWindow() {
    setClosed(true);
  }

  const used = link.status !== "PENDING" || Boolean(link.result);

  if (closed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
        <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <img src="/edecoop-logo.png" alt="EDECOOP" className="mx-auto mb-5 h-auto w-44" />
          <h1 className="text-2xl font-black text-slate-950">Gracias por ser parte de EDECOOP</h1>
          <p className="mt-3 text-slate-600">Su participación fue registrada correctamente.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-6">
      <section className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(280px,420px)_1fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">EDECOOP</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">Sorteo instantáneo</h1>
          {link.eventName ? (
            <div className="mt-3 rounded-md bg-emerald-50 p-3">
              <p className="text-sm font-bold text-emerald-800">Premios</p>
              <p className="text-lg font-black text-emerald-950">{link.eventName}</p>
            </div>
          ) : null}
          <p className="mt-2 text-slate-600">{link.participantName}, gira una sola vez para conocer tu premio.</p>
          <div className="relative mx-auto mt-6 aspect-square max-w-[420px]">
            <div className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-l-[16px] border-r-[16px] border-t-[34px] border-l-transparent border-r-transparent border-t-slate-950" />
            <div
              key={spinKey}
              className={`wheel h-full w-full rounded-full border-[12px] border-white shadow-xl ${loading ? "spin" : ""}`}
            />
            <div className="absolute inset-[34%] rounded-full border-8 border-white bg-slate-950 shadow-lg" />
          </div>
          <button
            onClick={() => {
              if (used) {
                notify("Esta participación ya fue registrada.", "warning");
                return;
              }
              spin();
            }}
            disabled={loading || used}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-4 text-lg font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCw size={22} />
            {used ? "Participación registrada" : loading ? "Girando..." : "Girar ruleta"}
          </button>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Resultado</p>
          {error ? <p className="mt-4 rounded-md bg-red-50 p-3 font-semibold text-red-700">{error}</p> : null}
          {link.result ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">Participante</p>
                <p className="text-2xl font-black text-slate-950">{link.result.participantName}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Premio ganado</p>
                <p className="text-3xl font-black text-emerald-800">{link.result.prizeName}</p>
              </div>
              <div className="rounded-md bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">Código único</p>
                <p className="break-all text-2xl font-black text-amber-950">{link.result.code}</p>
              </div>
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                {link.downloadUrl ? (
                  <a
                    href={link.downloadUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 font-bold text-amber-900 hover:bg-amber-100"
                  >
                    <Download size={18} />
                    Descargar constancia
                  </a>
                ) : null}
                {enrollmentUrl ? (
                  <a
                    href={enrollmentUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800"
                  >
                    <FilePlus2 size={18} />
                    Completar Nueva Solicitud de Afiliación
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={closeWindow}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-100"
                >
                  <DoorClosed size={18} />
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-slate-600">Tu premio aparecera aqui despues del giro.</p>
          )}
        </div>
      </section>
    </main>
  );
}
