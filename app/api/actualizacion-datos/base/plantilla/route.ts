import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";

const HEADERS = ["nombres", "apellidos", "cedula", "numero_empleado"];

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    HEADERS,
    ["JUAN", "PEREZ", "00112345678", "12345"]
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Socios");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-base-socios.xlsx"'
    }
  });
}
