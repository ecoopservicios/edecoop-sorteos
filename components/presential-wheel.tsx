"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, RotateCw } from "lucide-react";
import { notify } from "@/lib/toast";

type Result = {
  id: string;
  code: string;
  participantName: string;
  participantNie?: string | null;
  prizeName: string;
  eventName?: string | null;
  status?: string;
  statusLabel?: string;
};

type EventOption = {
  id: string;
  name: string;
  typeName: string;
  typeCode: string;
};

export function PresentialWheel({ events }: { events: EventOption[] }) {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [spinKey, setSpinKey] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [eventEditionId, setEventEditionId] = useState(events[0]?.id || "");
  const selectedEvent = events.find((event) => event.id === eventEditionId);
  const isFinalEvent = selectedEvent?.typeCode === "AFFILIATION_FINAL";

  useEffect(() => {
    if (!result) return;
    const timeout = window.setTimeout(() => {
      setResult(null);
      setStatusMessage("");
      setError("");
    }, 60000);

    return () => window.clearTimeout(timeout);
  }, [result]);

  async function spin() {
    setLoading(true);
    setError("");
    setStatusMessage("");
    setResult(null);
    setSpinKey((value) => value + 1);

    const response = await fetch(isFinalEvent ? "/api/sorteos/final" : "/api/sorteos/presencial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isFinalEvent ? { eventEditionId } : { playWithoutRegistration: true, eventEditionId: eventEditionId || undefined })
    });
    const data = await response.json();

    setTimeout(() => {
      setLoading(false);
      if (!response.ok) {
        setError(data.error || "No se pudo realizar el sorteo.");
        notify(data.error || "No se pudo realizar el sorteo.", "error");
        return;
      }
      setResult(data.result);
    }, 2100);
  }

  async function updatePrizeStatus(status: "PENDING" | "DELIVERED") {
    if (!result) return;
    setStatusMessage("");
    const response = await fetch(`/api/resultados/${result.id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    if (!response.ok) {
      setStatusMessage(data.error || "No se pudo actualizar el estado.");
      notify(data.error || "No se pudo actualizar el estado.", "error");
      return;
    }
    setResult({
      ...result,
      status,
      statusLabel: status === "DELIVERED" ? "Entregado" : "Pendiente"
    });
    setStatusMessage(status === "DELIVERED" ? "Premio marcado como entregado." : "Premio marcado como pendiente de entrega.");
    notify(status === "DELIVERED" ? "Premio marcado como entregado." : "Premio marcado como pendiente de entrega.", "success");
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(280px,420px)_1fr] lg:items-center">
      <div className="mx-auto w-full max-w-[420px]">
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Evento de trabajo</span>
          <select
            value={eventEditionId}
            onChange={(event) => setEventEditionId(event.currentTarget.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            {events.length ? null : <option value="">No hay eventos activos con premios</option>}
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mb-4 rounded-md bg-emerald-50 p-3 text-center">
          <p className="text-sm font-bold text-emerald-800">Premios</p>
          <p className="text-lg font-black text-emerald-950">{selectedEvent ? selectedEvent.name : "Sin evento seleccionado"}</p>
        </div>
        <div className="relative aspect-square">
          <div className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-l-[16px] border-r-[16px] border-t-[34px] border-l-transparent border-r-transparent border-t-slate-950" />
          <div
            key={spinKey}
            className={`wheel h-full w-full rounded-full border-[12px] border-white shadow-xl ${loading ? "spin" : ""}`}
          />
          <div className="absolute inset-[34%] rounded-full border-8 border-white bg-slate-950 shadow-lg" />
        </div>
        <button
          onClick={spin}
          disabled={loading || !eventEditionId}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-4 text-lg font-black text-white hover:bg-emerald-800 disabled:opacity-70"
        >
          <RotateCw size={22} />
          {loading ? (isFinalEvent ? "Eligiendo..." : "Girando...") : isFinalEvent ? "Elegir ganador" : "Girar ruleta"}
        </button>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Resultado</p>
        {error ? <p className="mt-4 rounded-md bg-red-50 p-3 font-semibold text-red-700">{error}</p> : null}
        {result ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Participante</p>
              <p className="text-2xl font-black text-slate-950">{result.participantName}</p>
            </div>
            {result.participantNie ? (
              <div>
                <p className="text-sm font-semibold text-slate-500">NIE</p>
                <p className="text-2xl font-black text-slate-950">{result.participantNie}</p>
              </div>
            ) : null}
            <div>
              <p className="text-sm font-semibold text-slate-500">Premio ganado</p>
              <p className="text-3xl font-black text-emerald-800">{result.prizeName}</p>
            </div>
            <div className="rounded-md bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">Código único</p>
              <p className="break-all text-2xl font-black text-amber-950">{result.code}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-500">Estado del premio</p>
              <p className="mt-1 text-lg font-black text-slate-950">{result.statusLabel || "Pendiente"}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => updatePrizeStatus("DELIVERED")}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800"
                >
                  <CheckCircle2 size={18} />
                  Entregado
                </button>
                <button
                  onClick={() => updatePrizeStatus("PENDING")}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-100"
                >
                  <Clock size={18} />
                  Pendiente de entrega
                </button>
              </div>
              {statusMessage ? <p className="mt-3 text-sm font-semibold text-emerald-800">{statusMessage}</p> : null}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-slate-600">El resultado aparecera aqui despues del giro.</p>
        )}
      </div>
    </section>
  );
}
