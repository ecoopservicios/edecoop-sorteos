export const DATA_UPDATE_EMAIL_VALIDITY_MS = 24 * 60 * 60 * 1000;

type EmailTrackingInput = {
  deliveryStatus: string;
  sentAt: Date | string | null;
  verifiedAt: Date | string | null;
  resendCount?: number;
};

function timestamp(value: Date | string | null) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function isDataUpdateEmailExpired(sentAt: Date | string | null, now = Date.now()) {
  const sentTime = timestamp(sentAt);
  return sentTime !== null && now - sentTime >= DATA_UPDATE_EMAIL_VALIDITY_MS;
}

export function dataUpdateEmailTracking(input: EmailTrackingInput, now = Date.now()) {
  const sentAt = timestamp(input.sentAt);
  const verifiedAt = timestamp(input.verifiedAt);
  const resendCount = Math.max(0, Math.trunc(input.resendCount || 0));
  const deliveryLabel = input.deliveryStatus === "FAILED"
    ? "Falló el envío"
    : input.deliveryStatus === "SENT" || input.deliveryStatus === "VERIFIED" || verifiedAt !== null
      ? "Enviado"
      : "Pendiente";
  const validationLabel = verifiedAt !== null
    ? "Validado"
    : sentAt !== null && isDataUpdateEmailExpired(input.sentAt, now)
      ? "Tiempo agotado"
      : input.deliveryStatus === "FAILED"
        ? "No enviado"
        : sentAt !== null
          ? "Pendiente"
          : "Sin envío";

  return {
    deliveryLabel,
    validationLabel,
    resendLabel: resendCount ? `Sí (${resendCount})` : "No",
    expired: validationLabel === "Tiempo agotado"
  };
}
