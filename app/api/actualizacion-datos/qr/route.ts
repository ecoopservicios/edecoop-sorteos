import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
  const url = `${baseUrl}/actualizar-datos`;
  const buffer = await QRCode.toBuffer(url, { type: "png", width: 420, margin: 2 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": 'inline; filename="qr-actualizacion-datos-edecoop.png"'
    }
  });
}
