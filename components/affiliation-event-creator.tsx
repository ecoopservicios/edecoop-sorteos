"use client";

import { useRouter } from "next/navigation";
import { CalendarPlus, Gift, Pencil, Pin, PinOff, Power, Save, Trash2, X } from "lucide-react";
import { Fragment, FormEvent, useState } from "react";

import { notify } from "@/lib/toast";

type AffiliationEventRow = {
  id: string;
  displayName: string;
  typeName: string;
  monthLabel: string;
  month: number;
  year: number;
  typeCode: string;
  promotionStartAt: string;
  promotionEndAt: string;
  promotionStartInput: string;
  promotionEndInput: string;
  status: string;
  statusLabel: string;
  prizes: Array<{
    id: string;
    type: string;
    name: string;
    availableQuantity: number;
    awardedQuantity: number;
    isActive: boolean;
  }>;
};

const months = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" }
];

const years = Array.from({ length: 10 }, (_, index) => 2026 + index);

const statusOptions = [
  { value: "ACTIVE", label: "Activa" },
  { value: "INACTIVE", label: "Inactiva" },
  { value: "CLOSED", label: "Cerrada" }
];

const prizeTypeLabels: Record<string, string> = {
  BONUS: "Bono",
  ARTICLE: "Articulo",
  FINAL: "Premio final"
};

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function AffiliationEventCreator({
  currentYear,
  rows
}: {
  currentYear: number;
  rows: AffiliationEventRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [prizeBusy, setPrizeBusy] = useState(false);
  const [selectedPrizeEventId, setSelectedPrizeEventId] = useState(rows[0]?.id || "");
  const [pinnedEventIds, setPinnedEventIds] = useState<string[]>([]);
  const [editingPrize, setEditingPrize] = useState<{
    id: string;
    type: string;
    name: string;
    availableQuantity: number;
    awardedQuantity: number;
  } | null>(null);
  const [editingEvent, setEditingEvent] = useState<AffiliationEventRow | null>(null);
  const selectedPrizeEvent = rows.find((row) => row.id === selectedPrizeEventId);
  const isFinalEvent = selectedPrizeEvent?.typeCode === "AFFILIATION_FINAL";

  function togglePinnedEvent(eventId: string) {
    setPinnedEventIds((current) => (current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId]));
  }

  async function createAffiliationEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const month = Number(form.get("month"));
    const year = Number(form.get("year"));
    const promotionStartAt = String(form.get("promotionStartAt") || "");
    const promotionEndAt = String(form.get("promotionEndAt") || "");
    const status = String(form.get("status") || "ACTIVE");

    setBusy(true);
    const response = await fetch("/api/afiliacion/eventos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year, promotionStartAt, promotionEndAt, status })
    });
    const data = await readJson(response);
    setBusy(false);

    if (!response.ok) {
      notify(data.error || "No se pudo crear la jornada de afiliacion.", "error");
      return;
    }

    notify("Jornada creada: premio instantaneo y premio final.", "success");
    router.refresh();
  }

  async function createPrize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const eventEditionId = String(form.get("eventEditionId") || "");
    const name = String(form.get("name") || "");
    const availableQuantity = Number(form.get("availableQuantity"));
    const type = isFinalEvent ? "FINAL" : String(form.get("type") || "BONUS");

    setPrizeBusy(true);
    const response = await fetch("/api/eventos/premios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventEditionId, type, name, availableQuantity })
    });
    const data = await readJson(response);
    setPrizeBusy(false);

    if (!response.ok) {
      notify(data.error || "No se pudo agregar el premio.", "error");
      return;
    }

    formElement.reset();
    setSelectedPrizeEventId(rows[0]?.id || "");
    notify("Premio agregado a la jornada.", "success");
    router.refresh();
  }

  async function updatePrize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPrize) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/eventos/premios/${editingPrize.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: String(form.get("type") || editingPrize.type),
        name: String(form.get("name") || ""),
        availableQuantity: Number(form.get("availableQuantity"))
      })
    });
    const data = await readJson(response);

    if (!response.ok) {
      notify(data.error || "No se pudo editar el premio.", "error");
      return;
    }

    setEditingPrize(null);
    notify("Premio actualizado.", "success");
    router.refresh();
  }

  async function togglePrize(prize: AffiliationEventRow["prizes"][number]) {
    const response = await fetch(`/api/eventos/premios/${prize.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !prize.isActive })
    });
    const data = await readJson(response);

    if (!response.ok) {
      notify(data.error || "No se pudo cambiar el estado del premio.", "error");
      return;
    }

    notify(prize.isActive ? "Premio inactivado." : "Premio activado.", "success");
    router.refresh();
  }

  async function deletePrize(prize: AffiliationEventRow["prizes"][number]) {
    const response = await fetch(`/api/eventos/premios/${prize.id}`, { method: "DELETE" });
    const data = await readJson(response);

    if (!response.ok) {
      notify(data.error || "No se pudo eliminar el premio.", "error");
      return;
    }

    notify("Premio eliminado.", "success");
    router.refresh();
  }

  async function toggleEvent(row: AffiliationEventRow) {
    const response = await fetch(`/api/eventos/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle" })
    });
    const data = await readJson(response);

    if (!response.ok) {
      notify(data.error || "No se pudo cambiar el estado de la jornada.", "error");
      return;
    }

    notify(row.status === "ACTIVE" ? "Jornada inactivada." : "Jornada activada.", "success");
    router.refresh();
  }

  async function updateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingEvent) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/eventos/${editingEvent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: Number(form.get("month")),
        year: Number(form.get("year")),
        promotionStartAt: String(form.get("promotionStartAt") || ""),
        promotionEndAt: String(form.get("promotionEndAt") || "")
      })
    });
    const data = await readJson(response);

    if (!response.ok) {
      notify(data.error || "No se pudo editar la jornada.", "error");
      return;
    }

    setEditingEvent(null);
    notify("Jornada actualizada.", "success");
    router.refresh();
  }

  return (
    <section className="mb-6 rounded-lg border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Jornada de afiliacion</p>
          <h2 className="text-xl font-black text-slate-950">Crear evento de afiliacion</h2>
          <p className="mt-1 text-sm text-slate-600">
            Selecciona el mes y el año. El sistema creara automaticamente Premio Instantaneo y Premio Final.
          </p>
        </div>
      </div>

      <form onSubmit={createAffiliationEvent} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_180px_220px_220px_180px_auto]">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Mes de la jornada</span>
          <select name="month" required className="w-full rounded-md border border-slate-300 px-3 py-2">
            <option value="">Seleccione un mes</option>
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Año</span>
          <select name="year" required defaultValue={currentYear} className="w-full rounded-md border border-slate-300 px-3 py-2">
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Fecha inicio de promocion</span>
          <input name="promotionStartAt" type="date" required className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Fecha fin de promocion</span>
          <input name="promotionEndAt" type="date" required className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Estado</span>
          <select name="status" required defaultValue="ACTIVE" className="w-full rounded-md border border-slate-300 px-3 py-2">
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-md bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CalendarPlus size={18} />
          {busy ? "Creando..." : "Crear jornada"}
        </button>
      </form>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3">
          <h3 className="text-lg font-black text-slate-950">Premios de la jornada</h3>
          <p className="text-sm text-slate-600">Agrega aqui los premios instantaneos y el premio final de la jornada seleccionada.</p>
        </div>
        <form onSubmit={createPrize} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_180px_1fr_160px_auto]">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Evento de la jornada</span>
            <select
              name="eventEditionId"
              required
              value={selectedPrizeEventId}
              onChange={(event) => setSelectedPrizeEventId(event.currentTarget.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Seleccione evento</option>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo premio</span>
            <select
              key={selectedPrizeEventId}
              name="type"
              required
              disabled={isFinalEvent}
              defaultValue={isFinalEvent ? "FINAL" : "BONUS"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            >
              <option value="BONUS">Bono</option>
              <option value="ARTICLE">Articulo</option>
              <option value="FINAL">Premio final</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Premio</span>
            <input name="name" required minLength={2} placeholder="Nombre del premio" className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Cantidad disponible</span>
            <input name="availableQuantity" type="number" required min={0} defaultValue={1} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <button
            disabled={prizeBusy || rows.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-md bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Gift size={18} />
            {prizeBusy ? "Agregando..." : "Agregar premio"}
          </button>
        </form>
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Fijar</th>
              <th className="px-3 py-2">Evento</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Mes</th>
              <th className="px-3 py-2">Año</th>
              <th className="px-3 py-2">Inicio</th>
              <th className="px-3 py-2">Fin</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pinned = pinnedEventIds.includes(row.id);
              return (
                <Fragment key={row.id}>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => togglePinnedEvent(row.id)}
                        title={pinned ? "Desfijar premios" : "Fijar premios"}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition ${
                          pinned
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {pinned ? <PinOff size={17} /> : <Pin size={17} />}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-semibold">{row.displayName}</td>
                    <td className="px-3 py-2">{row.typeName}</td>
                    <td className="px-3 py-2">{row.monthLabel}</td>
                    <td className="px-3 py-2">{row.year}</td>
                    <td className="px-3 py-2">{row.promotionStartAt || "-"}</td>
                    <td className="px-3 py-2">{row.promotionEndAt || "-"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                          row.statusLabel === "Activo"
                            ? "bg-emerald-50 text-emerald-800"
                            : row.statusLabel === "Inactivo"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingEvent(row)}
                          title="Editar jornada"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleEvent(row)}
                          title={row.status === "ACTIVE" ? "Inactivar jornada" : "Activar jornada"}
                          disabled={row.status === "CLOSED"}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-50 ${
                            row.status === "ACTIVE"
                              ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          }`}
                        >
                          <Power size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {pinned ? (
                    <tr className="border-t border-emerald-100 bg-emerald-50/35">
                      <td colSpan={9} className="px-3 py-3">
                        <div className="rounded-lg border border-emerald-100 bg-white shadow-sm">
                          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
                            <div>
                              <p className="text-sm font-black text-slate-950">Premios asociados</p>
                              <p className="text-xs text-slate-500">{row.displayName}</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                              {row.prizes.length} premios
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[860px] text-left text-xs">
                              <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                  <th className="px-3 py-2">Premio</th>
                                  <th className="px-3 py-2">Tipo</th>
                                  <th className="px-3 py-2">Disponible</th>
                                  <th className="px-3 py-2">Otorgado</th>
                                  <th className="px-3 py-2">Estado</th>
                                  <th className="px-3 py-2 text-right">Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.prizes.map((prize) => (
                                  <tr key={prize.id} className="border-t border-slate-100">
                                    <td className="px-3 py-2 font-bold text-slate-950">{prize.name}</td>
                                    <td className="px-3 py-2">{prizeTypeLabels[prize.type] || prize.type}</td>
                                    <td className="px-3 py-2">{prize.availableQuantity}</td>
                                    <td className="px-3 py-2">{prize.awardedQuantity}</td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                                          prize.isActive ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
                                        }`}
                                      >
                                        {prize.isActive ? "Activo" : "Inactivo"}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setEditingPrize(prize)}
                                          title="Editar premio"
                                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                        >
                                          <Pencil size={16} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => togglePrize(prize)}
                                          title={prize.isActive ? "Inactivar premio" : "Activar premio"}
                                          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border ${
                                            prize.isActive
                                              ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                              : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                          }`}
                                        >
                                          <Power size={16} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => deletePrize(prize)}
                                          title="Eliminar premio"
                                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {row.prizes.length === 0 ? (
                                  <tr>
                                    <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                                      Esta jornada no tiene premios asociados.
                                    </td>
                                  </tr>
                                ) : null}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={9}>
                  No hay jornadas de afiliacion creadas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editingEvent ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4">
          <form onSubmit={updateEvent} className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-950">Editar jornada</h3>
                <p className="text-sm text-slate-600">{editingEvent.displayName}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                title="Cerrar"
              >
                <X size={17} />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Mes</span>
                <select name="month" required defaultValue={editingEvent.month} className="w-full rounded-md border border-slate-300 px-3 py-2">
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Año</span>
                <select name="year" required defaultValue={editingEvent.year} className="w-full rounded-md border border-slate-300 px-3 py-2">
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Fecha inicio de promocion</span>
                <input
                  name="promotionStartAt"
                  type="date"
                  required
                  defaultValue={editingEvent.promotionStartInput}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Fecha fin de promocion</span>
                <input
                  name="promotionEndAt"
                  type="date"
                  required
                  defaultValue={editingEvent.promotionEndInput}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 font-bold text-slate-700 hover:bg-slate-100"
              >
                <X size={17} />
                Cancelar
              </button>
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800">
                <Save size={17} />
                Guardar
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingPrize ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4">
          <form onSubmit={updatePrize} className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-950">Editar premio</h3>
                <p className="text-sm text-slate-600">Actualiza el premio asociado a la jornada.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPrize(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                title="Cerrar"
              >
                <X size={17} />
              </button>
            </div>
            <div className="grid gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo premio</span>
                <select name="type" required defaultValue={editingPrize.type} className="w-full rounded-md border border-slate-300 px-3 py-2">
                  <option value="BONUS">Bono</option>
                  <option value="ARTICLE">Articulo</option>
                  <option value="FINAL">Premio final</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Premio</span>
                <input name="name" required minLength={2} defaultValue={editingPrize.name} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Cantidad disponible</span>
                <input
                  name="availableQuantity"
                  type="number"
                  required
                  min={editingPrize.awardedQuantity}
                  defaultValue={editingPrize.availableQuantity}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
                <span className="mt-1 block text-xs text-slate-500">No puede ser menor que la cantidad otorgada: {editingPrize.awardedQuantity}.</span>
              </label>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditingPrize(null)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 font-bold text-slate-700 hover:bg-slate-100"
              >
                <X size={17} />
                Cancelar
              </button>
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800">
                <Save size={17} />
                Guardar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
