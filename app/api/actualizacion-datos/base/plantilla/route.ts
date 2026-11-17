import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const buffer = await readFile(join(process.cwd(), "resources", "templates", "plantilla-base-socios.xlsx"));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-base-socios.xlsx"',
      "Cache-Control": "no-store"
    }
  });
}
