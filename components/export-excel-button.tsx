"use client";

import * as XLSX from "xlsx";
import { Download } from "lucide-react";
import { notify } from "@/lib/toast";

type ExportRow = Record<string, string | number | boolean | null | undefined>;

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function ExportExcelButton({
  rows,
  fileName,
  label = "Descargar Excel",
  className = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
}: {
  rows: ExportRow[];
  fileName: string;
  label?: string;
  className?: string;
}) {
  function download() {
    if (!rows.length) {
      notify("No hay registros para descargar.", "warning");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Listado");
    XLSX.writeFile(workbook, `${safeFileName(fileName) || "listado"}.xlsx`);
  }

  return (
    <button type="button" onClick={download} className={className}>
      <Download size={17} />
      {label}
    </button>
  );
}
