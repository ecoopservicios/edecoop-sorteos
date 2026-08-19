"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Power, Save, Trash2, X } from "lucide-react";
import { notify } from "@/lib/toast";
import { ExportExcelButton } from "@/components/export-excel-button";

type PrizeRow = {
  id: string;
  name: string;
  availableQuantity: number;
  isActive: boolean;
};

function actionButtonClass(tone: "neutral" | "green" | "amber" | "red") {
  const colors = {
    neutral: "border-slate-300 text-slate-700 hover:bg-slate-100",
    green: "border-emerald-200 text-emerald-800 hover:bg-emerald-50",
    amber: "border-amber-200 text-amber-800 hover:bg-amber-50",
    red: "border-red-200 text-red-700 hover:bg-red-50"
  };

  return `inline-flex h-9 w-9 items-center justify-center rounded-md border ${colors[tone]}`;
}

export function PrizesTable({ prizes }: { prizes: PrizeRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PrizeRow | null>(null);
  const [deleting, setDeleting] = useState<PrizeRow | null>(null);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const exportRows = prizes.map((prize) => ({
    Premio: prize.name,
    Disponibilidad: prize.availableQuantity,
    Estado: prize.isActive ? "Activo" : "Inactivo"
  }));

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setBusyId(editing.id);
    setMessage("");

    const response = await fetch(`/api/premios/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        availableQuantity: Number(form.get("newQuantity"))
      })
    });
    const data = await response.json();
    setBusyId("");

    if (!response.ok) {
      setMessage(data.error || "No se pudo editar el premio.");
      notify(data.error || "No se pudo editar el premio.", "error");
      return;
    }

    setEditing(null);
    notify("Premio actualizado correctamente.", "success");
    router.refresh();
  }

  async function toggleActive(prize: PrizeRow) {
    setBusyId(prize.id);
    setMessage("");
    const response = await fetch(`/api/premios/${prize.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !prize.isActive })
    });
    const data = await response.json();
    setBusyId("");

    if (!response.ok) {
      setMessage(data.error || "No se pudo cambiar el estado.");
      notify(data.error || "No se pudo cambiar el estado.", "error");
      return;
    }

    notify(prize.isActive ? "Premio inactivado." : "Premio activado.", "success");
    router.refresh();
  }

  async function deleteConfirmed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deleting) return;
    const form = new FormData(event.currentTarget);
    setBusyId(deleting.id);
    setMessage("");
    const response = await fetch(`/api/premios/${deleting.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: form.get("reason") })
    });
    const data = await response.json();
    setBusyId("");

    if (!response.ok) {
      setMessage(data.error || "No se pudo eliminar el premio.");
      notify(data.error || "No se pudo eliminar el premio.", "error");
      return;
    }

    setDeleting(null);
    notify("Premio eliminado correctamente.", "success");
    router.refresh();
  }

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-black text-slate-950">Premios registrados</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ExportExcelButton rows={exportRows} fileName="premios-registrados" />
          {message ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{message}</p> : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Premio</th>
                <th className="px-3 py-2">Disponibilidad</th>
                <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {prizes.map((prize) => (
              <tr key={prize.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold">{prize.name}</td>
                <td className="px-3 py-2">{prize.availableQuantity}</td>
                <td className="px-3 py-2">{prize.isActive ? "Activo" : "Inactivo"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button className={actionButtonClass("neutral")} onClick={() => setEditing(prize)} disabled={busyId === prize.id} title="Editar">
                      <Pencil size={17} />
                    </button>
                    <button
                      className={actionButtonClass(prize.isActive ? "amber" : "green")}
                      onClick={() => toggleActive(prize)}
                      disabled={busyId === prize.id}
                      title={prize.isActive ? "Inactivar" : "Activar"}
                    >
                      <Power size={17} />
                    </button>
                    <button className={actionButtonClass("red")} onClick={() => setDeleting(prize)} disabled={busyId === prize.id} title="Eliminar">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <form onSubmit={saveEdit} className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-950">Editar premio</h3>
                <p className="text-sm text-slate-600">Actualiza el nombre y la disponibilidad operativa.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Premio</span>
                <input name="name" required defaultValue={editing.name} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Cantidad actual</span>
                <input
                  type="number"
                  value={editing.availableQuantity}
                  readOnly
                  className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Cantidad nueva</span>
                <input
                  name="newQuantity"
                  required
                  min="0"
                  type="number"
                  defaultValue={editing.availableQuantity}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                disabled={busyId === editing.id}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                <Save size={17} />
                {busyId === editing.id ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {deleting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <form onSubmit={deleteConfirmed} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-950">Eliminar premio</h3>
                <p className="mt-1 text-sm text-slate-600">Se guardara una copia en el historico de premios.</p>
              </div>
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-900">
              <p className="font-bold">{deleting.name}</p>
            </div>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Motivo de eliminacion</span>
              <textarea
                name="reason"
                required
                minLength={5}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Indica por que se elimina este premio"
              />
            </label>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                disabled={busyId === deleting.id}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800 disabled:opacity-60"
              >
                <Trash2 size={17} />
                {busyId === deleting.id ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
