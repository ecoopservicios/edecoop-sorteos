"use client";



import { FormEvent, useState } from "react";

import { useRouter } from "next/navigation";

import { Plus, Power, Trash2 } from "lucide-react";

import { notify } from "@/lib/toast";



type Company = {

  id: string;

  name: string;

  isActive: boolean;

};



export function EnrollmentCompanyManager({ formId, companies }: { formId: string; companies: Company[] }) {

  const router = useRouter();

  const [busyId, setBusyId] = useState("");

  const [creating, setCreating] = useState(false);



  async function create(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    const formElement = event.currentTarget;

    const form = new FormData(formElement);

    setCreating(true);

    const response = await fetch("/api/inscripcion-virtual/empresas", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ formId, name: form.get("name") })

    });

    const data = await response.json();

    setCreating(false);



    if (!response.ok) {

      notify(data.error || "No se pudo agregar la empresa.", "error");

      return;

    }



    formElement.reset();

    notify("Empresa agregada.", "success");

    router.refresh();

  }



  async function toggle(company: Company) {

    setBusyId(company.id);

    const response = await fetch(`/api/inscripcion-virtual/empresas/${company.id}`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ isActive: !company.isActive })

    });

    const data = await response.json();

    setBusyId("");



    if (!response.ok) {

      notify(data.error || "No se pudo cambiar el estado.", "error");

      return;

    }



    notify(company.isActive ? "Empresa inactivada." : "Empresa activada.", "success");

    router.refresh();

  }



  async function deleteCompany(company: Company) {

    setBusyId(company.id);

    const response = await fetch(`/api/inscripcion-virtual/empresas/${company.id}`, { method: "DELETE" });

    const data = await response.json();

    setBusyId("");



    if (!response.ok) {

      notify(data.error || "No se pudo eliminar la empresa.", "error");

      return;

    }



    notify("Empresa eliminada.", "success");

    router.refresh();

  }



  return (

    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

      <h2 className="text-lg font-black text-slate-950">Empresas del formulario</h2>

      <form onSubmit={create} className="mt-3 flex flex-col gap-2 sm:flex-row">

        <input name="name" required placeholder="Nombre de empresa" className="rounded-md border border-slate-300 px-3 py-2 sm:flex-1" />

        <button disabled={creating} className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">

          <Plus size={17} />

          {creating ? "Agregando..." : "Agregar empresa"}

        </button>

      </form>

      <div className="mt-4 overflow-x-auto">

        <table className="w-full min-w-[520px] text-left text-sm">

          <thead className="bg-slate-50 text-slate-600">

            <tr>

              <th className="px-3 py-2">Empresa</th>

              <th className="px-3 py-2">Estado</th>

              <th className="px-3 py-2">Acción</th>

            </tr>

          </thead>

          <tbody>

            {companies.map((company) => (

              <tr key={company.id} className="border-t border-slate-100">

                <td className="px-3 py-2 font-semibold">{company.name}</td>

                <td className="px-3 py-2">{company.isActive ? "Activa" : "Inactiva"}</td>

                <td className="px-3 py-2">

                  <div className="flex items-center gap-2">

                    <button

                      onClick={() => toggle(company)}

                      disabled={busyId === company.id}

                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60"

                      title={company.isActive ? "Inactivar" : "Activar"}

                    >

                      <Power size={17} />

                    </button>

                    <button

                      onClick={() => deleteCompany(company)}

                      disabled={busyId === company.id}

                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"

                      title="Eliminar"

                    >

                      <Trash2 size={17} />

                    </button>

                  </div>

                </td>

              </tr>

            ))}

            {companies.length === 0 ? (

              <tr>

                <td className="px-3 py-6 text-center text-slate-500" colSpan={3}>

                  No hay empresas registradas.

                </td>

              </tr>

            ) : null}

          </tbody>

        </table>

      </div>

    </section>

  );

}

