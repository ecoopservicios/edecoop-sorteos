"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Download, RotateCcw, Send } from "lucide-react";
import { notify } from "@/lib/toast";

type SubmitResult = {
  message: string;
  prizeLink: string | null;

  downloadUrl?: string | null;
  eventName?: string | null;
};

type FieldAlertKey = "lastName" | "documentId" | "residencePhone" | "mobilePhone" | "email" | "employeeNumber";

const controlClass = "h-11 rounded-md border border-slate-300 px-3 py-2";
const fullControlClass = `w-full ${controlClass}`;

function upper(event: FormEvent<HTMLInputElement>) {
  event.currentTarget.value = event.currentTarget.value.toUpperCase();
}

function FieldBubble({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="absolute left-6 top-[calc(100%+8px)] z-20 w-max max-w-[280px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-lg">
      <span className="absolute -top-1.5 left-5 h-3 w-3 rotate-45 border-l border-t border-slate-300 bg-white" />
      <span className="relative flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-amber-500 text-white">
          <AlertTriangle size={15} />
        </span>
        {message}
      </span>
    </div>
  );
}

export function EnrollmentPublicForm({
  token,
  title,
  description,
  channel = "virtual",
  companies
}: {
  token: string;
  title: string;
  description: string;
  channel?: "virtual" | "presential";
  companies: Array<{ id: string; name: string }>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [fieldAlerts, setFieldAlerts] = useState<Partial<Record<FieldAlertKey, string>>>({});
  const [maritalStatus, setMaritalStatus] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const requiresSpouse = maritalStatus === "CASADO" || maritalStatus === "UNION LIBRE";
  const storageKey = `edecoop:enrollment:${token}`;

  useEffect(() => {
    if (!isDirty || result) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty, result]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;

    try {
      const values = JSON.parse(saved) as Record<string, string>;
      const form = document.querySelector<HTMLFormElement>(`form[data-enrollment-token="${token}"]`);
      if (!form) return;

      for (const [name, value] of Object.entries(values)) {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
          if (field.type === "checkbox") {
            (field as HTMLInputElement).checked = value === "on";
          } else {
            field.value = value;
          }
        }
      }

      setMaritalStatus(values.maritalStatus || "");
      setCompanyName(values.companyName || "");
      setBankAccountNumber(values.bankAccountNumber || "");
      setBankName(values.bankName || "");
      setIsDirty(true);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey, token]);

  function setFieldAlert(field: FieldAlertKey, message: string) {
    setFieldAlerts((current) => ({ ...current, [field]: message }));
  }

  function clearFieldAlert(field: FieldAlertKey) {
    setFieldAlerts((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function digitsOnly(field: FieldAlertKey, maxLength: number, invalidMessage: string) {
    return (event: FormEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const previous = input.value;
      const next = previous.replace(/\D/g, "").slice(0, maxLength);
      input.value = next;

      if (previous !== next) {
        setFieldAlert(field, invalidMessage);
        return;
      }
      clearFieldAlert(field);
    };
  }

  function showHint(field: FieldAlertKey, message: string) {
    return () => setFieldAlert(field, message);
  }

  function hideHint(field: FieldAlertKey) {
    return () => clearFieldAlert(field);
  }

  function alertFieldFromApi(field: string | undefined): FieldAlertKey | null {
    if (!field) return null;
    const fields: Record<string, FieldAlertKey> = {
      lastName: "lastName",
      documentId: "documentId",
      employeeNumber: "employeeNumber",
      nie: "employeeNumber",
      mobilePhone: "mobilePhone",
      phone: "mobilePhone",
      email: "email"
    };
    return fields[field] || null;
  }

  function persist(formElement: HTMLFormElement) {
    const data = new FormData(formElement);
    const values: Record<string, string> = {};

    for (const [key, value] of data.entries()) {
      values[key] = String(value);
    }

    window.localStorage.setItem(storageKey, JSON.stringify(values));
  }

  function clearSavedForm(formElement: HTMLFormElement) {
    window.localStorage.removeItem(storageKey);
    formElement.reset();
    setIsDirty(false);
    setFieldAlerts({});
    setMaritalStatus("");
    setCompanyName("");
    setBankAccountNumber("");
    setBankName("");
    notify("Formulario limpiado.", "success");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    const formElement = event.currentTarget;

    const response = await fetch(`/api/inscripcion/${token}/submit?channel=${channel}`, {
      method: "POST",
      body: new FormData(formElement)
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      const message = data.error || "No se pudo enviar la solicitud.";
      const field = alertFieldFromApi(data.field);
      if (field) setFieldAlert(field, message);
      setError(message);
      notify(message, "error");
      return;
    }

    setIsDirty(false);
    setFieldAlerts({});
    window.localStorage.removeItem(storageKey);
    setResult({ message: data.message, prizeLink: data.prizeLink, downloadUrl: data.downloadUrl, eventName: data.eventName });
    formElement.reset();
    setMaritalStatus("");
    setCompanyName("");
    setBankAccountNumber("");
    setBankName("");
    notify("Solicitud enviada correctamente.", "success");
  }

  if (result) {
    return (
      <section className="mx-auto w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <img src="/edecoop-logo.png" alt="EDECOOP" className="mx-auto mb-4 h-auto w-36" />
        <h1 className="text-2xl font-black text-slate-950">Solicitud recibida</h1>
        <p className="mt-3 text-slate-700">{result.message}</p>
        {result.eventName ? (
          <p className="mt-4 rounded-md bg-emerald-50 p-3 font-bold text-emerald-900">Participas en: {result.eventName}</p>
        ) : null}
        {result.prizeLink ? (
          <a href={result.prizeLink} className="mt-5 inline-flex rounded-md bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">
            Participar por premio instantáneo
          </a>
        ) : (
          <div className="mt-5 grid gap-3">
            <p className="rounded-md bg-emerald-50 p-3 font-semibold text-emerald-900">Gracias por ser parte de EDECOOP.</p>
            {result.downloadUrl ? (
              <a href={result.downloadUrl} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-5 py-3 font-bold text-slate-700 hover:bg-slate-100">
                <Download size={18} />
                Descargar solicitud
              </a>
            ) : null}
          </div>
        )}
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      data-enrollment-token={token}
      onChange={(event) => {
        setIsDirty(true);
        persist(event.currentTarget);
      }}
      className="mx-auto w-full max-w-5xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="mb-6 text-center">
        <img src="/edecoop-logo.png" alt="EDECOOP" className="mx-auto mb-3 h-auto w-32" />
        <h1 className="text-2xl font-black text-slate-950">{title}</h1>
      </div>
      <div className="mb-6 rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        <h2 className="mb-2 text-center text-lg font-black text-slate-950">SOLICITUD DE ADMISIÓN</h2>
        {description.split("\n").map((paragraph, index) => (
          <p key={index} className="mb-2">
            {paragraph}
          </p>
        ))}
        <label className="mt-3 block font-semibold text-slate-800">
          Autorizo a mi empleador a descontar la suma equivalente al
          <input name="salaryDeductionPercent" required min="4" step="0.01" type="number" className="mx-2 h-9 w-24 rounded-md border border-slate-300 px-2 py-1" />%
          de mi salario para ser depositados a mi cuenta de ahorros corriente y de capital.
        </label>
      </div>

      <h2 className="mb-3 text-center text-lg font-black text-slate-950">DATOS PERSONALES</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <input name="firstName" required placeholder="Nombres" pattern="[A-Z ]+" title="Solo letras A-Z y espacios" onInput={upper} className={controlClass} />
        <label className="relative block">
          <input name="lastName" required placeholder="Apellidos" pattern="[A-Z ]+" title="Solo letras A-Z y espacios" onInput={upper} onBlur={hideHint("lastName")} className={fullControlClass} />
          <FieldBubble message={fieldAlerts.lastName} />
        </label>
        <label className="relative block">
          <input
            name="documentId"
            required
            placeholder="Cédula No."
            inputMode="numeric"
            maxLength={11}
            pattern="[0-9]{11}"
            title="Debe contener exactamente 11 números, sin guiones ni letras"
            onInput={digitsOnly("documentId", 11, "La cédula solo acepta 11 números, sin guiones ni letras.")}
            onFocus={showHint("documentId", "La cédula debe tener exactamente 11 números, sin guiones.")}
            onBlur={hideHint("documentId")}
            className={fullControlClass}
          />
          <FieldBubble message={fieldAlerts.documentId} />
        </label>
        <label className="relative block">
          <input
            name="residencePhone"
            placeholder="Número de flota"
            inputMode="numeric"
            maxLength={10}
            pattern="[0-9]{10}"
            title="Coloque su número de flota empresarial. Debe contener exactamente 10 números."
            onInput={digitsOnly("residencePhone", 10, "El número de flota solo acepta 10 números, sin letras ni símbolos.")}
            onFocus={showHint("residencePhone", "Coloque su número de flota empresarial.")}
            onBlur={hideHint("residencePhone")}
            className={fullControlClass}
          />
          <FieldBubble message={fieldAlerts.residencePhone} />
        </label>
        <label className="relative block">
          <input
            name="mobilePhone"
            required
            placeholder="Celular"
            inputMode="numeric"
            maxLength={10}
            pattern="[0-9]{10}"
            title="Favor colocar su teléfono móvil personal. Debe contener exactamente 10 números."
            onInput={digitsOnly("mobilePhone", 10, "El celular solo acepta 10 números, sin letras ni símbolos.")}
            onFocus={showHint("mobilePhone", "Favor colocar su teléfono móvil personal. Debe tener 10 números.")}
            onBlur={hideHint("mobilePhone")}
            className={fullControlClass}
          />
          <FieldBubble message={fieldAlerts.mobilePhone} />
        </label>
        <input name="city" required placeholder="Ciudad" className={controlClass} />
        <input name="address" required placeholder="Dirección de residencia" className={`${controlClass} md:col-span-2`} />
        <select name="maritalStatus" required value={maritalStatus} onChange={(event) => setMaritalStatus(event.currentTarget.value)} className={controlClass}>
          <option value="">Estado Civil</option>
          <option value="SOLTERO">Soltero</option>
          <option value="CASADO">Casado</option>
          <option value="UNION LIBRE">Unión libre</option>
        </select>
        {requiresSpouse ? (
          <input name="spouseName" required placeholder="Nombre cónyuge" className={controlClass} />
        ) : null}
      </div>

      <h2 className="mb-3 mt-8 text-center text-lg font-black text-slate-950">DATOS DEL EMPLEADO</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <select name="companyName" required value={companyName} onChange={(event) => setCompanyName(event.currentTarget.value)} className={controlClass}>
          <option value="">Empresa</option>
          {companies.map((company) => (
            <option key={company.id} value={company.name}>
              {company.name}
            </option>
          ))}
        </select>
        <input name="position" required placeholder="Cargo" className={controlClass} />
        <input name="department" required placeholder="Dependencia" className={controlClass} />
        <input name="workplace" required placeholder="Oficina" className={controlClass} />
        <label className="relative block">
          <input
            name="email"
            required
            type="email"
            placeholder="Correo electrónico"
            title="Facilítenos su correo electrónico personal."
            onFocus={showHint("email", "Facilítenos su correo electrónico personal.")}
            onBlur={hideHint("email")}
            className={fullControlClass}
          />
          <FieldBubble message={fieldAlerts.email} />
        </label>
        <input name="monthlySalary" required min="0" step="0.01" type="number" placeholder="Sueldo mensual" className={controlClass} />
        <label className="relative block">
          <input
            name="employeeNumber"
            required
            placeholder="NIE"
            inputMode="numeric"
            maxLength={5}
            pattern="[0-9]{1,5}"
            title="Número de empleado. Máximo 5 números."
            onInput={digitsOnly("employeeNumber", 5, "El NIE solo acepta números y un máximo de 5 dígitos.")}
            onFocus={showHint("employeeNumber", "Número de empleado. Máximo 5 números.")}
            onBlur={hideHint("employeeNumber")}
            className={fullControlClass}
          />
          <FieldBubble message={fieldAlerts.employeeNumber} />
        </label>
        <input
          name="bankAccountNumber"
          placeholder="Cta Banco No."
          value={bankAccountNumber}
          onChange={(event) => setBankAccountNumber(event.currentTarget.value)}

          className={controlClass}
        />
        <input
          name="bankName"
          placeholder="Nombre Banco"
          value={bankName}
          onChange={(event) => setBankName(event.currentTarget.value)}

          className={controlClass}
        />
      </div>

      <label className="mt-5 flex items-start gap-2 text-sm font-semibold text-slate-700">
        <input name="acceptsTerms" type="checkbox" required className="mt-1 h-4 w-4" />
        Confirmo que solicito ser admitido como socio de EDECOOP, acepto la cuota de inscripción de RD$200.00 y certifico que la información suministrada es correcta.
      </label>
      {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60 sm:w-auto">
          <Send size={17} />
          {loading ? "Enviando..." : "Enviar solicitud"}
        </button>
        <button
          type="button"
          onClick={(event) => clearSavedForm(event.currentTarget.form!)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-100 sm:w-auto"
        >
          <RotateCcw size={17} />
          Limpiar formulario
        </button>
      </div>
    </form>
  );
}






