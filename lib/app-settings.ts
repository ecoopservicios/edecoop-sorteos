import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

export const APP_SETTING_KEYS = {
  cooperativeWhatsapp: "cooperative.whatsapp",
  cooperativePhone: "cooperative.phone",
  cooperativeEmail: "cooperative.email",
  cooperativeWebsite: "cooperative.website",
  cooperativeFacebook: "cooperative.facebook",
  cooperativeInstagram: "cooperative.instagram",
  cooperativeX: "cooperative.x",
  cooperativeYoutube: "cooperative.youtube",
  dataUpdateTitle: "dataUpdate.title",
  dataUpdateDescription: "dataUpdate.description",
  dataUpdateLookupQuestion: "dataUpdate.lookupQuestion",
  dataUpdateNotFoundMessage: "dataUpdate.notFoundMessage",
  dataUpdateSuccessMessage: "dataUpdate.successMessage",
  dataUpdateWhatsappMessage: "dataUpdate.whatsappMessage",
  dataUpdateQuestions: "dataUpdate.questions"
} as const;

export type AppSettingKey = (typeof APP_SETTING_KEYS)[keyof typeof APP_SETTING_KEYS];

export type CooperativeSettings = {
  whatsapp: string;
  phone: string;
  email: string;
  website: string;
  facebook: string;
  instagram: string;
  x: string;
  youtube: string;
};

export type DataUpdateTextSettings = {
  title: string;
  description: string;
  lookupQuestion: string;
  notFoundMessage: string;
  successMessage: string;
  whatsappMessage: string;
};

export type DataUpdateQuestionType = "TEXT" | "NUMBER" | "PHONE" | "EMAIL" | "SELECT";
export type DataUpdateQuestionSection = "CONTACT" | "EMERGENCY" | "ADDITIONAL";

export type DataUpdateQuestion = {
  id: string;
  fieldKey: string;
  label: string;
  section: DataUpdateQuestionSection;
  type: DataUpdateQuestionType;
  required: boolean;
  isSystem: boolean;
  helpText?: string;
  options?: string[];
};

const cooperativeKeys = [
  APP_SETTING_KEYS.cooperativeWhatsapp,
  APP_SETTING_KEYS.cooperativePhone,
  APP_SETTING_KEYS.cooperativeEmail,
  APP_SETTING_KEYS.cooperativeWebsite,
  APP_SETTING_KEYS.cooperativeFacebook,
  APP_SETTING_KEYS.cooperativeInstagram,
  APP_SETTING_KEYS.cooperativeX,
  APP_SETTING_KEYS.cooperativeYoutube
] as const;

const keyToField: Record<(typeof cooperativeKeys)[number], keyof CooperativeSettings> = {
  [APP_SETTING_KEYS.cooperativeWhatsapp]: "whatsapp",
  [APP_SETTING_KEYS.cooperativePhone]: "phone",
  [APP_SETTING_KEYS.cooperativeEmail]: "email",
  [APP_SETTING_KEYS.cooperativeWebsite]: "website",
  [APP_SETTING_KEYS.cooperativeFacebook]: "facebook",
  [APP_SETTING_KEYS.cooperativeInstagram]: "instagram",
  [APP_SETTING_KEYS.cooperativeX]: "x",
  [APP_SETTING_KEYS.cooperativeYoutube]: "youtube"
};

export function fallbackCooperativeSettings(): CooperativeSettings {
  return {
    whatsapp: process.env.DATA_UPDATE_SUPPORT_WHATSAPP || process.env.PRIZE_CONTACT_WHATSAPP || "",
    phone: "",
    email: "",
    website: "",
    facebook: "",
    instagram: "",
    x: "",
    youtube: ""
  };
}

export async function getCooperativeSettings() {
  const settings = fallbackCooperativeSettings();
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [...cooperativeKeys] } }
  });

  for (const row of rows) {
    const field = keyToField[row.key as (typeof cooperativeKeys)[number]];
    if (field) settings[field] = row.value;
  }

  return settings;
}

export function fallbackDataUpdateTextSettings(): DataUpdateTextSettings {
  return {
    title: "Actualizacion de Datos",
    description: "Seleccione su empresa para validar sus datos registrados.",
    lookupQuestion: "Digite el dato de consulta solicitado para su empresa.",
    notFoundMessage: "No encontramos sus datos en nuestros registros.",
    successMessage: "Gracias por actualizar sus datos. La informacion fue recibida correctamente por EDECOOP.",
    whatsappMessage: "Hola EDECOOP, necesito actualizar mis datos y no aparezco en el portal para la empresa {empresa}."
  };
}

export function fallbackDataUpdateQuestions(): DataUpdateQuestion[] {
  return [
    {
      id: "personalPhone",
      fieldKey: "personalPhone",
      label: "Telefono personal",
      section: "CONTACT",
      type: "PHONE",
      required: true,
      isSystem: true,
      helpText: "Debe contener exactamente 10 numeros."
    },
    {
      id: "whatsappPhone",
      fieldKey: "whatsappPhone",
      label: "WhatsApp personal",
      section: "CONTACT",
      type: "PHONE",
      required: true,
      isSystem: true,
      helpText: "Si es el mismo telefono personal, puede repetirlo."
    },
    {
      id: "personalEmail",
      fieldKey: "personalEmail",
      label: "Correo electronico personal",
      section: "CONTACT",
      type: "EMAIL",
      required: true,
      isSystem: true,
      helpText: "Ingrese un correo personal. No se permiten correos institucionales."
    },
    {
      id: "emergencyContactName",
      fieldKey: "emergencyContactName",
      label: "Contacto de emergencia",
      section: "EMERGENCY",
      type: "TEXT",
      required: true,
      isSystem: true,
      helpText: "Nombre completo de la persona a contactar en caso de emergencia."
    },
    {
      id: "emergencyContactPhone",
      fieldKey: "emergencyContactPhone",
      label: "Telefono emergencia",
      section: "EMERGENCY",
      type: "PHONE",
      required: true,
      isSystem: true,
      helpText: "Debe contener exactamente 10 numeros."
    },
    {
      id: "emergencyContactRelation",
      fieldKey: "emergencyContactRelation",
      label: "Relacion",
      section: "EMERGENCY",
      type: "SELECT",
      required: true,
      isSystem: true,
      helpText: "Seleccione la relacion con su contacto de emergencia.",
      options: ["FAMILIAR", "ESPOSA", "HIJO", "AMIGO"]
    }
  ];
}

function normalizeQuestions(value: unknown): DataUpdateQuestion[] {
  const defaults = fallbackDataUpdateQuestions();
  if (!Array.isArray(value)) return defaults;

  const byField = new Map(defaults.map((question) => [question.fieldKey, question]));
  const normalized = value
    .map((question) => {
      if (!question || typeof question !== "object") return null;
      const row = question as Partial<DataUpdateQuestion>;
      const fieldKey = String(row.fieldKey || row.id || "").trim();
      const system = byField.get(fieldKey);
      const typeValues: DataUpdateQuestionType[] = ["TEXT", "NUMBER", "PHONE", "EMAIL", "SELECT"];
      const sectionValues: DataUpdateQuestionSection[] = ["CONTACT", "EMERGENCY", "ADDITIONAL"];
      const type = typeValues.includes(row.type as DataUpdateQuestionType) ? (row.type as DataUpdateQuestionType) : system?.type || "TEXT";
      const section = sectionValues.includes(row.section as DataUpdateQuestionSection)
        ? (row.section as DataUpdateQuestionSection)
        : system?.section || "ADDITIONAL";
      const id = String(row.id || fieldKey || randomUUID()).trim();
      const label = String(row.label || system?.label || "").trim();
      if (!id || !fieldKey || !label) return null;

      return {
        id,
        fieldKey,
        label,
        section,
        type,
        required: system ? true : Boolean(row.required),
        isSystem: Boolean(system),
        helpText: String(row.helpText || system?.helpText || "").trim(),
        options: type === "SELECT" ? (Array.isArray(row.options) ? row.options.map(String).filter(Boolean) : system?.options || []) : undefined
      };
    })
    .filter(Boolean) as DataUpdateQuestion[];

  const fields = new Set(normalized.map((question) => question.fieldKey));
  for (const question of defaults) {
    if (!fields.has(question.fieldKey)) normalized.push(question);
  }

  return normalized;
}

export async function getDataUpdateQuestions() {
  const row = await prisma.appSetting.findUnique({ where: { key: APP_SETTING_KEYS.dataUpdateQuestions } });
  if (!row) return fallbackDataUpdateQuestions();
  try {
    return normalizeQuestions(JSON.parse(row.value));
  } catch {
    return fallbackDataUpdateQuestions();
  }
}

export async function upsertDataUpdateQuestions(questions: DataUpdateQuestion[]) {
  const normalized = normalizeQuestions(questions);
  await prisma.appSetting.upsert({
    where: { key: APP_SETTING_KEYS.dataUpdateQuestions },
    update: { value: JSON.stringify(normalized) },
    create: { key: APP_SETTING_KEYS.dataUpdateQuestions, value: JSON.stringify(normalized) }
  });
  return normalized;
}

export async function getDataUpdateTextSettings() {
  const settings = fallbackDataUpdateTextSettings();
  const rows = await prisma.appSetting.findMany({
    where: {
      key: {
        in: [
          APP_SETTING_KEYS.dataUpdateTitle,
          APP_SETTING_KEYS.dataUpdateDescription,
          APP_SETTING_KEYS.dataUpdateLookupQuestion,
          APP_SETTING_KEYS.dataUpdateNotFoundMessage,
          APP_SETTING_KEYS.dataUpdateSuccessMessage,
          APP_SETTING_KEYS.dataUpdateWhatsappMessage
        ]
      }
    }
  });

  for (const row of rows) {
    if (row.key === APP_SETTING_KEYS.dataUpdateTitle) settings.title = row.value;
    if (row.key === APP_SETTING_KEYS.dataUpdateDescription) settings.description = row.value;
    if (row.key === APP_SETTING_KEYS.dataUpdateLookupQuestion) settings.lookupQuestion = row.value;
    if (row.key === APP_SETTING_KEYS.dataUpdateNotFoundMessage) settings.notFoundMessage = row.value;
    if (row.key === APP_SETTING_KEYS.dataUpdateSuccessMessage) settings.successMessage = row.value;
    if (row.key === APP_SETTING_KEYS.dataUpdateWhatsappMessage) settings.whatsappMessage = row.value;
  }

  return settings;
}

export async function upsertDataUpdateTextSettings(settings: DataUpdateTextSettings) {
  const entries: Array<[AppSettingKey, string]> = [
    [APP_SETTING_KEYS.dataUpdateTitle, settings.title],
    [APP_SETTING_KEYS.dataUpdateDescription, settings.description],
    [APP_SETTING_KEYS.dataUpdateLookupQuestion, settings.lookupQuestion],
    [APP_SETTING_KEYS.dataUpdateNotFoundMessage, settings.notFoundMessage],
    [APP_SETTING_KEYS.dataUpdateSuccessMessage, settings.successMessage],
    [APP_SETTING_KEYS.dataUpdateWhatsappMessage, settings.whatsappMessage]
  ];

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      })
    )
  );
}

export async function upsertCooperativeSettings(settings: CooperativeSettings) {
  const entries: Array<[AppSettingKey, string]> = [
    [APP_SETTING_KEYS.cooperativeWhatsapp, settings.whatsapp],
    [APP_SETTING_KEYS.cooperativePhone, settings.phone],
    [APP_SETTING_KEYS.cooperativeEmail, settings.email],
    [APP_SETTING_KEYS.cooperativeWebsite, settings.website],
    [APP_SETTING_KEYS.cooperativeFacebook, settings.facebook],
    [APP_SETTING_KEYS.cooperativeInstagram, settings.instagram],
    [APP_SETTING_KEYS.cooperativeX, settings.x],
    [APP_SETTING_KEYS.cooperativeYoutube, settings.youtube]
  ];

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      })
    )
  );
}
