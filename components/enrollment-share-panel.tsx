"use client";



import { Copy, Download, MessageCircle } from "lucide-react";

import { notify } from "@/lib/toast";



export function EnrollmentSharePanel({ url, qrUrl, isActive }: { url: string; qrUrl: string; isActive: boolean }) {

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Hola, EDECOOP te invita a completar tu solicitud de admisión: ${url}`)}`;



  async function copy() {

    await navigator.clipboard.writeText(url);

    notify("Link copiado.", "success");

  }



  return (

    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">

          <img src={qrUrl} alt="Código QR del formulario de inscripción" className="mx-auto h-auto w-full max-w-[320px]" />

        </div>

        <div>

          <p className={`mb-3 inline-flex rounded-md px-3 py-1 text-sm font-bold ${isActive ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"}`}>

            {isActive ? "Formulario activo" : "Formulario inactivo"}

          </p>

          <label className="block">

            <span className="mb-1 block text-sm font-semibold text-slate-700">Link publico</span>

            <input value={url} readOnly className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2" />

          </label>

          <div className="mt-4 flex flex-wrap gap-2">

            <button onClick={copy} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100">

              <Copy size={17} />

              Copiar link

            </button>

            <a href={whatsappUrl} target="_blank" className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800">

              <MessageCircle size={17} />

              Enviar por WhatsApp

            </a>

            <a href={qrUrl} download="qr-inscripcion-edecoop.png" className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100">

              <Download size={17} />

              Descargar QR

            </a>

          </div>

        </div>

      </div>

    </section>

  );

}

