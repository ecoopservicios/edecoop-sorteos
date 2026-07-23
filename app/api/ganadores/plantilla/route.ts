import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { WINNER_TEMPLATE_HEADERS } from "@/lib/winner-reports";

export async function GET() {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    Array.from(WINNER_TEMPLATE_HEADERS),
    [1, "14279", "NOMBRE DEL GANADOR", "3,000", "LOCALIDAD"]
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ganadores");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-ganadores-edecoop.xlsx"'
    }
  });
}
