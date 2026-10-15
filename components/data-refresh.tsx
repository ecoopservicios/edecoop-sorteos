"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { notify } from "@/lib/toast";

type Handler = () => void | Promise<void>;
type RefreshContextValue = { subscribe: (handler: Handler) => () => void; refresh: (silent?: boolean) => Promise<void>; pending: boolean };
const RefreshContext = createContext<RefreshContextValue | null>(null);

export function DataRefreshProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const handlers = useRef(new Set<Handler>());
  const running = useRef(false);
  const transitioning = useRef(false);
  const printing = useRef(false);
  const [fetching, setFetching] = useState(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => { transitioning.current = pending; }, [pending]);
  const subscribe = useCallback((handler: Handler) => {
    handlers.current.add(handler);
    return () => { handlers.current.delete(handler); };
  }, []);
  const refresh = useCallback(async (silent = false) => {
    if (running.current || transitioning.current || printing.current || !navigator.onLine) return;
    running.current = true;
    setFetching(true);
    try {
      const requests = [...handlers.current].map(handler => Promise.resolve().then(handler));
      startTransition(() => router.refresh());
      const results = await Promise.allSettled(requests);
      const failed = results.find(result => result.status === "rejected");
      if (failed?.status === "rejected" && !silent) notify(failed.reason instanceof Error ? failed.reason.message : "No se pudieron actualizar los datos.", "error");
    } finally { running.current = false; setFetching(false); }
  }, [router]);
  useEffect(() => {
    const update = () => { if (document.visibilityState === "visible") void refresh(true); };
    const beforePrint = () => { printing.current = true; };
    const afterPrint = () => { printing.current = false; update(); };
    const interval = window.setInterval(update, 15000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("online", update);
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("online", update);
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, [refresh]);
  const value = useMemo(() => ({ subscribe, refresh, pending: pending || fetching }), [subscribe, refresh, pending, fetching]);
  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export function useDataRefresh(handler: Handler) {
  const context = useContext(RefreshContext);
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  const subscribe = context?.subscribe;
  useEffect(() => subscribe?.(() => latest.current()), [subscribe]);
}

export function RefreshDataButton() {
  const context = useContext(RefreshContext);
  if (!context) return null;
  return <button type="button" title="Actualizar datos" aria-label="Actualizar datos" aria-busy={context.pending} disabled={context.pending} onClick={() => void context.refresh()} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 print:hidden">
    <RefreshCw size={18} className={context.pending ? "animate-spin" : ""} /><span>Actualizar</span>
  </button>;
}
