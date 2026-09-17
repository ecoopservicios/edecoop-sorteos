"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, RotateCw, X } from "lucide-react";
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
  participantCompany?: string | null;
  participantLookupLabel?: string | null;
};

type EventOption = {
  id: string;
  name: string;
  typeName: string;
  typeCode: string;
};

type CompanyOption = {
  id: string;
  name: string;
  lookupField: "DOCUMENT_ID" | "EMPLOYEE_NUMBER" | null;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function lookupLabel(lookupField?: CompanyOption["lookupField"]) {
  return lookupField === "DOCUMENT_ID" ? "Cedula" : lookupField === "EMPLOYEE_NUMBER" ? "Numero de empleado" : "Identificacion";
}

export function PresentialWheel({ events, companies }: { events: EventOption[]; companies: CompanyOption[] }) {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [spinKey, setSpinKey] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [eventEditionId, setEventEditionId] = useState(events[0]?.id || "");
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [lookupValue, setLookupValue] = useState("");
  const [identityError, setIdentityError] = useState("");
  const [lookupStatus, setLookupStatus] = useState<"idle" | "checking" | "available" | "duplicate">("idle");
  const [lookupMessage, setLookupMessage] = useState("");
  const selectedEvent = events.find((event) => event.id === eventEditionId);
  const isFinalEvent = selectedEvent?.typeCode === "AFFILIATION_FINAL";
  const requiresIdentity = selectedEvent?.typeCode === "AFFILIATION_INSTANT";
  const selectedCompany = companies.find((company) => company.id === companyId);
  const selectedLookupField = selectedCompany?.lookupField || null;
  const currentLookupLabel = lookupLabel(selectedLookupField);

  function resetIdentityForm() {
    setCompanyId("");
    setLookupValue("");
    setIdentityError("");
    setLookupStatus("idle");
    setLookupMessage("");
  }

  useEffect(() => {
    if (!result) return;
    const timeout = window.setTimeout(() => {
      setResult(null);
      setStatusMessage("");
      setError("");
    }, 60000);

    return () => window.clearTimeout(timeout);
  }, [result]);

  useEffect(() => {
    setLookupStatus("idle");
    setLookupMessage("");
    if (!showIdentityModal || !eventEditionId || !selectedCompany || !selectedLookupField) return;

    const digits = onlyDigits(lookupValue);
    const complete =
      selectedLookupField === "DOCUMENT_ID" ? digits.length === 11 : Boolean(digits) && digits.length <= 5;
    if (!complete) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLookupStatus("checking");
      setLookupMessage("Validando participante...");
      const response = await fetch("/api/sorteos/presencial/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          eventEditionId,
          companyName: selectedCompany.name,
          lookupField: selectedLookupField,
          lookupValue: digits
        })
      }).catch(() => null);

      if (!response) return;
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLookupStatus("duplicate");
        setLookupMessage(data.error || "No se pudo validar el participante.");
        return;
      }
      setLookupStatus(data.exists ? "duplicate" : "available");
      setLookupMessage(data.message || (data.exists ? "Esta persona ya participo." : "Participante disponible para girar."));
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [eventEditionId, lookupValue, selectedCompany, selectedLookupField, showIdentityModal]);

  function requestSpin() {
    if (requiresIdentity) {
      resetIdentityForm();
      setShowIdentityModal(true);
      return;
    }
    void spin();
  }

  function validateIdentity() {
    if (!selectedCompany) return "Debe seleccionar la empresa.";
    if (!selectedLookupField) return "Esta empresa no tiene configurado el dato de identificacion para validar participantes.";

    const digits = onlyDigits(lookupValue);
    if (selectedLookupField === "DOCUMENT_ID" && digits.length !== 11) return "La cedula debe contener exactamente 11 numeros.";
    if (selectedLookupField === "EMPLOYEE_NUMBER" && (!digits || digits.length > 5)) return "El numero de empleado debe contener maximo 5 numeros.";
    return "";
  }

  async function spin(identity?: { companyName: string; lookupField: "DOCUMENT_ID" | "EMPLOYEE_NUMBER"; lookupValue: string }) {
    setLoading(true);
    setError("");
    setStatusMessage("");
    setResult(null);
    setSpinKey((value) => value + 1);

    const response = await fetch(isFinalEvent ? "/api/sorteos/final" : "/api/sorteos/presencial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isFinalEvent
          ? { eventEditionId }
          : {
              playWithoutRegistration: true,
              eventEditionId: eventEditionId || undefined,
              ...(identity || {})
            }
      )
    });
    const data = await response.json();

    setTimeout(() => {
      setLoading(false);
      if (!response.ok) {
        setError(data.error || "No se pudo realizar el sorteo.");
        notify(data.error || "No se pudo realizar el sorteo.", "error");
        return;
      }
      setResult({
        ...data.result,
        participantCompany: identity?.companyName || null,
        participantLookupLabel: identity?.lookupField ? lookupLabel(identity.lookupField) : null
      });
      if (identity) resetIdentityForm();
    }, 2100);
  }

  function submitIdentity() {
    const message = validateIdentity();
    if (message) {
      setIdentityError(message);
      notify(message, "warning");
      return;
    }
    if (lookupStatus === "duplicate") {
      setIdentityError(lookupMessage || "Esta persona ya participo en esta jornada.");
      notify(lookupMessage || "Esta persona ya participo en esta jornada.", "warning");
      return;
    }
    if (!selectedCompany || !selectedLookupField) return;
    setShowIdentityModal(false);
    void spin({
      companyName: selectedCompany.name,
      lookupField: selectedLookupField,
      lookupValue: onlyDigits(lookupValue)
    });
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
          onClick={requestSpin}
          disabled={loading || !eventEditionId}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-4 text-lg font-black text-white hover:bg-emerald-800 disabled:opacity-70"
        >
          <RotateCw size={22} />
          {loading ? (isFinalEvent ? "Eligiendo..." : "Girando...") : isFinalEvent ? "Elegir ganador" : "Girar ruleta"}
        </button>
      </div>
      {showIdentityModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-950">Validar participante</h3>
                <p className="text-sm text-slate-600">Requerido solo para premio instantaneo de afiliacion.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowIdentityModal(false);
                  resetIdentityForm();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                title="Cerrar"
              >
                <X size={17} />
              </button>
            </div>
            <div className="grid gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Empresa</span>
                <select
                  value={companyId}
                  onChange={(event) => {
                    setCompanyId(event.currentTarget.value);
                    setLookupValue("");
                    setIdentityError("");
                    setLookupStatus("idle");
                    setLookupMessage("");
                  }}
                  autoComplete="off"
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value="">Seleccione empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedCompany ? (
                <div className={`rounded-md p-3 text-sm font-semibold ${selectedLookupField ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                  {selectedLookupField
                    ? `Dato configurado para esta empresa: ${currentLookupLabel}.`
                    : "Esta empresa no tiene configurado el dato de identificacion para validar participantes."}
                </div>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">{currentLookupLabel}</span>
                <input
                  value={lookupValue}
                  onChange={(event) => {
                    const raw = event.currentTarget.value;
                    const digits = onlyDigits(raw);
                    if (raw !== digits) notify("Solo se permiten numeros.", "warning");
                    setLookupValue(selectedLookupField === "EMPLOYEE_NUMBER" ? digits.slice(0, 5) : digits.slice(0, 11));
                    setIdentityError("");
                    setLookupStatus("idle");
                    setLookupMessage("");
                  }}
                  inputMode="numeric"
                  name="presential-participant-lookup"
                  autoComplete="off"
                  placeholder={selectedLookupField === "DOCUMENT_ID" ? "11 numeros" : "Maximo 5 numeros"}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              {lookupMessage ? (
                <p
                  className={`rounded-md p-3 text-sm font-semibold ${
                    lookupStatus === "duplicate"
                      ? "bg-red-50 text-red-700"
                      : lookupStatus === "available"
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-slate-50 text-slate-600"
                  }`}
                >
                  {lookupMessage}
                </p>
              ) : null}
              {identityError ? <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">{identityError}</p> : null}
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowIdentityModal(false);
                  resetIdentityForm();
                }}
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 px-4 font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitIdentity}
                disabled={lookupStatus === "checking" || lookupStatus === "duplicate"}
                className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                Continuar y girar
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
                <p className="text-sm font-semibold text-slate-500">{result.participantLookupLabel || "Identificacion"}</p>
                <p className="text-2xl font-black text-slate-950">{result.participantNie}</p>
              </div>
            ) : null}
            {result.participantCompany ? (
              <div>
                <p className="text-sm font-semibold text-slate-500">Empresa</p>
                <p className="text-2xl font-black text-slate-950">{result.participantCompany}</p>
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
