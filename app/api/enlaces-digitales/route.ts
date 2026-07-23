import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/codes";
import { digitalParticipantSchema } from "@/lib/validators";
import { buildWhatsappUrl, normalizePhone } from "@/lib/whatsapp";
import { buildFullName, validatePersonName } from "@/lib/participants";
import { checkPersonDuplicate } from "@/lib/duplicate-protection";

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const links = await prisma.digitalLink.findMany({
    include: {
      participant: true,
      result: true
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({ links });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) return jsonError("No autorizado.", 403);

  const payload = digitalParticipantSchema.safeParse(await request.json());
  if (!payload.success) return jsonError("Datos inválidos.", 422);

  let firstName: string;
  let lastName: string;
  try {
    firstName = validatePersonName(payload.data.firstName, "Nombres");
    lastName = validatePersonName(payload.data.lastName, "Apellidos");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Nombre inválido.", 422);
  }

  const token = generateToken();
  const fullName = buildFullName(firstName, lastName);
  const phone = normalizePhone(payload.data.phone);
  const nie = payload.data.nie.trim();
  const email = payload.data.email.trim().toLowerCase();
  const duplicate = await checkPersonDuplicate({ firstName, lastName, employeeNumber: nie, phone, email });
  if (duplicate) return NextResponse.json({ error: duplicate.message, field: duplicate.field }, { status: 409 });

  try {
    const participant = await prisma.digitalParticipant.create({
      data: {
        firstName,
        lastName,
        nie,
        email,
        name: fullName,
        phone,
        links: {
          create: {
            token,
            createdById: user!.id
          }
        }
      },
      include: {
        links: true
      }
    });

    const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
    const link = `${baseUrl}/ruleta/digital/${token}`;
    const whatsappUrl = buildWhatsappUrl(participant.phone, link);

    return NextResponse.json(
      {
        participant,
        link,
        whatsappUrl
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("Ya existe un participante digital con ese NIE, teléfono o nombre.", 409);
    }
    throw error;
  }
}
