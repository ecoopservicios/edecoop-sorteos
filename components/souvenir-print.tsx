"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { compareSouvenirCompanies } from "@/lib/souvenir-order";
import { notify } from "@/lib/toast";
import { souvenirPrintSheets, souvenirPrintIndicators, SOUVENIR_PRINT_COLUMNS, SOUVENIR_PRINT_WIDTHS, type SouvenirPrintMember } from "@/lib/souvenir-print";
import styles from "@/components/souvenir-print.module.css";
import { CompanyMultiFilter, MultiSelectFilter } from "@/components/company-multi-filter";
import { matchesSouvenirFilters, souvenirOfficeLabel, souvenirOfficeKey, SOUVENIR_STATUS_OPTIONS } from "@/lib/souvenir-filters";
import { souvenirLocationKey } from "@/lib/souvenir-order";

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50";
const columns = SOUVENIR_PRINT_COLUMNS;

export function SouvenirPrint({ members }: { members: SouvenirPrintMember[] }) {
  const [company, setCompany] = useState<string[]>([]);
  const [location, setLocation] = useState<string[]>([]);
  const [office, setOffice] = useState<string[]>([]);
  const [state, setState] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const companies = [...new Map(members.map(m => [m.companyId, m.companyName])).entries()].sort((a, b) => compareSouvenirCompanies(a[1], b[1]));
  const companyRows = members.filter(m => !company.length || company.includes(m.companyId));
  const offices = [...new Map(companyRows.map(m => [souvenirOfficeKey(m.office), souvenirOfficeLabel(m.office)])).entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  const availableSheets = souvenirPrintSheets(companyRows.filter(m => !office.length || office.includes(souvenirOfficeKey(m.office))));
  const locations: [string, string][] = [...new Set(availableSheets.map(s => s.location))].map(label => [souvenirLocationKey(label), label]);
  const sheets = souvenirPrintSheets(members.filter(m => matchesSouvenirFilters(m, { companies: company, offices: office, locations: location, states: state })));
  const total = sheets.reduce((n, s) => n + s.members.length, 0);
  async function download() {
    if (downloading) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      company.forEach(id => params.append("companyId", id));
      office.forEach(value => params.append("office", value));
      location.forEach(value => params.append("location", value));
      state.forEach(value => params.append("state", value));
      const response = await fetch(`/api/souvenir/imprimir?${params}`, { cache: "no-store" });
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
      <div className="grid gap-4 sm:grid-cols-2"><CompanyMultiFilter options={companies} value={company} onChange={value => { setCompany(value); setLocation([]); setOffice([]); }} /><MultiSelectFilter label="Oficina" allLabel="Todas las oficinas" options={offices} value={office} onChange={value => { setOffice(value); setLocation([]); }} /><MultiSelectFilter label="Ubicación aproximada" allLabel="Todas las ubicaciones" options={locations} value={location} onChange={setLocation} /><MultiSelectFilter label="Estado" allLabel="Todos los estados" options={SOUVENIR_STATUS_OPTIONS} value={state} onChange={setState} /></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">{new Set(sheets.map(s => s.location)).size} ubicaciones · {total} socios</p><div className="flex flex-wrap gap-2"><button type="button" disabled={!sheets.length || downloading} className={button + " border-emerald-700 bg-emerald-700 text-white"} onClick={() => void download()}><Download size={18} />{downloading ? "Generando PDF…" : "Descargar PDF"}</button><button type="button" disabled={!sheets.length} className={button} onClick={() => window.print()}><Printer size={18} />Imprimir listado</button></div></div>
    </div>
    {!sheets.length && <p className={styles.controls + " p-6 text-center text-slate-500"}>No hay socios para imprimir.</p>}
    {sheets.map((sheet, index) => <section key={`${sheet.companyId}:${sheet.location}:${sheet.page}`} className={styles.sheet} aria-label={`Ubicación aproximada ${sheet.location}, página ${index + 1}`}>
      <header className={styles.heading}><h2>Entrega de Souvenir Aniversario · EDECOOP</h2><strong>Empresa: {sheet.companyName}</strong><strong>Ubicación: {sheet.location}</strong><span>{sheet.total} socios</span></header>
      <table className={styles.table}><colgroup>{SOUVENIR_PRINT_WIDTHS.map((width, i) => <col key={i} style={{ width: `${width / 768 * 100}%` }} />)}</colgroup><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{sheet.members.map(m => <tr key={m.id}>{[m.listNumber, m.firstName, m.lastName, m.displayDocumentId || "-", m.employeeNumber || "-", m.companyName, ...souvenirPrintIndicators(m), ""].map((value, index) => <td key={index} data-label={columns[index]} className={index === columns.length - 1 ? styles.signature : undefined}>{value}</td>)}</tr>)}</tbody></table>
      <footer className={styles.footer}>Página {index + 1} de {sheets.length}</footer>
    </section>)}
  </main>;
}
