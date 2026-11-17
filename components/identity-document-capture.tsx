"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, X } from "lucide-react";

type OcrLine = { text: string; score: number };
type OcrEngine = { predict: (input: Blob, params?: Record<string, unknown>) => Promise<Array<{ items: OcrLine[] }>> };

let ocrEnginePromise: Promise<OcrEngine> | null = null;

function getOcrEngine() {
  if (!ocrEnginePromise) {
    ocrEnginePromise = import("@paddleocr/paddleocr-js")
      .then(({ PaddleOCR }) => PaddleOCR.create({
        lang: "en",
        ocrVersion: "PP-OCRv6",
        worker: true,
        ortOptions: { backend: "auto", numThreads: 2, simd: true }
      }) as Promise<OcrEngine>)
      .catch(error => {
        ocrEnginePromise = null;
        throw error;
      });
  }
  return ocrEnginePromise;
}

function stopStream(video: HTMLVideoElement | null) {
  const stream = video?.srcObject as MediaStream | null;
  stream?.getTracks().forEach(track => track.stop());
  if (video) video.srcObject = null;
}

async function cameraFrame(video: HTMLVideoElement, frame: HTMLDivElement, portrait: boolean) {
  const targetRatio = portrait ? 0.63 : 1.586;
  const videoRect = video.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  const scale = Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
  const renderedWidth = video.videoWidth * scale;
  const renderedHeight = video.videoHeight * scale;
  const offsetX = (videoRect.width - renderedWidth) / 2;
  const offsetY = (videoRect.height - renderedHeight) / 2;
  const sx = Math.max(0, (frameRect.left - videoRect.left - offsetX) / scale);
  const sy = Math.max(0, (frameRect.top - videoRect.top - offsetY) / scale);
  const sw = Math.min(video.videoWidth - sx, frameRect.width / scale);
  const sh = Math.min(video.videoHeight - sy, frameRect.height / scale);
  const canvas = document.createElement("canvas");
  canvas.width = portrait ? 900 : 1400;
  canvas.height = Math.round(canvas.width / targetRatio);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("No se pudo preparar la fotografía.");
  context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se pudo capturar la fotografía.")), "image/jpeg", 0.9));
}

export function IdentityDocumentCapture({
  kind,
  verificationToken,
  verified,
  onVerified
}: {
  kind: "EMPLOYEE_CARD" | "DOCUMENT_ID";
  verificationToken: string;
  verified: boolean;
  onVerified: (token: string) => void;
}) {
  const portrait = kind === "EMPLOYEE_CARD";
  const documentLabel = portrait ? "carnet de empleado" : "cédula";
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [status, setStatus] = useState<"IDLE" | "LOADING" | "READING" | "VERIFIED">("IDLE");
  const [message, setMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    stopStream(videoRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;
    setCameraError("");
    navigator.mediaDevices?.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    }).then(stream => {
      if (cancelled) return stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        return videoRef.current.play();
      }
    }).catch(() => setCameraError("No fue posible abrir la cámara. Revisa el permiso del navegador o continúa desde un teléfono con cámara."));
    return () => {
      cancelled = true;
      stopStream(videoRef.current);
    };
  }, [cameraOpen]);

  function setSelectedPhoto(blob: Blob) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhoto(blob);
    setPreviewUrl(URL.createObjectURL(blob));
    setMessage("");
    setStatus("IDLE");
  }

  async function takePhoto() {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video?.videoWidth || !frame) return setCameraError("Espera un momento mientras inicia la cámara.");
    try {
      setSelectedPhoto(await cameraFrame(video, frame, portrait));
      setCameraOpen(false);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "No se pudo capturar la fotografía.");
    }
  }

  async function analyze() {
    if (!photo || status === "LOADING" || status === "READING") return;
    setMessage("");
    try {
      setStatus("LOADING");
      const engine = await getOcrEngine();
      setStatus("READING");
      const [result] = await engine.predict(photo, {
        textDetLimitSideLen: 1280,
        textDetLimitType: "max",
        textRecScoreThresh: 0.3
      });
      const lines = (result?.items || [])
        .filter(item => item.text?.trim() && Number.isFinite(item.score))
        .slice(0, 40)
        .map(item => ({ text: item.text.trim().slice(0, 160), score: item.score }));
      if (!lines.length) throw new Error("No pudimos leer el documento. Toma otra foto con mejor iluminación y sin reflejos.");
      const response = await fetch("/api/actualizacion-datos/validar-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationToken, lines, kind })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "El documento no coincide con los datos consultados.");
      setStatus("VERIFIED");
      setMessage(data.message || "Documento validado correctamente.");
      onVerified(data.verificationToken);
      setPhoto(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    } catch (error) {
      setStatus("IDLE");
      setMessage(error instanceof Error ? error.message : "No se pudo validar el documento.");
    }
  }

  function resetPhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhoto(null);
    setPreviewUrl("");
    setMessage("");
    setStatus("IDLE");
  }

  if (verified || status === "VERIFIED") return (
    <div data-current-field tabIndex={-1} className="border-l-4 border-emerald-600 bg-emerald-50 p-5">
      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={24} /><div><p className="font-black text-emerald-950">Documento validado</p><p className="mt-1 text-sm text-emerald-900">{message || "Confirmamos que el documento coincide con tus datos."}</p><p className="mt-2 text-xs text-emerald-800">La fotografía fue eliminada después de la lectura.</p></div></div>
    </div>
  );

  return <div data-current-field tabIndex={-1}>
    <div className="mb-5 flex items-start gap-3 bg-slate-50 p-4 text-sm text-slate-700"><ShieldCheck size={22} className="mt-0.5 shrink-0 text-emerald-700" /><p>La lectura se realiza en este dispositivo. La fotografía no se guarda ni se envía al servidor.</p></div>
    {previewUrl ? <div>
      <div className={`mx-auto overflow-hidden border-2 border-slate-300 bg-slate-950 ${portrait ? "max-w-[260px]" : "max-w-lg"}`} style={{ aspectRatio: portrait ? "0.63" : "1.586" }}>
        <img src={previewUrl} alt={`Vista previa del ${documentLabel}`} className="h-full w-full object-contain" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={resetPhoto} disabled={status !== "IDLE"} className="inline-flex min-h-12 items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={19} />Repetir foto</button>
        <button type="button" onClick={analyze} disabled={status !== "IDLE"} className="inline-flex min-h-12 items-center justify-center gap-2 bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{status !== "IDLE" ? <LoaderCircle size={19} className="animate-spin" /> : <ShieldCheck size={19} />}{status === "LOADING" ? "Preparando lectura..." : status === "READING" ? "Leyendo documento..." : "Validar documento"}</button>
      </div>
    </div> : <button type="button" onClick={() => setCameraOpen(true)} className="inline-flex min-h-14 w-full items-center justify-center gap-2 bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800"><Camera size={21} />Abrir cámara</button>}
    {message ? <p role="alert" className="mt-5 border-l-4 border-amber-500 bg-amber-50 p-3 text-sm font-medium text-amber-950">{message}</p> : null}

    {cameraOpen ? <div role="dialog" aria-modal="true" aria-label={`Fotografiar ${documentLabel}`} className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between gap-4 px-4 py-3"><div><p className="font-black">Fotografía tu {documentLabel}</p><p className="text-sm text-slate-300">Ubícalo completo dentro del marco</p></div><button type="button" onClick={() => setCameraOpen(false)} aria-label="Cerrar cámara" className="inline-flex h-11 w-11 items-center justify-center hover:bg-white/10"><X size={26} /></button></header>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 p-5">
          <div ref={frameRef} className={`relative border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.38)] ${portrait ? "h-[72%] max-h-[680px]" : "w-[92%] max-w-3xl"}`} style={{ aspectRatio: portrait ? "0.63" : "1.586" }}>
            <span className="absolute -left-0.5 -top-0.5 h-8 w-8 border-l-4 border-t-4 border-amber-400" /><span className="absolute -right-0.5 -top-0.5 h-8 w-8 border-r-4 border-t-4 border-amber-400" /><span className="absolute -bottom-0.5 -left-0.5 h-8 w-8 border-b-4 border-l-4 border-amber-400" /><span className="absolute -bottom-0.5 -right-0.5 h-8 w-8 border-b-4 border-r-4 border-amber-400" />
          </div>
        </div>
      </div>
      {cameraError ? <p role="alert" className="bg-red-950 px-4 py-3 text-center text-sm">{cameraError}</p> : null}
      <footer className="flex items-center justify-center px-4 py-5"><button type="button" onClick={takePhoto} aria-label="Tomar fotografía" className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-emerald-600 shadow-lg"><Camera size={27} /></button></footer>
    </div> : null}
  </div>;
}
