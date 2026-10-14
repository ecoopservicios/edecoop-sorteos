"use client";

import { ReactNode, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function SouvenirTable({ headers, rows, empty = "Sin registros.", pageSize = 10 }: {
  headers: string[]; rows: { id: string; cells: ReactNode[] }[]; empty?: string; pageSize?: number;
}) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);
  return <div className="min-w-0">
    <table role="table" className="block w-full rounded-md border border-slate-200 text-left text-sm lg:table lg:table-fixed">
      <thead role="rowgroup" className="hidden bg-slate-100 lg:table-header-group"><tr role="row">{headers.map(h => <th key={h} role="columnheader" className="p-3 align-top [overflow-wrap:anywhere]">{h}</th>)}</tr></thead>
      <tbody role="rowgroup" className="block lg:table-row-group">
        {visible.map(row => <tr key={row.id} role="row" className="grid grid-cols-1 border-t border-slate-200 first:border-t-0 sm:grid-cols-2 lg:table-row lg:first:border-t">
          {row.cells.map((cell, i) => <td key={headers[i]} role="cell" className="block min-w-0 p-3 align-top [overflow-wrap:anywhere] lg:table-cell"><span className="mb-1 block text-xs font-semibold text-slate-500 lg:hidden">{headers[i]}</span>{cell ?? "-"}</td>)}
        </tr>)}
        {!rows.length && <tr role="row" className="block lg:table-row"><td role="cell" colSpan={headers.length} className="block p-5 text-center text-slate-500 lg:table-cell">{empty}</td></tr>}
      </tbody>
    </table>
    {pages > 1 && <nav aria-label="Páginas de la tabla" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span>{(current - 1) * pageSize + 1}–{Math.min(current * pageSize, rows.length)} de {rows.length}</span>
      <div className="flex items-center gap-3"><button type="button" aria-label="Página anterior" title="Página anterior" disabled={current === 1} onClick={() => setPage(current - 1)} className="flex h-10 w-10 items-center justify-center rounded-md border disabled:opacity-40"><ChevronLeft size={18} /></button><span>{current} / {pages}</span><button type="button" aria-label="Página siguiente" title="Página siguiente" disabled={current === pages} onClick={() => setPage(current + 1)} className="flex h-10 w-10 items-center justify-center rounded-md border disabled:opacity-40"><ChevronRight size={18} /></button></div>
    </nav>}
  </div>;
}
