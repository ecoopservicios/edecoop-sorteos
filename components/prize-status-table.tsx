"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PackageCheck } from "lucide-react";
import { notify } from "@/lib/toast";

type PrizeStatusRow = {
  id: string;
  createdAt: string;
  code: string;
  participantName: string;
  participantPhone: string | null;
  eventName: string;
  prizeName: string;
  environmentLabel: string;
  status: "PENDING" | "SENT" | "DELIVERED" | "AWARDED" | "CANCELLED";
  statusLabel: string;
  responsibleName: string;
};

const editableStatuses = [
  { value: "PENDING", label: "Pendiente" },
  { value: "SENT", label: "Enviado" },
  { value: "DELIVERED", label: "Entregado" }
];

export function PrizeStatusTable({ rows }: { rows: PrizeStatusRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    setMessage("");
    const response = await fetch(`/api/resultados/${id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    setBusyId("");

    if (!response.ok) {
      setMessage(data.error || "No se pudo cambiar el estado.");
      notify(data.error || "No se pudo cambiar el estado.", "error");
      return;
    }

    notify("Estado de premio actualizado.", "success");
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <PackageCheck className="text-emerald-800" size={22} />
          <h2 className="text-lg font-black text-slate-950">Premios ganados</h2>
        </div>
        {message ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{message}</p> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Participante</th>
              <th className="px-3 py-2">Teléfono</th>
              <th className="px-3 py-2">Evento</th>
              <th className="px-3 py-2">Premio</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Responsable</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString("es-DO")}</td>
                <td className="px-3 py-2 font-bold">{row.code}</td>
                <td className="px-3 py-2">{row.participantName}</td>
                <td className="px-3 py-2">{row.participantPhone || "-"}</td>
                <td className="px-3 py-2">{row.eventName}</td>
                <td className="px-3 py-2">{row.prizeName}</td>
                <td className="px-3 py-2">{row.environmentLabel}</td>
                <td className="px-3 py-2">{row.responsibleName || "-"}</td>
                <td className="px-3 py-2">
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-800">{row.statusLabel}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <select
                      defaultValue={row.status === "AWARDED" || row.status === "CANCELLED" ? "PENDING" : row.status}
                      disabled={busyId === row.id}
                      onChange={(event) => updateStatus(row.id, event.currentTarget.value)}
                      className="rounded-md border border-slate-300 px-2 py-2"
                      title="Cambiar estado del premio"
                    >
                      {editableStatuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <CheckCircle2 size={18} className="text-emerald-700" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
