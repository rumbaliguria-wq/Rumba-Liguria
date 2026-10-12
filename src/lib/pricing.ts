import { decodeTicketTypes, type TicketType } from "@/lib/ticketTypes";

// Convierte el texto libre del campo `events.price` ("10", "€10", "10,50 €")
// en céntimos. Cualquier otra cosa ("free", "Gratis", "Ingresso libero",
// "€15 con drink") se considera gratis para no cobrar por error.
export function parsePriceCents(raw: string | null | undefined): number {
  if (!raw) return 0;
  const m = raw.trim().match(/^€?\s*(\d+(?:[.,]\d{1,2})?)\s*€?$/);
  if (!m) return 0;
  const cents = Math.round(parseFloat(m[1].replace(",", ".")) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : 0;
}

// Precio por persona en céntimos. Misma regla en servidor y navegador.
//
// Si el evento tiene tipos de entrada, cada uno vale por SU propio precio,
// sin heredar el Prezzo general del evento — así se pueden mezclar tipos
// gratis y pagos en el mismo evento (p.ej. "General" sin precio = gratis,
// "VIP" con precio = pago), tal como ya promete el texto de ayuda del panel.
// Sin tipos de entrada, manda el Prezzo general del evento, como siempre.
export function unitPriceCents(
  eventPrice: string | null | undefined,
  types: TicketType[] | undefined,
  ticketType?: string | null
): number {
  if (types && types.length > 0) {
    const tt = types.find((t) => t.name === ticketType);
    return tt && typeof tt.price === "number" && tt.price > 0 ? Math.round(tt.price * 100) : 0;
  }
  return parsePriceCents(eventPrice);
}

export function getUnitPriceCents(
  event: { price?: string | null; details?: string | null },
  ticketType?: string | null
): number {
  const { types } = decodeTicketTypes(event.details || "");
  return unitPriceCents(event.price, types, ticketType);
}

export function formatEUR(cents: number): string {
  const v = (cents / 100).toFixed(2).replace(/\.00$/, "");
  return `€${v}`;
}
