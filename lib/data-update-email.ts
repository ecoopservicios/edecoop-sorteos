import { createHash, randomBytes } from "node:crypto";

type VerificationEmail = {
  email: string;
  name: string;
  token: string;
};

type EmailResult = {
  configured: boolean;
  sent: boolean;
  error?: string;
};

export function hashDataUpdateEmailToken(token: string) {
  return createHash("sha256").update(`data-update-email:${token}`).digest("hex");
}

export function createDataUpdateEmailToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDataUpdateEmailToken(token) };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}

export async function sendDataUpdateVerificationEmail({ email, name, token }: VerificationEmail): Promise<EmailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const fromEmail = process.env.EMAIL_FROM_ADDRESS?.trim();
  const fromName = process.env.EMAIL_FROM_NAME?.trim() || "EDECOOP";
  const baseUrl = (process.env.APP_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
  if (!apiKey || !fromEmail) return { configured: false, sent: false };

  const verificationUrl = `${baseUrl}/validar-actualizacion/${encodeURIComponent(token)}`;
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(verificationUrl);
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email, name }],
        subject: "Valida tu actualización de datos en EDECOOP",
        textContent: `Hola ${name}. Recibimos tu actualización de datos. Para validarla, abre este enlace y presiona Validar mi registro: ${verificationUrl}`,
        htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17202a"><h1 style="font-size:24px">Actualización de datos EDECOOP</h1><p>Hola <strong>${safeName}</strong>.</p><p>Recibimos tu actualización de datos. Confirma tu registro mediante el siguiente botón:</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#0f7b63;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:6px">Validar mi registro</a></p><p style="font-size:13px;color:#64748b">Este enlace es personal y solo puede utilizarse una vez.</p></div>`
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { configured: true, sent: false, error: `Brevo rechazó el envío (${response.status})${detail ? `: ${detail.slice(0, 240)}` : "."}` };
    }
    return { configured: true, sent: true };
  } catch (error) {
    return { configured: true, sent: false, error: error instanceof Error ? error.message.slice(0, 500) : "No se pudo conectar con el servicio de correo." };
  }
}
