"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, LoaderCircle, Pencil, Search, Send, ShieldCheck } from "lucide-react";
import { notify } from "@/lib/toast";

type CompanyOption = {
  id: string;
  companyName: string;
  lookupField: "DOCUMENT_ID" | "EMPLOYEE_NUMBER";
};

type FoundMember = {
  id: string;
  companyName: string;
  fullName: string;
  documentId: string | null;
  employeeNumber: string | null;
  personalPhone: string | null;
  whatsappPhone: string | null;
  personalEmail: string | null;
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

const inputClass =
  "h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";
function inputType(type: DataUpdateQuestion["type"]) {
  if (type === "EMAIL") return "email";
  if (type === "NUMBER" || type === "PHONE") return "tel";
  return "text";
}

export function DataUpdatePublicForm({ companies, texts, questions }: {
  companies: CompanyOption[]; texts: DataUpdateTexts; questions: DataUpdateQuestion[];
}) {
  const [companyId, setCompanyId] = useState("");
  const [lookupValue, setLookupValue] = useState("");
  const [member, setMember] = useState<FoundMember | null>(null);
  const [notFound, setNotFound] = useState<{ message: string; supportWhatsapp: string; whatsappUrl: string } | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [samePhone, setSamePhone] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = companies.find(c => c.id === companyId);
  const stages = useMemo(() => [
    { key: "identity", title: "Identificacion", questions: [] as DataUpdateQuestion[] },
    { key: "confirm", title: "Confirma tus datos", questions: [] as DataUpdateQuestion[] },
    ...(["CONTACT", "EMERGENCY", "ADDITIONAL"] as const).map(section => ({
      key: section,
      title: section === "CONTACT" ? "Datos de contacto" : section === "EMERGENCY" ? "Contacto de emergencia" : "Informacion adicional",
      questions: questions.filter(q => q.section === section)
    })).filter(s => s.questions.length),
    { key: "review", title: "Revisa tu actualizacion", questions: [] as DataUpdateQuestion[] }
  ], [questions]);
  const current = stages[step];
  const effective: Record<string, string> = { ...values, ...(samePhone ? { whatsappPhone: values.personalPhone || "" } : {}) };

  useEffect(() => { if (step > 0 || done) heading.current?.focus(); }, [step, done]);
  function goTo(next: number) { setError(""); setStep(next); }
  function changeValue(key: string, value: string) {
    setValues(previous => ({ ...previous, [key]: value }));
    setError("");
  }
  async function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const toValidate = current.key === "review" ? stages : [current];
    for (const stage of toValidate) {
      const invalid = stage.questions.find(q => questionError(q, effective[q.fieldKey] || "", member));
      if (invalid) {
        setStep(stages.indexOf(stage));
        setError(`${invalid.label}: ${questionError(invalid, effective[invalid.fieldKey] || "", member)}`);
        requestAnimationFrame(() => document.getElementById(`data-update-${invalid.fieldKey}`)?.focus());
        return;
      }
    }
    if (step > 0 && current.key !== "review") { goTo(step + 1); return; }
    if (step === 0 && !selected) return;
    busy.current = true; setLoading(true); setError(""); setNotFound(null);
    try {
      if (step === 0) {
        const response = await fetch("/api/actualizacion-datos/buscar", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentCompanyId: selected!.id, lookupValue })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo buscar el registro.");
        if (!data.found) { setNotFound(data); return; }
        setMember(data.member); setValues({}); setSamePhone(false); goTo(1);
      } else if (member) {
        const customResponses = Object.fromEntries(questions.filter(q => !q.isSystem).map(q => [q.fieldKey, effective[q.fieldKey] || ""]));
        const response = await fetch("/api/actualizacion-datos/solicitudes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...effective, personalEmail: effective.personalEmail?.trim().toLowerCase(), memberDirectoryId: member.id, lookupValue, customResponses })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo enviar la actualizacion.");
        setDone(data.message || texts.successMessage); setValues({});
        notify("Datos recibidos correctamente.", "success");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo conectar. Tus datos se conservan; intenta nuevamente.");
    } finally { busy.current = false; setLoading(false); }
  }

  const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60";
  if (done) return (
    <section className="mx-auto w-full max-w-2xl py-10 text-center">
      <img src="/edecoop-logo.png" alt="EDECOOP" className="mx-auto mb-8 h-auto w-28" />
      <CheckCircle2 size={52} className="mx-auto mb-5 text-emerald-700" aria-hidden="true" />
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-black text-slate-950 outline-none">Actualizacion recibida</h1>
      <p role="status" className="mt-4 leading-relaxed text-slate-600">{done}</p>
      <p className="mt-6 font-bold text-slate-900">{member?.fullName}</p>
      <p className="mt-1 text-sm text-slate-500">{member?.companyName}</p>
    </section>
  );
  return (
    <section className="mx-auto w-full max-w-2xl">
      <header className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <img src="/edecoop-logo.png" alt="EDECOOP" className="h-auto w-20 shrink-0 sm:w-24" />
        <div className="min-w-0"><h1 className="text-xl font-black leading-snug text-slate-950 sm:text-2xl">{texts.title}</h1><p className="mt-1 text-sm leading-relaxed text-slate-600">{texts.description}</p></div>
      </header>
      <div className="py-5">
        <div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-bold text-emerald-800">Paso {step + 1} de {stages.length}</span><span className="text-slate-500">{current.key === "review" ? "Revision final" : "Actualizacion de datos"}</span></div>
        <div role="progressbar" aria-label="Progreso de la actualizacion" aria-valuemin={0} aria-valuemax={stages.length} aria-valuenow={step + 1} aria-valuetext={current.title} className="flex h-1.5 gap-1">
          {stages.map((s, index) => <span key={s.key} className={`h-full flex-1 rounded-sm ${index <= step ? "bg-emerald-700" : "bg-slate-200"}`} />)}
        </div>
      </div>
      <form onSubmit={advance} aria-busy={loading} className="border-t border-slate-200 py-6">
        <h2 ref={heading} tabIndex={-1} className="mb-5 text-xl font-black text-slate-950 outline-none">{current.title}</h2>
        {member && step > 1 ? <p className="mb-5 break-words text-sm text-slate-600">{member.fullName} · {member.companyName}</p> : null}
        {step === 0 ? <div className="grid gap-5">
          <div><label htmlFor="data-update-company" className="mb-2 block text-sm font-bold text-slate-700">Empresa</label>
            <select id="data-update-company" name="company" value={companyId} disabled={loading} required onChange={e => { setCompanyId(e.target.value); setLookupValue(""); setMember(null); setNotFound(null); setError(""); }} className={inputClass}>
              <option value="">Seleccione empresa</option>{companies.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
          </div>
          {selected ? <div><label htmlFor="data-update-lookup" className="mb-2 block text-sm font-bold text-slate-700">{selected.lookupField === "DOCUMENT_ID" ? "Cedula" : "Numero de empleado"}</label>
            <input id="data-update-lookup" name="data-update-lookup" inputMode="numeric" autoComplete="off" required pattern={selected.lookupField === "DOCUMENT_ID" ? "[0-9]{11}" : "[0-9]{1,5}"} title={selected.lookupField === "DOCUMENT_ID" ? "Ingresa los 11 numeros de tu cedula" : "Ingresa hasta 5 numeros"} disabled={loading} value={lookupValue} onChange={e => { setLookupValue(e.target.value.replace(/\D/g, "").slice(0, selected.lookupField === "DOCUMENT_ID" ? 11 : 5)); setNotFound(null); }} className={inputClass} aria-describedby="data-update-lookup-help" />
            <p id="data-update-lookup-help" className="mt-2 text-sm text-slate-500">{texts.lookupQuestion}</p>
          </div> : null}
          {notFound ? <div role="status" className="border-l-4 border-amber-500 bg-amber-50 p-4"><p className="font-bold text-amber-950">{notFound.message}</p><p className="mt-2 text-sm text-amber-900">{notFound.supportWhatsapp}</p><a href={notFound.whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center font-bold text-emerald-800 underline">Contactar por WhatsApp</a></div> : null}
        </div> : null}
        {current.key === "confirm" && member ? <div>
          <ShieldCheck size={32} className="mb-4 text-emerald-700" aria-hidden="true" />
          <p className="text-sm text-slate-600">Confirma que este registro te pertenece.</p>
          <p className="mt-4 break-words text-xl font-black text-slate-950">{member.fullName}</p>
          <dl className="mt-5 divide-y divide-slate-200 border-y border-slate-200 text-sm">
            {[["Empresa", member.companyName], ["Cedula", member.documentId], ["Numero de empleado", member.employeeNumber]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-slate-500">{label}</dt><dd className="break-all font-semibold text-slate-900">{value}</dd></div>)}
          </dl>
        </div> : null}
        {current.questions.length ? <QuestionSection key={current.key} title={current.title} questions={current.questions} values={effective} onValueChange={changeValue}
          whatsappSameAsPhone={samePhone} onWhatsappSameAsPhoneChange={checked => { if (!checked) changeValue("whatsappPhone", effective.whatsappPhone || ""); setSamePhone(checked); }}
          member={member} /> : null}
        {current.key === "review" ? <div className="divide-y divide-slate-200 border-t border-slate-200">
          {stages.filter(s => s.questions.length).map(s => <section key={s.key} className="py-5">
            <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900">{s.title}</h3><button type="button" disabled={loading} onClick={() => goTo(stages.findIndex(item => item.key === s.key))} className="inline-flex min-h-11 shrink-0 items-center gap-2 px-2 text-sm font-bold text-emerald-800 hover:underline" aria-label={`Editar ${s.title.toLowerCase()}`}><Pencil size={15} />Editar</button></div>
            <dl className="grid gap-4 sm:grid-cols-2">{s.questions.map(q => <div key={q.id} className="min-w-0"><dt className="text-sm text-slate-500">{q.label}</dt><dd className="mt-1 break-words font-medium text-slate-900 [overflow-wrap:anywhere]">{effective[q.fieldKey] || "No indicado"}</dd></div>)}</dl>
          </section>)}
        </div> : null}
        {error ? <p role="alert" className="mt-5 border-l-4 border-red-500 bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p> : null}
        <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-between">
          {step > 0 ? <button type="button" disabled={loading} onClick={() => goTo(step - 1)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><ArrowLeft size={18} />{step === 1 ? "No soy yo" : "Atras"}</button> : <span />}
          <button type="submit" disabled={loading || (step === 0 && !companies.length)} className={primary}>
            {loading ? <LoaderCircle size={18} className="animate-spin" /> : current.key === "review" ? <Send size={18} /> : step === 0 ? <Search size={18} /> : step === 1 ? <Check size={18} /> : null}
            {loading ? (step === 0 ? "Buscando..." : "Enviando...") : current.key === "review" ? "Enviar actualizacion" : step === 1 ? "Si, soy yo" : "Continuar"}
            {!loading && step > 1 && current.key !== "review" ? <ArrowRight size={18} /> : null}
          </button>
        </div>
      </form>
    </section>
  );
}

function questionError(question: DataUpdateQuestion, value: string, member?: FoundMember | null) {
  value = value.trim();
  if (!value) return question.required ? "Este campo es obligatorio." : "";
  if (question.type === "PHONE" && !/^\d{10}$/.test(value)) return "Ingresa un telefono de 10 numeros.";
  if (question.type === "NUMBER" && !/^\d+$/.test(value)) return "Ingresa solo numeros.";
  if (question.type === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Ingresa un correo electronico valido.";
  if (question.type === "SELECT" && !question.options?.includes(value)) return "Selecciona una opcion valida.";
  if (question.fieldKey === "personalEmail") {
    if (["edesur.com.do", "edeeste.com.do", "edenorte.com.do", "edecoop.com.do"].includes(value.split("@")[1]?.toLowerCase())) return "Ingresa tu correo personal, no el institucional.";
    if (value.toLowerCase() === member?.personalEmail) return "El correo coincide con el registrado. Ingresa tu correo personal actualizado.";
  }
  if (question.fieldKey === "personalPhone" && value === member?.personalPhone) return "El telefono coincide con el registrado. Ingresa tu movil personal actualizado.";
  return "";
}

function QuestionSection({ title, questions, values, onValueChange, whatsappSameAsPhone, onWhatsappSameAsPhoneChange, member }: {
  title: string; questions: DataUpdateQuestion[]; values: Record<string, string>;
  onValueChange: (key: string, value: string) => void; whatsappSameAsPhone: boolean;
  onWhatsappSameAsPhoneChange: (value: boolean) => void; member: FoundMember | null;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <div aria-label={title} className="grid gap-5 sm:grid-cols-2">
      {questions.map(question => {
        const key = question.fieldKey;
        const id = `data-update-${key}`;
        const value = values[key] || "";
        const change = (value: string) => {
          onValueChange(key, value);
          setErrors(previous => ({ ...previous, [key]: "" }));
        };
        return <div key={question.id} className={question.type === "EMAIL" || key === "whatsappPhone" ? "sm:col-span-2" : ""}>
          <label htmlFor={id} className="mb-2 block text-sm font-bold text-slate-700">{question.label}{question.required ? <span className="ml-1 text-red-700" aria-label="obligatorio">*</span> : null}</label>
          {question.type === "SELECT" ? (
            <select id={id} name={key} required={question.required} value={value} onChange={event => change(event.target.value)} className={inputClass}>
              <option value="">Seleccione</option>{question.options?.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : (
            <input id={id} name={key} required={question.required} value={value}
              type={inputType(question.type)}
              inputMode={question.type === "PHONE" || question.type === "NUMBER" ? "numeric" : question.type === "EMAIL" ? "email" : "text"}
              autoComplete={key === "personalEmail" ? "email" : key === "personalPhone" ? "tel-national" : "off"}
              maxLength={question.type === "PHONE" ? 10 : undefined}
              pattern={question.type === "PHONE" ? "[0-9]{10}" : question.type === "NUMBER" ? "[0-9]+" : undefined}
              readOnly={key === "whatsappPhone" && whatsappSameAsPhone}
              onChange={event => {
                if (question.type === "TEXT") event.target.value = event.target.value.toUpperCase().replace(/[^A-Z\u00c0-\u024f\u0300-\u036f '\-]/g, "");
                else if (question.type === "PHONE" || question.type === "NUMBER") event.target.value = event.target.value.replace(/\D/g, "").slice(0, question.type === "PHONE" ? 10 : undefined);
                event.target.setCustomValidity("");
                change(event.target.value);
              }}
              onInvalid={event => {
                const message = questionError(question, event.currentTarget.value, member) || event.currentTarget.validationMessage;
                setErrors(previous => ({ ...previous, [key]: message }));
              }}
              onBlur={event => {
                const message = questionError(question, event.currentTarget.value, member);
                setErrors(previous => ({ ...previous, [key]: message }));
              }}
              aria-invalid={Boolean(errors[key])}
              aria-describedby={`${id}-help ${id}-error`}
              className={`${inputClass} ${key === "whatsappPhone" && whatsappSameAsPhone ? "bg-slate-100 text-slate-700" : ""}`}
            />
          )}
          {question.helpText ? <p id={`${id}-help`} className="mt-2 text-xs leading-relaxed text-slate-500">{question.helpText}</p> : null}
          {errors[key] ? <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700">{errors[key]}</p> : null}
          {key === "whatsappPhone" ? <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={whatsappSameAsPhone} onChange={event => onWhatsappSameAsPhoneChange(event.target.checked)} className="h-4 w-4 shrink-0 accent-emerald-700" />
            Mi telefono movil personal es el mismo para WhatsApp
          </label> : null}
        </div>;
      })}
    </div>
  );
}
