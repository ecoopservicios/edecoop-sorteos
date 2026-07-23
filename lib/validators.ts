import { RaffleResultStatus, UserRole } from "@prisma/client";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.nativeEnum(UserRole).default(UserRole.PROMOTER)
});

export const userStatusSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(UserRole).optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.union([z.string().min(1), z.literal(""), z.null()]).optional(),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres."),
  confirmPassword: z.string().min(8, "La confirmacion debe tener al menos 8 caracteres.")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"]
});

export const prizeSchema = z.object({
  name: z.string().min(2),
  availableQuantity: z.coerce.number().int().min(0),
  isActive: z.boolean().optional()
});

export const digitalParticipantSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  nie: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(8)
});

export const digitalParticipantUpdateSchema = digitalParticipantSchema.partial();

export const deleteWithReasonSchema = z.object({
  reason: z.string().trim().min(5, "Debe indicar un motivo de al menos 5 caracteres.")
});

export const digitalSpinSchema = z.object({
  token: z.string().min(20)
});

export const presentialSpinSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  nie: z.string().trim().optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().trim().optional(),
  playWithoutRegistration: z.boolean().optional(),
  eventEditionId: z.string().optional()
});

export const prizeStatusSchema = z.object({
  status: z.enum([
    RaffleResultStatus.PENDING,
    RaffleResultStatus.SENT,
    RaffleResultStatus.DELIVERED
  ])
});
