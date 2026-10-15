"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Search, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { compareSouvenirCompanies, compareSouvenirMembers, souvenirLocationKey, souvenirLocationLabel } from "@/lib/souvenir-order";
import { notify } from "@/lib/toast";
import { SouvenirTable } from "@/components/souvenir-table";
import { CompanyMultiFilter, MultiSelectFilter } from "@/components/company-multi-filter";
import { matchesSouvenirFilters, souvenirOfficeLabel, souvenirOfficeKey, SOUVENIR_STATUS_OPTIONS } from "@/lib/souvenir-filters";
import { useDataRefresh } from "@/components/data-refresh";

type Row = {
  id: string; listNumber: number | null; companyId: string; companyName: string; firstName: string; lastName: string; fullName: string;
  documentId: string | null; displayDocumentId: string | null; employeeNumber: string | null;
  sex: string | null; office: string | null; unit: string | null; approximateLocation: string | null; organizationalDirection: string | null;
  physicalListPage: number | null; clearedAt: string | null; deliveredAt: string | null; responsible: string | null;
  collectedByOther: boolean; collectorEmployeeNumber: string | null; collectorName: string | null;
};
const input = "h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-base";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50";
const key = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo" }) : "";

function summary(rows: Row[]) {
  const groups = new Map<string, { Empresa: string; Total: number; Pendientes: number; Entregados: number; "Entrega %": number }>();
  for (const row of rows) {
    const item = groups.get(row.companyId) || { Empresa: row.companyName, Total: 0, Pendientes: 0, Entregados: 0, "Entrega %": 0 };
    item.Total++; if (row.deliveredAt) item.Entregados++; else item.Pendientes++;
    item["Entrega %"] = Math.round(item.Entregados / item.Total * 100);
    groups.set(row.companyId, item);
  }
  return [...groups.values()].sort((a, b) => compareSouvenirCompanies(a.Empresa, b.Empresa));
}

export function SouvenirList({ view, isAdmin }: { view: "listado" | "estado"; isAdmin: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [company, setCompany] = useState<string[]>([]);
  const [location, setLocation] = useState<string[]>([]);
  const [office, setOffice] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [clearCompany, setClearCompany] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    fetch(`/api/souvenir/listado?view=${view}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const result = await response.json().catch(() => null); if (!response.ok || !result) throw new Error(result?.error || "No se pudo cargar el listado."); return result; })
      .then(data => setRows(data.members.sort(compareSouvenirMembers)))
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [view, refresh]);
  useDataRefresh(async () => {
    const response = await fetch(`/api/souvenir/listado?view=${view}`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error || "No se pudo actualizar el listado.");
    setRows(data.members.sort(compareSouvenirMembers)); setError("");
  });
  const companies = [...new Map(rows.map(row => [row.companyId, row.companyName])).entries()].sort((a, b) => compareSouvenirCompanies(a[1], b[1]));
  const query = key(search);
  const companyRows = rows.filter(row => !company.length || company.includes(row.companyId));
  const offices = [...new Map(companyRows.map(row => [souvenirOfficeKey(row.office), souvenirOfficeLabel(row.office)])).entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  const locations = [...new Map(companyRows.filter(row => !office.length || office.includes(souvenirOfficeKey(row.office))).map(row => [souvenirLocationKey(row.approximateLocation), souvenirLocationLabel(row.approximateLocation)])).entries()];
  const filtered = rows.filter(row => matchesSouvenirFilters({ ...row, delivered: !!row.deliveredAt }, { companies: company, offices: office, locations: location, states: state }) && (!query || [row.fullName, row.employeeNumber || "", row.documentId || ""].some(value => key(value).includes(query))));
  const quantities = summary(filtered);
  const total = quantities.reduce((sum, row) => sum + row.Total, 0);
  const delivered = quantities.reduce((sum, row) => sum + row.Entregados, 0);

  function download() {
    if (!rows.length) { notify("No hay registros para descargar.", "warning"); return; }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(quantities), "Resumen por empresa");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(filtered.map(row => ({ "No. de listado": row.listNumber, Empresa: row.companyName, Nombres: row.firstName, Apellidos: row.lastName, "Nombre completo": row.fullName, "Cédula consulta": row.documentId, "Cédula mostrar": row.displayDocumentId, "Número de empleado": row.employeeNumber, Sexo: row.sex, Oficina: row.office, Unidad: row.unit, "Ubicación aproximada": row.approximateLocation, Dirección: row.organizationalDirection, "Página del físico": row.physicalListPage, Estado: row.deliveredAt ? "Entregado" : "Pendiente", "Fecha de entrega": dateLabel(row.deliveredAt), Responsable: row.responsible, "Retiró": row.deliveredAt ? row.collectedByOther ? "Otro socio de EDESUR" : "El socio" : "", "Empleado que retiró": row.collectorEmployeeNumber, "Nombre de quien retiró": row.collectorName, "Retirado del listado": row.clearedAt ? "Sí" : "No" }))), "Detalle");
    XLSX.writeFile(workbook, `souvenir-${view}.xlsx`); notify("Excel descargado.", "success");
  }

  async function clear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true);
    try {
      const response = await fetch("/api/souvenir/listado", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation, reason, companyId: clearCompany }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) throw new Error(result?.error || "No se pudo limpiar el listado.");
      notify(`${result.count} socios retirados del listado. Estado de Entrega conservado.`, "success");
      setClearing(false); setConfirmation(""); setReason(""); setCompany([]); setLocation([]); setOffice([]); setRefresh(n => n + 1);
    } catch (e) { notify(e instanceof Error ? e.message : "No se pudo limpiar el listado.", "error"); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{view === "listado" ? "Consultar listado" : "Estado de Entrega"}</h1><Link href="/entrega-souvenir" className={button}><ArrowLeft size={18} />Volver al inicio</Link></header>
    <nav className="flex flex-wrap gap-2" aria-label="Secciones de souvenir"><Link href="/entrega-souvenir/listado" className={button} aria-current={view === "listado" ? "page" : undefined}>Consultar listado</Link><Link href="/entrega-souvenir/estado" className={button} aria-current={view === "estado" ? "page" : undefined}>Estado de Entrega</Link><Link href="/entrega-souvenir/imprimir" className={button}>Imprimir listado</Link>{isAdmin && <Link href="/entrega-souvenir/carga" className={button}>Cargar listado</Link>}</nav>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <section className="grid gap-3 border-y border-slate-200 py-4 md:grid-cols-2 xl:grid-cols-4">
      <CompanyMultiFilter options={companies} value={company} onChange={value => { setCompany(value); setLocation([]); setOffice([]); }} />
      <MultiSelectFilter label="Oficina" allLabel="Todas las oficinas" options={offices} value={office} onChange={value => { setOffice(value); setLocation([]); }} />
      <MultiSelectFilter label="Ubicación aproximada" allLabel="Todas las ubicaciones" options={locations} value={location} onChange={setLocation} />
      <label className="text-sm font-semibold">Buscar socio<div className="relative mt-1"><Search size={18} className="absolute left-3 top-3 text-slate-500" /><input className={input + " !pl-10"} value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, empleado o cédula" /></div></label>
      <MultiSelectFilter label="Estado" allLabel="Todos los estados" options={SOUVENIR_STATUS_OPTIONS} value={state} onChange={setState} />
    </section>
    <section><h2 className="mb-3 text-lg font-bold">{view === "listado" ? "Cantidades por empresa" : "Entregas por empresa"}</h2>
      <dl className="mb-4 grid grid-cols-3 gap-3">{[["Socios", total], ["Pendientes", total - delivered], ["Entregados", delivered]].map(([label, value]) => <div key={label} className="border-b-2 border-slate-200 pb-3"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 text-2xl font-bold">{loading ? "..." : value}</dd></div>)}</dl>
      <SouvenirTable headers={["Empresa", "Total", "Pendientes", "Entregados", "% de entrega"]} rows={quantities.map(row => ({ id: row.Empresa, cells: [row.Empresa, row.Total, <span key="pending" className="text-amber-700">{row.Pendientes}</span>, <span key="delivered" className="text-emerald-700">{row.Entregados}</span>, `${row["Entrega %"]}%`] }))} empty={loading ? "Cargando..." : "Sin registros."} />
    </section>
    <section><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Detalle de socios ({filtered.length})</h2><div className="flex flex-wrap gap-2"><button className={button} disabled={loading} onClick={download}><Download size={18} />Descargar Excel</button>{view === "listado" && isAdmin && <button className={button + " border-red-200 text-red-700"} disabled={loading || !rows.length} onClick={() => setClearing(true)}><Trash2 size={18} />Limpiar listado</button>}</div></div>
      <SouvenirTable key={`${company}:${office}:${location}:${search}:${state}`} headers={["No.", "Empresa", "Nombre", "Cédula consulta", "Cédula mostrar", "Empleado", "Sexo", "Oficina", "Unidad", "Ubicación aproximada", "Estado", "Fecha / responsable", "Quién retiró"]} rows={filtered.map(row => ({ id: row.id, group: `${row.companyName} · ${souvenirLocationLabel(row.approximateLocation)}`, cells: [row.listNumber, row.companyName, row.fullName, row.documentId, row.displayDocumentId, row.employeeNumber, row.sex, row.office, row.unit, row.approximateLocation, row.deliveredAt ? "Entregado" : "Pendiente", <span key="date">{dateLabel(row.deliveredAt)}<br />{row.responsible}</span>, row.deliveredAt ? row.collectedByOther ? `${row.collectorName} · EDESUR · ${row.collectorEmployeeNumber}` : "El socio" : "-"] }))} empty={loading ? "Cargando..." : "Sin coincidencias."} />
    </section>
    {clearing && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"><form role="dialog" aria-modal="true" aria-label="Limpiar listado" onSubmit={clear} className="w-full max-w-lg space-y-4 rounded-lg bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Limpiar listado</h2><button type="button" className={button} title="Cerrar" disabled={busy} onClick={() => setClearing(false)}><X size={18} /></button></div>
      <p className="text-sm text-slate-700">Se eliminarán definitivamente los socios de la empresa seleccionada o de todo el listado de Souvenir Aniversario, sin copia oculta. Las entregas realizadas conservarán sus datos, fechas y responsables. Esta eliminación no se puede deshacer.</p>
      <label className="block text-sm font-semibold">Empresa a limpiar<select aria-label="Empresa a limpiar" className={input + " mt-1"} value={clearCompany} onChange={e => setClearCompany(e.target.value)}><option value="">Todo el listado</option>{companies.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="block text-sm font-semibold">Motivo<textarea required minLength={5} value={reason} onChange={e => setReason(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 p-3" /></label>
      <label className="block text-sm font-semibold">Escriba LIMPIAR<input required value={confirmation} onChange={e => setConfirmation(e.target.value)} className={input + " mt-1"} /></label>
      <div className="flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={() => setClearing(false)}>Cancelar</button><button className={button + " bg-red-700 text-white"} disabled={busy || confirmation !== "LIMPIAR" || reason.trim().length < 5}>{busy ? "Limpiando..." : "Confirmar limpieza"}</button></div>
    </form></div>}
  </div>;
}
