"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileDown, ImageUp, Plus, Trash2, Upload } from "lucide-react";
import { notify } from "@/lib/toast";
import { ExportExcelButton } from "@/components/export-excel-button";

type WinnerRow = {
  id: string;
  ref: number;
  winnerId: string;
  name: string;
  prize: string;
  location: string;
};

type ReportRow = {
  id: string;
  name: string;
  reportDate: string;
  headerImagePath: string | null;
  footerImagePath: string | null;
  winners: WinnerRow[];
};

type UploadResult = {
  processed: number;
  created: number;
  rejected: number;
  errors: Array<{ row: number; message: string }>;
};

function actionButtonClass(tone: "neutral" | "green" | "red") {
  const colors = {
    neutral: "border-slate-300 text-slate-700 hover:bg-slate-100",
    green: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    red: "border-red-200 text-red-700 hover:bg-red-50"
  };
  return `inline-flex h-9 w-9 items-center justify-center rounded-md border ${colors[tone]}`;
}

export function WinnersManager({ reports }: { reports: ReportRow[] }) {
  const router = useRouter();
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState(reports[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const selected = reports.find((report) => report.id === selectedId) || reports[0] || null;

  async function createReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    const response = await fetch("/api/ganadores/reportes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        reportDate: form.get("reportDate")
      })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      notify(data.error || "No se pudo crear el reporte.", "error");
      return;
    }
    notify("Reporte creado.", "success");
    setSelectedId(data.report.id);
    router.refresh();
    formElement.reset();
  }

  async function uploadImages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const response = await fetch(`/api/ganadores/reportes/${selected.id}/imagenes`, {
      method: "POST",
      body: form
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      notify(data.error || "No se pudieron guardar las imágenes.", "error");
      return;
    }
    notify("Imágenes guardadas.", "success");
    router.refresh();
  }

  async function uploadExcel(event: ChangeEvent<HTMLInputElement>) {
    if (!selected) return;
    const inputElement = event.currentTarget;
    const file = inputElement.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    setBusy(true);
    setUploadResult(null);
    const response = await fetch(`/api/ganadores/reportes/${selected.id}/ganadores`, {
      method: "POST",
      body: form
    });
    const data = await response.json();
    setBusy(false);
    inputElement.value = "";
    setUploadResult(data);
    if (!response.ok) {
      notify(data.error || "Revise los errores del archivo.", "error");
      return;
    }
    notify(`Ganadores cargados: ${data.created}.`, data.rejected ? "info" : "success");
    router.refresh();
  }

  async function deleteReport() {
    if (!selected) return;
    if (!confirm(`Eliminar el reporte "${selected.name}"?`)) return;
    setBusy(true);
    const response = await fetch(`/api/ganadores/reportes/${selected.id}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      notify("No se pudo eliminar el reporte.", "error");
      return;
    }
    notify("Reporte eliminado.", "success");
    setSelectedId("");
    router.refresh();
  }

  async function clearWinners() {
    if (!selected) return;
    if (!confirm(`Borrar todos los ganadores cargados en "${selected.name}"?`)) return;
    setBusy(true);
    const response = await fetch(`/api/ganadores/reportes/${selected.id}/ganadores/limpiar`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      notify(data.error || "No se pudo borrar la tabla de ganadores.", "error");
      return;
    }

    notify(`Tabla de ganadores borrada. Registros eliminados: ${data.deleted}.`, "success");
    router.refresh();
  }

  async function generatePdf() {
    if (!selected) return;
    setBusy(true);
    const response = await fetch(`/api/ganadores/reportes/${selected.id}/pdf`, { credentials: "include" });
    setBusy(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        notify(data.error || "La sesión caducó. Debe iniciar sesión nuevamente.", "error");
        window.location.replace("/login?expired=1");
        return;
      }
      notify(data.error || "No se pudo generar el PDF.", "error");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.name.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "ganadores"}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify("PDF generado correctamente.", "success");
  }

  return (
    <div className="grid min-w-0 gap-4">
      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-black text-slate-950">Crear reporte</h2>
        <form onSubmit={createReport} className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
          <label className="block min-w-0">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Nombre del reporte</span>
            <input name="name" required placeholder="Gran Sorteo Papá 2024" className="h-11 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Fecha</span>
            <input name="reportDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="h-11 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <button disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60 sm:w-auto lg:w-auto">
            <Plus size={17} />
            Crear
          </button>
        </form>
      </section>

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block min-w-0">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Reporte seleccionado</span>
            <select value={selected?.id || ""} onChange={(event) => setSelectedId(event.target.value)} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              {reports.length === 0 ? <option value="">No hay reportes creados</option> : null}
              {reports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap lg:justify-end">
            <a href="/api/ganadores/plantilla" className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100">
              <Download size={17} />
              Plantilla Excel
            </a>
            {selected ? (
              <>
                <button type="button" onClick={generatePdf} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
                  <FileDown size={17} />
                  Generar PDF
                </button>
                <button type="button" onClick={deleteReport} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-red-200 px-4 py-2 font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">
                  <Trash2 size={17} />
                  Eliminar
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {selected ? (
        <>
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-black text-slate-950">Imágenes del PDF</h2>
            <form onSubmit={uploadImages} className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
              <label className="block min-w-0">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Imagen de cabecera</span>
                <input name="headerImage" type="file" accept="image/*" className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Imagen de cierre</span>
                <input name="footerImage" type="file" accept="image/*" className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
              <button disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60 sm:w-auto lg:w-auto">
                <ImageUp size={17} />
                Guardar imágenes
              </button>
            </form>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="mb-2 text-sm font-bold text-slate-700">Cabecera actual</p>
                {selected.headerImagePath ? <img src={selected.headerImagePath} alt="Cabecera" className="max-h-36 w-full rounded-md object-contain sm:max-h-44" /> : <p className="text-sm text-slate-500">Sin imagen.</p>}
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="mb-2 text-sm font-bold text-slate-700">Cierre actual</p>
                {selected.footerImagePath ? <img src={selected.footerImagePath} alt="Cierre" className="max-h-28 w-full rounded-md object-contain sm:max-h-36" /> : <p className="text-sm text-slate-500">Sin imagen.</p>}
              </div>
            </div>
          </section>

          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-950">Ganadores cargados</h2>
                <p className="text-sm text-slate-600">La nueva carga reemplaza la lista anterior de este reporte.</p>
              </div>
              <div>
                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                  <ExportExcelButton
                    rows={selected.winners.map((winner) => ({
                      Ref: winner.ref,
                      ID: winner.winnerId,
                      Nombre: winner.name,
                      "Premio RD$": winner.prize,
                      Localidad: winner.location
                    }))}
                    fileName={`ganadores-${selected.name}`}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100"
                  />
                  <button type="button" onClick={() => excelInputRef.current?.click()} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
                    <Upload size={17} />
                    Cargar Excel
                  </button>
                  <button type="button" onClick={clearWinners} disabled={busy || selected.winners.length === 0} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-red-200 px-4 py-2 font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">
                    <Trash2 size={17} />
                    Borrar tabla
                  </button>
                </div>
                <input ref={excelInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={uploadExcel} />
              </div>
            </div>

            {uploadResult?.errors?.length ? (
              <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
                <p className="font-black">Errores de carga</p>
                {uploadResult.errors.map((error, index) => (
                  <p key={`${error.row}-${index}`}>Fila {error.row}: {error.message}</p>
                ))}
              </div>
            ) : null}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Ref.</th>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Premio RD$</th>
                    <th className="px-3 py-2">Localidad</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.winners.map((winner) => (
                    <tr key={winner.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{winner.ref}</td>
                      <td className="px-3 py-2">{winner.winnerId}</td>
                      <td className="px-3 py-2 font-semibold">{winner.name}</td>
                      <td className="px-3 py-2">{winner.prize}</td>
                      <td className="px-3 py-2">{winner.location}</td>
                    </tr>
                  ))}
                  {selected.winners.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-500">No hay ganadores cargados.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
