"use client";



import { FormEvent, useState } from "react";

import { useRouter } from "next/navigation";

import { KeyRound, Pencil, Power, Save, X } from "lucide-react";

import { notify } from "@/lib/toast";



type UserRow = {

  id: string;

  name: string;

  email: string;

  role: "ADMIN" | "PROMOTER";

  isActive: boolean;

  mustChangePassword: boolean;

  createdAt: string;

};



function actionButtonClass(tone: "neutral" | "green" | "amber") {

  const colors = {

    neutral: "border-slate-300 text-slate-700 hover:bg-slate-100",

    green: "border-emerald-200 text-emerald-800 hover:bg-emerald-50",

    amber: "border-amber-200 text-amber-800 hover:bg-amber-50"

  };

  return `inline-flex h-9 w-9 items-center justify-center rounded-md border ${colors[tone]}`;

}



export function UsersTable({ users }: { users: UserRow[] }) {

  const router = useRouter();

  const [editing, setEditing] = useState<UserRow | null>(null);

  const [busyId, setBusyId] = useState("");

  const [message, setMessage] = useState("");



  async function saveEdit(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (!editing) return;

    const form = new FormData(event.currentTarget);

    setBusyId(editing.id);

    setMessage("");



    const response = await fetch(`/api/usuarios/${editing.id}`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        name: form.get("name"),

        email: form.get("email"),

        role: form.get("role")

      })

    });

    const data = await response.json();

    setBusyId("");



    if (!response.ok) {

      setMessage(data.error || "No se pudo editar el usuario.");

      notify(data.error || "No se pudo editar el usuario.", "error");

      return;

    }



    setEditing(null);

    notify("Usuario actualizado correctamente.", "success");

    router.refresh();

  }



  async function toggleActive(user: UserRow) {

    setBusyId(user.id);

    setMessage("");

    const response = await fetch(`/api/usuarios/${user.id}`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ isActive: !user.isActive })

    });

    const data = await response.json();

    setBusyId("");



    if (!response.ok) {

      setMessage(data.error || "No se pudo cambiar el estado.");

      notify(data.error || "No se pudo cambiar el estado.", "error");

      return;

    }



    notify(user.isActive ? "Usuario inactivado." : "Usuario activado.", "success");

    router.refresh();

  }



  async function resetPassword(user: UserRow) {

    setBusyId(user.id);

    setMessage("");

    const response = await fetch(`/api/usuarios/${user.id}/reset-password`, {

      method: "POST"

    });

    const data = await response.json();

    setBusyId("");



    if (!response.ok) {

      setMessage(data.error || "No se pudo resetear la clave.");

      notify(data.error || "No se pudo resetear la clave.", "error");

      return;

    }



    setMessage(`Clave temporal restablecida para ${user.name}: ${data.temporaryPassword}`);

    notify(`Clave temporal restablecida: ${data.temporaryPassword}`, "success");

    router.refresh();

  }



  return (

    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

        <h2 className="text-lg font-black text-slate-950">Usuarios registrados</h2>

        {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">{message}</p> : null}

      </div>

      <div className="overflow-x-auto">

        <table className="w-full min-w-[900px] text-left text-sm">

          <thead className="bg-slate-50 text-slate-600">

            <tr>

              <th className="px-3 py-2">Nombre</th>

              <th className="px-3 py-2">Correo</th>

              <th className="px-3 py-2">Rol</th>

              <th className="px-3 py-2">Estado</th>

              <th className="px-3 py-2">Clave</th>

              <th className="px-3 py-2">Creado</th>

              <th className="px-3 py-2">Acciones</th>

            </tr>

          </thead>

          <tbody>

            {users.map((user) => (

              <tr key={user.id} className="border-t border-slate-100">

                <td className="px-3 py-2 font-semibold">{user.name}</td>

                <td className="px-3 py-2">{user.email}</td>

                <td className="px-3 py-2">{user.role === "ADMIN" ? "Administrador" : "Promotora"}</td>

                <td className="px-3 py-2">{user.isActive ? "Activo" : "Inactivo"}</td>

                <td className="px-3 py-2">{user.mustChangePassword ? "Debe cambiarla" : "Configurada"}</td>

                <td className="px-3 py-2">{new Date(user.createdAt).toLocaleDateString("es-DO")}</td>

                <td className="px-3 py-2">

                  <div className="flex items-center gap-2">

                    <button className={actionButtonClass("neutral")} onClick={() => setEditing(user)} disabled={busyId === user.id} title="Editar">

                      <Pencil size={17} />

                    </button>

                    <button

                      className={actionButtonClass(user.isActive ? "amber" : "green")}

                      onClick={() => toggleActive(user)}

                      disabled={busyId === user.id}

                      title={user.isActive ? "Inactivar" : "Activar"}

                    >

                      <Power size={17} />

                    </button>

                    <button

                      className={actionButtonClass("amber")}

                      onClick={() => resetPassword(user)}

                      disabled={busyId === user.id}

                      title="Resetear clave"

                    >

                      <KeyRound size={17} />

                    </button>

                  </div>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {editing ? (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">

          <form onSubmit={saveEdit} className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">

            <div className="mb-4 flex items-start justify-between gap-3">

              <div>

                <h3 className="text-xl font-black text-slate-950">Editar usuario</h3>

                <p className="text-sm text-slate-600">Actualiza datos basícos y rol.</p>

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

                <input name="name" required defaultValue={editing.name} className="w-full rounded-md border border-slate-300 px-3 py-2" />

              </label>

              <label className="block">

                <span className="mb-1 block text-sm font-semibold text-slate-700">Correo</span>

                <input name="email" required type="email" defaultValue={editing.email} className="w-full rounded-md border border-slate-300 px-3 py-2" />

              </label>

              <label className="block md:col-span-2">

                <span className="mb-1 block text-sm font-semibold text-slate-700">Rol</span>

                <select name="role" defaultValue={editing.role} className="w-full rounded-md border border-slate-300 px-3 py-2">

                  <option value="PROMOTER">Promotora</option>

                  <option value="ADMIN">Administrador</option>

                </select>

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

    </section>

  );

}

