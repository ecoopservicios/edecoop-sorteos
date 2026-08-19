"use client";

import { FormEvent, useMemo, useState } from "react";
import { Search, Send } from "lucide-react";
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
const panelClass = "rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const fieldHelpClass = "mt-1 min-h-[1rem] text-xs font-medium text-slate-500";

function digitsOnly(event: FormEvent<HTMLInputElement>, max = 10) {
  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, max);
}

function upper(event: FormEvent<HTMLInputElement>) {
  event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/[^A-Z ]/g, "");
}

function enforceType(event: FormEvent<HTMLInputElement>, type: DataUpdateQuestion["type"]) {
  if (type === "PHONE") {
    digitsOnly(event, 10);
    return;
  }
  if (type === "NUMBER") {
    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
    return;
  }
  if (type === "TEXT") {
    upper(event);
  }
}

function inputType(type: DataUpdateQuestion["type"]) {
  if (type === "EMAIL") return "email";
  if (type === "NUMBER" || type === "PHONE") return "tel";
  return "text";
}

export function DataUpdatePublicForm({
  companies,
  texts,
  questions
}: {
  companies: CompanyOption[];
  texts: DataUpdateTexts;
  questions: DataUpdateQuestion[];
}) {
  const [companyId, setCompanyId] = useState("");
  const [lookupValue, setLookupValue] = useState("");
  const [member, setMember] = useState<FoundMember | null>(null);
  const [notFound, setNotFound] = useState<{ message: string; supportWhatsapp: string; whatsappUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState("");
  const [personalPhoneValue, setPersonalPhoneValue] = useState("");
  const [whatsappPhoneValue, setWhatsappPhoneValue] = useState("");
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(false);
  const selected = useMemo(() => companies.find((company) => company.id === companyId) || null, [companies, companyId]);
  const contactQuestions = questions.filter((question) => question.section === "CONTACT");
  const emergencyQuestions = questions.filter((question) => question.section === "EMERGENCY");
  const additionalQuestions = questions.filter((question) => question.section === "ADDITIONAL");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setLoading(true);
    setMember(null);
    setNotFound(null);
    setDone("");
    const response = await fetch("/api/actualizacion-datos/buscar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentCompanyId: selected.id, lookupValue })
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      notify(data.error || "No se pudo buscar el registro.", "error");
      return;
    }
    if (!data.found) {
      setNotFound(data);
      return;
    }
    setMember(data.member);
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) return;
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const customResponses: Record<string, string> = {};
    for (const question of additionalQuestions) {
      customResponses[question.fieldKey] = String(form.get(question.fieldKey) || "");
    }
    const response = await fetch("/api/actualizacion-datos/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberDirectoryId: member.id,
        lookupValue,
        personalPhone: form.get("personalPhone"),
        whatsappPhone: form.get("whatsappPhone"),
        personalEmail: form.get("personalEmail"),
        emergencyContactName: form.get("emergencyContactName"),
        emergencyContactPhone: form.get("emergencyContactPhone"),
        emergencyContactRelation: form.get("emergencyContactRelation"),
        customResponses
      })
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      notify(data.error || "No se pudo enviar la actualizacion.", "error");
      return;
    }
    setDone(data.message);
    notify("Datos recibidos correctamente.", "success");
  }

  if (done) {
    return (
      <section className="mx-auto w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <img src="/edecoop-logo.png" alt="EDECOOP" className="mx-auto mb-5 h-auto w-32 sm:w-40" />
        <h1 className="text-2xl font-black text-slate-950">Datos recibidos</h1>
        <p className="mx-auto mt-4 max-w-xl rounded-md bg-emerald-50 p-4 font-semibold leading-relaxed text-emerald-900">{done}</p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl text-center">
        <img src="/edecoop-logo.png" alt="EDECOOP" className="mx-auto mb-4 h-auto w-28 sm:w-36" />
        <h1 className="text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{texts.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{texts.description}</p>
      </div>

      <form onSubmit={search} className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <label>
          <span className="mb-1 block text-sm font-bold text-slate-700">Empresa</span>
          <select value={companyId} onChange={(event) => { setCompanyId(event.target.value); setLookupValue(""); setMember(null); setNotFound(null); }} required className={inputClass}>
            <option value="">Seleccione empresa</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.companyName}</option>
            ))}
          </select>
        </label>
        {selected ? (
          <label>
            <span className="mb-1 block text-sm font-bold text-slate-700">
              {selected.lookupField === "DOCUMENT_ID" ? "Digite su cedula" : "Digite su numero de empleado"}
            </span>
            <span className="mb-1 block min-h-[1rem] text-xs font-semibold text-slate-500">{texts.lookupQuestion}</span>
            <input value={lookupValue} onChange={(event) => setLookupValue(event.target.value)} onInput={(event) => digitsOnly(event, selected.lookupField === "DOCUMENT_ID" ? 11 : 5)} required className={inputClass} />
          </label>
        ) : null}
        <button disabled={loading || !selected} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 font-bold text-white hover:bg-emerald-800 disabled:opacity-60 sm:col-span-2 lg:col-span-1 lg:w-auto">
          <Search size={18} />
          {loading ? "Buscando..." : "Continuar"}
        </button>
      </form>

      {notFound ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-center sm:p-5">
          <p className="font-bold text-amber-950">{notFound.message}</p>
          <p className="mt-2 text-sm text-amber-900">Favor contactenos por WhatsApp para actualizar sus datos.</p>
          <p className="mt-2 text-lg font-black text-amber-950">{notFound.supportWhatsapp}</p>
          <a href={notFound.whatsappUrl} target="_blank" className="mt-3 inline-flex rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800">
            Contactar por WhatsApp
          </a>
        </div>
      ) : null}

      {member ? (
        <form onSubmit={submitUpdate} className="mt-6 grid gap-5">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 sm:p-5">
            <p className="text-sm font-bold text-emerald-800">Datos encontrados</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <p className="text-lg font-black leading-tight text-emerald-950 sm:col-span-2">{member.fullName}</p>
              <p className="rounded-md bg-white/70 px-3 py-2 text-sm font-bold text-emerald-900">{member.companyName}</p>
            </div>
          </div>
          <QuestionSection
            title="Datos de contacto"
            questions={contactQuestions}
            personalPhoneValue={personalPhoneValue}
            whatsappSameAsPhone={whatsappSameAsPhone}
            onPersonalPhoneChange={setPersonalPhoneValue}
            whatsappPhoneValue={whatsappPhoneValue}
            onWhatsappPhoneChange={setWhatsappPhoneValue}
            onWhatsappSameAsPhoneChange={(checked) => {
              setWhatsappSameAsPhone(checked);
              if (checked) setWhatsappPhoneValue(personalPhoneValue);
            }}
          />
          <QuestionSection title="Contacto de emergencia" questions={emergencyQuestions} />
          {additionalQuestions.length ? <QuestionSection title="Informacion adicional" questions={additionalQuestions} /> : null}
          <button disabled={loading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 font-bold text-white hover:bg-emerald-800 disabled:opacity-60 sm:ml-auto sm:w-auto">
            <Send size={18} />
            Enviar actualizacion
          </button>
        </form>
      ) : null}
    </section>
  );
}

function QuestionSection({
  title,
  questions,
  personalPhoneValue,
  whatsappPhoneValue,
  whatsappSameAsPhone,
  onPersonalPhoneChange,
  onWhatsappPhoneChange,
  onWhatsappSameAsPhoneChange
}: {
  title: string;
  questions: DataUpdateQuestion[];
  personalPhoneValue?: string;
  whatsappPhoneValue?: string;
  whatsappSameAsPhone?: boolean;
  onPersonalPhoneChange?: (value: string) => void;
  onWhatsappPhoneChange?: (value: string) => void;
  onWhatsappSameAsPhoneChange?: (value: boolean) => void;
}) {
  return (
    <section className={panelClass}>
      <h2 className="border-b border-slate-200 pb-3 text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
      {questions.map((question) => {
        const isPersonalPhone = question.fieldKey === "personalPhone";
        const isWhatsappPhone = question.fieldKey === "whatsappPhone";
        const phoneValue = personalPhoneValue || "";
        const whatsappValue = whatsappSameAsPhone ? phoneValue : whatsappPhoneValue || "";

        return (
          <div key={question.id} className={question.type === "EMAIL" ? "md:col-span-2" : ""}>
            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">{question.label}</span>
              {question.type === "SELECT" ? (
                <select name={question.fieldKey} required={question.required} className={inputClass}>
                  <option value="">Seleccione</option>
                  {(question.options || []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={question.fieldKey}
                  required={question.required}
                  type={inputType(question.type)}
                  inputMode={question.type === "PHONE" || question.type === "NUMBER" ? "numeric" : question.type === "EMAIL" ? "email" : "text"}
                  maxLength={question.type === "PHONE" ? 10 : undefined}
                  value={isPersonalPhone ? phoneValue : isWhatsappPhone ? whatsappValue : undefined}
                  readOnly={isWhatsappPhone && whatsappSameAsPhone}
                  onInput={(event) => {
                    enforceType(event, question.type);
                    if (isPersonalPhone) {
                      onPersonalPhoneChange?.(event.currentTarget.value);
                    }
                    if (isWhatsappPhone) {
                      onWhatsappPhoneChange?.(event.currentTarget.value);
                    }
                  }}
                  onChange={(event) => {
                    if (isPersonalPhone) onPersonalPhoneChange?.(event.currentTarget.value);
                    if (isWhatsappPhone) onWhatsappPhoneChange?.(event.currentTarget.value);
                  }}
                  className={`${inputClass} ${isWhatsappPhone && whatsappSameAsPhone ? "bg-slate-100 text-slate-700" : ""}`}
                />
              )}
              {question.helpText ? (
                <span className={fieldHelpClass}>{question.helpText}</span>
              ) : null}
            </label>
            {isWhatsappPhone ? (
              <label className="mt-2 flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(whatsappSameAsPhone)}
                  onChange={(event) => onWhatsappSameAsPhoneChange?.(event.currentTarget.checked)}
                  className="h-4 w-4"
                />
                Mi telefono movil personal es el mismo para WhatsApp
              </label>
            ) : null}
          </div>
        );
      })}
      </div>
    </section>
  );
}
