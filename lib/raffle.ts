import { randomInt } from "node:crypto";
import { DigitalLinkStatus, EventEdition, EventPrize, EventType, Prisma, Prize, RaffleEnvironment } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatParticipant, generatePrizeCode } from "@/lib/codes";
import { EVENT_TYPE_CODES } from "@/lib/events";
import { buildFullName, validatePersonName } from "@/lib/participants";
import { normalizePhone } from "@/lib/whatsapp";
import { checkPersonDuplicate } from "@/lib/duplicate-protection";

function selectPrize(prizes: Prize[]) {
  const totalAvailable = prizes.reduce((sum, prize) => sum + prize.availableQuantity, 0);
  if (totalAvailable <= 0) {
    throw new Error("No hay premios disponibles para este ambiente.");
  }

  let ticket = randomInt(1, totalAvailable + 1);
  for (const prize of prizes) {
    ticket -= prize.availableQuantity;
    if (ticket <= 0) return prize;
  }

  return prizes[0];
}

function selectEventPrize(prizes: EventPrize[]) {
  const totalAvailable = prizes.reduce((sum, prize) => sum + prize.availableQuantity, 0);
  if (totalAvailable <= 0) {
    throw new Error("No hay premios disponibles para este evento.");
  }

  let ticket = randomInt(1, totalAvailable + 1);
  for (const prize of prizes) {
    ticket -= prize.availableQuantity;
    if (ticket <= 0) return prize;
  }

  return prizes[0];
}

async function createUniquePrizeCode(tx: Prisma.TransactionClient) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generatePrizeCode();
    const existing = await tx.raffleResult.findUnique({ where: { code } });
    if (!existing) return code;
  }

  throw new Error("No se pudo generar un código único.");
}

async function availablePrizes(tx: Prisma.TransactionClient) {
  return tx.prize.findMany({
    where: {
      isActive: true,
      availableQuantity: { gt: 0 }
    },
    orderBy: { createdAt: "asc" }
  });
}

async function activeEventWithPrizes(tx: Prisma.TransactionClient, eventEditionId: string) {
  const event = await tx.eventEdition.findFirst({
    where: {
      id: eventEditionId,
      status: "ACTIVE"
    },
    include: {
      eventType: true,
      prizes: {
        where: { isActive: true, availableQuantity: { gt: 0 } },
        orderBy: { createdAt: "asc" }
      }
    }
  });
  if (!event) throw new Error("El evento seleccionado no esta activo o no existe.");
  if (!event.prizes.length) throw new Error("El evento seleccionado no tiene premios disponibles.");
  return event;
}

function eventSnapshot(event: EventEdition & { eventType: EventType }) {
  return {
    eventEditionId: event.id,
    eventTypeName: event.eventType.name,
    eventName: event.displayName,
    eventMonth: event.month,
    eventYear: event.year,
    eventDate: event.eventDate
  };
}

type PresentialParticipantInput = {
  firstName?: string;
  lastName?: string;
  nie?: string;
  email?: string;
  phone?: string;
  playWithoutRegistration?: boolean;
  eventEditionId?: string;
};

export async function spinPresential(responsibleUserId: string, participant?: PresentialParticipantInput) {
  return prisma.$transaction(async (tx) => {
    const selectedEvent = participant?.eventEditionId ? await activeEventWithPrizes(tx, participant.eventEditionId) : null;
    const eventPrize = selectedEvent ? selectEventPrize(selectedEvent.prizes) : null;
    const globalPrize = eventPrize ? null : selectPrize(await availablePrizes(tx));

    if (eventPrize) {
      const updatedPrize = await tx.eventPrize.updateMany({
        where: {
          id: eventPrize.id,
          availableQuantity: { gt: 0 }
        },
        data: {
          availableQuantity: { decrement: 1 },
          awardedQuantity: { increment: 1 }
        }
      });
      if (updatedPrize.count !== 1) throw new Error("El premio ya no tiene inventario disponible.");
    } else if (globalPrize) {
      const updatedPrize = await tx.prize.updateMany({
        where: {
          id: globalPrize.id,
          availableQuantity: { gt: 0 }
        },
        data: {
          availableQuantity: { decrement: 1 }
        }
      });
      if (updatedPrize.count !== 1) throw new Error("El premio ya no tiene inventario disponible.");
    }

    const counter = await tx.appCounter.upsert({
      where: { key: "PRESENTIAL_PARTICIPANT_SEQUENCE" },
      update: { value: { increment: 1 } },
      create: { key: "PRESENTIAL_PARTICIPANT_SEQUENCE", value: 1 }
    });

    let registeredName = "";
    let registeredPhone: string | null = null;
    let registeredNie: string | null = null;
    let registeredEmail: string | null = null;

    if (!participant?.playWithoutRegistration && (participant?.firstName || participant?.lastName || participant?.phone)) {
      const firstName = validatePersonName(participant.firstName || "", "Nombres");
      const lastName = validatePersonName(participant.lastName || "", "Apellidos");
      registeredName = buildFullName(firstName, lastName);
      registeredPhone = participant.phone ? normalizePhone(participant.phone) : null;
      registeredNie = participant.nie || null;
      registeredEmail = participant.email || null;

      const duplicate = await checkPersonDuplicate(
        { firstName, lastName, employeeNumber: registeredNie, phone: registeredPhone, email: registeredEmail },
        tx
      );
      if (duplicate) throw new Error(duplicate.message);
    }

    const participantName = registeredName || formatParticipant(counter.value);
    const code = await createUniquePrizeCode(tx);

    const result = await tx.raffleResult.create({
      data: {
        code,
        participantName,
        participantPhone: registeredPhone,
        participantNie: registeredNie,
        participantEmail: registeredEmail,
        presentialSequence: counter.value,
        environment: RaffleEnvironment.PRESENTIAL,
        prizeId: eventPrize?.id || globalPrize!.id,
        prizeName: eventPrize?.name || globalPrize!.name,
        responsibleUserId,
        ...(selectedEvent ? eventSnapshot(selectedEvent) : {})
      },
      include: {
        responsibleUser: true
      }
    });

    return result;
  });
}

export async function spinDigital(token: string) {
  return prisma.$transaction(async (tx) => {
    const link = await tx.digitalLink.findUnique({
      where: { token },
      include: {
        participant: true,
        enrollmentSubmissions: {
          include: {
            eventEdition: {
              include: { eventType: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    if (!link) throw new Error("El enlace no es valido.");
    if (link.status !== DigitalLinkStatus.PENDING) {
      throw new Error("Este enlace ya fue utilizado o no esta disponible.");
    }
    if (link.expiresAt && link.expiresAt < new Date()) {
      await tx.digitalLink.update({
        where: { id: link.id },
        data: { status: DigitalLinkStatus.EXPIRED }
      });
      throw new Error("Este enlace ya expiro.");
    }

    const lockedLink = await tx.digitalLink.updateMany({
      where: {
        id: link.id,
        status: DigitalLinkStatus.PENDING
      },
      data: {
        status: DigitalLinkStatus.USED,
        usedAt: new Date()
      }
    });

    if (lockedLink.count !== 1) {
      throw new Error("Este enlace ya fue utilizado.");
    }

    const selectedEvent = link.enrollmentSubmissions[0]?.eventEdition || null;
    const event = selectedEvent ? await activeEventWithPrizes(tx, selectedEvent.id) : null;
    const eventPrize = event ? selectEventPrize(event.prizes) : null;
    const globalPrize = eventPrize ? null : selectPrize(await availablePrizes(tx));

    if (eventPrize) {
      const updatedPrize = await tx.eventPrize.updateMany({
        where: { id: eventPrize.id, availableQuantity: { gt: 0 } },
        data: {
          availableQuantity: { decrement: 1 },
          awardedQuantity: { increment: 1 }
        }
      });
      if (updatedPrize.count !== 1) throw new Error("El premio ya no tiene inventario disponible.");
    } else if (globalPrize) {
      const updatedPrize = await tx.prize.updateMany({
        where: {
          id: globalPrize.id,
          availableQuantity: { gt: 0 }
        },
        data: {
          availableQuantity: { decrement: 1 }
        }
      });
      if (updatedPrize.count !== 1) throw new Error("El premio ya no tiene inventario disponible.");
    }

    const code = await createUniquePrizeCode(tx);

    const result = await tx.raffleResult.create({
      data: {
        code,
        participantName: link.participant.name,
        participantPhone: link.participant.phone,
        participantNie: link.participant.nie,
        participantEmail: link.participant.email,
        environment: RaffleEnvironment.DIGITAL,
        prizeId: eventPrize?.id || globalPrize!.id,
        prizeName: eventPrize?.name || globalPrize!.name,
        digitalParticipantId: link.participantId,
        digitalLinkId: link.id,
        ...(event ? eventSnapshot(event) : {})
      },
      include: {
        digitalParticipant: true
      }
    });

    return result;
  });
}

export async function drawAffiliationFinal(responsibleUserId: string, eventEditionId: string) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.eventEdition.findFirst({
      where: {
        id: eventEditionId,
        status: "ACTIVE",
        eventType: { code: EVENT_TYPE_CODES.AFFILIATION_FINAL }
      },
      include: {
        eventType: true,
        prizes: {
          where: { isActive: true, availableQuantity: { gt: 0 } },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!event) throw new Error("Debe seleccionar un evento final activo.");
    if (event.prizes.length !== 1) throw new Error("El evento final debe tener un solo premio disponible.");

    const campaignEvent = await tx.eventEdition.findFirst({
      where: {
        month: event.month,
        year: event.year,
        eventType: { code: EVENT_TYPE_CODES.AFFILIATION_INSTANT }
      },
      select: { id: true, displayName: true }
    });
    if (!campaignEvent) throw new Error("No existe una campaña de afiliación instantánea para el mismo mes y año.");

    const previousWinner = await tx.raffleResult.findFirst({
      where: { eventEditionId: event.id },
      select: { id: true }
    });
    if (previousWinner) throw new Error("Este evento final ya tiene un ganador registrado.");

    const winnerRows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "EnrollmentSubmission"
        WHERE "deletedAt" IS NULL
          AND "eventEditionId" = ${campaignEvent.id}
        ORDER BY RANDOM()
        LIMIT 1
      `
    );
    if (!winnerRows.length) throw new Error(`No hay solicitudes recibidas vinculadas a la campaña ${campaignEvent.displayName}.`);

    const winner = await tx.enrollmentSubmission.findUniqueOrThrow({
      where: { id: winnerRows[0].id }
    });    const prize = event.prizes[0];

    const updatedPrize = await tx.eventPrize.updateMany({
      where: { id: prize.id, availableQuantity: { gt: 0 } },
      data: {
        availableQuantity: { decrement: 1 },
        awardedQuantity: { increment: 1 }
      }
    });
    if (updatedPrize.count !== 1) throw new Error("El premio final ya no tiene inventario disponible.");

    const code = await createUniquePrizeCode(tx);
    const participantName = buildFullName(winner.firstName, winner.lastName);

    return tx.raffleResult.create({
      data: {
        code,
        participantName,
        participantPhone: winner.mobilePhone,
        participantNie: winner.employeeNumber,
        participantEmail: winner.email,
        environment: RaffleEnvironment.PRESENTIAL,
        prizeId: prize.id,
        prizeName: prize.name,
        responsibleUserId,
        ...eventSnapshot(event)
      },
      include: {
        responsibleUser: true
      }
    });
  });
}
