import { generateToken } from "@/lib/codes";
import { prisma } from "@/lib/db";
import {
  DEFAULT_ENROLLMENT_COMPANY,
  DEFAULT_ENROLLMENT_SUCCESS_MESSAGE,
  DEFAULT_ENROLLMENT_TEXT,
  DEFAULT_ENROLLMENT_TITLE,
  DEFAULT_ENROLLMENT_WELCOME_MESSAGE
} from "@/lib/enrollment";

export async function ensureEnrollmentForm(createdById?: string) {
  const existing = await prisma.enrollmentForm.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      companies: {
        orderBy: { name: "asc" }
      },
      submissions: {
        where: { deletedAt: null },
        include: { digitalLink: true },
        orderBy: { createdAt: "desc" },
        take: 300
      }
    }
  });

  const form =
    existing ||
    (await prisma.enrollmentForm.create({
      data: {
        token: generateToken(),
        title: DEFAULT_ENROLLMENT_TITLE,
        description: DEFAULT_ENROLLMENT_TEXT,
        welcomeMessage: DEFAULT_ENROLLMENT_WELCOME_MESSAGE,
        successMessage: DEFAULT_ENROLLMENT_SUCCESS_MESSAGE,
        isActive: true,
        allowInstantPrize: true,
        createdById,
        companies: {
          create: {
            name: DEFAULT_ENROLLMENT_COMPANY,
            isActive: true
          }
        }
      },
      include: {
        companies: {
          orderBy: { name: "asc" }
        },
        submissions: {
          where: { deletedAt: null },
          include: { digitalLink: true },
          orderBy: { createdAt: "desc" },
          take: 300
        }
      }
    }));

  await prisma.enrollmentCompany.upsert({
    where: {
      formId_name: {
        formId: form.id,
        name: DEFAULT_ENROLLMENT_COMPANY
      }
    },
    update: {},
    create: {
      formId: form.id,
      name: DEFAULT_ENROLLMENT_COMPANY,
      isActive: true
    }
  });

  return prisma.enrollmentForm.findUniqueOrThrow({
    where: { id: form.id },
    include: {
      companies: {
        orderBy: { name: "asc" }
      },
      submissions: {
        where: { deletedAt: null },
        include: { digitalLink: true },
        orderBy: { createdAt: "desc" },
        take: 300
      }
    }
  });
}
