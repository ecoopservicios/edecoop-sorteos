"use client";

import { ChangeEvent, useRef, useState } from "react";
import { Download, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { notify } from "@/lib/toast";

type Company = { id: string; name: string; isActive: boolean; dataUpdateEnabled: boolean; dataUpdateLookupField: string | null };
type UploadResult = {
  processed: number; created: number; updated: number; restored: number; removed: number; rejected: number; applied: boolean;
  errors: Array<{ row: number; message: string }>; duplicates: Array<{ row: number; message: string }>;
};
const fieldClass = "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

export function MemberDirectoryActions({ companies, members }: { companies: Company[]; members: Array<{ enrollmentCompanyId: string }> }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"" | "append" | "replace">("");
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteScope, setDeleteScope] = useState("all");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const configured = companies.filter(company => company.isActive && company.dataUpdateEnabled && company.dataUpdateLookupField);
  const company = companies.find(item => item.id === companyId);
  const companyCount = members.filter(member => member.enrollmentCompanyId === companyId).length;
  const deleteCount = deleteScope === "all" ? members.length : members.filter(member => member.enrollmentCompanyId === deleteScope).length;
  const deleteCompany = companies.find(item => item.id === deleteScope);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.currentTarget.files?.[0] || null);
    event.currentTarget.value = "";
    setMode(""); setConfirmation(""); setResult(null);
  }

  async function uploadMembers() {
    if (!file || !companyId || !mode || busy || (mode === "replace" && confirmation !== "REEMPLAZAR")) return;
    const form = new FormData();
    form.set("enrollmentCompanyId", companyId); form.set("file", file); form.set("mode", mode);
    form.set("confirmation", confirmation); form.set("expectedCount", String(companyCount));
    setBusy(true); setResult(null);
    try {
      const response = await fetch("/api/actualizacion-datos/base/carga", { method: "POST", body: form });
      const data = await response.json();
      if (typeof data.processed === "number") setResult(data);
      if (!response.ok) throw new Error(data.error || "Revisa los errores y duplicados del archivo.");
      notify(`Carga completada: ${data.created} nuevos, ${data.updated} actualizados, ${data.restored} reincorporados y ${data.removed} retirados del listado.`, data.rejected || data.duplicates?.length ? "info" : "success");
      setFile(null); setMode(""); setConfirmation("");
      router.refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo cargar el archivo. Intenta nuevamente.", "error");
    } finally { setBusy(false); }
  }

  async function deleteMembers() {
    if (busy || deleteConfirmation !== "ELIMINAR" || !deleteCount) return;
    setBusy(true);
    try {
      const response = await fetch("/api/actualizacion-datos/base", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: deleteScope === "all" ? "all" : "company", enrollmentCompanyId: deleteScope === "all" ? undefined : deleteScope, expectedCount: deleteCount, confirmation: deleteConfirmation })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar el listado.");
      notify(`${data.removed} socios eliminados del listado. Las solicitudes recibidas se conservaron.`, "success");
      setDeleteOpen(false); setDeleteConfirmation("");
      router.refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo eliminar el listado.", "error");
    } finally { setBusy(false); }
  }

  return <>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <a href="/api/actualizacion-datos/base/plantilla" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100"><Download size={18} />Descargar template</a>
      <button type="button" disabled={busy} onClick={() => { setUploadOpen(true); setCompanyId(configured[0]?.id || ""); setFile(null); setMode(""); setConfirmation(""); setResult(null); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><Upload size={18} />Cargar listado de socios</button>
      <button type="button" disabled={busy || !members.length} onClick={() => { setDeleteScope("all"); setDeleteConfirmation(""); setDeleteOpen(true); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-300 px-4 py-2 font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={18} />Eliminar listado completo</button>
    </div>

    {uploadOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="member-upload-title" className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
          <h3 id="member-upload-title" className="text-lg font-black text-slate-950">Cargar base de socios</h3>
          <button type="button" disabled={busy} onClick={() => setUploadOpen(false)} aria-label="Cerrar carga" title="Cerrar" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"><X size={18} /></button>
        </div>
        <div className="min-h-0 overflow-y-auto">
        <label className="block text-sm font-bold text-slate-700">Empresa
          <select autoFocus aria-label="Empresa del listado" value={companyId} disabled={busy} onChange={event => { setCompanyId(event.currentTarget.value); setFile(null); setMode(""); setConfirmation(""); setResult(null); }} className={`mt-1 ${fieldClass}`}>
            <option value="">Seleccione empresa</option>
            {configured.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a href="/api/actualizacion-datos/base/plantilla" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 font-bold text-slate-700 hover:bg-slate-100"><Download size={18} />Descargar template</a>
          <button type="button" disabled={busy || !companyId} onClick={() => fileInput.current?.click()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><Upload size={18} />{file ? "Cambiar archivo" : "Seleccionar archivo"}</button>
          <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label="Archivo de socios" onChange={selectFile} />
        </div>
        {file && <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="break-words text-sm font-semibold text-slate-700">{file.name}</p>
          <fieldset disabled={busy} className="mt-3 grid gap-3">
            <legend className="mb-3 font-bold text-slate-950">¿Qué deseas hacer con el listado de {company?.name}?</legend>
            <label className="flex items-start gap-3 text-sm"><input type="radio" name="member-upload-mode" value="append" checked={mode === "append"} onChange={() => { setMode("append"); setConfirmation(""); setResult(null); }} className="mt-0.5 h-4 w-4 accent-emerald-700" /><span>Agregar al listado existente <span className="font-semibold">({companyCount} socios)</span></span></label>
            <label className="flex items-start gap-3 text-sm"><input type="radio" name="member-upload-mode" value="replace" checked={mode === "replace"} onChange={() => { setMode("replace"); setConfirmation(""); setResult(null); }} className="mt-0.5 h-4 w-4 accent-emerald-700" /><span>Reemplazar el listado anterior de esta empresa</span></label>
          </fieldset>
          {mode === "replace" && <div role="alert" className="mt-4 border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-950">
            <p>Se reemplazará el listado de {company?.name} ({companyCount} socios). Las demás empresas y las solicitudes recibidas se conservarán. Si hay errores en el archivo, no se reemplazará nada.</p>
            <label className="mt-3 block font-bold">Escribe REEMPLAZAR para confirmar<input value={confirmation} disabled={busy} onChange={event => setConfirmation(event.currentTarget.value.toUpperCase())} autoComplete="off" className={`mt-1 ${fieldClass}`} /></label>
          </div>}
        </div>}
        {result && <div aria-live="polite" className="mt-4 border-t border-slate-200 pt-4 text-sm">
          <p className="font-bold text-slate-950">{result.applied ? "Carga completada" : "Sin cambios en el listado"}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700 sm:grid-cols-3">
            {[["Procesados", result.processed], ["Nuevos", result.created], ["Actualizados", result.updated], ["Reincorporados", result.restored], ["Retirados", result.removed], ["Rechazados", result.rejected]].map(([label, value]) => <div key={label}><dt className="inline">{label}: </dt><dd className="inline font-bold">{value}</dd></div>)}
          </dl>
          {!!result.errors?.length && <div className="mt-3"><h4 className="font-bold text-red-800">Errores y duplicados rechazados</h4><ul className="mt-2 max-h-40 space-y-2 overflow-y-auto break-words text-red-700">{result.errors.map(error => <li key={`${error.row}-${error.message}`}>{error.message}</li>)}</ul></div>}
          {!!result.duplicates?.length && <details className="mt-3 text-amber-900"><summary className="cursor-pointer font-bold">Coincidencias con registros existentes: {result.duplicates.length}</summary><ul className="mt-2 max-h-40 space-y-2 overflow-y-auto break-words">{result.duplicates.map(item => <li key={item.row}>{item.message}</li>)}</ul></details>}
        </div>}
        </div>
        {file && <div className="mt-4 flex shrink-0 flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row">
          <button type="button" disabled={busy || !mode || (mode === "replace" && confirmation !== "REEMPLAZAR")} onClick={uploadMembers} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><Upload size={18} />{busy ? "Validando y cargando..." : "Confirmar carga"}</button>
          <button type="button" disabled={busy} onClick={() => { setFile(null); setMode(""); setConfirmation(""); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700"><X size={18} />Cancelar archivo</button>
        </div>}
      </section>
    </div>}

    {deleteOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="member-delete-title" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><h3 id="member-delete-title" className="text-lg font-black text-slate-950">Eliminar listado de socios</h3><button type="button" disabled={busy} onClick={() => setDeleteOpen(false)} aria-label="Cerrar eliminación" title="Cerrar" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 disabled:opacity-50"><X size={18} /></button></div>
        <label className="mt-4 block text-sm font-bold text-slate-700">Listado
          <select autoFocus aria-label="Listado a eliminar" disabled={busy} value={deleteScope} onChange={event => { setDeleteScope(event.currentTarget.value); setDeleteConfirmation(""); }} className={`mt-1 ${fieldClass}`}>
            <option value="all">Todas las empresas</option>
            {companies.filter(item => members.some(member => member.enrollmentCompanyId === item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div role="alert" className="mt-4 border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-950"><p>Se eliminarán <strong>{deleteCount} socios</strong> del listado {deleteScope === "all" ? "de todas las empresas" : `de ${deleteCompany?.name}`}, independientemente de los filtros. Las solicitudes recibidas y su historial no se borrarán.</p></div>
        <label className="mt-4 block text-sm font-bold text-slate-700">Escribe ELIMINAR para confirmar<input disabled={busy} value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.currentTarget.value.toUpperCase())} autoComplete="off" className={`mt-1 ${fieldClass}`} /></label>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={busy || !deleteCount || deleteConfirmation !== "ELIMINAR"} onClick={deleteMembers} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800 disabled:opacity-50"><Trash2 size={18} />{busy ? "Eliminando..." : "Confirmar eliminación"}</button>
          <button type="button" disabled={busy} onClick={() => setDeleteOpen(false)} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700">Cancelar</button>
        </div>
      </section>
    </div>}
  </>;
}
