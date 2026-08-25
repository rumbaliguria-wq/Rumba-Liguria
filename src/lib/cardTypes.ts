export const ID_TYPE_PRESETS = ["UNIVERSITARIO", "ERASMUS", "VIP", "CLIENTE"] as const;

const ID_TYPE_LABELS: Record<string, string> = {
  UNIVERSITARIO: "Universitario",
  ERASMUS: "Erasmus",
  VIP: "Cliente VIP",
  CLIENTE: "Cliente",
};

// id_type is stored either as a preset key ("VIP") or "OTRO:<testo libero>"
export function encodeIdType(preset: string, customText: string): string {
  if (preset === "OTRO") return `OTRO:${customText.trim()}`;
  return preset;
}

export function decodeIdType(raw: string | null | undefined): { preset: string; custom: string; label: string } {
  if (!raw) return { preset: "", custom: "", label: "—" };
  if (raw.startsWith("OTRO:")) {
    const custom = raw.slice(5);
    return { preset: "OTRO", custom, label: custom || "Altro" };
  }
  return { preset: raw, custom: "", label: ID_TYPE_LABELS[raw] || raw };
}

export function generateCardCode(): string {
  const rand = Array.from({ length: 10 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");
  return `RLC-${rand}`;
}
