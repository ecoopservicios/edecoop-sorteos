"use client";

import { ExternalLink } from "lucide-react";
import { EnrollmentBulkUpload } from "@/components/enrollment-bulk-upload";

export function EnrollmentPresentialPanel({ url }: { url: string }) {
  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Formulario presencial digital</h2>
            <p className="text-sm text-slate-600">
              Abre el formulario para que la promotora registre afiliaciones directamente durante una jornada física.
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800"
          >
            <ExternalLink size={17} />
            Abrir formulario digital
          </a>
        </div>
        <p className="mt-3 break-all rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-700">{url}</p>
      </section>

      <EnrollmentBulkUpload />
    </div>
  );
}
