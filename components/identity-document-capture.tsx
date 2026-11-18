"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, X } from "lucide-react";

type OcrLine = { text: string; score: number };
type OcrEngine = {
  predict: (input: Blob, params?: Record<string, unknown>) => Promise<Array<{ items: OcrLine[] }>>;
  dispose: () => Promise<void>;
};

let ocrEnginePromise: Promise<OcrEngine> | null = null;

function usesSafariOcr() {
  return /AppleWebKit/i.test(navigator.userAgent) && !/Chrome\/|Chromium\/|Android|Edg\/|OPR\//i.test(navigator.userAgent);
}

function getOcrEngine() {
  if (!ocrEnginePromise) {
    ocrEnginePromise = import("@paddleocr/paddleocr-js")
      .then(({ PaddleOCR }) => PaddleOCR.create({
        textDetectionModelName: "PP-OCRv6_tiny_det",
        textRecognitionModelName: "PP-OCRv6_tiny_rec",
        textDetectionModelAsset: { url: new URL("/ocr/models/PP-OCRv6_tiny_det.tar", window.location.origin).href },
        textRecognitionModelAsset: { url: new URL("/ocr/models/PP-OCRv6_tiny_rec.tar", window.location.origin).href },
        // Safari uses the CPU-only main-thread runtime; the SDK worker embeds JSEP.
        worker: !usesSafariOcr(),
        // Match the runtime bundled in PaddleOCR's worker; keep WASM imports same-origin.
        ortOptions: {
          backend: "wasm",
          wasmPaths: new URL("/ocr/onnxruntime/1.24.3/", window.location.origin).href,
          numThreads: 1,
          simd: true
        }
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

function videoPixels(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 72;
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const gray = new Uint8Array(rgba.length / 4);
  for (let source = 0, target = 0; source < rgba.length; source += 4, target++) {
    gray[target] = Math.round(rgba[source] * 0.299 + rgba[source + 1] * 0.587 + rgba[source + 2] * 0.114);
  }
  return gray;
}

function frameDifference(first: Uint8Array, second: Uint8Array) {
  let total = 0;
  for (let index = 0; index < first.length; index++) total += Math.abs(first[index] - second[index]);
  return total / first.length;
}

async function enhancePhoto(photo: Blob) {
  const image = await createImageBitmap(photo);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) { image.close(); return photo; }
  context.filter = "grayscale(1) contrast(1.12)";
  context.drawImage(image, 0, 0);
  image.close();
  return new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob || photo), "image/jpeg", 0.94));
}

function readLines(result?: { items: OcrLine[] }) {
  return (result?.items || []).filter(item => item.text?.trim() && Number.isFinite(item.score) && item.score >= 0.3)
    .map(item => ({ text: item.text.trim().slice(0, 160), score: item.score }));
}

export function IdentityDocumentCapture({
  kind,
  verificationToken,
  handoffToken,
  verified,
  onVerified
}: {
  kind: "EMPLOYEE_CARD" | "DOCUMENT_ID";
  verificationToken?: string;
  handoffToken?: string;
  verified: boolean;
  onVerified: (token?: string) => void;
}) {
  const portrait = kind === "EMPLOYEE_CARD";
  const documentLabel = portrait ? "carnet de empleado" : "cédula";
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [liveReady, setLiveReady] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [status, setStatus] = useState<"IDLE" | "LOADING" | "READING" | "REFINING" | "CHECKING" | "VERIFIED">("IDLE");
  const [message, setMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const liveStats = useRef<{ previous: Uint8Array | null; samples: number; movement: number }>({ previous: null, samples: 0, movement: 0 });

  useEffect(() => {
    if (usesSafariOcr()) return;
    const warmUp = () => { void getOcrEngine().catch(() => {}); };
    const idleWindow = window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(warmUp, { timeout: 1200 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }
    const timer = globalThis.setTimeout(warmUp, 250);
    return () => globalThis.clearTimeout(timer);
  }, []);

  useEffect(() => () => {
    stopStream(videoRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!cameraOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let cancelled = false;
    let sampleTimer: ReturnType<typeof setInterval> | null = null;
    liveStats.current = { previous: null, samples: 0, movement: 0 };
    setLiveReady(false);
    setCameraError("");
    navigator.mediaDevices?.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    }).then(stream => {
      if (cancelled) return stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        return videoRef.current.play().then(() => {
          sampleTimer = setInterval(() => {
            const current = videoRef.current ? videoPixels(videoRef.current) : null;
            if (!current) return;
            const stats = liveStats.current;
            if (stats.previous) {
              const difference = frameDifference(stats.previous, current);
              stats.samples++;
              if (difference >= 1.8 && difference <= 70) stats.movement += Math.min(difference, 15);
              if (stats.samples >= 3 && stats.movement >= 6) setLiveReady(true);
            }
            stats.previous = current;
          }, 260);
        });
      }
    }).catch(() => setCameraError("No fue posible abrir la cámara. Revisa el permiso del navegador o continúa desde un teléfono con cámara."));
    return () => {
      cancelled = true;
      if (sampleTimer) clearInterval(sampleTimer);
      stopStream(videoRef.current);
      document.body.style.overflow = previousOverflow;
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
    if (!liveReady) return setCameraError("Mueve ligeramente el documento dentro del marco y espera a que la cámara esté lista.");
    try {
      setCameraError("");
      setSelectedPhoto(await cameraFrame(video, frame, portrait));
      setCameraOpen(false);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "No se pudo capturar la fotografía.");
    }
  }

  function openCamera() {
    setLiveReady(false);
    setCameraError("");
    setCameraOpen(true);
    void getOcrEngine().catch(() => {});
  }

  function closeCamera() {
    setLiveReady(false);
    setCameraOpen(false);
  }

  async function analyze() {
    if (!photo || status !== "IDLE") return;
    setMessage("");
    let engine: OcrEngine | undefined;
    try {
      setStatus("LOADING");
      engine = await getOcrEngine();
      setStatus("READING");
      const [result] = await engine.predict(photo, {
        textDetLimitSideLen: 960,
        textDetLimitType: "max",
        textRecScoreThresh: 0.3
      });
      const lines = readLines(result).slice(0, 60);
      if (!lines.length) throw new Error("No pudimos leer el documento. Toma otra foto con mejor iluminación y sin reflejos.");
      async function confirm(reading: OcrLine[]) {
        setStatus("CHECKING");
        const response = await fetch("/api/actualizacion-datos/validar-documento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verificationToken, handoffToken, lines: reading, kind })
        });
        return { response, data: await response.json() };
      }
      let { response, data } = await confirm(lines);
      if (response.status === 422 && ["DOCUMENT_FORMAT", "DOCUMENT_NUMBER", "DOCUMENT_NAME"].includes(data.code)) {
        setStatus("REFINING");
        const [refined] = await engine.predict(await enhancePhoto(photo), {
          textDetLimitSideLen: 1400, textDetLimitType: "max", textRecScoreThresh: 0.3
        });
        const merged = new Map<string, OcrLine>();
        for (const line of [...readLines(refined), ...lines]) if (!merged.has(line.text)) merged.set(line.text, line);
        ({ response, data } = await confirm([...merged.values()].slice(0, 60)));
      }
      if (!response.ok) throw new Error(data.error || "El documento no coincide con los datos consultados.");
      setStatus("VERIFIED");
      setMessage(data.message || "Documento validado correctamente.");
      onVerified(data.verificationToken);
      setPhoto(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    } catch (error) {
      setStatus("IDLE");
      const detail = error instanceof Error ? error.message : "";
      const runtimeFailed = !engine || /initWasm|no available backend|WebAssembly|OffscreenCanvas|ImageBitmap|failed to fetch dynamically imported module/i.test(detail);
      if (runtimeFailed) {
        ocrEnginePromise = null;
        void engine?.dispose().catch(() => {});
      }
      setMessage(runtimeFailed
        ? `No se pudo iniciar la lectura. ${usesSafariOcr() ? "En Safari puedes continuar desde Chrome mientras revisamos la compatibilidad." : "Vuelve a presionar Validar documento; no necesitas repetir la foto."} Código: ${usesSafariOcr() ? "OCR-SAFARI" : "OCR-INIT"}. Detalle: ${detail.replace(/https?:\/\/\S+/g, "[recurso OCR]").slice(0, 240) || "Error de inicialización."}`
        : detail || "No se pudo validar el documento.");
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
    {!previewUrl ? <figure className="mb-5 bg-slate-50 px-4 py-5 text-center">
      <img src={portrait ? "/ocr/capture-guide-badge.webp" : "/ocr/capture-guide-id.webp"} width={330} height={440} alt={`Ejemplo de cómo sostener ${portrait ? "el carnet de empleado" : "la cédula"} en la palma sin tapar sus datos`} className="mx-auto h-60 w-auto max-w-full object-contain" />
      <figcaption className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-700">Apoya el documento en la palma, con los dedos detrás. No tapes el nombre, el número ni las esquinas.</figcaption>
    </figure> : null}
    <div className="mb-5 flex items-start gap-3 bg-slate-50 p-4 text-sm text-slate-700"><ShieldCheck size={22} className="mt-0.5 shrink-0 text-emerald-700" /><p>La lectura se realiza en este dispositivo. La fotografía no se guarda ni se envía al servidor.</p></div>
    {previewUrl ? <div>
      <div className={`mx-auto overflow-hidden border-2 border-slate-300 bg-slate-950 ${portrait ? "max-w-[260px]" : "max-w-lg"}`} style={{ aspectRatio: portrait ? "0.63" : "1.586" }}>
        <img src={previewUrl} alt={`Vista previa del ${documentLabel}`} className="h-full w-full object-contain" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={resetPhoto} disabled={status !== "IDLE"} className="inline-flex min-h-12 items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={19} />Repetir foto</button>
        <button type="button" onClick={analyze} disabled={status !== "IDLE"} className="inline-flex min-h-12 items-center justify-center gap-2 bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{status !== "IDLE" ? <LoaderCircle size={19} className="animate-spin" /> : <ShieldCheck size={19} />}{status === "LOADING" ? "Preparando lectura..." : status === "READING" ? "Leyendo documento..." : status === "REFINING" ? "Mejorando lectura..." : status === "CHECKING" ? "Confirmando datos..." : "Validar documento"}</button>
      </div>
    </div> : <button type="button" onClick={openCamera} className="inline-flex min-h-14 w-full items-center justify-center gap-2 bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800"><Camera size={21} />Abrir cámara</button>}
    {message ? <p role="alert" className="mt-5 break-words border-l-4 border-amber-500 bg-amber-50 p-3 text-sm font-medium text-amber-950">{message}</p> : null}

    {cameraOpen ? createPortal(<div role="dialog" aria-modal="true" aria-label={`Fotografiar ${documentLabel}`} className="fixed inset-0 z-[100] flex h-[100dvh] w-screen flex-col overflow-hidden bg-slate-950 text-white">
      <header className="flex shrink-0 items-center justify-between gap-4 px-4 py-3"><div><p className="font-black">Fotografía tu {documentLabel}</p><p className="text-sm text-slate-300">Ubícalo completo y muévelo ligeramente dentro del marco</p></div><button type="button" onClick={closeCamera} aria-label="Cerrar cámara" className="inline-flex h-11 w-11 shrink-0 items-center justify-center hover:bg-white/10"><X size={26} /></button></header>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full max-w-none object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 p-4">
          <div ref={frameRef} className={`relative max-h-[88%] border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.42)] ${portrait ? "h-[82%] max-w-[78%]" : "w-[92%] max-w-3xl"}`} style={{ aspectRatio: portrait ? "0.63" : "1.586" }}>
            <span className="absolute -left-0.5 -top-0.5 h-8 w-8 border-l-4 border-t-4 border-amber-400" /><span className="absolute -right-0.5 -top-0.5 h-8 w-8 border-r-4 border-t-4 border-amber-400" /><span className="absolute -bottom-0.5 -left-0.5 h-8 w-8 border-b-4 border-l-4 border-amber-400" /><span className="absolute -bottom-0.5 -right-0.5 h-8 w-8 border-b-4 border-r-4 border-amber-400" />
          </div>
        </div>
      </div>
      {cameraError ? <p role="alert" className="shrink-0 bg-red-950 px-4 py-3 text-center text-sm">{cameraError}</p> : null}
      <footer className="flex shrink-0 flex-col items-center justify-center gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"><p role="status" className={`text-xs font-bold uppercase ${liveReady ? "text-emerald-300" : "text-slate-300"}`}>{liveReady ? "Cámara lista" : "Comprobando documento en vivo"}</p><button type="button" onClick={takePhoto} disabled={!liveReady} aria-label="Tomar fotografía" className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-emerald-600 shadow-lg disabled:cursor-wait disabled:bg-slate-600 disabled:opacity-70"><Camera size={27} /></button></footer>
    </div>, document.body) : null}
  </div>;
}
