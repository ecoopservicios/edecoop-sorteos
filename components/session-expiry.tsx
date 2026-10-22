"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isPrivatePage } from "@/lib/private-pages";

export function SessionExpiry() {
  const pathname = usePathname();
  useEffect(() => {
    if (!isPrivatePage(pathname)) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expire = () => { window.location.replace("/login?expired=1"); };
    const check = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (stopped) return;
        if (!data.user || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) { expire(); return; }
        clearTimeout(timer);
        timer = setTimeout(expire, data.expiresAt - Date.now());
      } catch { /* Server authorization still rejects expired sessions while offline. */ }
    };
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    const pageshow = (event: PageTransitionEvent) => { if (event.persisted) expire(); };
    void check();
    const interval = setInterval(visible, 60000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pageshow", pageshow);
    window.addEventListener("online", visible);
    return () => {
      stopped = true; clearTimeout(timer); clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("pageshow", pageshow);
      window.removeEventListener("online", visible);
    };
  }, [pathname]);
  return null;
}
