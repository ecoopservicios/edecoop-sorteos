"use client";



import { FormEvent, useState } from "react";

import { useRouter } from "next/navigation";

import { Printer, Trash2, X } from "lucide-react";

import { EnrollmentFollowUpStatus, EnrollmentSubmissionChannel } from "@prisma/client";

import { enrollmentStatusLabel } from "@/lib/enrollment";

import { notify } from "@/lib/toast";

import { ExportExcelButton } from "@/components/export-excel-button";



type Row = {

  id: string;

  createdAt: string;

  name: string;

  documentId: string;

  mobilePhone: string;

  email: string;

  companyName: string;

  workplace: string;

  employeeNumber: string;

  salaryDeductionPercent: string;

  channel: EnrollmentSubmissionChannel;

  receivedPrize: boolean;

  prizeCode: string;

  followUpStatus: EnrollmentFollowUpStatus;

  prizeLink: string;

};



function channelLabel(channel: EnrollmentSubmissionChannel) {

  if (channel === "PRESENTIAL_FISICO") return "Formulario físico";

  if (channel === "PRESENTIAL") return "Presencial";

  return "Virtual";

}



function actionButtonClass(tone: "neutral" | "red") {

  const colors = {

    neutral: "border-slate-300 text-slate-700 hover:bg-slate-100",

    red: "border-red-200 text-red-700 hover:bg-red-50"

  };

  return `inline-flex h-9 w-9 items-center justify-center rounded-md border ${colors[tone]}`;

}



export function EnrollmentSubmissionsTable({ rows }: { rows: Row[] }) {

  const router = useRouter();

  const [deleting, setDeleting] = useState<Row | null>(null);

  const [busyId, setBusyId] = useState("");

  const [channelFilter, setChannelFilter] = useState<"ALL" | EnrollmentSubmissionChannel>("ALL");

  const filteredRows = channelFilter === "ALL" ? rows : rows.filter((row) => row.channel === channelFilter);
  const exportRows = filteredRows.map((row) => ({
    Fecha: row.createdAt,
    Modalidad: channelLabel(row.channel),
    Solicitante: row.name,
    Cedula: row.documentId,
    Celular: row.mobilePhone,
    Correo: row.email,
    Empresa: row.companyName,
    Oficina: row.workplace,
    "No. empleado": row.employeeNumber,
    "% descuento": row.salaryDeductionPercent,
    Premio: row.receivedPrize ? "Recibido presencial" : row.prizeLink ? "Link generado" : "No generado",
    Codigo: row.prizeCode || "",
    Estado: enrollmentStatusLabel(row.followUpStatus),
    "Link premio": row.prizeLink
  }));



  async function deleteSubmission(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (!deleting) return;

    const form = new FormData(event.currentTarget);

    setBusyId(deleting.id);

    const response = await fetch(`/api/inscripcion-virtual/solicitudes/${deleting.id}`, {

      method: "DELETE",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ reason: form.get("reason") })

    });

    const data = await response.json();

    setBusyId("");



    if (!response.ok) {

      notify(data.error || "No se pudo eliminar la solicitud.", "error");

      return;

    }



    setDeleting(null);

    notify("Solicitud eliminada.", "success");

    router.refresh();

  }



  return (

    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <h2 className="text-lg font-black text-slate-950">Solicitudes recibidas</h2>

          <p className="text-sm text-slate-600">Filtra por el origen de la afiliación.</p>

        </div>

        <label className="block sm:w-72">

          <span className="mb-1 block text-sm font-semibold text-slate-700">Modalidad</span>

          <select
            value={channelFilter}
            onChange={(event) => setChannelFilter(event.target.value as "ALL" | EnrollmentSubmissionChannel)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >

            <option value="ALL">Todas</option>

            <option value="VIRTUAL">Virtual</option>

            <option value="PRESENTIAL_FISICO">Formulario físico</option>

            <option value="PRESENTIAL">Presencial anterior</option>

          </select>

        </label>

        <ExportExcelButton rows={exportRows} fileName="solicitudes-afiliacion" />

      </div>

      <div className="overflow-x-auto">

        <table className="w-full min-w-[1480px] text-left text-sm">

          <thead className="bg-slate-50 text-slate-600">

            <tr>

              <th className="px-3 py-2">Fecha</th>

              <th className="px-3 py-2">Modalidad</th>

              <th className="px-3 py-2">Solicitante</th>

              <th className="px-3 py-2">Cédula</th>

              <th className="px-3 py-2">Celular</th>

              <th className="px-3 py-2">Correo</th>

              <th className="px-3 py-2">Empresa</th>

              <th className="px-3 py-2">Oficina</th>

              <th className="px-3 py-2">No. empleado</th>

              <th className="px-3 py-2">% descuento</th>

              <th className="px-3 py-2">Premio</th>

              <th className="px-3 py-2">Código</th>

              <th className="px-3 py-2">Estado</th>

              <th className="px-3 py-2">Acción</th>

            </tr>

          </thead>

          <tbody>

            {filteredRows.map((row) => (

              <tr key={row.id} className="border-t border-slate-100">

                <td className="px-3 py-2">{row.createdAt}</td>

                <td className="px-3 py-2">

                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{channelLabel(row.channel)}</span>

                </td>

                <td className="px-3 py-2 font-semibold">{row.name}</td>

                <td className="px-3 py-2">{row.documentId}</td>

                <td className="px-3 py-2">{row.mobilePhone}</td>

                <td className="px-3 py-2">{row.email}</td>

                <td className="px-3 py-2">{row.companyName}</td>

                <td className="px-3 py-2">{row.workplace}</td>

                <td className="px-3 py-2">{row.employeeNumber}</td>

                <td className="px-3 py-2">{row.salaryDeductionPercent}%</td>

                <td className="px-3 py-2">{row.receivedPrize ? "Recibido presencial" : row.prizeLink ? "Link generado" : "No generado"}</td>

                <td className="px-3 py-2 font-mono">{row.prizeCode || "-"}</td>

                <td className="px-3 py-2">{enrollmentStatusLabel(row.followUpStatus)}</td>

                <td className="px-3 py-2">

                  <div className="flex items-center gap-2">

                    <a className={actionButtonClass("neutral")} href={`/inscripcion-virtual/solicitudes/${row.id}/imprimir`} target="_blank" title="Imprimir formulario">

                      <Printer size={17} />

                    </a>

                    <button className={actionButtonClass("red")} onClick={() => setDeleting(row)} disabled={busyId === row.id} title="Eliminar formulario">

                      <Trash2 size={17} />

                    </button>

                  </div>

                </td>

              </tr>

            ))}

            {filteredRows.length === 0 ? (

              <tr>

                <td className="px-3 py-8 text-center text-slate-500" colSpan={14}>

                  No hay solicitudes recibidas.

                </td>

              </tr>

            ) : null}

          </tbody>

        </table>

      </div>

      {deleting ? (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">

          <form onSubmit={deleteSubmission} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">

            <div className="mb-4 flex items-start justify-between gap-3">

              <div>

                <h3 className="text-xl font-black text-slate-950">Eliminar solicitud</h3>

                <p className="mt-1 text-sm text-slate-600">{deleting.name}</p>

              </div>

              <button

                type="button"

                onClick={() => setDeleting(null)}

                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"

                title="Cerrar"

              >

                <X size={18} />

              </button>

            </div>

            <label className="block">

              <span className="mb-1 block text-sm font-semibold text-slate-700">Motivo de eliminacion</span>

              <textarea name="reason" required minLength={5} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2" />

            </label>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

              <button type="button" onClick={() => setDeleting(null)} className="rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100">

                Cancelar

              </button>

              <button disabled={busyId === deleting.id} className="inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800 disabled:opacity-60">

                <Trash2 size={17} />

                {busyId === deleting.id ? "Eliminando..." : "Eliminar"}

              </button>

            </div>

          </form>

        </div>

      ) : null}

    </section>

  );

}
