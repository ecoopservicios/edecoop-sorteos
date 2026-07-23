import { DigitalLinkStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { DigitalWheel } from "@/components/digital-wheel";
import { prisma } from "@/lib/db";

export default async function DigitalRafflePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.digitalLink.findUnique({
    where: { token },
    include: {
      participant: true,
      result: true,
      enrollmentSubmissions: {
        include: {
          eventEdition: true
        },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (!link) notFound();
  const enrollmentForm = await prisma.enrollmentForm.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { token: true }
  });

  const status =
    link.status === DigitalLinkStatus.PENDING && link.expiresAt && link.expiresAt < new Date()
      ? DigitalLinkStatus.EXPIRED
      : link.status;

  return (
    <DigitalWheel
      initialLink={{
        token: link.token,
        status,
        participantName: link.participant.name,
        eventName: link.result?.eventName || link.enrollmentSubmissions[0]?.eventEdition?.displayName || null,
        result: link.result
          ? {
              code: link.result.code,
              prizeName: link.result.prizeName,
              participantName: link.result.participantName,
              eventName: link.result.eventName
            }
          : null
      }}
      enrollmentUrl={enrollmentForm ? `/inscripcion/${enrollmentForm.token}` : null}
    />
  );
}
