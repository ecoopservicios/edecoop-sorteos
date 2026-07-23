import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const token = request.nextUrl.searchParams.get("token");
  if (!token) return jsonError("Token requerido.", 422);

  const form = await prisma.enrollmentForm.findUnique({ where: { token } });
  if (!form) return jsonError("Formulario no encontrado.", 404);

  const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
  const url = `${baseUrl}/inscripcion/${form.token}`;
  const buffer = await QRCode.toBuffer(url, { type: "png", width: 420, margin: 2 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": 'inline; filename="qr-inscripcion-edecoop.png"'
    }
  });
}
