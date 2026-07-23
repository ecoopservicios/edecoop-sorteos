"use client";



import { ChangeEvent, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { Download, Upload } from "lucide-react";

import { notify } from "@/lib/toast";



type BulkError = {

  row: number;

  message: string;

};



type BulkResult = {

  processed: number;

  created: number;

  linksCreated: number;

  prizesLinked: number;

  rejected: number;

  errors: BulkError[];

};



export function EnrollmentBulkUpload() {

  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState<BulkResult | null>(null);



  async function upload(event: ChangeEvent<HTMLInputElement>) {

    const inputElement = event.currentTarget;

    const file = inputElement.files?.[0];

    if (!file) return;



    setLoading(true);

    setResult(null);

    const form = new FormData();

    form.set("file", file);



    const response = await fetch("/api/inscripcion-virtual/carga-presencial", {

      method: "POST",

      body: form

    });

    const data = await response.json();

    setLoading(false);

    inputElement.value = "";



    if (!response.ok && !data.errors) {

      notify(data.error || "No se pudo procesar la carga de afiliaciones.", "error");

      return;

    }



    setResult(data);

    if (data.created > 0) {

      notify(`Carga completada. Solicitudes: ${data.created}. Links: ${data.linksCreated}. Rechazados: ${data.rejected}.`, data.rejected ? "info" : "success");

      router.refresh();

      return;

    }



    notify("No se crearon afiliaciones. Revise los errores de la carga.", "error");

  }



  return (

    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

        <div>

          <h2 className="text-lg font-black text-slate-950">Carga de formularios físicos</h2>

          <p className="text-sm text-slate-600">

            Importa formularios llenados en papel, coteja códigos de premios presenciales y deja links listos para premio instantáneo cuando aplique.

          </p>

        </div>

        <div className="flex flex-wrap gap-2">

          <a

            href="/api/inscripcion-virtual/plantilla-presencial"

            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100"

          >

            <Download size={17} />

            Descargar plantilla

          </a>

          <button

            type="button"

            onClick={() => inputRef.current?.click()}

            disabled={loading}

            className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60"

          >

            <Upload size={17} />

            {loading ? "Procesando..." : "Cargar formularios físicos"}

          </button>

          <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={upload} />

        </div>

      </div>

      {result ? (

        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm">

          <div className="grid gap-2 sm:grid-cols-4">

            <p>

              <span className="font-bold text-slate-950">Procesadas:</span> {result.processed}

            </p>

            <p>

              <span className="font-bold text-emerald-800">Solicitudes:</span> {result.created}

            </p>

            <p>

              <span className="font-bold text-emerald-800">Links:</span> {result.linksCreated}

            </p>

            <p>

              <span className="font-bold text-amber-800">Premios cotejados:</span> {result.prizesLinked}

            </p>

          </div>

          <p className="mt-2">

            <span className="font-bold text-red-700">Rechazadas:</span> {result.rejected}

          </p>

          {result.errors.length ? (

            <div className="mt-3 overflow-x-auto">

              <table className="w-full min-w-[620px] text-left text-sm">

                <thead className="text-slate-600">

                  <tr>

                    <th className="px-2 py-1">Fila</th>

                    <th className="px-2 py-1">Error</th>

                  </tr>

                </thead>

                <tbody>

                  {result.errors.map((error, index) => (

                    <tr key={`${error.row}-${index}`} className="border-t border-slate-200">

                      <td className="px-2 py-1 font-mono">{error.row}</td>

                      <td className="px-2 py-1">{error.message}</td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          ) : null}

        </div>

      ) : null}

    </section>

  );

}
