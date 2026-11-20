import assert from "node:assert/strict";
import test from "node:test";
import { DATA_UPDATE_EMAIL_VALIDITY_MS, dataUpdateEmailTracking, isDataUpdateEmailExpired } from "../lib/data-update-email-status";
import { DATA_UPDATE_MEMBER_SEND_LIMIT, DATA_UPDATE_MEMBER_SEND_WINDOW_MS } from "../lib/data-update-security";

const now = new Date("2026-11-19T12:00:00.000Z").getTime();

test("separates sent, validated and resent email states", () => {
  const sentAt = new Date(now - 60_000);
  assert.deepEqual(dataUpdateEmailTracking({ deliveryStatus: "SENT", sentAt, verifiedAt: null, resendCount: 2 }, now), {
    deliveryLabel: "Enviado",
    validationLabel: "Pendiente",
    resendLabel: "Sí (2)",
    expired: false
  });
  assert.equal(dataUpdateEmailTracking({ deliveryStatus: "VERIFIED", sentAt, verifiedAt: new Date(now), resendCount: 0 }, now).validationLabel, "Validado");
});

test("marks an unvalidated link as timed out after 24 hours", () => {
  const sentAt = new Date(now - DATA_UPDATE_EMAIL_VALIDITY_MS);
  assert.equal(isDataUpdateEmailExpired(sentAt, now), true);
  assert.equal(dataUpdateEmailTracking({ deliveryStatus: "SENT", sentAt, verifiedAt: null }, now).validationLabel, "Tiempo agotado");
});

test("distinguishes failed delivery from validation timeout", () => {
  const tracking = dataUpdateEmailTracking({ deliveryStatus: "FAILED", sentAt: null, verifiedAt: null }, now);
  assert.equal(tracking.deliveryLabel, "Falló el envío");
  assert.equal(tracking.validationLabel, "No enviado");
});

test("limits each member to ten email requests every two hours", () => {
  assert.equal(DATA_UPDATE_MEMBER_SEND_LIMIT, 10);
  assert.equal(DATA_UPDATE_MEMBER_SEND_WINDOW_MS, 2 * 60 * 60 * 1000);
});
