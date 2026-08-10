import { prisma } from "@/lib/db";

export const APP_SETTING_KEYS = {
  cooperativeWhatsapp: "cooperative.whatsapp",
  cooperativePhone: "cooperative.phone",
  cooperativeEmail: "cooperative.email",
  cooperativeWebsite: "cooperative.website",
  cooperativeFacebook: "cooperative.facebook",
  cooperativeInstagram: "cooperative.instagram",
  cooperativeX: "cooperative.x",
  cooperativeYoutube: "cooperative.youtube"
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

const keyToField: Record<AppSettingKey, keyof CooperativeSettings> = {
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
    where: { key: { in: Object.values(APP_SETTING_KEYS) } }
  });

  for (const row of rows) {
    const field = keyToField[row.key as AppSettingKey];
    if (field) settings[field] = row.value;
  }

  return settings;
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
