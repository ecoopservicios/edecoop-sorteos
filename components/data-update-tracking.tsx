"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { summarizeDataUpdates, type TrackingMember, type TrackingUpdate } from "@/lib/data-update-tracking";
import { RefreshDataButton } from "@/components/data-refresh";

export function DataUpdateIndicators({ members, updates }: { members: TrackingMember[]; updates: TrackingUpdate[] }) {
  const rows = summarizeDataUpdates(members, updates);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const updated = rows.reduce((sum, row) => sum + row.updated, 0);
  const today = rows.reduce((sum, row) => sum + row.today, 0);
  return <section className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black">Avance por empresa</h2><RefreshDataButton /></div>
    <dl className="grid grid-cols-2 gap-4 border-y border-slate-200 py-4 lg:grid-cols-4">
      {[{ label: "Socios", value: total }, { label: "Actualizados", value: updated }, { label: "Pendientes", value: total - updated }].map((item) => <div key={item.label}><dt className="text-sm text-slate-600">{item.label}</dt><dd className="flex min-h-11 items-center text-2xl font-bold">{item.value.toLocaleString("es-DO")}</dd></div>)}
      <div><dt className="text-sm text-slate-600">Recibidos hoy</dt><dd className="flex min-h-11 items-center text-2xl font-bold">{today}</dd></div>
    </dl>
    <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-100"><tr>{["Empresa", "Socios", "Actualizados", "Pendientes", "Hoy", "Avance"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>
      {rows.map((row) => <tr key={row.companyName} className="border-b border-slate-200"><th scope="row" className="px-3 py-3 font-semibold">{row.companyName}</th><td className="px-3">{row.total.toLocaleString("es-DO")}</td><td className="px-3 text-emerald-800">{row.updated.toLocaleString("es-DO")}</td><td className="px-3 text-amber-800">{row.pending.toLocaleString("es-DO")}</td><td className="px-3">{row.today}</td><td className="px-3"><div className="flex items-center gap-2"><progress aria-label={`Avance de ${row.companyName}`} value={row.updated} max={row.total || 1} className="h-2 w-20 accent-emerald-700" /><span>{row.percent}%</span></div></td></tr>)}
      {!rows.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No hay socios para las empresas seleccionadas.</td></tr>}
    </tbody></table></div>
  </section>;
}

export function DataUpdatePagination({ total, page, size, onPage, onSize }: { total: number; page: number; size: number; onPage: (page: number) => void; onSize: (size: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <nav aria-label="Paginación del listado" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm">
    <span>{total ? (page - 1) * size + 1 : 0}–{Math.min(page * size, total)} de {total}</span>
    <label className="flex items-center gap-2">Por página<select aria-label="Registros por página" value={size} onChange={(event) => onSize(Number(event.target.value))} className="h-11 rounded-md border border-slate-300 bg-white px-2">{[25, 50, 100].map((value) => <option key={value}>{value}</option>)}</select></label>
    <div className="flex items-center gap-2"><button type="button" aria-label="Página anterior" title="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)} className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 disabled:opacity-40"><ChevronLeft size={18} /></button><label className="flex items-center gap-2">Página<input aria-label="Número de página" type="number" min={1} max={pages} value={page} onChange={(event) => { const next = Number(event.target.value); if (next >= 1 && next <= pages) onPage(next); }} className="h-11 w-16 rounded-md border border-slate-300 px-2" />de {pages}</label><button type="button" aria-label="Página siguiente" title="Página siguiente" disabled={page >= pages} onClick={() => onPage(page + 1)} className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 disabled:opacity-40"><ChevronRight size={18} /></button></div>
  </nav>;
}
