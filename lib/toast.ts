export type ToastType = "success" | "error" | "info" | "warning";

export function notify(message: string, type: ToastType = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("app-toast", {
      detail: { message, type }
    })
  );
}
