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

async function companyRequest(url: string, options: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || "El servidor no pudo completar la operación. Intente nuevamente.");
  return data;
}

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
  const [deleting, setDeleting] = useState<{ company: Company; warning: string } | null>(null);
  const exportRows = companies.map((company) => ({
    Empresa: company.name,
    Estado: company.isActive ? "Activa" : "Inactiva",
    "Actualizacion de datos": company.dataUpdateEnabled ? "Habilitada" : "No habilitada",
    "Dato de consulta": lookupLabel(company.dataUpdateLookupField)
  }));

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setCreating(true);
    try {
    await companyRequest("/api/inscripcion-virtual/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formId, name: form.get("name") })
    });
    formElement.reset();
    notify("Empresa agregada.", "success");
    router.refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "No se pudo agregar la empresa.", "error"); }
    finally { setCreating(false); }
  }

  async function toggle(company: Company) {
    setBusyId(company.id);
    try {
    await companyRequest(`/api/inscripcion-virtual/empresas/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !company.isActive })
    });
    notify(company.isActive ? "Empresa inactivada." : "Empresa activada.", "success");
    router.refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "No se pudo cambiar el estado.", "error"); }
    finally { setBusyId(""); }
  }

  async function deleteCompany(company: Company, confirm = false) {
    setBusyId(company.id);
    try {
    const result = await companyRequest(`/api/inscripcion-virtual/empresas/${company.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm }) });
    if (result.requiresConfirmation) { setDeleting({ company, warning: result.warning }); return; }
    setDeleting(null);
    notify("Empresa eliminada.", "success");
    router.refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "No se pudo eliminar la empresa.", "error"); }
    finally { setBusyId(""); }
  }

  async function saveDataUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const form = new FormData(event.currentTarget);
    setSavingEdit(true);
    try {
    await companyRequest(`/api/inscripcion-virtual/empresas/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataUpdateEnabled: form.get("dataUpdateEnabled") === "on",
        dataUpdateLookupField: form.get("dataUpdateLookupField")
      })
    });
    notify("Empresa actualizada.", "success");
    setEditing(null);
    router.refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "No se pudo actualizar la empresa.", "error"); }
    finally { setSavingEdit(false); }
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
                <td className="px-3 py-2">{lookupLabel(company.dataUpdateLookupField)}</td>
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

      {deleting && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
        <section role="dialog" aria-modal="true" aria-label="Eliminar empresa" className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-bold">Eliminar empresa</h3>
          <p className="mt-3 text-sm text-slate-700">{deleting.warning}</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={!!busyId} onClick={() => setDeleting(null)} className="rounded-md border px-4 py-2">Cancelar</button>
            <button type="button" disabled={!!busyId} onClick={() => deleteCompany(deleting.company, true)} className="rounded-md bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busyId ? "Eliminando..." : "Eliminar de todos modos"}</button>
          </div>
        </section>
      </div>}
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
