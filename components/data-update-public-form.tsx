"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, LoaderCircle, Pencil, Search, Send, ShieldCheck } from "lucide-react";
import { notify } from "@/lib/toast";

type CompanyOption = { id: string; companyName: string; lookupField: "DOCUMENT_ID" | "EMPLOYEE_NUMBER" };
type FoundMember = { id: string; companyName: string; fullName: string; documentId: string | null; employeeNumber: string | null };
type DataUpdateTexts = { title: string; description: string; lookupQuestion: string; notFoundMessage: string; successMessage: string; whatsappMessage: string };
type DataUpdateQuestion = {
  id: string; fieldKey: string; label: string; section: "CONTACT" | "EMERGENCY" | "ADDITIONAL";
  type: "TEXT" | "NUMBER" | "PHONE" | "EMAIL" | "SELECT"; required: boolean; isSystem: boolean; helpText?: string; options?: string[];
};
type Stage = { key: string; title: string; question?: DataUpdateQuestion };
type WhatsappMode = "" | "SAME" | "OTHER" | "NONE";
const inputClass = "h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";
const primaryClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60";

function questionError(question: DataUpdateQuestion, value: string) {
  value = value.trim();
  if (!value) return question.required ? "Este campo es obligatorio." : "";
  if (question.type === "PHONE" && !/^\d{10}$/.test(value)) return "Ingresa un teléfono de 10 números.";
  if (question.type === "NUMBER" && !/^\d+$/.test(value)) return "Ingresa solo números.";
  if (question.type === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Ingresa un correo electrónico válido.";
  if (question.type === "SELECT" && !question.options?.includes(value)) return "Selecciona una opción válida.";
  if (question.fieldKey === "emergencyContactName" && (value.length < 2 || !/^[A-Z ]+$/.test(value))) return "Ingresa el nombre completo con letras y espacios.";
  if (question.fieldKey === "personalEmail" && ["edesur.com.do", "edeeste.com.do", "edenorte.com.do", "edecoop.com.do"].includes(value.split("@")[1]?.toLowerCase())) return "Ingresa tu correo personal, no el institucional.";
  return "";
}

export function DataUpdatePublicForm({ companies, texts, questions, initialCompleted = false }: {
  companies: CompanyOption[]; texts: DataUpdateTexts; questions: DataUpdateQuestion[]; initialCompleted?: boolean;
}) {
  const [companyId, setCompanyId] = useState("");
  const [lookupValue, setLookupValue] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [member, setMember] = useState<FoundMember | null>(null);
  const [verificationToken, setVerificationToken] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [whatsappMode, setWhatsappMode] = useState<WhatsappMode>("");
  const [stageKey, setStageKey] = useState("company");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(initialCompleted ? texts.successMessage : "");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState<{ message: string; supportWhatsapp: string; whatsappUrl: string } | null>(null);
  const busy = useRef(false);
  const editing = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = companies.find(c => c.id === companyId);
  const stages = useMemo<Stage[]>(() => {
    const question = (key: string): Stage[] => {
      const q = questions.find(q => q.fieldKey === key);
      return q ? [{ key, title: q.label, question: q }] : [];
    };
    return [
      { key: "company", title: "Selecciona tu empresa" },
      { key: "lookup", title: selected?.lookupField === "DOCUMENT_ID" ? "Consulta con tu cédula" : "Consulta con tu número de empleado" },
      ...(selected?.lookupField === "EMPLOYEE_NUMBER" ? [{ key: "document", title: "Valida tu cédula" }] : []),
      { key: "confirm", title: "Confirma tu nombre" },
      ...question("personalPhone"),
      { key: "whatsapp", title: "¿Tu teléfono personal tiene WhatsApp?" },
      ...(whatsappMode === "OTHER" ? question("whatsappPhone") : []),
      ...question("personalEmail"),
      ...question("emergencyContactName"),
      ...question("emergencyContactPhone"),
      ...question("emergencyContactRelation"),
      ...questions.filter(q => !q.isSystem).map(q => ({ key: q.fieldKey, title: q.label, question: q })),
      { key: "review", title: "Revisa tu actualización" }
    ];
  }, [questions, selected?.lookupField, whatsappMode]);
  const step = Math.max(0, stages.findIndex(s => s.key === stageKey));
  const current = stages[step];
  const effective: Record<string, string> = { ...values, whatsappPhone: whatsappMode === "NONE" ? "" : whatsappMode === "SAME" ? values.personalPhone || "" : values.whatsappPhone || "" };
  useEffect(() => { if (stageKey !== "company" || done) heading.current?.focus(); }, [stageKey, done]);
  useEffect(() => { setReady(true); }, []);
  function goTo(key: string) { setError(""); setNotFound(null); setStageKey(key); }
  function changeValue(key: string, value: string) { setValues(previous => ({ ...previous, [key]: value })); setError(""); }
  function stageError(stage: Stage) {
    if (stage.key === "company" && !selected) return "Selecciona tu empresa.";
    if (stage.key === "lookup" && !(selected?.lookupField === "DOCUMENT_ID" ? /^\d{11}$/ : /^\d{1,5}$/).test(lookupValue)) return selected?.lookupField === "DOCUMENT_ID" ? "Ingresa los 11 números de tu cédula." : "Ingresa tu número de empleado (hasta 5 números).";
    if (stage.key === "document" && !/^\d{11}$/.test(documentId)) return "Ingresa los 11 números de tu cédula.";
    if (stage.key === "whatsapp" && !whatsappMode) return "Selecciona una opción de WhatsApp.";
    return stage.question ? questionError(stage.question, effective[stage.key] || "") : "";
  }
  function focusField() { requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-current-field]")?.focus()); }
  async function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const invalid = current.key === "review" ? stages.find(s => stageError(s)) : stageError(current) ? current : undefined;
    if (invalid) { setStageKey(invalid.key); setError(stageError(invalid)); focusField(); return; }
    if (!["lookup", "document", "review"].includes(current.key)) {
      if (editing.current) {
        const incomplete = stages.find(s => s.question && stageError(s));
        if (incomplete) goTo(incomplete.key);
        else { editing.current = false; goTo("review"); }
      } else goTo(stages[step + 1].key);
      return;
    }
    busy.current = true; setLoading(true); setError(""); setNotFound(null);
    try {
      if (current.key !== "review") {
        const response = await fetch("/api/actualizacion-datos/buscar", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentCompanyId: selected!.id, lookupValue, ...(current.key === "document" ? { documentId } : {}) })
        });
        const data = await response.json();
        if (!response.ok) {
          if (data.code === "ALREADY_SUBMITTED" || data.code === "COMPLETED") { setAlreadySubmitted(true); setDone(data.error); return; }
          throw new Error(data.error || "No se pudo consultar el registro.");
        }
        if (data.requiresDocument) { goTo("document"); return; }
        if (!data.found) { setNotFound(data); return; }
        if (member?.id !== data.member.id) { setValues({}); setWhatsappMode(""); }
        setMember(data.member); setVerificationToken(data.verificationToken); goTo("confirm");
      } else if (member) {
        const customResponses = Object.fromEntries(questions.filter(q => !q.isSystem).map(q => [q.fieldKey, effective[q.fieldKey] || ""]));
        const response = await fetch("/api/actualizacion-datos/solicitudes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...effective, whatsappMode, verificationToken, personalEmail: effective.personalEmail?.trim().toLowerCase(), memberDirectoryId: member.id, lookupValue, customResponses })
        });
        const data = await response.json();
        if (!response.ok) {
          if (data.code === "ALREADY_SUBMITTED" || data.code === "COMPLETED") { setAlreadySubmitted(true); setDone(data.error); return; }
          if (response.status === 403) goTo("lookup");
          throw new Error(data.error || "No se pudo enviar la actualización.");
        }
        setDone(data.message || texts.successMessage); setValues({}); setVerificationToken("");
        notify("Datos recibidos correctamente.", "success");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo conectar. Tus datos se conservan; inténtalo nuevamente.");
    } finally { busy.current = false; setLoading(false); }
  }
  if (done) return <section className="mx-auto w-full max-w-2xl py-10 text-center">
    <img src="/edecoop-logo.png" alt="EDECOOP" className="mx-auto mb-8 h-auto w-28" />
    <CheckCircle2 size={52} className="mx-auto mb-5 text-emerald-700" aria-hidden="true" />
    <h1 ref={heading} tabIndex={-1} className="text-2xl font-black text-slate-950 outline-none">{alreadySubmitted ? "Actualización ya registrada" : "Actualización recibida"}</h1>
    <p role="status" className="mt-4 leading-relaxed text-slate-600">{done}</p>
    {member ? <p className="mt-6 font-bold text-slate-900">{member.fullName}</p> : null}
  </section>;
  const identityVisible = member && step > stages.findIndex(s => s.key === "confirm");
  const reviewQuestions = stages.filter(s => s.question && s.key !== "whatsappPhone");
  return <section className="mx-auto w-full max-w-2xl">
    <header className="flex items-center gap-4 border-b border-slate-200 pb-5">
      <img src="/edecoop-logo.png" alt="EDECOOP" className="h-auto w-20 shrink-0 sm:w-24" />
      <div className="min-w-0"><h1 className="text-xl font-black leading-snug text-slate-950 sm:text-2xl">{texts.title}</h1></div>
    </header>
    {identityVisible ? <aside aria-label="Socio validado" className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 py-3">
      <p className="break-words text-sm font-bold text-slate-950">{member.fullName}</p>
      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><span>Empleado: {member.employeeNumber || "No registrado"}</span><span>Cédula: {member.documentId || "No registrada"}</span></div>
    </aside> : null}
    <div className="py-5">
      <p className="mb-2 text-sm font-bold text-emerald-800">Paso {step + 1} de {stages.length}</p>
      <div role="progressbar" aria-label="Progreso de la actualización" aria-valuemin={0} aria-valuemax={stages.length} aria-valuenow={step + 1} aria-valuetext={current.title} className="h-1.5 overflow-hidden rounded-sm bg-slate-200"><div className="h-full bg-emerald-700 transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${(step + 1) / stages.length * 100}%` }} /></div>
    </div>
    <form onSubmit={advance} method="post" noValidate aria-busy={loading} className="border-t border-slate-200 py-6">
      <fieldset disabled={!ready || loading} className="contents">
      <h2 ref={heading} tabIndex={-1} className="mb-6 text-xl font-black text-slate-950 outline-none">{current.title}</h2>
      {current.key === "company" ? <div>
        <label htmlFor="data-update-company" className="sr-only">Empresa</label>
        <select data-current-field id="data-update-company" name="company" value={companyId} disabled={loading} onChange={event => { setCompanyId(event.target.value); setLookupValue(""); setDocumentId(""); setMember(null); setVerificationToken(""); setValues({}); setWhatsappMode(""); setError(""); }} className={inputClass} aria-describedby={error ? "data-update-error" : undefined} aria-invalid={Boolean(error)}>
          <option value="">Seleccione empresa</option>{companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
        </select>
      </div> : null}
      {current.key === "lookup" || current.key === "document" ? <div>
        <label htmlFor="data-update-lookup" className="sr-only">{current.key === "document" || selected?.lookupField === "DOCUMENT_ID" ? "Cédula" : "Número de empleado"}</label>
        <input data-current-field id="data-update-lookup" name="data-update-lookup" inputMode="numeric" autoComplete="off" disabled={loading} value={current.key === "document" ? documentId : lookupValue}
          onChange={event => { const value = event.target.value.replace(/\D/g, "").slice(0, current.key === "document" || selected?.lookupField === "DOCUMENT_ID" ? 11 : 5); if (current.key === "document") setDocumentId(value); else setLookupValue(value); setVerificationToken(""); setError(""); setNotFound(null); }}
          className={inputClass} aria-describedby={error ? "data-update-error" : undefined} aria-invalid={Boolean(error)} />
      </div> : null}
      {current.key === "confirm" && member ? <div>
        <ShieldCheck size={32} className="mb-4 text-emerald-700" aria-hidden="true" />
        <p className="mt-4 break-words text-xl font-black text-slate-950">{member.fullName}</p>
        <dl className="mt-5 divide-y divide-slate-200 border-y border-slate-200 text-sm">{[["Empresa", member.companyName], ["Cédula", member.documentId], ["Número de empleado", member.employeeNumber]].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-slate-500">{label}</dt><dd className="break-all font-semibold text-slate-900">{value || "No registrado"}</dd></div>)}</dl>
      </div> : null}
      {current.key === "whatsapp" ? <fieldset><legend className="sr-only">Disponibilidad de WhatsApp</legend>
        <div className="divide-y divide-slate-200 border-y border-slate-200">{([["SAME", "Sí, uso este mismo número"], ["OTHER", "Uso WhatsApp con otro número"], ["NONE", "No tengo WhatsApp"]] as const).map(([value, label]) => <label key={value} className="flex min-h-14 cursor-pointer items-center gap-3 py-3 text-base text-slate-800"><input data-current-field type="radio" name="whatsappMode" value={value} checked={whatsappMode === value} onChange={() => { setWhatsappMode(value); setError(""); }} className="h-5 w-5 shrink-0 accent-emerald-700" />{label}</label>)}</div>
      </fieldset> : null}
      {current.question ? <QuestionField key={current.key} question={current.question} value={effective[current.key] || ""} onChange={value => changeValue(current.key, value)} invalid={Boolean(error)} /> : null}
      {current.key === "review" ? <dl className="divide-y divide-slate-200 border-y border-slate-200">
        {reviewQuestions.map(stage => <ReviewRow key={stage.key} label={stage.title} value={effective[stage.key] || "No indicado"} onEdit={() => { editing.current = true; goTo(stage.key); }} disabled={loading} />)}
        <ReviewRow label="WhatsApp" value={whatsappMode === "NONE" ? "No tiene WhatsApp" : effective.whatsappPhone} onEdit={() => { editing.current = true; goTo("whatsapp"); }} disabled={loading} />
      </dl> : null}
      {notFound ? <div role="status" className="mt-5 border-l-4 border-amber-500 bg-amber-50 p-4"><p className="font-bold text-amber-950">{notFound.message}</p><p className="mt-2 text-sm text-amber-900">{notFound.supportWhatsapp}</p><a href={notFound.whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center font-bold text-emerald-800 underline">Contactar por WhatsApp</a></div> : null}
      {error ? <p id="data-update-error" role="alert" className="mt-5 border-l-4 border-red-500 bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p> : null}
      <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-between">
        {step > 0 ? <button type="button" disabled={loading} onClick={() => { editing.current = false; goTo(current.key === "confirm" ? "lookup" : stages[step - 1].key); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><ArrowLeft size={18} />{current.key === "confirm" ? "No soy yo" : "Atrás"}</button> : <span />}
        <button type="submit" disabled={loading || (current.key === "company" && !companies.length)} className={primaryClass}>
          {loading ? <LoaderCircle size={18} className="animate-spin" /> : current.key === "review" ? <Send size={18} /> : current.key === "lookup" || current.key === "document" ? <Search size={18} /> : current.key === "confirm" ? <Check size={18} /> : null}
          {loading ? (current.key === "review" ? "Enviando..." : "Validando...") : current.key === "review" ? "Enviar actualización" : current.key === "confirm" ? "Sí, soy yo" : editing.current ? "Volver al resumen" : "Continuar"}
          {!loading && !["review", "lookup", "document", "confirm"].includes(current.key) ? <ArrowRight size={18} /> : null}
        </button>
      </div>
      </fieldset>
    </form>
  </section>;
}

function ReviewRow({ label, value, onEdit, disabled }: { label: string; value: string; onEdit: () => void; disabled: boolean }) {
  return <div className="flex items-start justify-between gap-4 py-4"><div className="min-w-0"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-900 [overflow-wrap:anywhere]">{value}</dd></div><button type="button" onClick={onEdit} disabled={disabled} aria-label={`Editar ${label.toLowerCase()}`} title={`Editar ${label.toLowerCase()}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"><Pencil size={18} /></button></div>;
}

function QuestionField({ question, value, onChange, invalid }: { question: DataUpdateQuestion; value: string; onChange: (value: string) => void; invalid: boolean }) {
  const id = `field-${question.fieldKey}`;
  const shared = { id, name: question.fieldKey, className: inputClass, "data-current-field": true, "aria-invalid": invalid, "aria-describedby": invalid ? "data-update-error" : undefined };
  return <div><label htmlFor={id} className="sr-only">{question.label}</label>
    {question.type === "SELECT" ? <select {...shared} value={value} onChange={event => onChange(event.target.value)}><option value="">Seleccione</option>{question.options?.map(option => <option key={option} value={option}>{option}</option>)}</select> :
      <input {...shared} value={value} type={question.type === "EMAIL" ? "email" : question.type === "PHONE" ? "tel" : "text"} inputMode={question.type === "PHONE" || question.type === "NUMBER" ? "numeric" : question.type === "EMAIL" ? "email" : "text"} autoComplete={question.fieldKey === "personalEmail" ? "email" : question.fieldKey === "personalPhone" ? "tel-national" : "off"} maxLength={question.type === "PHONE" ? 10 : undefined}
        onChange={event => { let value = event.target.value; if (question.type === "PHONE" || question.type === "NUMBER") value = value.replace(/\D/g, "").slice(0, question.type === "PHONE" ? 10 : undefined); else if (question.type === "TEXT") value = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, ""); onChange(value); }} />}
  </div>;
}
