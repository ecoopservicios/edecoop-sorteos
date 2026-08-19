"use client";



import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { Archive, Eye, FileDown, FolderPlus, MapPin, Pencil, Plus, Power, Save, Trash2, Upload, XCircle } from "lucide-react";

import { EventEditionStatus, EventPrizeType } from "@prisma/client";

import { MONTHS, eventStatusLabel, monthLabel, prizeTypeLabel } from "@/lib/events";

import { notify } from "@/lib/toast";

import { ExportExcelButton } from "@/components/export-excel-button";



type EventTypeRow = {

  id: string;

  name: string;

  code: string;

  isActive: boolean;

};



type EventPrizeRow = {

  id: string;

  type: string;

  name: string;

  zone: string | null;

  availableQuantity: number;

  awardedQuantity: number;

  isActive: boolean;

};



type EventRow = {

  id: string;

  displayName: string;

  month: number;

  year: number;

  usesZones: boolean;

  status: EventEditionStatus;

  closedAt: string | null;

  eventType: EventTypeRow;

  prizes: EventPrizeRow[];

  participantCount: number;

  prizeResultCount: number;

};



type EnrollmentRow = {

  id: string;

  name: string;

  documentId: string;

  phone: string;

  email: string;

  channel: string;

  prizeCode: string;

};



type EventParticipantRow = {

  id: string;

  name: string;

  documentId: string;

  phone: string;

  email: string;

  zone: string;

  source: string;

  status: string;

  channel: string;

  prizeCode: string;

  prizeName: string;

  prizeStatus: string;

  prizeDate: string;

  loadedAt: string;

};



type EventZoneRow = {

  id: string;

  name: string;

  isActive: boolean;

};



type ResetPreview = {

  event: {

    id: string;

    name: string;

    typeCode: string;

    typeName: string;

    status: string;

  };

  results: number;

  submissions: number;

  digitalLinks: number;

  digitalParticipants: number;

  participants: number;

  prizes: Array<{ id: string; name: string; restoreQuantity: number }>;

};



const years = Array.from({ length: 10 }, (_, index) => 2026 + index);



function actionClass(tone: "neutral" | "green" | "amber" | "red") {

  const colors = {

    neutral: "border-slate-300 text-slate-700 hover:bg-slate-100",

    green: "border-emerald-200 text-emerald-800 hover:bg-emerald-50",

    amber: "border-amber-200 text-amber-800 hover:bg-amber-50",

    red: "border-red-200 text-red-700 hover:bg-red-50"

  };

  return `inline-flex h-9 w-9 items-center justify-center rounded-md border ${colors[tone]}`;

}



async function readJsonResponse(response: Response) {

  const text = await response.text();

  if (!text) return {};

  try {

    return JSON.parse(text) as { error?: string; errors?: Array<{ row: number; message: string }>; created?: number; rejected?: number };

  } catch {

    return { error: "El servidor devolvió una respuesta inesperada." };

  }

}



function participantSourceLabel(source: string) {

  if (source === "ENROLLMENT") return "Afiliación";

  if (source === "BULK") return "Carga masiva";

  return source || "-";

}



function participantStatusLabel(status: string) {

  const labels: Record<string, string> = {

    AVAILABLE: "Disponible",

    WINNER: "Ganador",

    NEW: "Nuevo",

    CONTACTED: "Contactado",

    IN_PROCESS: "En proceso",

    MEMBER: "Afiliado",

    NOT_INTERESTED: "No interesado"

  };

  return labels[status] || status || "-";

}



function participantChannelLabel(channel: string) {

  if (channel === "PRESENTIAL_FISICO") return "Formulario físico";

  if (channel === "PRESENTIAL") return "Presencial";

  if (channel === "VIRTUAL") return "Virtual";

  if (channel === "EVENTO") return "Evento";

  return channel || "-";

}



function prizeResultStatusLabel(status: string) {

  if (status === "SENT") return "Enviado";

  if (status === "DELIVERED") return "Entregado";

  if (status === "PENDING") return "Pendiente";

  if (status === "AWARDED") return "Premio";

  if (status === "CANCELLED") return "Cancelado";

  return status || "-";

}



function csvValue(value: unknown) {

  return `"${String(value ?? "").replace(/"/g, '""')}"`;

}



function eventFileName(event: EventRow) {

  return event.displayName

    .toLowerCase()

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .replace(/[^a-z0-9]+/g, "-")

    .replace(/^-|-$/g, "");

}



function downloadCsv(fileName: string, csv: string) {

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;

  a.download = fileName;

  a.click();

  URL.revokeObjectURL(url);

}



export function EventsManager({

  activeTab,

  eventTypes,

  events,

  historicalEvents,

  enrollmentRows,

  eventParticipantRows,

  zones

}: {

  activeTab: string;

  eventTypes: EventTypeRow[];

  events: EventRow[];

  historicalEvents: EventRow[];

  enrollmentRows: EnrollmentRow[];

  eventParticipantRows: Record<string, EventParticipantRow[]>;

  zones: EventZoneRow[];

}) {

  const router = useRouter();

  const [busyId, setBusyId] = useState("");

  const [editing, setEditing] = useState<EventRow | null>(null);

  const [editingPrize, setEditingPrize] = useState<EventPrizeRow | null>(null);

  const [selectedEventId, setSelectedEventId] = useState("");

  const [selectedParticipantsEventId, setSelectedParticipantsEventId] = useState("");

  const [selectedResetEventId, setSelectedResetEventId] = useState("");

  const [resetPreview, setResetPreview] = useState<ResetPreview | null>(null);

  const [viewEvent, setViewEvent] = useState<EventRow | null>(null);

  const [uploadEventId, setUploadEventId] = useState("");

  const uploadInputRef = useRef<HTMLInputElement>(null);



  const selectedPrizeEvent = useMemo(() => events.find((event) => event.id === selectedEventId), [events, selectedEventId]);

  const selectedParticipantsEvent = useMemo(() => events.find((event) => event.id === selectedParticipantsEventId), [events, selectedParticipantsEventId]);

  const selectedResetEvent = useMemo(() => events.find((event) => event.id === selectedResetEventId), [events, selectedResetEventId]);

  const selectedUploadEvent = useMemo(() => events.find((event) => event.id === uploadEventId), [events, uploadEventId]);



  async function createEvent(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/eventos", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        eventTypeId: form.get("eventTypeId"),

        month: Number(form.get("month")),

        year: Number(form.get("year")),

        usesZones: form.get("usesZones") === "YES"

      })

    });

    const data = await readJsonResponse(response);

    if (!response.ok) {

      notify(data.error || "No se pudo crear el evento.", "error");

      return;

    }

    notify("Evento creado correctamente.", "success");

    router.refresh();

  }



  async function createEventType(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    const formElement = event.currentTarget;

    const form = new FormData(event.currentTarget);

    setBusyId("event-type");

    const response = await fetch("/api/eventos/tipos", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ name: form.get("name") })

    });

    const data = await readJsonResponse(response);

    setBusyId("");

    if (!response.ok) {

      notify(data.error || "No se pudo crear el tipo de evento.", "error");

      return;

    }

    formElement.reset();

    notify("Tipo de evento creado correctamente.", "success");

    router.refresh();

  }



  async function toggleEventType(type: EventTypeRow) {

    setBusyId(type.id);

    const response = await fetch(`/api/eventos/tipos/${type.id}`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ isActive: !type.isActive })

    });

    const data = await readJsonResponse(response);

    setBusyId("");

    if (!response.ok) {

      notify(data.error || "No se pudo actualizar el tipo de evento.", "error");

      return;

    }

    notify(type.isActive ? "Tipo de evento inactivado." : "Tipo de evento activado.", "success");

    router.refresh();

  }



  async function deleteEventType(type: EventTypeRow) {

    setBusyId(type.id);

    const response = await fetch(`/api/eventos/tipos/${type.id}`, { method: "DELETE" });

    const data = await readJsonResponse(response);

    setBusyId("");

    if (!response.ok) {

      notify(data.error || "No se pudo eliminar el tipo de evento.", "error");

      return;

    }

    notify("Tipo de evento eliminado.", "success");

    router.refresh();

  }



  async function createZone(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    const formElement = event.currentTarget;

    const form = new FormData(event.currentTarget);

    setBusyId("zone");

    const response = await fetch("/api/eventos/zonas", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ name: form.get("name") })

    });

    const data = await readJsonResponse(response);

    setBusyId("");

    if (!response.ok) {

      notify(data.error || "No se pudo crear la zona.", "error");

      return;

    }

    formElement.reset();

    notify("Zona creada correctamente.", "success");

    router.refresh();

  }



  async function toggleZone(zone: EventZoneRow) {

    setBusyId(zone.id);

    const response = await fetch(`/api/eventos/zonas/${zone.id}`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ isActive: !zone.isActive })

    });

    const data = await readJsonResponse(response);

    setBusyId("");

    if (!response.ok) {

      notify(data.error || "No se pudo actualizar la zona.", "error");

      return;

    }

    notify(zone.isActive ? "Zona inactivada." : "Zona activada.", "success");

    router.refresh();

  }



  async function deleteZone(zone: EventZoneRow) {

    setBusyId(zone.id);

    const response = await fetch(`/api/eventos/zonas/${zone.id}`, { method: "DELETE" });

    const data = await readJsonResponse(response);

    setBusyId("");

    if (!response.ok) {

      notify(data.error || "No se pudo eliminar la zona.", "error");

      return;

    }

    notify("Zona eliminada.", "success");

    router.refresh();

  }



  async function loadResetPreview(eventId: string) {

    setSelectedResetEventId(eventId);

    setResetPreview(null);

    if (!eventId) return;

    setBusyId("reset-preview");

    const response = await fetch(`/api/eventos/reset/${eventId}`);

    const data = await readJsonResponse(response) as ResetPreview & { error?: string };

    setBusyId("");

    if (!response.ok) {

      notify(data.error || "No se pudo cargar el resumen de reset.", "error");

      return;

    }

    setResetPreview(data);

  }



  async function resetEvent(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (!resetPreview) return;

    const form = new FormData(event.currentTarget);

    setBusyId("reset-event");

    const response = await fetch(`/api/eventos/reset/${resetPreview.event.id}`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        reason: form.get("reason"),

        confirmation: form.get("confirmation")

      })

    });

    const data = await readJsonResponse(response);

    setBusyId("");

    if (!response.ok) {

      notify(data.error || "No se pudo resetear el evento.", "error");

      return;

    }

    notify("Evento reseteado correctamente.", "success");

    setResetPreview(null);

    setSelectedResetEventId("");

    router.refresh();

  }



  async function eventAction(event: EventRow, action: "toggle" | "close" | "delete") {

    setBusyId(event.id);

    const response =

      action === "delete"

        ? await fetch(`/api/eventos/${event.id}`, { method: "DELETE" })

        : await fetch(`/api/eventos/${event.id}`, {

            method: "PATCH",

            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({ action })

          });

    const data = await readJsonResponse(response);

    setBusyId("");

    if (!response.ok) {

      notify(data.error || "No se pudo actualizar el evento.", "error");

      return;

    }

    notify(action === "close" ? "Evento cerrado y enviado a históricos." : "Evento actualizado.", "success");

    router.refresh();

  }



  async function saveEventEdit(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (!editing) return;

    const form = new FormData(event.currentTarget);

    setBusyId(editing.id);

    const response = await fetch(`/api/eventos/${editing.id}`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        month: Number(form.get("month")),

        year: Number(form.get("year")),

        usesZones: form.get("usesZones") === "YES"

      })

    });

    const data = await readJsonResponse(response);

    setBusyId("");

    if (!response.ok) {

      notify(data.error || "No se pudo editar el evento.", "error");

      return;

    }

    setEditing(null);

    notify("Evento editado correctamente.", "success");

    router.refresh();

  }



  async function addPrize(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/eventos/premios", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        eventEditionId: form.get("eventEditionId"),

        type: form.get("type"),

        name: form.get("name"),

        zone: form.get("zone"),

        availableQuantity: Number(form.get("availableQuantity"))

      })

    });

    const data = await readJsonResponse(response);

    if (!response.ok) {

      notify(data.error || "No se pudo crear el premio del evento.", "error");

      return;

    }

    notify("Premio asociado al evento.", "success");

    router.refresh();

  }



  async function savePrizeEdit(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (!editingPrize) return;

    const form = new FormData(event.currentTarget);

    setBusyId(editingPrize.id);

    const response = await fetch(`/api/eventos/premios/${editingPrize.id}`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        type: form.get("type"),

        name: form.get("name"),

        zone: form.get("zone"),

        availableQuantity: Number(form.get("availableQuantity"))

      })

    });

    const data = await readJsonResponse(response);

    setBusyId("");

    if (!response.ok) {

      notify(data.error || "No se pudo editar el premio.", "error");

      return;

    }

    setEditingPrize(null);

    notify("Premio actualizado correctamente.", "success");

    router.refresh();

  }



  async function togglePrize(prize: EventPrizeRow) {

    setBusyId(prize.id);

    const response = await fetch(`/api/eventos/premios/${prize.id}`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ isActive: !prize.isActive })

    });

    const data = await readJsonResponse(response);

    setBusyId("");

    if (!response.ok) {

      notify(data.error || "No se pudo cambiar el estado del premio.", "error");

      return;

    }

    notify(prize.isActive ? "Premio inactivado." : "Premio activado.", "success");

    router.refresh();

  }



  async function deletePrize(prize: EventPrizeRow) {

    setBusyId(prize.id);

    const response = await fetch(`/api/eventos/premios/${prize.id}`, { method: "DELETE" });

    const data = await readJsonResponse(response);

    setBusyId("");

    if (!response.ok) {

      notify(data.error || "No se pudo eliminar el premio.", "error");

      return;

    }

    notify("Premio eliminado correctamente.", "success");

    router.refresh();

  }



  function downloadEventParticipants(event: EventRow) {

    const rows = eventParticipantRows[event.id] || [];

    const csv = [

      `Reporte del evento,${csvValue(event.displayName)}`,

      `Tipo,${csvValue(event.eventType.name)}`,

      `Estado,${csvValue(eventStatusLabel(event.status))}`,

      `Mes,${csvValue(monthLabel(event.month))}`,

      `Año,${csvValue(event.year)}`,

      "",

      "PREMIOS DEL EVENTO",

      "premio,tipo,zona,cantidad_disponible,cantidad_otorgada,estado",

      ...event.prizes.map((prize) =>

        [

          prize.name,

          prizeTypeLabel(prize.type),

          prize.zone || "",

          prize.availableQuantity,

          prize.awardedQuantity,

          prize.isActive ? "Activo" : "Inactivo"

        ]

          .map(csvValue)

          .join(",")

      ),

      "",

      "PARTICIPANTES",

      "nombre,cedula,telefono,correo,zona,origen,canal,estado_participacion,codigo_premio,premio,estado_premio,fecha_premio,fecha_registro",

      ...rows.map((row) =>

        [

          row.name,

          row.documentId,

          row.phone,

          row.email,

          row.zone,

          participantSourceLabel(row.source),

          participantChannelLabel(row.channel),

          participantStatusLabel(row.status),

          row.prizeCode,

          row.prizeName,

          prizeResultStatusLabel(row.prizeStatus),

          row.prizeDate ? new Date(row.prizeDate).toLocaleString("es-DO") : "",

          row.loadedAt ? new Date(row.loadedAt).toLocaleString("es-DO") : ""

        ]

          .map(csvValue)

          .join(",")

      )

    ].join("\r\n");

    downloadCsv(`reporte-evento-${eventFileName(event)}.csv`, csv);

  }



  async function uploadParticipants(file: File) {

    if (!uploadEventId) {

      notify("Seleccione un evento para cargar participantes.", "warning");

      return;

    }

    const form = new FormData();

    form.set("eventEditionId", uploadEventId);

    form.set("file", file);

    const response = await fetch("/api/eventos/participantes/carga", {

      method: "POST",

      body: form

    });

    const data = await readJsonResponse(response);

    if (!response.ok && !data.errors) {

      notify(data.error || "No se pudo cargar la plantilla.", "error");

      return;

    }

    const created = data.created ?? 0;

    const rejected = data.rejected ?? 0;

    if (created > 0) {

      notify(`Participantes cargados: ${created}. Rechazados: ${rejected}.`, rejected ? "info" : "success");

      router.refresh();

      return;

    }

    notify(data.errors?.[0]?.message || "No se cargaron participantes.", "error");

  }



  function renderEventTable(rows: EventRow[], historical = false) {
    const eventExportRows = rows.map((event) => ({
      Evento: event.displayName,
      Tipo: event.eventType.name,
      Mes: monthLabel(event.month),
      Año: event.year,
      Zona: event.usesZones ? "Si" : "No",
      Participantes: event.participantCount,
      Premios: event.prizes.length,
      Estado: eventStatusLabel(event.status)
    }));

    return (

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex justify-end">
          <ExportExcelButton rows={eventExportRows} fileName={historical ? "eventos-historicos" : "eventos"} />
        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1120px] text-left text-sm">

            <thead className="bg-slate-50 text-slate-600">

              <tr>

                <th className="px-3 py-2">Evento</th>

                <th className="px-3 py-2">Tipo</th>

                <th className="px-3 py-2">Mes</th>

                <th className="px-3 py-2">Año</th>

                <th className="px-3 py-2">Zona</th>

                <th className="px-3 py-2">Participantes</th>

                <th className="px-3 py-2">Premios</th>

                <th className="px-3 py-2">Estado</th>

                <th className="px-3 py-2">Acciones</th>

              </tr>

            </thead>

            <tbody>

              {rows.map((event) => (

                <tr key={event.id} className="border-t border-slate-100">

                  <td className="px-3 py-2 font-semibold">{event.displayName}</td>

                  <td className="px-3 py-2">{event.eventType.name}</td>

                  <td className="px-3 py-2">{monthLabel(event.month)}</td>

                  <td className="px-3 py-2">{event.year}</td>

                  <td className="px-3 py-2">{event.usesZones ? "Si" : "No"}</td>

                  <td className="px-3 py-2">{event.participantCount}</td>

                  <td className="px-3 py-2">{event.prizes.length}</td>

                  <td className="px-3 py-2">{eventStatusLabel(event.status)}</td>

                  <td className="px-3 py-2">

                    <div className="flex items-center gap-2">

                      <button className={actionClass("neutral")} onClick={() => setViewEvent(event)} title="Ver">

                        <Eye size={17} />

                      </button>

                      <button className={actionClass("neutral")} onClick={() => downloadEventParticipants(event)} title="Descargar Excel">

                        <FileDown size={17} />

                      </button>

                      {!historical ? (

                        <>

                          <button className={actionClass("neutral")} onClick={() => setEditing(event)} disabled={busyId === event.id} title="Editar">

                            <Pencil size={17} />

                          </button>

                          <button className={actionClass(event.status === "ACTIVE" ? "amber" : "green")} onClick={() => eventAction(event, "toggle")} disabled={busyId === event.id} title="Activar/Inactivar">

                            <Power size={17} />

                          </button>

                          <button className={actionClass("amber")} onClick={() => eventAction(event, "close")} disabled={busyId === event.id} title="Cerrar evento">

                            <Archive size={17} />

                          </button>

                          <button className={actionClass("red")} onClick={() => eventAction(event, "delete")} disabled={busyId === event.id} title="Eliminar">

                            <XCircle size={17} />

                          </button>

                        </>

                      ) : null}

                    </div>

                  </td>

                </tr>

              ))}

              {rows.length === 0 ? (

                <tr>

                  <td className="px-3 py-8 text-center text-slate-500" colSpan={9}>

                    No hay eventos para mostrar.

                  </td>

                </tr>

              ) : null}

            </tbody>

          </table>

        </div>

      </section>

    );

  }



  if (activeTab === "premios") {

    return (

      <div className="grid gap-4">

        <form onSubmit={addPrize} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

          <h2 className="mb-4 text-lg font-black text-slate-950">Añadir premios al evento</h2>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">

            <label className="block xl:col-span-2">

              <span className="mb-1 block text-sm font-semibold text-slate-700">Evento</span>

              <select name="eventEditionId" required value={selectedEventId} onChange={(event) => setSelectedEventId(event.currentTarget.value)} className="w-full rounded-md border border-slate-300 px-3 py-2">

                <option value="">Seleccionar evento</option>

                {events.map((event) => (

                  <option key={event.id} value={event.id}>{event.displayName}</option>

                ))}

              </select>

            </label>

            <label className="block">

              <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo de premio</span>

              <select name="type" required className="w-full rounded-md border border-slate-300 px-3 py-2">

                <option value={EventPrizeType.BONUS}>Bono</option>

                <option value={EventPrizeType.ARTICLE}>Articulo</option>

                <option value={EventPrizeType.FINAL}>Premio final</option>

              </select>

            </label>

            <label className="block">

              <span className="mb-1 block text-sm font-semibold text-slate-700">Premio</span>

              <input name="name" required placeholder="Nombre del premio" className="w-full rounded-md border border-slate-300 px-3 py-2" />

            </label>

            <label className="block">

              <span className="mb-1 block text-sm font-semibold text-slate-700">Cantidad disponible</span>

              <input name="availableQuantity" required min="0" type="number" placeholder="Cantidad disponible" className="w-full rounded-md border border-slate-300 px-3 py-2" />

            </label>

            {selectedPrizeEvent?.usesZones ? (

              <label className="block">

                <span className="mb-1 block text-sm font-semibold text-slate-700">Zona</span>

                <select name="zone" required className="w-full rounded-md border border-slate-300 px-3 py-2">

                  <option value="">Seleccione zona</option>

                  {zones.filter((zone) => zone.isActive).map((zone) => (

                    <option key={zone.id} value={zone.name}>{zone.name}</option>

                  ))}

                </select>

              </label>

            ) : null}

          </div>

          <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white">

            <Plus size={17} />

            Agregar premio

          </button>

        </form>

        {selectedPrizeEvent ? (

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-black text-slate-950">Premios relacionados con {selectedPrizeEvent.displayName}</h2>
              <ExportExcelButton
                rows={selectedPrizeEvent.prizes.map((prize) => ({
                  Tipo: prizeTypeLabel(prize.type),
                  Premio: prize.name,
                  Zona: prize.zone || "",
                  Disponible: prize.availableQuantity,
                  Otorgada: prize.awardedQuantity,
                  Estado: prize.isActive ? "Activo" : "Inactivo",
                  Evento: selectedPrizeEvent.displayName
                }))}
                fileName={`premios-${selectedPrizeEvent.displayName}`}
              />
            </div>

            <div className="overflow-x-auto">

              <table className="w-full min-w-[920px] text-left text-sm">

                <thead className="bg-slate-50 text-slate-600">

                  <tr>

                    <th className="px-3 py-2">Tipo</th>

                    <th className="px-3 py-2">Premio</th>

                    <th className="px-3 py-2">Zona</th>

                    <th className="px-3 py-2">Disponible</th>

                    <th className="px-3 py-2">Otorgada</th>

                    <th className="px-3 py-2">Estado</th>

                    <th className="px-3 py-2">Acciones</th>

                  </tr>

                </thead>

                <tbody>

                  {selectedPrizeEvent.prizes.map((prize) => (

                    <tr key={prize.id} className="border-t border-slate-100">

                      <td className="px-3 py-2">{prizeTypeLabel(prize.type)}</td>

                      <td className="px-3 py-2 font-semibold">{prize.name}</td>

                      <td className="px-3 py-2">{prize.zone || "-"}</td>

                      <td className="px-3 py-2">{prize.availableQuantity}</td>

                      <td className="px-3 py-2">{prize.awardedQuantity}</td>

                      <td className="px-3 py-2">{prize.isActive ? "Activo" : "Inactivo"}</td>

                      <td className="px-3 py-2">

                        <div className="flex items-center gap-2">

                          <button className={actionClass("neutral")} onClick={() => setEditingPrize(prize)} disabled={busyId === prize.id} title="Editar">

                            <Pencil size={17} />

                          </button>

                          <button className={actionClass(prize.isActive ? "amber" : "green")} onClick={() => togglePrize(prize)} disabled={busyId === prize.id} title={prize.isActive ? "Inactivar" : "Activar"}>

                            <Power size={17} />

                          </button>

                          <button className={actionClass("red")} onClick={() => deletePrize(prize)} disabled={busyId === prize.id || prize.awardedQuantity > 0} title={prize.awardedQuantity > 0 ? "No se puede eliminar con premios otorgados" : "Eliminar"}>

                            <Trash2 size={17} />

                          </button>

                        </div>

                      </td>

                    </tr>

                  ))}

                  {selectedPrizeEvent.prizes.length === 0 ? (

                    <tr>

                      <td className="px-3 py-8 text-center text-slate-500" colSpan={7}>

                        No hay premios asociados a este evento.

                      </td>

                    </tr>

                  ) : null}

                </tbody>

              </table>

            </div>

          </section>

        ) : (

          <section className="rounded-lg border border-slate-200 bg-white p-4 text-slate-600 shadow-sm">

            Seleccione un evento para ver sus premios relacionados.

          </section>

        )}

        {editingPrize ? (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">

            <form onSubmit={savePrizeEdit} className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">

              <div className="mb-4 flex items-start justify-between gap-3">

                <div>

                  <h3 className="text-xl font-black text-slate-950">Editar premio del evento</h3>

                  <p className="text-sm text-slate-600">La cantidad otorgada se calcula desde el historico y no se puede modificar manualmente.</p>

                </div>

                <button

                  type="button"

                  onClick={() => setEditingPrize(null)}

                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"

                  title="Cerrar"

                >

                  <XCircle size={17} />

                </button>

              </div>

              <div className="grid gap-3 md:grid-cols-2">

                <label className="block">

                  <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo de premio</span>

                  <select name="type" defaultValue={editingPrize.type} className="w-full rounded-md border border-slate-300 px-3 py-2">

                    <option value={EventPrizeType.BONUS}>Bono</option>

                    <option value={EventPrizeType.ARTICLE}>Articulo</option>

                    <option value={EventPrizeType.FINAL}>Premio final</option>

                  </select>

                </label>

                <label className="block">

                  <span className="mb-1 block text-sm font-semibold text-slate-700">Premio</span>

                  <input name="name" required defaultValue={editingPrize.name} className="w-full rounded-md border border-slate-300 px-3 py-2" />

                </label>

                {selectedPrizeEvent?.usesZones ? (

                  <label className="block">

                    <span className="mb-1 block text-sm font-semibold text-slate-700">Zona</span>

                    <select name="zone" required defaultValue={editingPrize.zone || ""} className="w-full rounded-md border border-slate-300 px-3 py-2">

                      <option value="">Seleccione zona</option>

                      {zones.filter((zone) => zone.isActive || zone.name === editingPrize.zone).map((zone) => (

                        <option key={zone.id} value={zone.name}>{zone.name}</option>

                      ))}

                    </select>

                  </label>

                ) : null}

                <label className="block">

                  <span className="mb-1 block text-sm font-semibold text-slate-700">Cantidad disponible</span>

                  <input name="availableQuantity" required min="0" type="number" defaultValue={editingPrize.availableQuantity} className="w-full rounded-md border border-slate-300 px-3 py-2" />

                </label>

                <label className="block">

                  <span className="mb-1 block text-sm font-semibold text-slate-700">Cantidad otorgada</span>

                  <input

                    value={editingPrize.awardedQuantity}

                    readOnly

                    className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600"

                  />

                </label>

              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

                <button type="button" onClick={() => setEditingPrize(null)} className="rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100">

                  Cancelar

                </button>

                <button disabled={busyId === editingPrize.id} className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">

                  <Save size={17} />

                  {busyId === editingPrize.id ? "Guardando..." : "Guardar cambios"}

                </button>

              </div>

            </form>

          </div>

        ) : null}

      </div>

    );

  }



  if (activeTab === "participantes") {

    const selectedRows = selectedParticipantsEvent ? eventParticipantRows[selectedParticipantsEvent.id] || [] : [];

    const isAffiliation =

      selectedParticipantsEvent?.eventType.code === "AFFILIATION_INSTANT" || selectedParticipantsEvent?.eventType.code === "AFFILIATION_FINAL";

    return (

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h2 className="text-lg font-black text-slate-950">Participantes por evento</h2>

            <p className="text-sm text-slate-600">Seleccione un evento activo o inactivo para ver la participacion y su estado.</p>

          </div>

        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">

          <label className="block">

            <span className="mb-1 block text-sm font-semibold text-slate-700">Evento</span>

            <select

              value={selectedParticipantsEventId}

              onChange={(event) => setSelectedParticipantsEventId(event.currentTarget.value)}

              className="w-full rounded-md border border-slate-300 px-3 py-2"

            >

              <option value="">Seleccione un evento</option>

              {events.map((event) => (

                <option key={event.id} value={event.id}>

                  {event.displayName} - {eventStatusLabel(event.status)}

                </option>

              ))}

            </select>

          </label>

          <div className="flex flex-wrap gap-2">

            <a href="/api/eventos/participantes/plantilla" className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 font-bold text-slate-700 hover:bg-slate-100">

              <FileDown size={16} />

              Plantilla

            </a>

            <button

              type="button"

              disabled={!selectedParticipantsEvent}

              onClick={() => selectedParticipantsEvent && downloadEventParticipants(selectedParticipantsEvent)}

              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"

            >

              <FileDown size={16} />

              Descargar

            </button>

            {selectedParticipantsEvent && !isAffiliation ? (

              <button

                type="button"

                className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 font-bold text-white hover:bg-emerald-800"

                onClick={() => {

                  setUploadEventId(selectedParticipantsEvent.id);

                  uploadInputRef.current?.click();

                }}

              >

                <Upload size={16} />

                Cargar

              </button>

            ) : null}

          </div>

        </div>

        {selectedParticipantsEvent ? (

          <div className="mt-4 rounded-lg border border-slate-200">

            <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <h3 className="font-black text-slate-950">{selectedParticipantsEvent.displayName}</h3>

                <p className="text-sm text-slate-600">

                  {selectedParticipantsEvent.eventType.name} - {eventStatusLabel(selectedParticipantsEvent.status)} - {selectedRows.length} participantes

                </p>

              </div>

              <p className="text-sm font-semibold text-slate-600">

                {isAffiliation ? "Origen: solicitudes recibidas" : "Origen: carga masiva del evento"}

              </p>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full min-w-[1380px] text-left text-sm">

                <thead className="bg-white text-slate-600">

                  <tr>

                    <th className="px-3 py-2">Nombre</th>

                    <th className="px-3 py-2">Cédula</th>

                    <th className="px-3 py-2">Teléfono</th>

                    <th className="px-3 py-2">Correo</th>

                    <th className="px-3 py-2">Zona</th>

                    <th className="px-3 py-2">Origen</th>

                    <th className="px-3 py-2">Canal</th>

                    <th className="px-3 py-2">Estado</th>

                    <th className="px-3 py-2">Código premio</th>

                    <th className="px-3 py-2">Premio</th>

                    <th className="px-3 py-2">Estado premio</th>

                    <th className="px-3 py-2">Fecha premio</th>

                    <th className="px-3 py-2">Fecha</th>

                  </tr>

                </thead>

                <tbody>

                  {selectedRows.map((row) => (

                    <tr key={row.id} className="border-t border-slate-100">

                      <td className="px-3 py-2 font-semibold text-slate-900">{row.name}</td>

                      <td className="px-3 py-2">{row.documentId || "-"}</td>

                      <td className="px-3 py-2">{row.phone || "-"}</td>

                      <td className="px-3 py-2">{row.email || "-"}</td>

                      <td className="px-3 py-2">{row.zone || "-"}</td>

                      <td className="px-3 py-2">{participantSourceLabel(row.source)}</td>

                      <td className="px-3 py-2">{participantChannelLabel(row.channel)}</td>

                      <td className="px-3 py-2">

                        <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-800">{participantStatusLabel(row.status)}</span>

                      </td>

                      <td className="px-3 py-2 font-bold">{row.prizeCode || "-"}</td>

                      <td className="px-3 py-2">{row.prizeName || "-"}</td>

                      <td className="px-3 py-2">{prizeResultStatusLabel(row.prizeStatus)}</td>

                      <td className="px-3 py-2">{row.prizeDate ? new Date(row.prizeDate).toLocaleString("es-DO") : "-"}</td>

                      <td className="px-3 py-2">{row.loadedAt ? new Date(row.loadedAt).toLocaleString("es-DO") : "-"}</td>

                    </tr>

                  ))}

                  {selectedRows.length === 0 ? (

                    <tr>

                      <td className="px-3 py-8 text-center text-slate-500" colSpan={13}>

                        No hay participantes vinculados a este evento.

                      </td>

                    </tr>

                  ) : null}

                </tbody>

              </table>

            </div>

          </div>

        ) : (

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">

            Seleccione un evento para consultar sus participantes.

          </div>

        )}

        <input ref={uploadInputRef} type="file" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => {

          const file = event.currentTarget.files?.[0];

          event.currentTarget.value = "";

          if (!file) return;

          uploadParticipants(file);

        }} />

      </section>

    );

  }



  if (activeTab === "reset") {

    return (

      <section className="rounded-lg border border-red-200 bg-white p-4 shadow-sm">

        <div className="mb-4">

          <h2 className="text-lg font-black text-red-900">Reset de eventos</h2>

          <p className="text-sm text-slate-600">

            Esta opción borra pruebas del evento seleccionado y repone inventario. No elimina el evento ni sus premios configurados.

          </p>

        </div>

        <label className="block">

          <span className="mb-1 block text-sm font-semibold text-slate-700">Evento</span>

          <select

            value={selectedResetEventId}

            onChange={(event) => loadResetPreview(event.currentTarget.value)}

            className="w-full rounded-md border border-slate-300 px-3 py-2"

          >

            <option value="">Seleccione evento</option>

            {events.map((event) => (

              <option key={event.id} value={event.id}>

                {event.displayName} - {eventStatusLabel(event.status)}

              </option>

            ))}

          </select>

        </label>

        {selectedResetEvent?.status === "CLOSED" ? (

          <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">No se puede resetear un evento cerrado.</p>

        ) : null}

        {resetPreview ? (

          <form onSubmit={resetEvent} className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4">

            <h3 className="font-black text-red-950">{resetPreview.event.name}</h3>

            <p className="text-sm text-red-900">{resetPreview.event.typeName}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">

              <div className="rounded-md bg-white p-3">

                <p className="text-xs font-bold text-slate-500">Premios otorgados</p>

                <p className="text-2xl font-black text-slate-950">{resetPreview.results}</p>

              </div>

              <div className="rounded-md bg-white p-3">

                <p className="text-xs font-bold text-slate-500">Solicitudes</p>

                <p className="text-2xl font-black text-slate-950">{resetPreview.submissions}</p>

              </div>

              <div className="rounded-md bg-white p-3">

                <p className="text-xs font-bold text-slate-500">Participantes cargados</p>

                <p className="text-2xl font-black text-slate-950">{resetPreview.participants}</p>

              </div>

              <div className="rounded-md bg-white p-3">

                <p className="text-xs font-bold text-slate-500">Links digitales</p>

                <p className="text-2xl font-black text-slate-950">{resetPreview.digitalLinks}</p>

              </div>

              <div className="rounded-md bg-white p-3">

                <p className="text-xs font-bold text-slate-500">Participantes digitales</p>

                <p className="text-2xl font-black text-slate-950">{resetPreview.digitalParticipants}</p>

              </div>

            </div>

            <div className="mt-4 overflow-x-auto">

              <table className="w-full min-w-[520px] text-left text-sm">

                <thead className="bg-white text-slate-600">

                  <tr>

                    <th className="px-3 py-2">Premio</th>

                    <th className="px-3 py-2">Inventario a reponer</th>

                  </tr>

                </thead>

                <tbody>

                  {resetPreview.prizes.map((prize) => (

                    <tr key={prize.id} className="border-t border-red-100">

                      <td className="px-3 py-2 font-semibold">{prize.name}</td>

                      <td className="px-3 py-2">{prize.restoreQuantity}</td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">

              <label className="block">

                <span className="mb-1 block text-sm font-semibold text-red-900">Confirmacion</span>

                <input

                  name="confirmation"

                  required

                  placeholder={`RESET ${resetPreview.event.name}`}

                  className="w-full rounded-md border border-red-200 px-3 py-2"

                />

              </label>

              <label className="block">

                <span className="mb-1 block text-sm font-semibold text-red-900">Motivo</span>

                <input name="reason" required minLength={5} placeholder="Ej. Pruebas internas" className="w-full rounded-md border border-red-200 px-3 py-2" />

              </label>

            </div>

            <button

              disabled={busyId === "reset-event" || resetPreview.event.status === "CLOSED"}

              className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800 disabled:opacity-60"

            >

              <Trash2 size={17} />

              {busyId === "reset-event" ? "Reseteando..." : "Resetear evento"}

            </button>

          </form>

        ) : null}

      </section>

    );

  }



  if (activeTab === "configuracion") {

    return (

      <div className="grid gap-4 lg:grid-cols-2">

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

          <div className="mb-4 flex items-center gap-2">

            <FolderPlus className="text-emerald-800" size={22} />

            <h2 className="text-lg font-black text-slate-950">Tipos de evento</h2>

          </div>

          <form onSubmit={createEventType} className="grid gap-3 sm:grid-cols-[1fr_auto]">

            <label className="block">

              <span className="mb-1 block text-sm font-semibold text-slate-700">Nombre</span>

              <input name="name" required minLength={3} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Ej. Madres" />

            </label>

            <button disabled={busyId === "event-type"} className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">

              <Plus size={17} />

              Crear

            </button>

          </form>

          <div className="mt-4 overflow-x-auto">

            <table className="w-full min-w-[460px] text-left text-sm">

              <thead className="bg-slate-50 text-slate-600">

                <tr>

                  <th className="px-3 py-2">Tipo de evento</th>

                  <th className="px-3 py-2">Estado</th>

                  <th className="px-3 py-2">Acciones</th>

                </tr>

              </thead>

              <tbody>

                {eventTypes.map((type) => (

                  <tr key={type.id} className="border-t border-slate-100">

                    <td className="px-3 py-2 font-semibold">{type.name}</td>

                    <td className="px-3 py-2">{type.isActive ? "Activo" : "Inactivo"}</td>

                    <td className="px-3 py-2">

                      <div className="flex items-center gap-2">

                        <button className={actionClass(type.isActive ? "amber" : "green")} onClick={() => toggleEventType(type)} disabled={busyId === type.id} title={type.isActive ? "Inactivar" : "Activar"}>

                          <Power size={17} />

                        </button>

                        <button className={actionClass("red")} onClick={() => deleteEventType(type)} disabled={busyId === type.id} title="Eliminar">

                          <Trash2 size={17} />

                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </section>



        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

          <div className="mb-4 flex items-center gap-2">

            <MapPin className="text-emerald-800" size={22} />

            <h2 className="text-lg font-black text-slate-950">Zonas</h2>

          </div>

          <form onSubmit={createZone} className="grid gap-3 sm:grid-cols-[1fr_auto]">

            <label className="block">

              <span className="mb-1 block text-sm font-semibold text-slate-700">Nombre de la zona</span>

              <input name="name" required minLength={2} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Ej. ZONA NORTE" />

            </label>

            <button disabled={busyId === "zone"} className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">

              <Plus size={17} />

              Agregar

            </button>

          </form>

          <div className="mt-4 overflow-x-auto">

            <table className="w-full min-w-[520px] text-left text-sm">

              <thead className="bg-slate-50 text-slate-600">

                <tr>

                  <th className="px-3 py-2">Zona</th>

                  <th className="px-3 py-2">Estado</th>

                  <th className="px-3 py-2">Acciones</th>

                </tr>

              </thead>

              <tbody>

                {zones.map((zone) => (

                  <tr key={zone.id} className="border-t border-slate-100">

                    <td className="px-3 py-2 font-semibold">{zone.name}</td>

                    <td className="px-3 py-2">{zone.isActive ? "Activa" : "Inactiva"}</td>

                    <td className="px-3 py-2">

                      <div className="flex items-center gap-2">

                        <button className={actionClass(zone.isActive ? "amber" : "green")} onClick={() => toggleZone(zone)} disabled={busyId === zone.id} title={zone.isActive ? "Inactivar" : "Activar"}>

                          <Power size={17} />

                        </button>

                        <button className={actionClass("red")} onClick={() => deleteZone(zone)} disabled={busyId === zone.id} title="Eliminar">

                          <Trash2 size={17} />

                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

                {zones.length === 0 ? (

                  <tr>

                    <td className="px-3 py-8 text-center text-slate-500" colSpan={3}>

                      No hay zonas registradas.

                    </td>

                  </tr>

                ) : null}

              </tbody>

            </table>

          </div>

        </section>

      </div>

    );

  }



  if (activeTab === "historicos") {

    return renderEventTable(historicalEvents, true);

  }



  return (

    <div className="grid gap-4">

      <form onSubmit={createEvent} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

        <h2 className="mb-4 text-lg font-black text-slate-950">Crear eventos</h2>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">

          <label className="block xl:col-span-2">

            <span className="mb-1 block text-sm font-semibold text-slate-700">Nombre / tipo de evento</span>

            <select name="eventTypeId" required className="w-full rounded-md border border-slate-300 px-3 py-2">

                {eventTypes.filter((type) => type.isActive).map((type) => (

                  <option key={type.id} value={type.id}>{type.name}</option>

                ))}

            </select>

          </label>

          <label className="block">

            <span className="mb-1 block text-sm font-semibold text-slate-700">Mes</span>

            <select name="month" required className="w-full rounded-md border border-slate-300 px-3 py-2">

              {MONTHS.map((month) => (

                <option key={month.value} value={month.value}>{month.label}</option>

              ))}

            </select>

          </label>

          <label className="block">

            <span className="mb-1 block text-sm font-semibold text-slate-700">Año</span>

            <select name="year" required className="w-full rounded-md border border-slate-300 px-3 py-2">

              {years.map((year) => (

                <option key={year} value={year}>{year}</option>

              ))}

            </select>

          </label>

          <label className="block">

            <span className="mb-1 block text-sm font-semibold text-slate-700">Premios por zona</span>

            <select name="usesZones" className="w-full rounded-md border border-slate-300 px-3 py-2">

              <option value="NO">Deshabilitado</option>

              <option value="YES">Habilitado</option>

            </select>

          </label>

        </div>

        <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white">

          <Plus size={17} />

          Crear evento

        </button>

      </form>

      {renderEventTable(events)}

      {editing ? (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">

          <form onSubmit={saveEventEdit} className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">

            <h3 className="text-xl font-black text-slate-950">Editar evento</h3>

            <p className="mt-1 text-sm text-slate-600">{editing.displayName}</p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">

              <select name="month" defaultValue={editing.month} className="rounded-md border border-slate-300 px-3 py-2">

                {MONTHS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}

              </select>

              <select name="year" defaultValue={editing.year} className="rounded-md border border-slate-300 px-3 py-2">

                {years.map((year) => <option key={year} value={year}>{year}</option>)}

              </select>

              <select name="usesZones" defaultValue={editing.usesZones ? "YES" : "NO"} className="rounded-md border border-slate-300 px-3 py-2">

                <option value="NO">Sin zonas</option>

                <option value="YES">Con zonas</option>

              </select>

            </div>

            <div className="mt-5 flex justify-end gap-2">

              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100">Cancelar</button>

              <button className="rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800">Guardar</button>

            </div>

          </form>

        </div>

      ) : null}

      {viewEvent ? (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">

          <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">

            <div className="flex items-start justify-between gap-3">

              <div>

                <h3 className="text-xl font-black text-slate-950">{viewEvent.displayName}</h3>

                <p className="text-sm text-slate-600">{viewEvent.eventType.name} · {eventStatusLabel(viewEvent.status)}</p>

              </div>

              <button className={actionClass("neutral")} onClick={() => setViewEvent(null)} title="Cerrar">

                <XCircle size={17} />

              </button>

            </div>

            <h4 className="mt-5 font-black text-slate-950">Premios del evento</h4>

            <div className="mt-2 overflow-x-auto">

              <table className="w-full min-w-[620px] text-left text-sm">

                <thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Premio</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Zona</th><th className="px-3 py-2">Disponible</th><th className="px-3 py-2">Otorgado</th></tr></thead>

                <tbody>{viewEvent.prizes.map((prize) => <tr key={prize.id} className="border-t"><td className="px-3 py-2">{prize.name}</td><td className="px-3 py-2">{prizeTypeLabel(prize.type)}</td><td className="px-3 py-2">{prize.zone || "-"}</td><td className="px-3 py-2">{prize.availableQuantity}</td><td className="px-3 py-2">{prize.awardedQuantity}</td></tr>)}</tbody>

              </table>

            </div>

            <h4 className="mt-5 font-black text-slate-950">Participantes</h4>

            <div className="mt-2 overflow-x-auto">

              <table className="w-full min-w-[720px] text-left text-sm">

                <thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Cédula</th><th className="px-3 py-2">Teléfono</th><th className="px-3 py-2">Correo</th><th className="px-3 py-2">Zona</th></tr></thead>

                <tbody>{(eventParticipantRows[viewEvent.id] || []).map((row) => <tr key={row.id} className="border-t"><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.documentId}</td><td className="px-3 py-2">{row.phone}</td><td className="px-3 py-2">{row.email}</td><td className="px-3 py-2">{row.zone || "-"}</td></tr>)}</tbody>

              </table>

            </div>

          </section>

        </div>

      ) : null}

    </div>

  );

}
