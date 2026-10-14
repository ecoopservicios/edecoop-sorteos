"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { compareSouvenirCompanies } from "@/lib/souvenir-order";
import { notify } from "@/lib/toast";
import { souvenirPrintSheets, type SouvenirPrintMember } from "@/lib/souvenir-print";
import styles from "@/components/souvenir-print.module.css";

const field = "mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50";
const columns = ["No.", "Nombres", "Apellidos", "Cédula", "No. empleado", "Empresa", "Firma"];

export function SouvenirPrint({ members }: { members: SouvenirPrintMember[] }) {
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [downloading, setDownloading] = useState(false);
  const companies = [...new Map(members.map(m => [m.companyId, m.companyName])).entries()].sort((a, b) => compareSouvenirCompanies(a[1], b[1]));
  const allSheets = souvenirPrintSheets(members.filter(m => !company || m.companyId === company));
  const locations = [...new Set(allSheets.map(s => s.location))];
  const sheets = allSheets.filter(s => !location || s.location === location);
  const total = sheets.reduce((n, s) => n + s.members.length, 0);
  async function download() {
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(`/api/souvenir/imprimir?${new URLSearchParams({ companyId: company, location })}`, { cache: "no-store" });
      if (!response.ok) { const result = await response.json().catch(() => null); throw new Error(result?.error || "No se pudo descargar el listado."); }
      const blob = await response.blob(), url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "souvenir-aniversario.pdf";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      notify("PDF del listado descargado.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "Error al descargar.", "error"); }
    finally { setDownloading(false); }
  }
  return <main className={styles.root}>
    <div className={styles.controls + " mx-auto mb-6 max-w-5xl space-y-4 p-4 sm:p-6"}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Imprimir listado · Souvenir Aniversario</h1><Link href="/entrega-souvenir" className={button}><ArrowLeft size={18} />Volver al inicio</Link></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Empresa<select aria-label="Empresa" className={field} value={company} onChange={e => { setCompany(e.target.value); setLocation(""); }}><option value="">Todas las empresas</option>{companies.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label className="text-sm font-semibold">Ubicación aproximada<select aria-label="Ubicación aproximada" className={field} value={location} onChange={e => setLocation(e.target.value)}><option value="">Todas las ubicaciones</option>{locations.map(o => <option key={o}>{o}</option>)}</select></label></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">{new Set(sheets.map(s => s.location)).size} ubicaciones · {total} socios</p><div className="flex flex-wrap gap-2"><button type="button" disabled={!sheets.length || downloading} className={button + " border-emerald-700 bg-emerald-700 text-white"} onClick={() => void download()}><Download size={18} />{downloading ? "Generando PDF…" : "Descargar PDF"}</button><button type="button" disabled={!sheets.length} className={button} onClick={() => window.print()}><Printer size={18} />Imprimir listado</button></div></div>
    </div>
    {!sheets.length && <p className={styles.controls + " p-6 text-center text-slate-500"}>No hay socios para imprimir.</p>}
    {sheets.map((sheet, index) => <section key={`${sheet.companyId}:${sheet.location}:${sheet.page}`} className={styles.sheet} aria-label={`Ubicación aproximada ${sheet.location}, página ${index + 1}`}>
      <header className={styles.heading}><h2>Entrega de Souvenir Aniversario · EDECOOP</h2><p className="mb-2 text-sm font-semibold">Empresa: {sheet.companyName}</p><div><strong>Ubicación aproximada: {sheet.location}</strong><span>Cantidad: {sheet.total} socios</span></div></header>
      <table className={styles.table}><colgroup>{[5, 17, 19, 12, 10, 13, 24].map((width, i) => <col key={i} style={{ width: `${width}%` }} />)}</colgroup><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{sheet.members.map(m => <tr key={m.id}>{[m.listNumber, m.firstName, m.lastName, m.displayDocumentId || "-", m.employeeNumber || "-", m.companyName, ""].map((value, index) => <td key={index} data-label={columns[index]} className={index === 6 ? styles.signature : undefined}>{value}</td>)}</tr>)}</tbody></table>
      <footer className={styles.footer}>Ubicación aproximada: {sheet.location} · Página {index + 1} de {sheets.length}</footer>
    </section>)}
  </main>;
}
