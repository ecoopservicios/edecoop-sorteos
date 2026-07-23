"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import type { ToastType } from "@/lib/toast";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

const toastStyles: Record<ToastType, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-red-200 bg-red-50 text-red-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-slate-200 bg-white text-slate-950"
};

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info
};

export function ToastViewport() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function addToast(event: Event) {
      const detail = (event as CustomEvent<{ message: string; type?: ToastType }>).detail;
      if (!detail?.message) return;
      const id = Date.now() + Math.random();
      const toast = {
        id,
        message: detail.message,
        type: detail.type || "info"
      };

      setToasts((current) => [toast, ...current].slice(0, 4));
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, 4200);
    }

    window.addEventListener("app-toast", addToast);
    return () => window.removeEventListener("app-toast", addToast);
  }, []);

  return (
    <div className="fixed right-4 top-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg ${toastStyles[toast.type]}`}
            role="status"
          >
            <Icon size={20} className="mt-0.5 shrink-0" />
            <p className="min-w-0 flex-1 text-sm font-semibold leading-5">{toast.message}</p>
            <button
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              className="rounded-md p-1 hover:bg-black/5"
              title="Cerrar notificacion"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
