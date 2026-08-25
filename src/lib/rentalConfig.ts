// Store rental items and section config in admin_settings.accent_color field
// Format: "#hexcolor|||RENTALS:{json}"

const RENTAL_MARKER = "|||RENTALS:";

export interface RentalItem {
  id: string;
  name: string;
  description: string;
  price: string;
  duration: string;
  photos: string[];
  contact_phone: string;
  contact_email: string;
  available: boolean;
  archived?: boolean;
  created_at: string;
}

export interface RentalConfig {
  items: RentalItem[];
  section_name: string;
  button_name: string;
  enabled: boolean;
}

const DEFAULT_CONFIG: RentalConfig = {
  items: [],
  section_name: "Noleggio Attrezzatura",
  button_name: "Noleggio",
  enabled: true,
};

export function encodeRentalConfig(accentColor: string, config: RentalConfig): string {
  const cleanColor = accentColor.split(RENTAL_MARKER)[0];
  return cleanColor + RENTAL_MARKER + JSON.stringify(config);
}

export function decodeRentalConfig(accentColor: string): { color: string; rental: RentalConfig } {
  if (!accentColor) return { color: "#ef4444", rental: DEFAULT_CONFIG };
  const idx = accentColor.indexOf(RENTAL_MARKER);
  if (idx === -1) return { color: accentColor, rental: DEFAULT_CONFIG };
  const color = accentColor.slice(0, idx);
  try {
    const rental = JSON.parse(accentColor.slice(idx + RENTAL_MARKER.length)) as RentalConfig;
    return { color, rental: { ...DEFAULT_CONFIG, ...rental } };
  } catch {
    return { color, rental: DEFAULT_CONFIG };
  }
}
