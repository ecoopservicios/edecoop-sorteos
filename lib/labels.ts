import { RaffleEnvironment, RaffleResultStatus } from "@prisma/client";

export function environmentLabel(environment: RaffleEnvironment) {
  if (environment === RaffleEnvironment.PRESENTIAL) return "Presencial";
  return "Virtual";
}

export function prizeStatusLabel(status: RaffleResultStatus) {
  if (status === RaffleResultStatus.SENT) return "Enviado";
  if (status === RaffleResultStatus.DELIVERED) return "Entregado";
  return "Pendiente";
}
