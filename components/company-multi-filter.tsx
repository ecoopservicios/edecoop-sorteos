"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export function CompanyMultiFilter({ options, value, onChange }: { options: [string, string][]; value: string[]; onChange: (value: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const selectedLabel = !value.length ? "Todas las empresas" : value.length === 1 ? options.find(([key]) => key === value[0])?.[1] || "Una empresa" : `${value.length} empresas seleccionadas`;
  return <div ref={root} className="relative min-w-0 text-sm font-semibold" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <span id={id + "-label"}>Empresa</span>
    <button ref={trigger} type="button" aria-labelledby={id + "-label"} aria-expanded={open} aria-controls={id + "-options"} onClick={() => setOpen(current => !current)} className="mt-1 flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 text-left text-base font-normal">
      <span className="truncate" title={selectedLabel}>{selectedLabel}</span><ChevronDown size={18} className="shrink-0" />
    </button>
    {open && <fieldset id={id + "-options"} aria-label="Filtrar por empresas" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 min-w-0 overflow-y-auto overscroll-contain rounded-md border border-slate-300 bg-white p-2 shadow-lg">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-slate-200 px-2 py-2"><input type="checkbox" checked={!value.length} onChange={() => onChange([])} className="h-5 w-5 shrink-0 accent-emerald-700" />Todas las empresas</label>
      {options.map(([key, name]) => <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3 px-2 py-2 hover:bg-emerald-50"><input type="checkbox" value={key} checked={value.includes(key)} onChange={event => onChange(event.target.checked ? [...value, key] : value.filter(item => item !== key))} className="h-5 w-5 shrink-0 accent-emerald-700" /><span className="min-w-0 break-words">{name}</span></label>)}
    </fieldset>}
  </div>;
}
