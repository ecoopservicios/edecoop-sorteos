"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-md bg-emerald-700 px-4 py-2 font-bold text-white">
      Imprimir
    </button>
  );
}
