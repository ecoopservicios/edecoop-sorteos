"use client";

import { ChangeEvent, useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { notify } from "@/lib/toast";

type EnrollmentCompanyRow = {
  id: string;
  name: string;
  isActive: boolean;
  dataUpdateEnabled: boolean;
  dataUpdateLookupField: "DOCUMENT_ID" | "EMPLOYEE_NUMBER" | null;
};

type MemberRow = {
  id: string;
  companyName: string;
  name: string;
  documentId: string | null;
  employeeNumber: string | null;
  personalPhone: string | null;
  personalEmail: string | null;
};

type UpdateRow = {
  id: string;
  createdAt: string;
  companyName: string;
  name: string;
  personalPhone: string;
  whatsappPhone: string;
  personalEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  status: string;
};

const inputClass = "h-11 rounded-md border border-slate-300 px-3 py-2";

type UploadResult = {
  processed: number;
  created: number;
  rejected: number;
  errors: Array<{ row: number; message: string }>;
};

export function DataUpdateAdmin({
  enrollmentCompanies,
  members,
  updates,
  publicUrl
}: {
  enrollmentCompanies: EnrollmentCompanyRow[];
  members: MemberRow[];
  updates: UpdateRow[];
  publicUrl: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCompanyId, setUploadCompanyId] = useState("");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const configuredCompanies = enrollmentCompanies.filter((company) => company.dataUpdateEnabled && company.dataUpdateLookupField);

  async function uploadMembers(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!uploadCompanyId) {
      notify("Seleccione la empresa antes de cargar el archivo.", "warning");
      event.currentTarget.value = "";
      return;
    }

    const form = new FormData();
    form.set("enrollmentCompanyId", uploadCompanyId);
    form.set("file", file);
    setBusy(true);
    setUploadResult(null);
    const response = await fetch("/api/actualizacion-datos/base/carga", { method: "POST", body: form });
    const data = await response.json();
    setBusy(false);
    event.currentTarget.value = "";
    setUploadResult(data);

    if (!response.ok) {
      notify(data.error || "Revise los errores del archivo.", "error");
      return;
    }

    notify(`Socios cargados: ${data.created}.`, data.rejected ? "info" : "success");
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Link publico</h2>
        <p className="mt-2 break-all rounded-md bg-slate-50 p-3 font-semibold text-slate-700">{publicUrl}</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Base de socios</h2>
        <p className="mt-1 text-sm text-slate-600">Las empresas disponibles se configuran en Formularios de Afiliacion, dentro de Empresas del formulario.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <a href="/api/actualizacion-datos/base/plantilla" className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 font-bold text-slate-700 hover:bg-slate-100">
            <Download size={18} />
            Descargar template
          </a>
          <button
            type="button"
            onClick={() => {
              setUploadOpen(true);
              setUploadResult(null);
              setUploadCompanyId(configuredCompanies[0]?.id || "");
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800"
          >
            <Upload size={18} />
            Cargar listado de socios
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Cedula</th>
                <th className="px-3 py-2">Empleado</th>
                <th className="px-3 py-2">Telefono</th>
                <th className="px-3 py-2">Correo</th>
              </tr>
            </thead>
            <tbody>
              {members.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{row.companyName}</td>
                  <td className="px-3 py-2 font-semibold">{row.name}</td>
                  <td className="px-3 py-2">{row.documentId}</td>
                  <td className="px-3 py-2">{row.employeeNumber}</td>
                  <td className="px-3 py-2">{row.personalPhone}</td>
                  <td className="px-3 py-2">{row.personalEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {uploadOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
          <section className="w-full max-w-xl rounded-lg bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-950">Cargar base de socios</h3>
                <p className="text-sm text-slate-600">Use el template descargable y cargue una empresa a la vez.</p>
              </div>
              <button type="button" onClick={() => setUploadOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50" title="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3">
              <label>
                <span className="mb-1 block text-sm font-bold text-slate-700">Empresa configurada</span>
                <select value={uploadCompanyId} onChange={(event) => setUploadCompanyId(event.currentTarget.value)} required className={inputClass}>
                  <option value="">Seleccione empresa</option>
                  {configuredCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <a href="/api/actualizacion-datos/base/plantilla" className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 font-bold text-slate-700 hover:bg-slate-100">
                  <Download size={18} />
                  Descargar template
                </a>
                <button
                  type="button"
                  disabled={busy || !uploadCompanyId}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  <Upload size={18} />
                  {busy ? "Cargando..." : "Seleccionar archivo"}
                </button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={uploadMembers} />
              </div>
            </div>

            {uploadResult ? (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-black text-slate-900">
                  Procesados: {uploadResult.processed} | Creados: {uploadResult.created} | Rechazados: {uploadResult.rejected}
                </p>
                {uploadResult.errors?.length ? (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-md bg-white p-2 text-red-700">
                    {uploadResult.errors.map((error) => (
                      <p key={`${error.row}-${error.message}`}>{error.message}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Solicitudes recibidas</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Telefono</th>
                <th className="px-3 py-2">WhatsApp</th>
                <th className="px-3 py-2">Correo</th>
                <th className="px-3 py-2">Emergencia</th>
                <th className="px-3 py-2">Relacion</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {updates.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{row.createdAt}</td>
                  <td className="px-3 py-2">{row.companyName}</td>
                  <td className="px-3 py-2 font-semibold">{row.name}</td>
                  <td className="px-3 py-2">{row.personalPhone}</td>
                  <td className="px-3 py-2">{row.whatsappPhone}</td>
                  <td className="px-3 py-2">{row.personalEmail}</td>
                  <td className="px-3 py-2">{row.emergencyContactName} / {row.emergencyContactPhone}</td>
                  <td className="px-3 py-2">{row.emergencyContactRelation}</td>
                  <td className="px-3 py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
