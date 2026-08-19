"use client";



import { FormEvent, useState } from "react";

import { useRouter } from "next/navigation";

import { MessageCircle, Pencil, RefreshCw, Save, Trash2, X } from "lucide-react";

import { notify } from "@/lib/toast";

import { ExportExcelButton } from "@/components/export-excel-button";



type DigitalLinkRow = {

  id: string;

  token: string;

  status: string;

  createdAt: string;

  sourceChannel: string;

  sourceEventName: string;

  participant: {

    id: string;

    firstName: string;

    lastName: string;

    nie: string;

    email: string;

    phone: string;

    name: string;

  };

  result: null | {

    code: string;

    prizeName: string;

  };

  url: string;

  whatsappUrl: string;

};

function sourceLabel(channel: string) {
  if (channel === "PRESENTIAL_FISICO") return "Formulario fisico";
  if (channel === "VIRTUAL") return "Afiliacion digital";
  if (channel === "PRESENTIAL") return "Presencial anterior";
  return "Sin origen";
}



function actionButtonClass(tone: "neutral" | "green" | "amber" | "red") {

  const colors = {

    neutral: "border-slate-300 text-slate-700 hover:bg-slate-100",

    green: "border-emerald-200 text-emerald-800 hover:bg-emerald-50",

    amber: "border-amber-200 text-amber-800 hover:bg-amber-50",

    red: "border-red-200 text-red-700 hover:bg-red-50"

  };



  return `inline-flex h-9 w-9 items-center justify-center rounded-md border ${colors[tone]}`;

}



export function DigitalLinksTable({ rows }: { rows: DigitalLinkRow[] }) {

  const router = useRouter();

  const [message, setMessage] = useState("");

  const [busyId, setBusyId] = useState("");

  const [editing, setEditing] = useState<DigitalLinkRow | null>(null);

  const [removing, setRemoving] = useState<DigitalLinkRow | null>(null);
  const exportRows = rows.map((row) => ({
    Nombre: row.participant.firstName,
    Apellido: row.participant.lastName,
    NIE: row.participant.nie,
    Correo: row.participant.email,
    Celular: row.participant.phone,
    Origen: sourceLabel(row.sourceChannel),
    Evento: row.sourceEventName || "",
    Estado: row.status,
    Premio: row.result?.prizeName || "",
    Codigo: row.result?.code || "",
    Creado: new Date(row.createdAt).toLocaleString("es-DO"),
    Link: row.url
  }));



  async function saveEdit(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (!editing) return;

    const form = new FormData(event.currentTarget);

    setBusyId(editing.id);

    setMessage("");

    const response = await fetch(`/api/participantes-digitales/${editing.participant.id}`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        firstName: form.get("firstName"),

        lastName: form.get("lastName"),

        nie: form.get("nie"),

        email: form.get("email"),

        phone: form.get("phone")

      })

    });

    const data = await response.json();

    setBusyId("");

    if (!response.ok) {

      setMessage(data.error || "No se pudo editar el participante.");

      notify(data.error || "No se pudo editar el participante.", "error");

      return;

    }

    setEditing(null);

    notify("Participante virtual actualizado.", "success");

    router.refresh();

  }



  function uppercaseName(event: FormEvent<HTMLInputElement>) {

    event.currentTarget.value = event.currentTarget.value.toUpperCase();

  }



  async function removeConfirmed(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (!removing) return;

    const form = new FormData(event.currentTarget);

    const reason = String(form.get("reason") || "").trim();

    if (reason.length < 5) {

      notify("Debe indicar un motivo de eliminacion de al menos 5 caracteres.", "warning");

      return;

    }



    setBusyId(removing.id);

    setMessage("");

    const response = await fetch(`/api/participantes-digitales/${removing.participant.id}`, {

      method: "DELETE",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ reason })

    });

    const data = await response.json();

    setBusyId("");

    if (!response.ok) {

      setMessage(data.error || "No se pudo eliminar el participante.");

      notify(data.error || "No se pudo eliminar el participante.", "error");

      return;

    }

    setRemoving(null);

    notify("Participante virtual eliminado y registrado en bitacora.", "success");

    router.refresh();

  }



  async function reset(row: DigitalLinkRow) {

    setBusyId(row.id);

    setMessage("");

    const response = await fetch(`/api/enlaces-digitales/${row.token}/reset`, {

      method: "POST"

    });

    const data = await response.json();

    setBusyId("");

    if (!response.ok) {

      setMessage(data.error || "No se pudo resetear el enlace.");

      notify(data.error || "No se pudo resetear el enlace.", "error");

      return;

    }

    setMessage("Enlace reseteado. Puedes enviarlo desde el icono de WhatsApp.");

    notify("Enlace reseteado correctamente.", "success");

    router.refresh();

  }



  return (

    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <h2 className="text-lg font-black text-slate-950">Premios instantaneos</h2>

          <p className="text-sm text-slate-600">Gestiona enlaces generados desde afiliaciones digitales o cargas de formularios fisicos.</p>

        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportExcelButton rows={exportRows} fileName="premios-instantaneos-afiliacion" />
          {message ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{message}</p> : null}
        </div>

      </div>

      <div className="overflow-x-auto">

        <table className="w-full min-w-[1260px] text-left text-sm">

          <thead className="bg-slate-50 text-slate-600">

            <tr>

              <th className="px-3 py-2">Nombre</th>

              <th className="px-3 py-2">Apellido</th>

              <th className="px-3 py-2">NIE</th>

              <th className="px-3 py-2">Correo</th>

              <th className="px-3 py-2">Celular o movil</th>

              <th className="px-3 py-2">Origen</th>

              <th className="px-3 py-2">Evento</th>

              <th className="px-3 py-2">Estado</th>

              <th className="px-3 py-2">Premio</th>

              <th className="px-3 py-2">Código</th>

              <th className="px-3 py-2">Creado</th>

              <th className="px-3 py-2">Acciones</th>

            </tr>

          </thead>

          <tbody>

            {rows.map((row) => {

              const isBusy = busyId === row.id;

              const hasPrize = Boolean(row.result);

              const isUsed = row.status === "USED" || hasPrize;

              return (

                <tr key={row.id} className="border-t border-slate-100">

                  <td className="px-3 py-2 font-semibold">{row.participant.firstName}</td>

                  <td className="px-3 py-2">{row.participant.lastName}</td>

                  <td className="px-3 py-2">{row.participant.nie}</td>

                  <td className="px-3 py-2">{row.participant.email}</td>

                  <td className="px-3 py-2">{row.participant.phone}</td>

                  <td className="px-3 py-2">
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">{sourceLabel(row.sourceChannel)}</span>
                  </td>

                  <td className="px-3 py-2">{row.sourceEventName || "-"}</td>

                  <td className="px-3 py-2">{row.status}</td>

                  <td className="px-3 py-2">{row.result?.prizeName || "-"}</td>

                  <td className="px-3 py-2">{row.result?.code || "-"}</td>

                  <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString("es-DO")}</td>

                  <td className="px-3 py-2">

                    <div className="flex items-center gap-2">

                      <a

                        className={`${actionButtonClass(isUsed ? "neutral" : "green")} ${isUsed ? "cursor-not-allowed opacity-60" : ""}`}

                        href={isUsed ? undefined : row.whatsappUrl}

                        target={isUsed ? undefined : "_blank"}

                        onClick={(event) => {

                          if (!isUsed) return;

                          event.preventDefault();

                          notify("No se puede enviar por WhatsApp un enlace que ya fue usado.", "warning");

                        }}

                        title={isUsed ? "El enlace ya fue usado" : "Enviar por WhatsApp"}

                        aria-disabled={isUsed}

                      >

                        <MessageCircle size={17} />

                      </a>

                      <button

                        className={`${actionButtonClass("neutral")} ${isUsed ? "cursor-not-allowed opacity-60" : ""}`}

                        onClick={() => {

                          if (isUsed) {

                            notify("No se puede editar un participante con enlace usado o premio otorgado.", "warning");

                            return;

                          }

                          setEditing(row);

                        }}

                        disabled={isBusy}

                        title={isUsed ? "El enlace ya fue usado" : "Editar"}

                      >

                        <Pencil size={17} />

                      </button>

                      <button

                        className={`${actionButtonClass("amber")} ${isUsed ? "cursor-not-allowed opacity-60" : ""}`}

                        onClick={() => {

                          if (isUsed) {

                            notify("No se puede resetear un enlace usado o con premio otorgado.", "warning");

                            return;

                          }

                          reset(row);

                        }}

                        disabled={isBusy}

                        title={isUsed ? "El enlace ya fue usado" : "Resetear enlace"}

                      >

                        <RefreshCw size={17} />

                      </button>

                      <button

                        className={actionButtonClass("red")}

                        onClick={() => setRemoving(row)}

                        disabled={isBusy}

                        title={isUsed ? "Eliminar con motivo en bitacora" : "Eliminar"}

                      >

                        <Trash2 size={17} />

                      </button>

                    </div>

                  </td>

                </tr>

              );

            })}

          </tbody>

        </table>

      </div>

      {editing ? (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">

          <form onSubmit={saveEdit} className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">

            <div className="mb-4 flex items-start justify-between gap-3">

              <div>

                <h3 className="text-xl font-black text-slate-950">Editar participante</h3>

                <p className="text-sm text-slate-600">Actualiza los datos usados para el enlace virtual.</p>

              </div>

              <button

                type="button"

                onClick={() => setEditing(null)}

                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"

                title="Cerrar"

              >

                <X size={18} />

              </button>

            </div>

            <div className="grid gap-3 md:grid-cols-2">

              <label className="block">

                <span className="mb-1 block text-sm font-semibold text-slate-700">Nombre</span>

                <input

                  name="firstName"

                  required

                  defaultValue={editing.participant.firstName}

                  pattern="[A-Z ]+"

                  title="Solo letras A-Z y espacios, sin acentos ni simbolos"

                  onInput={uppercaseName}

                  className="w-full rounded-md border border-slate-300 px-3 py-2"

                />

              </label>

              <label className="block">

                <span className="mb-1 block text-sm font-semibold text-slate-700">Apellido</span>

                <input

                  name="lastName"

                  required

                  defaultValue={editing.participant.lastName}

                  pattern="[A-Z ]+"

                  title="Solo letras A-Z y espacios, sin acentos ni simbolos"

                  onInput={uppercaseName}

                  className="w-full rounded-md border border-slate-300 px-3 py-2"

                />

              </label>

              <label className="block">

                <span className="mb-1 block text-sm font-semibold text-slate-700">NIE</span>

                <input

                  name="nie"

                  required

                  defaultValue={editing.participant.nie}

                  title="Numero de empleado"

                  className="w-full rounded-md border border-slate-300 px-3 py-2"

                />

              </label>

              <label className="block">

                <span className="mb-1 block text-sm font-semibold text-slate-700">Correo electrónico</span>

                <input

                  name="email"

                  required

                  type="email"

                  defaultValue={editing.participant.email}

                  title="Registrar correo electrónico personal"

                  className="w-full rounded-md border border-slate-300 px-3 py-2"

                />

              </label>

              <label className="block md:col-span-2">

                <span className="mb-1 block text-sm font-semibold text-slate-700">Celular o movil</span>

                <input

                  name="phone"

                  required

                  defaultValue={editing.participant.phone}

                  className="w-full rounded-md border border-slate-300 px-3 py-2"

                />

              </label>

            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

              <button

                type="button"

                onClick={() => setEditing(null)}

                className="rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100"

              >

                Cancelar

              </button>

              <button

                disabled={busyId === editing.id}

                className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60"

              >

                <Save size={17} />

                {busyId === editing.id ? "Guardando..." : "Guardar cambios"}

              </button>

            </div>

          </form>

        </div>

      ) : null}

      {removing ? (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">

          <form onSubmit={removeConfirmed} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">

            <div className="mb-4 flex items-start justify-between gap-3">

              <div>

                <h3 className="text-xl font-black text-slate-950">Eliminar participante</h3>

                <p className="mt-1 text-sm text-slate-600">

                  El participante se ocultara de la tabla principal y el motivo quedara guardado en bitacora.

                </p>

              </div>

              <button

                type="button"

                onClick={() => setRemoving(null)}

                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"

                title="Cerrar"

              >

                <X size={18} />

              </button>

            </div>

            <div className="rounded-md bg-red-50 p-3 text-sm text-red-900">

              <p className="font-bold">{removing.participant.name}</p>

              <p>{removing.participant.nie}</p>

            </div>

            <label className="mt-4 block">

              <span className="mb-1 block text-sm font-semibold text-slate-700">Motivo de eliminacion</span>

              <textarea

                name="reason"

                required

                minLength={5}

                rows={4}

                placeholder="Describe por que se elimina este participante"

                className="w-full resize-none rounded-md border border-slate-300 px-3 py-2"

              />

            </label>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

              <button

                type="button"

                onClick={() => setRemoving(null)}

                className="rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100"

              >

                Cancelar

              </button>

              <button

                type="submit"

                disabled={busyId === removing.id}

                className="inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800 disabled:opacity-60"

              >

                <Trash2 size={17} />

                {busyId === removing.id ? "Eliminando..." : "Eliminar"}

              </button>

            </div>

          </form>

        </div>

      ) : null}

    </section>

  );

}
