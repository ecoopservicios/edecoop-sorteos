"use client";



import { FormEvent, useState } from "react";

import { useRouter } from "next/navigation";

import { Save } from "lucide-react";

import { notify } from "@/lib/toast";



type FormConfig = {

  title: string;

  description: string;

  isActive: boolean;

  allowInstantPrize: boolean;

};



export function EnrollmentFormConfig({ form, defaultText }: { form?: FormConfig | null; defaultText: string }) {

  const router = useRouter();

  const [loading, setLoading] = useState(false);



  async function submit(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    setLoading(true);

    const data = new FormData(event.currentTarget);

    const response = await fetch("/api/inscripcion-virtual/form", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        title: data.get("title"),

        description: data.get("description"),

        isActive: data.get("isActive") === "on",

        allowInstantPrize: data.get("allowInstantPrize") === "on"

      })

    });

    const payload = await response.json();

    setLoading(false);



    if (!response.ok) {

      notify(payload.error || "No se pudo guardar el formulario.", "error");

      return;

    }



    notify("Formulario de afiliación actualizado.", "success");

    router.refresh();

  }



  return (

    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

      <div className="grid gap-4">

        <label className="block">

          <span className="mb-1 block text-sm font-semibold text-slate-700">Título del formulario</span>

          <input

            name="title"

            required

            defaultValue={form?.title || "Solicitud de Admisión EDECOOP"}

            className="w-full rounded-md border border-slate-300 px-3 py-2"

          />

        </label>

        <label className="block">

          <span className="mb-1 block text-sm font-semibold text-slate-700">Texto legal</span>

          <textarea

            name="description"

            required

            rows={9}

            defaultValue={form?.description || defaultText}

            className="w-full rounded-md border border-slate-300 px-3 py-2"

          />

        </label>

        <label className="inline-flex items-center gap-2 font-semibold text-slate-700">

          <input name="isActive" type="checkbox" defaultChecked={form?.isActive ?? true} className="h-4 w-4" />

          Formulario activo

        </label>

        <label className="inline-flex items-center gap-2 font-semibold text-slate-700">

          <input name="allowInstantPrize" type="checkbox" defaultChecked={form?.allowInstantPrize ?? true} className="h-4 w-4" />

          Habilitar premio instantáneo en el link público

        </label>

      </div>

      <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60" disabled={loading}>

        <Save size={17} />

        {loading ? "Guardando..." : "Actualizar formulario"}

      </button>

    </form>

  );

}
