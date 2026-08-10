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

const inputClass = "h-11 w-full rounded-md border border-slate-300 px-3 py-2";

function digitsOnly(event: FormEvent<HTMLInputElement>, max = 10) {
  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, max);
}

function upper(event: FormEvent<HTMLInputElement>) {
  event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/[^A-Z ]/g, "");
}

export function DataUpdatePublicForm({ companies }: { companies: CompanyOption[] }) {
  const [companyId, setCompanyId] = useState("");
  const [lookupValue, setLookupValue] = useState("");
  const [member, setMember] = useState<FoundMember | null>(null);
  const [notFound, setNotFound] = useState<{ message: string; supportWhatsapp: string; whatsappUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState("");
  const selected = useMemo(() => companies.find((company) => company.id === companyId) || null, [companies, companyId]);

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
        emergencyContactRelation: form.get("emergencyContactRelation")
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
      <section className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <img src="/edecoop-logo.png" alt="EDECOOP" className="mx-auto mb-4 h-auto w-32" />
        <h1 className="text-2xl font-black text-slate-950">Datos recibidos</h1>
        <p className="mt-3 rounded-md bg-emerald-50 p-4 font-semibold text-emerald-900">{done}</p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 text-center">
        <img src="/edecoop-logo.png" alt="EDECOOP" className="mx-auto mb-3 h-auto w-28" />
        <h1 className="text-2xl font-black text-slate-950">Actualizacion de Datos</h1>
        <p className="mt-2 text-slate-600">Seleccione su empresa para validar sus datos registrados.</p>
      </div>

      <form onSubmit={search} className="grid gap-3 rounded-md bg-slate-50 p-4">
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
            <input value={lookupValue} onChange={(event) => setLookupValue(event.target.value)} onInput={(event) => digitsOnly(event, selected.lookupField === "DOCUMENT_ID" ? 11 : 5)} required className={inputClass} />
          </label>
        ) : null}
        <button disabled={loading || !selected} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
          <Search size={18} />
          {loading ? "Buscando..." : "Continuar"}
        </button>
      </form>

      {notFound ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="font-bold text-amber-950">{notFound.message}</p>
          <p className="mt-2 text-sm text-amber-900">Favor contactenos por WhatsApp para actualizar sus datos.</p>
          <p className="mt-2 text-lg font-black text-amber-950">{notFound.supportWhatsapp}</p>
          <a href={notFound.whatsappUrl} target="_blank" className="mt-3 inline-flex rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800">
            Contactar por WhatsApp
          </a>
        </div>
      ) : null}

      {member ? (
        <form onSubmit={submitUpdate} className="mt-5 grid gap-4">
          <div className="rounded-md border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm font-bold text-emerald-800">Datos encontrados</p>
            <p className="text-xl font-black text-emerald-950">{member.fullName}</p>
            <p className="text-sm text-emerald-900">{member.companyName}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">Telefono personal</span>
              <input name="personalPhone" required onInput={(event) => digitsOnly(event)} className={inputClass} />
            </label>
            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">WhatsApp personal</span>
              <input name="whatsappPhone" required onInput={(event) => digitsOnly(event)} className={inputClass} />
              <span className="mt-1 block text-xs text-slate-500">Si es el mismo telefono personal, puede repetirlo.</span>
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-sm font-bold text-slate-700">Correo electronico personal</span>
              <input name="personalEmail" required type="email" className={inputClass} />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">Contacto de emergencia</span>
              <input name="emergencyContactName" required onInput={upper} className={inputClass} />
            </label>
            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">Telefono emergencia</span>
              <input name="emergencyContactPhone" required onInput={(event) => digitsOnly(event)} className={inputClass} />
            </label>
            <label>
              <span className="mb-1 block text-sm font-bold text-slate-700">Relacion</span>
              <select name="emergencyContactRelation" required className={inputClass}>
                <option value="FAMILIAR">Familiar</option>
                <option value="ESPOSA">Esposa</option>
                <option value="HIJO">Hijo</option>
                <option value="AMIGO">Amigo</option>
              </select>
            </label>
          </div>
          <button disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
            <Send size={18} />
            Enviar actualizacion
          </button>
        </form>
      ) : null}
    </section>
  );
}
