"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCircle2, Download, FileSpreadsheet, Gift, Search, Building2, Upload, X, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import { ExportExcelButton } from "@/components/export-excel-button";
import { SouvenirTable } from "@/components/souvenir-table";
import { notify } from "@/lib/toast";
import { SOUVENIR_HEADERS } from "@/lib/souvenir-template";
import type { SouvenirReport } from "@/lib/souvenir-report";
import type { CompanyReview } from "@/lib/souvenir-companies";

type Company = { id: string; name: string; dataUpdateLookupField: "DOCUMENT_ID" | "EMPLOYEE_NUMBER" | null };
type Member = {
  id: string; listNumber: number; firstName: string; lastName: string; displayDocumentId: string | null; employeeNumber: string | null;
  sex: string | null; office: string | null; unit: string | null; approximateLocation: string | null;
  organizationalDirection: string | null; physicalListPage: number | null;
  souvenirDelivery: { deliveredAt: string; deliveredBy: { name: string } } | null;
};
const field = "h-12 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50";

function Modal({ title, onClose, children, busy = false, fullScreen = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean; fullScreen?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} className={fullScreen ? "fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-y-auto overscroll-contain border-0 bg-white p-4 sm:p-8" : "fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl backdrop:bg-black/40 sm:p-6"}>
    <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{title}</h2><button type="button" aria-label="Cerrar" title="Cerrar" className={button + " !px-2"} disabled={busy} onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}

async function readResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "No se pudo completar la operación. Intente nuevamente.");
  return body;
}

function UploadReport({ report, title }: { report: SouvenirReport; title: string }) {
  return <section className="mt-5 border-t border-slate-200 pt-4">
    <h3 className="mb-3 font-bold">{title}</h3>
    <dl className="grid grid-cols-2 gap-3 text-sm">{[["Empresas", report.companyCount], ["Socios", report.total], ["Consulta por empleado", report.byEmployee], ["Consulta por cédula", report.byDocument], ["Sin número requerido", report.missingEmployee], ["Sin cédula requerida", report.missingDocument]].map(([label, value]) => <div key={label}><dt className="text-slate-600">{label}</dt><dd className="font-bold">{value}</dd></div>)}</dl>
    <div className="mt-4"><SouvenirTable headers={["Empresa", "Socios", "Consulta", "Identificación vacía"]} rows={report.companies.map(c => ({ id: c.name, cells: [c.name, c.total, c.lookupField === "DOCUMENT_ID" ? "Cédula" : c.lookupField === "EMPLOYEE_NUMBER" ? "Número de empleado" : "Sin configurar", c.missingDocument + c.missingEmployee] }))} empty="Sin socios cargados." /></div>
    {!!report.issues.length && <p className="mt-3 whitespace-pre-wrap text-xs text-red-700">{report.issues.join("\n")}</p>}
  </section>;
}

export function SouvenirManager({ companies, isAdmin, userId, view = "home" }: { companies: Company[]; isAdmin: boolean; userId: string; view?: "home" | "carga" }) {
  const [companyId, setCompanyId] = useState("");
  const [chosenCompanyId, setChosenCompanyId] = useState("");
  const [companyModal, setCompanyModal] = useState(false);
  const uploadModal = view === "carga";
  const [deliveryMode, setDeliveryMode] = useState(false);
  const [searchModal, setSearchModal] = useState(false);
  const [lookup, setLookup] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [refresh, setRefresh] = useState(0);
  const [uploadResult, setUploadResult] = useState("");
  const [uploadReport, setUploadReport] = useState<SouvenirReport | null>(null);
  const [existingReport, setExistingReport] = useState<SouvenirReport | null>(null);
  const [numberedMembers, setNumberedMembers] = useState<{ id: string; listNumber: number; firstName: string; lastName: string; office: string | null; approximateLocation: string | null; companyName: string }[]>([]);
  const [auditError, setAuditError] = useState("");
  const [auditRefresh, setAuditRefresh] = useState(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewHash, setPreviewHash] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [companyReview, setCompanyReview] = useState<CompanyReview[]>([]);
  const [companyOptions, setCompanyOptions] = useState<{ id: string; name: string }[]>([]);
  const [companyMappings, setCompanyMappings] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const company = companies.find(c => c.id === companyId);
  const isDocument = company?.dataUpdateLookupField === "DOCUMENT_ID";
  const label = isDocument ? "Cédula" : "Número de empleado";
  const delivered = members.filter(m => m.souvenirDelivery).length;
  const visible = members.filter(m => filter === "ALL" || (filter === "DELIVERED" ? !!m.souvenirDelivery : !m.souvenirDelivery));

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`souvenir-company:${userId}`);
      if (saved && companies.some(c => c.id === saved)) {
        setCompanyId(saved); setChosenCompanyId(saved); setCompanyModal(false);
      }
    } catch { /* The selection still works when browser storage is disabled. */ }
  }, [companies, userId]);

  useEffect(() => {
    if (!uploadModal || !isAdmin) return;
    const controller = new AbortController();
    setAuditError("");
    fetch("/api/souvenir/carga", { signal: controller.signal, cache: "no-store" }).then(readResponse)
      .then(data => { setExistingReport(data.report); setNumberedMembers(data.members || []); })
      .catch(err => { if (!controller.signal.aborted) setAuditError(err.message); });
    return () => controller.abort();
  }, [uploadModal, isAdmin, auditRefresh]);

  useEffect(() => {
    if (!companyId || !deliveryMode) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/souvenir?companyId=${encodeURIComponent(companyId)}`, { signal: controller.signal, cache: "no-store" })
      .then(readResponse).then(data => setMembers(data.members))
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [companyId, refresh, deliveryMode]);

  function resetSearch() {
    setMember(null); setLookup(""); setError("");
    setSearchModal(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function openCompanySelection() {
    let selected = companyId;
    try { selected ||= sessionStorage.getItem(`souvenir-company:${userId}`) || ""; } catch { /* Storage is optional. */ }
    setChosenCompanyId(companies.some(c => c.id === selected) ? selected : "");
    setSearchModal(false);
    setCompanyModal(true);
  }

  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!company || searching) return;
    setSearching(true); setError("");
    try {
      const data = await readResponse(await fetch(`/api/souvenir?companyId=${encodeURIComponent(companyId)}&lookup=${encodeURIComponent(lookup)}`, { cache: "no-store" }));
      setMember(data.member);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo buscar el socio."); }
    finally { setSearching(false); }
  }

  async function confirmDelivery() {
    if (!member || busy || member.souvenirDelivery) return;
    setBusy(true);
    try {
      await readResponse(await fetch("/api/souvenir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, memberId: member.id }) }));
      notify(`Souvenir entregado a ${member.firstName} ${member.lastName}.`, "success");
      resetSearch(); setRefresh(n => n + 1);
    } catch (err) {
      notify(err instanceof Error ? err.message : "No se pudo registrar la entrega.", "error");
      // A competing confirmation must update the visible status before another attempt.
      try { const data = await readResponse(await fetch(`/api/souvenir?companyId=${companyId}&lookup=${lookup}`, { cache: "no-store" })); setMember(data.member); } catch { /* Keep the current result for retry. */ }
      setRefresh(n => n + 1);
    } finally { setBusy(false); }
  }

  function downloadTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([SOUVENIR_HEADERS]);
    sheet["!cols"] = [{ wch: 24 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 45 }];
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Socios");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(companies.map(c => ({ empresa: c.name, identificacion: c.dataUpdateLookupField === "DOCUMENT_ID" ? "Cédula" : "Número de empleado" }))), "Empresas");
    XLSX.writeFile(workbook, "plantilla-socios-souvenir.xlsx");
  }

  async function upload(apply: boolean) {
    if (busy || !uploadFile || (apply && !previewHash)) return;
    const data = new FormData();
    data.set("file", uploadFile);
    data.set("companyMappings", JSON.stringify(companyMappings));
    if (apply) { data.set("action", "apply"); data.set("fileHash", previewHash!); }
    setBusy(true); setApplying(apply); setUploadResult(""); setPreviewHash(null);
    try {
      const response = await fetch("/api/souvenir/carga", { method: "POST", body: data });
      const result = await response.json().catch(() => null);
      setUploadReport(result?.report || null);
      setCompanyReview(result?.companyReview || []);
      setCompanyOptions(result?.companyOptions || []);
      if (!response.ok) throw new Error(result?.error || "No se pudo analizar el archivo.");
      if (apply) {
        setUploadResult(`${result.created} socios agregados. ${result.updated} socios actualizados.`);
        setUploadFile(null);
        setCompanyMappings({}); setCompanyReview([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setRefresh(n => n + 1); setAuditRefresh(n => n + 1); notify("Listado de socios cargado.", "success");
      } else {
        setPreviewHash(result.fileHash);
        setUploadResult(`Archivo válido. ${result.created} socios nuevos y ${result.updated} actualizaciones pendientes de aplicar.`);
      }
    } catch (err) { setUploadResult(err instanceof Error ? err.message : "No se pudo cargar el listado."); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-slate-950">{uploadModal ? "Cargar listado de socios" : "Souvenir Aniversario"}</h1>{deliveryMode && <p className="mt-1 flex items-center gap-2 text-emerald-800"><Building2 size={18} />{company?.name}</p>}</div>
      {uploadModal && <Link href="/entrega-souvenir" className={button}><ArrowLeft size={18} />Volver al inicio</Link>}
      {deliveryMode && <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy || searching} onClick={() => { setDeliveryMode(false); setSearchModal(false); setMember(null); setLookup(""); setError(""); }}><ArrowLeft size={18} />Volver al inicio</button>
        <button className={button} disabled={busy || searching} onClick={() => { setSearchModal(false); setChosenCompanyId(companyId); setCompanyModal(true); }}><Building2 size={18} />Cambiar de empresa</button>
        <button className={button + " bg-emerald-700 text-white"} onClick={resetSearch}><Search size={18} />Buscar socio</button>
      </div>}
    </div>
    {!deliveryMode && !uploadModal && <div className="grid gap-4 sm:grid-cols-2">
      {isAdmin && <Link href="/entrega-souvenir/carga" className="flex min-h-[160px] flex-col items-start justify-between gap-5 rounded-lg border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-emerald-400">
        <Upload size={30} className="text-sky-700" /><span className="text-xl font-bold">Cargar listado de socios</span>
      </Link>}
      <button type="button" className="flex min-h-[180px] flex-col items-start justify-between gap-5 rounded-lg border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-emerald-400" onClick={openCompanySelection}>
        <Gift size={30} className="text-emerald-700" /><span className="text-xl font-bold">Entregar Souvenir</span>
      </button>
      <Link href="/entrega-souvenir/listado" className="flex min-h-[160px] flex-col items-start justify-between gap-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:border-emerald-400"><FileSpreadsheet size={30} className="text-sky-700" /><span className="text-xl font-bold">Consultar listado</span></Link>
      <Link href="/entrega-souvenir/estado" className="flex min-h-[160px] flex-col items-start justify-between gap-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:border-emerald-400"><CheckCircle2 size={30} className="text-emerald-700" /><span className="text-xl font-bold">Estado de Entrega</span></Link>
      <Link href="/entrega-souvenir/imprimir" className="flex min-h-[160px] flex-col items-start justify-between gap-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:border-emerald-400"><Printer size={30} className="text-sky-700" /><span className="text-xl font-bold">Imprimir listado</span></Link>
    </div>}
    {deliveryMode && company && <>
      <div className="grid grid-cols-3 gap-3">{[{ title: "Total de socios", value: members.length, color: "text-slate-900" }, { title: "Entregados", value: delivered, color: "text-emerald-700" }, { title: "Pendientes", value: members.length - delivered, color: "text-amber-700" }].map(item => <div key={item.title} className="border-b-2 border-slate-200 py-3"><p className="text-xs font-semibold text-slate-600 sm:text-sm">{item.title}</p><p className={`mt-1 text-3xl font-bold ${item.color}`}>{loading ? "…" : item.value}</p></div>)}</div>
      <section className="border-t border-slate-200 pt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Listado de socios · {company.name}</h2><ExportExcelButton fileName={`souvenir-${company.name}`} rows={visible.map(m => ({ "No. de listado": m.listNumber, Empresa: company.name, Nombres: m.firstName, Apellidos: m.lastName, "Cédula mostrar": m.displayDocumentId, "Número de empleado": m.employeeNumber, Sexo: m.sex, Oficina: m.office, Unidad: m.unit, "Ubicación aproximada": m.approximateLocation, "Dirección": m.organizationalDirection, "Página del físico": m.physicalListPage, Estado: m.souvenirDelivery ? "Entregado" : "Pendiente", "Fecha de entrega": m.souvenirDelivery ? new Date(m.souvenirDelivery.deliveredAt).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo" }) : "", Responsable: m.souvenirDelivery?.deliveredBy.name }))} /></div>
        <label className="mb-3 block max-w-xs text-sm font-semibold">Estado<select className={field + " mt-1"} value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">Todos</option><option value="PENDING">Pendientes</option><option value="DELIVERED">Entregados</option></select></label>
        <SouvenirTable key={`${companyId}:${filter}`} headers={["No.", "Nombre", "Cédula", "Número de empleado", "Sexo", "Oficina", "Unidad", "Ubicación aproximada", "Estado", "Entrega / responsable"]} rows={visible.map(m => ({ id: m.id, cells: [m.listNumber, `${m.firstName} ${m.lastName}`, m.displayDocumentId, m.employeeNumber, m.sex, m.office, m.unit, m.approximateLocation, m.souvenirDelivery ? "Entregado" : "Pendiente", m.souvenirDelivery ? <span key="date">{new Date(m.souvenirDelivery.deliveredAt).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo" })}<br />{m.souvenirDelivery.deliveredBy.name}</span> : "-"] }))} empty={loading ? "Cargando socios…" : "No hay socios en este listado."} />
      </section>
    </>}
    {companyModal && <Modal title="Seleccionar empresa" onClose={() => setCompanyModal(false)}><label className="block text-sm font-semibold">Empresa<select autoFocus value={chosenCompanyId} onChange={e => setChosenCompanyId(e.target.value)} className={field + " mt-2"}><option value="">Seleccione una empresa</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{!companies.length && <p className="mt-3 text-sm text-amber-700">Configure la identificación de las empresas en Configuración.</p>}<div className="mt-6 flex justify-end gap-2"><button className={button} onClick={() => setCompanyModal(false)}>Cancelar</button><button disabled={!chosenCompanyId} className={button + " bg-emerald-700 text-white"} onClick={() => { try { sessionStorage.setItem(`souvenir-company:${userId}`, chosenCompanyId); } catch { /* Storage is optional. */ } setMembers([]); setCompanyId(chosenCompanyId); setRefresh(n => n + 1); setFilter("ALL"); setDeliveryMode(true); setCompanyModal(false); resetSearch(); }}><Check size={18} />Continuar</button></div></Modal>}
    {deliveryMode && company && searchModal && !member && !companyModal && <Modal title="Buscar socio" onClose={() => { setSearchModal(false); setLookup(""); setError(""); }} busy={searching}>
      <p className="mb-4 flex items-center gap-2 font-semibold text-emerald-800"><Building2 size={18} />{company.name}</p>
      <form onSubmit={search} className="space-y-3">
        <label htmlFor="souvenir-lookup" className="block text-sm font-semibold">{label}</label>
        <input autoFocus ref={searchRef} id="souvenir-lookup" value={lookup} onChange={e => { if (/\D/.test(e.target.value)) notify("Este campo solo acepta números.", "warning"); const digits = e.target.value.replace(/\D/g, ""); setLookup(isDocument ? digits.slice(0, 11) : digits); setError(""); }} inputMode="numeric" autoComplete="off" required minLength={isDocument ? 11 : 1} maxLength={isDocument ? 11 : undefined} className={field} disabled={searching} />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button className={button + " w-full border-emerald-700 bg-emerald-700 text-white"} disabled={searching || loading}><Search size={18} />{searching ? "Buscando…" : "Buscar"}</button>
      </form>
      <button className={button + " mt-3 w-full"} disabled={searching} onClick={() => { setSearchModal(false); setChosenCompanyId(companyId); setCompanyModal(true); setLookup(""); setError(""); }}><Building2 size={18} />Cambiar de empresa</button>
    </Modal>}
    {member && <Modal title={member.souvenirDelivery ? "Souvenir ya entregado" : "Confirmar entrega"} onClose={resetSearch} busy={busy}>
      <div className="mb-5 flex items-center gap-3 text-emerald-800">{member.souvenirDelivery ? <CheckCircle2 size={28} /> : <Gift size={28} />}<p className="text-lg font-bold">{member.firstName} {member.lastName}</p></div>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{[["No. de listado", member.listNumber], ["Empresa", company?.name], ["Cédula", member.displayDocumentId], ["Número de empleado", member.employeeNumber], ["Sexo", member.sex], ["Oficina", member.office], ["Unidad", member.unit], ["Ubicación aproximada", member.approximateLocation], ...(member.organizationalDirection ? [["Dirección", member.organizationalDirection]] : []), ...(member.physicalListPage ? [["Página del listado físico", member.physicalListPage]] : [])].map(([key, value]) => <div key={key}><dt className="text-xs font-semibold text-slate-500">{key}</dt><dd className="mt-1 break-words text-sm font-semibold">{value || "Sin registrar"}</dd></div>)}</dl>
      {member.souvenirDelivery && <p role="status" className="mt-5 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">Entregado el {new Date(member.souvenirDelivery.deliveredAt).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo" })} por {member.souvenirDelivery.deliveredBy.name}.</p>}
      <div className="mt-6 grid grid-cols-2 gap-3"><button className={button} disabled={busy} onClick={resetSearch}>Cancelar</button><button className={button + " border-emerald-700 bg-emerald-700 text-white"} disabled={busy || !!member.souvenirDelivery} onClick={confirmDelivery}><Check size={18} />{busy ? "Guardando…" : "Entregado"}</button></div>
    </Modal>}
    {uploadModal && <section>
      <button className={button + " mb-5"} onClick={downloadTemplate}><Download size={18} />Descargar plantilla</button>
      <form onSubmit={e => { e.preventDefault(); void upload(false); }} className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-semibold">Archivo Excel</p>
          <input ref={fileInputRef} aria-label="Archivo Excel" name="file" type="file" accept=".xlsx,.xls" className="sr-only" disabled={busy} onChange={e => { setUploadFile(e.currentTarget.files?.[0] || null); setPreviewHash(null); setUploadResult(""); setUploadReport(null); setCompanyReview([]); setCompanyMappings({}); }} />
          <button type="button" className={button + " w-full bg-slate-50"} disabled={busy} onClick={() => fileInputRef.current?.click()}><FileSpreadsheet size={20} />{uploadFile ? "Cambiar archivo Excel" : "Seleccionar archivo Excel"}</button>
          {uploadFile ? <div className="mt-3 flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3"><div className="min-w-0"><p className="break-all text-sm font-semibold">{uploadFile.name}</p><p className="mt-1 text-xs text-slate-500">{(uploadFile.size / 1024).toLocaleString("es-DO", { maximumFractionDigits: 1 })} KB</p></div><button type="button" title="Quitar archivo" aria-label="Quitar archivo" className={button + " shrink-0 !px-2"} disabled={busy} onClick={() => { setUploadFile(null); setPreviewHash(null); setUploadResult(""); setUploadReport(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}><X size={17} /></button></div> : <p className="mt-2 text-sm text-slate-500">Ningún archivo seleccionado</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button className={button} disabled={busy || !uploadFile}><Search size={18} />{busy && !applying ? "Analizando…" : "Analizar archivo"}</button>
          <button type="button" className={button + " border-emerald-700 bg-emerald-700 text-white"} disabled={busy || !previewHash} onClick={() => void upload(true)}><Check size={18} />{busy && applying ? "Aplicando…" : "Aplicar carga"}</button>
        </div>
      </form>
      {!!companyReview.length && <section className="mt-5 border-t border-amber-200 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Revisar empresas del archivo</h3><a href="/configuracion?tab=empresas" target="_blank" rel="noopener noreferrer" className={button}>Configurar empresas</a></div>
        <div className="mt-3"><SouvenirTable headers={["Nombre recibido / filas", "Validación", "Sugerencia", "Empresa correcta"]} rows={companyReview.map(item => ({ id: item.key, cells: [
          <div key="name"><strong>{item.name}</strong><p className="mt-1 text-xs text-slate-600">Filas: {item.rows.slice(0, 20).join(", ")}{item.rows.length > 20 ? ` y ${item.rows.length - 20} más` : ""}</p></div>,
          <span key="status" className="text-amber-800">{{ SIMILAR: "Nombre parecido; confirme la empresa.", NEW: "Empresa nueva: agréguela y configure su identificación.", DELETED: "Empresa eliminada: agréguela de nuevo para recuperarla.", INACTIVE: "Empresa inactiva: actívela en Configuración.", UNCONFIGURED: "Configure la consulta por cédula o empleado.", AMBIGUOUS: "Varias coincidencias: seleccione la correcta." }[item.status]}</span>,
          item.suggestions.map(s => s.name).join(", ") || "Sin coincidencias",
          <select key="select" aria-label={`Empresa correcta para ${item.name}`} className={field} disabled={busy || !item.key} value={companyMappings[item.key] || ""} onChange={e => { setCompanyMappings(current => ({ ...current, [item.key]: e.target.value })); setPreviewHash(null); setUploadResult(""); }}><option value="">Seleccione la empresa correcta</option>{companyOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
        ] }))} /></div>
      </section>}
      {uploadResult && <p role="status" className="mt-4 whitespace-pre-wrap text-sm">{uploadResult}</p>}
      {uploadReport && <UploadReport report={uploadReport} title="Resumen del archivo" />}
      {auditError && <p role="alert" className="mt-4 text-sm text-red-700">{auditError}</p>}
      {existingReport && <UploadReport report={existingReport} title="Listado actualmente cargado" />}
      {!!numberedMembers.length && <section className="mt-5 border-t border-slate-200 pt-4"><h3 className="mb-3 font-bold">Listado numerado</h3><SouvenirTable headers={["No.", "Nombres", "Apellidos", "Empresa", "Oficina", "Ubicación aproximada"]} rows={numberedMembers.map(m => ({ id: m.id, cells: [m.listNumber, m.firstName, m.lastName, m.companyName, m.office, m.approximateLocation] }))} /></section>}
    </section>}
  </div>;
}
