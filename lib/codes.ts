import crypto from "crypto";

export function generateToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function generatePrizeCode() {
  const number = crypto.randomInt(0, 100000);
  return `EDE-${String(number).padStart(5, "0")}`;
}

export function formatParticipant(sequence: number) {
  return `Participante ${String(sequence).padStart(6, "0")}`;
}
