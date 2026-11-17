import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
  const buffer = await QRCode.toBuffer(`${baseUrl}/actualizar-datos`, { type: "png", width: 420, margin: 2 });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": 'inline; filename="qr-actualizacion-datos-edecoop.png"'
    }
  });
}
