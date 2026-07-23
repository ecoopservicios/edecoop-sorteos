"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ReloadLogoutGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type !== "reload") return;
    if (pathname === "/login") return;

    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      window.location.replace("/login?expired=1");
    });
  }, [pathname]);

  return null;
}
