"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Power, Save, Trash2 } from "lucide-react";
import { notify } from "@/lib/toast";
import { ExportExcelButton } from "@/components/export-excel-button";

type CooperativeSettings = {
  whatsapp: string;
  phone: string;
  email: string;
  website: string;
  facebook: string;
  instagram: string;
  x: string;
  youtube: string;
};

type ZoneRow = {
  id: string;
  name: string;
  isActive: boolean;
};

type EventTypeRow = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

const inputClass = "h-11 w-full rounded-md border border-slate-300 px-3 py-2";

function actionClass(tone: "neutral" | "amber" | "green" | "red") {
  const colors = {
    neutral: "border-slate-300 text-slate-700 hover:bg-slate-100",
    amber: "border-amber-200 text-amber-700 hover:bg-amber-50",
    green: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    red: "border-red-200 text-red-700 hover:bg-red-50"
  };
  return `inline-flex h-9 w-9 items-center justify-center rounded-md border ${colors[tone]} disabled:opacity-60`;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

export function SettingsManager({
  settings,
  zones,
  eventTypes,
  mode = "general"
}: {
  settings: CooperativeSettings;
  zones: ZoneRow[];
  eventTypes?: EventTypeRow[];
  mode?: "general" | "zones" | "event-types";
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const zoneExportRows = zones.map((zone) => ({
    Zona: zone.name,
    Estado: zone.isActive ? "Activa" : "Inactiva"
  }));
  const eventTypeRows = (eventTypes || []).map((type) => ({
    "Tipo de evento": type.name,
    Codigo: type.code,
    Estado: type.isActive ? "Activo" : "Inactivo"
  }));

  async function saveCooperativeSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyId("cooperative");
    const response = await fetch("/api/configuracion/cooperativa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    const data = await readJson(response);
    setBusyId("");

    if (!response.ok) {
      notify(data.error || "No se pudo guardar la configuracion.", "error");
      return;
    }

    notify("Configuracion guardada.", "success");
    router.refresh();
  }

  async function createZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusyId("zone");
    const response = await fetch("/api/eventos/zonas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name") })
    });
    const data = await readJson(response);
    setBusyId("");
    if (!response.ok) {
      notify(data.error || "No se pudo crear la zona.", "error");
      return;
    }
    formElement.reset();
    notify("Zona creada.", "success");
    router.refresh();
  }

  async function toggleZone(zone: ZoneRow) {
    setBusyId(zone.id);
    const response = await fetch(`/api/eventos/zonas/${zone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !zone.isActive })
    });
    const data = await readJson(response);
    setBusyId("");
    if (!response.ok) {
      notify(data.error || "No se pudo actualizar la zona.", "error");
      return;
    }
    notify(zone.isActive ? "Zona inactivada." : "Zona activada.", "success");
    router.refresh();
  }

  async function deleteZone(zone: ZoneRow) {
    setBusyId(zone.id);
    const response = await fetch(`/api/eventos/zonas/${zone.id}`, { method: "DELETE" });
    const data = await readJson(response);
    setBusyId("");
    if (!response.ok) {
      notify(data.error || "No se pudo eliminar la zona.", "error");
      return;
    }
    notify("Zona eliminada.", "success");
    router.refresh();
  }

  async function createEventType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusyId("event-type");
    const response = await fetch("/api/eventos/tipos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name") })
    });
    const data = await readJson(response);
    setBusyId("");
    if (!response.ok) {
      notify(data.error || "No se pudo crear el tipo de evento.", "error");
      return;
    }
    formElement.reset();
    notify("Tipo de evento creado.", "success");
    router.refresh();
  }

  async function toggleEventType(type: EventTypeRow) {
    setBusyId(type.id);
    const response = await fetch(`/api/eventos/tipos/${type.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !type.isActive })
    });
    const data = await readJson(response);
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
    const data = await readJson(response);
    setBusyId("");
    if (!response.ok) {
      notify(data.error || "No se pudo eliminar el tipo de evento.", "error");
      return;
    }
    notify("Tipo de evento eliminado.", "success");
    router.refresh();
  }

  if (mode === "event-types") {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Tipos de evento</h2>
            <p className="text-sm text-slate-600">Lista base usada al crear eventos en el proyecto Sorteos.</p>
          </div>
          <ExportExcelButton rows={eventTypeRows} fileName="tipos-evento" />
        </div>
        <form onSubmit={createEventType} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input name="name" required minLength={3} placeholder="Nombre del tipo de evento" className={inputClass} />
          <button disabled={busyId === "event-type"} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
            <Plus size={18} />
            Crear
          </button>
        </form>
        <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Tipo de evento</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {(eventTypes || []).map((type) => (
                <tr key={type.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{type.name}</td>
                  <td className="px-3 py-2">{type.isActive ? "Activo" : "Inactivo"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button type="button" className={actionClass(type.isActive ? "amber" : "green")} onClick={() => toggleEventType(type)} disabled={busyId === type.id} title={type.isActive ? "Inactivar" : "Activar"}>
                        <Power size={17} />
                      </button>
                      <button type="button" className={actionClass("red")} onClick={() => deleteEventType(type)} disabled={busyId === type.id} title="Eliminar">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!eventTypes?.length ? (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan={3}>
                    No hay tipos de evento registrados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (mode === "zones") {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Zonas</h2>
            <p className="text-sm text-slate-600">Lista base para eventos que trabajan premios por zona.</p>
          </div>
          <ExportExcelButton rows={zoneExportRows} fileName="zonas" />
        </div>
        <form onSubmit={createZone} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input name="name" required placeholder="Nombre de zona" className={inputClass} />
          <button disabled={busyId === "zone"} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
            <Plus size={18} />
            Agregar
          </button>
        </form>
        <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[440px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Zona</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{zone.name}</td>
                  <td className="px-3 py-2">{zone.isActive ? "Activa" : "Inactiva"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button type="button" className={actionClass(zone.isActive ? "amber" : "green")} onClick={() => toggleZone(zone)} disabled={busyId === zone.id} title={zone.isActive ? "Inactivar" : "Activar"}>
                        <Power size={17} />
                      </button>
                      <button type="button" className={actionClass("red")} onClick={() => deleteZone(zone)} disabled={busyId === zone.id} title="Eliminar">
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
    );
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Datos de la cooperativa</h2>
        <form onSubmit={saveCooperativeSettings} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input name="whatsapp" defaultValue={settings.whatsapp} placeholder="WhatsApp EDECOOP" className={inputClass} />
          <input name="phone" defaultValue={settings.phone} placeholder="Telefono EDECOOP" className={inputClass} />
          <input name="email" defaultValue={settings.email} type="email" placeholder="Correo EDECOOP" className={inputClass} />
          <input name="website" defaultValue={settings.website} placeholder="Pagina web" className={inputClass} />
          <input name="facebook" defaultValue={settings.facebook} placeholder="Facebook URL" className={inputClass} />
          <input name="instagram" defaultValue={settings.instagram} placeholder="Instagram URL" className={inputClass} />
          <input name="x" defaultValue={settings.x} placeholder="X URL" className={inputClass} />
          <input name="youtube" defaultValue={settings.youtube} placeholder="YouTube URL" className={inputClass} />
          <button disabled={busyId === "cooperative"} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-800 disabled:opacity-60 md:col-span-2 xl:col-span-4">
            <Save size={18} />
            Guardar datos de EDECOOP
          </button>
        </form>
      </section>

    </div>
  );
}
