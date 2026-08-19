"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { notify } from "@/lib/toast";
import { ExportExcelButton } from "@/components/export-excel-button";

type Company = {
  id: string;
  name: string;
  isActive: boolean;
  dataUpdateEnabled: boolean;
  dataUpdateLookupField: "DOCUMENT_ID" | "EMPLOYEE_NUMBER" | null;
};

const inputClass = "h-11 w-full rounded-md border border-slate-300 px-3 py-2";

function lookupLabel(value: Company["dataUpdateLookupField"]) {
  if (value === "DOCUMENT_ID") return "Cedula";
  if (value === "EMPLOYEE_NUMBER") return "Numero de empleado";
  return "Sin configurar";
}

export function EnrollmentCompanyManager({ formId, companies }: { formId: string; companies: Company[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const exportRows = companies.map((company) => ({
    Empresa: company.name,
    Estado: company.isActive ? "Activa" : "Inactiva",
    "Actualizacion de datos": company.dataUpdateEnabled ? "Habilitada" : "No habilitada",
    "Dato de consulta": company.dataUpdateEnabled ? lookupLabel(company.dataUpdateLookupField) : "No habilitado"
  }));

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setCreating(true);
    const response = await fetch("/api/inscripcion-virtual/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formId, name: form.get("name") })
    });
    const data = await response.json();
    setCreating(false);

    if (!response.ok) {
      notify(data.error || "No se pudo agregar la empresa.", "error");
      return;
    }

    formElement.reset();
    notify("Empresa agregada.", "success");
    router.refresh();
  }

  async function toggle(company: Company) {
    setBusyId(company.id);
    const response = await fetch(`/api/inscripcion-virtual/empresas/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !company.isActive })
    });
    const data = await response.json();
    setBusyId("");

    if (!response.ok) {
      notify(data.error || "No se pudo cambiar el estado.", "error");
      return;
    }

    notify(company.isActive ? "Empresa inactivada." : "Empresa activada.", "success");
    router.refresh();
  }

  async function deleteCompany(company: Company) {
    setBusyId(company.id);
    const response = await fetch(`/api/inscripcion-virtual/empresas/${company.id}`, { method: "DELETE" });
    const data = await response.json();
    setBusyId("");

    if (!response.ok) {
      notify(data.error || "No se pudo eliminar la empresa.", "error");
      return;
    }

    notify("Empresa eliminada.", "success");
    router.refresh();
  }

  async function saveDataUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const form = new FormData(event.currentTarget);
    setSavingEdit(true);
    const response = await fetch(`/api/inscripcion-virtual/empresas/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataUpdateEnabled: form.get("dataUpdateEnabled") === "on",
        dataUpdateLookupField: form.get("dataUpdateLookupField")
      })
    });
    const data = await response.json();
    setSavingEdit(false);

    if (!response.ok) {
      notify(data.error || "No se pudo actualizar la empresa.", "error");
      return;
    }

    notify("Empresa actualizada.", "success");
    setEditing(null);
    router.refresh();
  }

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-black text-slate-950">Empresas del formulario</h2>
        <ExportExcelButton rows={exportRows} fileName="empresas-formulario" />
      </div>

      <form onSubmit={create} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input name="name" required placeholder="Nombre de empresa" className="rounded-md border border-slate-300 px-3 py-2 sm:flex-1" />
        <button disabled={creating} className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
          <Plus size={17} />
          {creating ? "Agregando..." : "Agregar empresa"}
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Empresa</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Dato de consulta</th>
              <th className="px-3 py-2">Accion</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold">{company.name}</td>
                <td className="px-3 py-2">{company.isActive ? "Activa" : "Inactiva"}</td>
                <td className="px-3 py-2">{company.dataUpdateEnabled ? lookupLabel(company.dataUpdateLookupField) : "No habilitado"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(company)}
                      disabled={busyId === company.id}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      title="Editar configuracion"
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(company)}
                      disabled={busyId === company.id}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      title={company.isActive ? "Inactivar" : "Activar"}
                    >
                      <Power size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCompany(company)}
                      disabled={busyId === company.id}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                      title="Eliminar"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {companies.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={4}>
                  No hay empresas registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <form onSubmit={saveDataUpdate} className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-950">Editar empresa</h3>
                <p className="text-sm font-semibold text-slate-600">{editing.name}</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50" title="Cerrar">
                <X size={18} />
              </button>
            </div>

            <label className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <input name="dataUpdateEnabled" type="checkbox" defaultChecked={editing.dataUpdateEnabled} className="h-4 w-4" />
              Habilitar actualizacion de datos
            </label>

            <div className="grid gap-3">
              <label>
                <span className="mb-1 block text-sm font-bold text-slate-700">Dato de consulta</span>
                <select name="dataUpdateLookupField" defaultValue={editing.dataUpdateLookupField || "DOCUMENT_ID"} className={inputClass}>
                  <option value="DOCUMENT_ID">Cedula</option>
                  <option value="EMPLOYEE_NUMBER">Numero de empleado</option>
                </select>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50">
                Cancelar
              </button>
              <button disabled={savingEdit} className="rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
                {savingEdit ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
