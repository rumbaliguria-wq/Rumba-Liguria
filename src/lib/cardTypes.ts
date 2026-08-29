export const ID_TYPE_PRESETS = ["UNIVERSITARIO", "ERASMUS", "VIP", "CLIENTE"] as const;

export const CARD_LANGUAGES = ["it", "es", "en"] as const;
export type CardLanguage = (typeof CARD_LANGUAGES)[number];
export const DEFAULT_CARD_LANGUAGE: CardLanguage = "it";

export const CARD_LANGUAGE_LABELS: Record<CardLanguage, string> = {
  it: "Italiano",
  es: "Español",
  en: "English",
};

// Testi stampati sulla tessera scaricabile (immagine consegnata al cliente),
// nella lingua scelta per quella specifica tessera.
export const CARD_TEXT: Record<
  CardLanguage,
  { birthDate: string; country: string; city: string; cardType: string; cardPill: string; dateLocale: string }
> = {
  it: { birthDate: "DATA DI NASCITA", country: "PAESE", city: "CITTÀ", cardType: "TIPO TESSERA", cardPill: "TESSERA", dateLocale: "it-IT" },
  es: { birthDate: "DÍA DE NACIMIENTO", country: "PAÍS", city: "CIUDAD", cardType: "TIPO DE TARJETA", cardPill: "TARJETA", dateLocale: "es-ES" },
  en: { birthDate: "DATE OF BIRTH", country: "COUNTRY", city: "CITY", cardType: "CARD TYPE", cardPill: "CARD", dateLocale: "en-US" },
};

const ID_TYPE_LABELS_BY_LANG: Record<CardLanguage, Record<string, string>> = {
  it: { UNIVERSITARIO: "Universitario", ERASMUS: "Erasmus", VIP: "Cliente VIP", CLIENTE: "Cliente" },
  es: { UNIVERSITARIO: "Universitario", ERASMUS: "Erasmus", VIP: "Cliente VIP", CLIENTE: "Cliente" },
  en: { UNIVERSITARIO: "University", ERASMUS: "Erasmus", VIP: "VIP Client", CLIENTE: "Client" },
};

// id_type is stored either as a preset key ("VIP") or "OTRO:<testo libero>"
export function encodeIdType(preset: string, customText: string): string {
  if (preset === "OTRO") return `OTRO:${customText.trim()}`;
  return preset;
}

export function decodeIdType(
  raw: string | null | undefined,
  lang: CardLanguage = DEFAULT_CARD_LANGUAGE
): { preset: string; custom: string; label: string } {
  if (!raw) return { preset: "", custom: "", label: "—" };
  if (raw.startsWith("OTRO:")) {
    const custom = raw.slice(5);
    return { preset: "OTRO", custom, label: custom || "Altro" };
  }
  return { preset: raw, custom: "", label: ID_TYPE_LABELS_BY_LANG[lang][raw] || raw };
}

export function generateCardCode(): string {
  const rand = Array.from({ length: 10 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");
  return `RLC-${rand}`;
}
