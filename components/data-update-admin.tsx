"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { Building2, ClipboardList, Copy, Download, Link2, MessageCircle, Pencil, Plus, Save, TextCursorInput, Trash2, Upload, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { EnrollmentCompanyManager } from "@/components/enrollment-company-manager";
import { notify } from "@/lib/toast";
import { ExportExcelButton } from "@/components/export-excel-button";

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

type DataUpdateTexts = {
  title: string;
  description: string;
  lookupQuestion: string;
  notFoundMessage: string;
  successMessage: string;
  whatsappMessage: string;
};

type DataUpdateQuestion = {
  id: string;
  fieldKey: string;
  label: string;
  section: "CONTACT" | "EMERGENCY" | "ADDITIONAL";
  type: "TEXT" | "NUMBER" | "PHONE" | "EMAIL" | "SELECT";
  required: boolean;
  isSystem: boolean;
  helpText?: string;
  options?: string[];
};

const inputClass = "h-11 rounded-md border border-slate-300 px-3 py-2";
const fieldClass = "h-11 w-full rounded-md border border-slate-300 px-3 py-2";
const textareaClass = "min-h-24 w-full rounded-md border border-slate-300 px-3 py-2";

type UploadResult = {
  processed: number;
  created: number;
  rejected: number;
  errors: Array<{ row: number; message: string }>;
};

export function DataUpdateAdmin({
  formId,
  enrollmentCompanies,
  members,
  updates,
  publicUrl,
  texts,
  questions
}: {
  formId: string;
  enrollmentCompanies: EnrollmentCompanyRow[];
  members: MemberRow[];
  updates: UpdateRow[];
  publicUrl: string;
  texts: DataUpdateTexts;
  questions: DataUpdateQuestion[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCompanyId, setUploadCompanyId] = useState("");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [activeTab, setActiveTab] = useState<"link" | "texts" | "companies" | "members" | "updates">("link");
  const [localQuestions, setLocalQuestions] = useState<DataUpdateQuestion[]>(questions);
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

  async function copyPublicUrl() {
    await navigator.clipboard.writeText(publicUrl);
    notify("Link copiado.", "success");
  }

  async function saveTexts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const response = await fetch("/api/actualizacion-datos/textos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      notify(data.error || "No se pudieron guardar los textos.", "error");
      return;
    }

    notify("Textos actualizados.", "success");
    router.refresh();
  }

  function updateQuestion(id: string, patch: Partial<DataUpdateQuestion>) {
    setLocalQuestions((current) => current.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  }

  async function saveQuestion(question: DataUpdateQuestion) {
    setBusy(true);
    const response = await fetch("/api/actualizacion-datos/preguntas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      notify(data.error || "No se pudo guardar la pregunta.", "error");
      return;
    }

    setLocalQuestions(data.questions);
    notify("Pregunta guardada.", "success");
    router.refresh();
  }

  async function deleteQuestion(question: DataUpdateQuestion) {
    setBusy(true);
    const response = await fetch(`/api/actualizacion-datos/preguntas/${question.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      notify(data.error || "No se pudo eliminar la pregunta.", "error");
      return;
    }

    setLocalQuestions(data.questions);
    notify("Pregunta eliminada.", "success");
    router.refresh();
  }

  function addQuestion(section: DataUpdateQuestion["section"]) {
    const id = `extra_${Date.now()}`;
    setLocalQuestions((current) => [
      ...current,
      {
        id,
        fieldKey: id,
        label: "",
        section,
        type: "TEXT",
        required: false,
        isSystem: false,
        helpText: ""
      }
    ]);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-2">
        {[
          { key: "link", label: "Link publico", icon: Link2 },
          { key: "texts", label: "Textos y pregunta", icon: TextCursorInput },
          { key: "companies", label: "Empresas", icon: Building2 },
          { key: "members", label: "Base de socios", icon: Users },
          { key: "updates", label: "Solicitudes recibidas", icon: ClipboardList }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-black transition ${
                active
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "link" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <img src="/api/actualizacion-datos/qr" alt="Codigo QR de actualizacion de datos" className="mx-auto h-auto w-full max-w-[320px]" />
            </div>
            <div>
              <p className="mb-3 inline-flex rounded-md bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-900">
                Formulario publico
              </p>
              <h2 className="text-lg font-black text-slate-950">Link publico de actualizacion</h2>
              <p className="mt-1 text-sm text-slate-600">
                Este enlace abre el formulario sin login. El socio selecciona empresa, valida su cedula o numero de empleado y actualiza sus datos.
              </p>
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Link publico</span>
                <input value={publicUrl} readOnly className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2" />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={copyPublicUrl} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100">
                  <Copy size={17} />
                  Copiar link
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Hola, EDECOOP te invita a actualizar tus datos: ${publicUrl}`)}`}
                  target="_blank"
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800"
                >
                  <MessageCircle size={17} />
                  Enviar por WhatsApp
                </a>
                <a href="/api/actualizacion-datos/qr" download="qr-actualizacion-datos-edecoop.png" className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100">
                  <Download size={17} />
                  Descargar QR
                </a>
              </div>
              <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950">
                <p className="font-black">Reglas activas</p>
                <p className="mt-1">
                  Solo participan empresas activas y habilitadas para actualizacion. Cada empresa define si consulta por cedula o numero de empleado.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "texts" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Textos y pregunta del formulario publico</h2>
          <p className="mt-1 text-sm text-slate-600">
            Estos textos se muestran en el formulario publico de actualizacion y en los mensajes de respuesta.
          </p>
          <form onSubmit={saveTexts} className="mt-4 grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm font-bold text-slate-700">Titulo del formulario</span>
                <input name="title" defaultValue={texts.title} required className={fieldClass} />
              </label>
              <label>
                <span className="mb-1 block text-sm font-bold text-slate-700">Pregunta de consulta</span>
                <input name="lookupQuestion" defaultValue={texts.lookupQuestion} required className={fieldClass} />
              </label>
            </div>
            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">Texto inicial</span>
              <textarea name="description" defaultValue={texts.description} required className={textareaClass} />
            </label>
            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">Mensaje si no aparece el socio</span>
              <textarea name="notFoundMessage" defaultValue={texts.notFoundMessage} required className={textareaClass} />
            </label>
            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">Mensaje final</span>
              <textarea name="successMessage" defaultValue={texts.successMessage} required className={textareaClass} />
            </label>
            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">Mensaje de WhatsApp cuando no aparece</span>
              <textarea name="whatsappMessage" defaultValue={texts.whatsappMessage} required className={textareaClass} />
              <span className="mt-1 block text-xs font-semibold text-slate-500">
                Puede usar {"{empresa}"} para insertar automaticamente el nombre de la empresa seleccionada.
              </span>
            </label>
            <button disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
              <Save size={18} />
              {busy ? "Guardando..." : "Guardar textos"}
            </button>
          </form>

          <div className="mt-6 grid gap-4">
            {[
              { key: "CONTACT", label: "Datos de contacto" },
              { key: "EMERGENCY", label: "Contacto de emergencia" },
              { key: "ADDITIONAL", label: "Preguntas adicionales" }
            ].map((section) => (
              <div key={section.key} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-black text-slate-950">{section.label}</h3>
                  <button
                    type="button"
                    onClick={() => addQuestion(section.key as DataUpdateQuestion["section"])}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Plus size={16} />
                    Agregar pregunta
                  </button>
                </div>
                <div className="grid gap-3">
                  {localQuestions
                    .filter((question) => question.section === section.key)
                    .map((question) => (
                      <div key={question.id} className="grid gap-2 rounded-md bg-slate-50 p-3 lg:grid-cols-[1.2fr_160px_120px_auto] lg:items-end">
                        <label>
                          <span className="mb-1 block text-xs font-bold text-slate-600">Pregunta</span>
                          <input
                            id={`question-${question.id}`}
                            value={question.label}
                            onChange={(event) => updateQuestion(question.id, { label: event.currentTarget.value })}
                            placeholder="Texto de la pregunta"
                            className={fieldClass}
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-xs font-bold text-slate-600">Tipo esperado</span>
                          <select
                            value={question.type}
                            disabled={question.isSystem}
                            onChange={(event) => updateQuestion(question.id, { type: event.currentTarget.value as DataUpdateQuestion["type"] })}
                            className={`${fieldClass} disabled:bg-slate-100 disabled:text-slate-500`}
                          >
                            <option value="TEXT">Texto</option>
                            <option value="NUMBER">Numero</option>
                            <option value="PHONE">Telefono</option>
                            <option value="EMAIL">Correo</option>
                            <option value="SELECT">Lista</option>
                          </select>
                          {question.isSystem ? <span className="mt-1 block text-xs text-slate-500">Tipo protegido</span> : null}
                        </label>
                        <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={question.required}
                            disabled={question.isSystem}
                            onChange={(event) => updateQuestion(question.id, { required: event.currentTarget.checked })}
                            className="h-4 w-4"
                          />
                          Obligatoria
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => document.getElementById(`question-${question.id}`)?.focus()}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                            title="Editar pregunta"
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => saveQuestion(question)}
                            disabled={busy || !question.label.trim()}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                            title="Guardar pregunta"
                          >
                            <Save size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteQuestion(question)}
                            disabled={busy || question.isSystem}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
                            title={question.isSystem ? "Pregunta obligatoria del sistema" : "Eliminar pregunta"}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <label className="lg:col-span-4">
                          <span className="mb-1 block text-xs font-bold text-slate-600">Texto alternativo o ayuda</span>
                          <textarea
                            value={question.helpText || ""}
                            onChange={(event) => updateQuestion(question.id, { helpText: event.currentTarget.value })}
                            placeholder="Texto breve para explicar como responder esta pregunta"
                            className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                          />
                        </label>
                        {question.type === "SELECT" ? (
                          <label className="lg:col-span-4">
                            <span className="mb-1 block text-xs font-bold text-slate-600">Opciones separadas por coma</span>
                            <input
                              value={(question.options || []).join(", ")}
                              onChange={(event) =>
                                updateQuestion(question.id, {
                                  options: event.currentTarget.value
                                    .split(",")
                                    .map((value) => value.trim())
                                    .filter(Boolean)
                                })
                              }
                              className={fieldClass}
                            />
                          </label>
                        ) : null}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "companies" ? <EnrollmentCompanyManager formId={formId} companies={enrollmentCompanies} /> : null}

      {activeTab === "members" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-slate-950">Base de socios</h2>
          <ExportExcelButton
            rows={members.map((row) => ({
              Empresa: row.companyName,
              Nombre: row.name,
              Cedula: row.documentId,
              Empleado: row.employeeNumber,
              Telefono: row.personalPhone,
              Correo: row.personalEmail
            }))}
            fileName="base-socios"
          />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Carga aqui el listado inicial de socios. La empresa debe estar activa y configurada para actualizacion de datos.
        </p>
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
      ) : null}

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

      {activeTab === "updates" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-slate-950">Solicitudes recibidas</h2>
          <ExportExcelButton
            rows={updates.map((row) => ({
              Fecha: row.createdAt,
              Empresa: row.companyName,
              Nombre: row.name,
              Telefono: row.personalPhone,
              WhatsApp: row.whatsappPhone,
              Correo: row.personalEmail,
              Emergencia: `${row.emergencyContactName} / ${row.emergencyContactPhone}`,
              Relacion: row.emergencyContactRelation,
              Estado: row.status
            }))}
            fileName="solicitudes-actualizacion-datos"
          />
        </div>
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
      ) : null}
    </div>
  );
}
