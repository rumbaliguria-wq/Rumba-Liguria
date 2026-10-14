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

// Como parsePriceCents, pero para el precio en texto libre de un noleggio
// ("€20/giorno", "50€ al weekend"): toma solo el primer número que encuentra
// y descarta el resto (la unidad es solo informativa para quien lo lee, acá
// no hay reserva por días — se cobra ese monto fijo una vez). Si no hay
// ningún número (p.ej. "Prezzo da concordare"), devuelve 0.
export function parseLeadingPriceCents(raw: string | null | undefined): number {
  if (!raw) return 0;
  const m = raw.match(/(\d+(?:[.,]\d{1,2})?)/);
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

// Promoción opcional por evento, configurable por el admin: "cada X
// entradas, Y salen gratis" (ej. cada 3, 1 gratis = el clásico 3x2; cada 2,
// 1 gratis = compra 1 lleva 2). Se reciben todas las entradas que se
// pidieron — cada una con su propio QR — pero se cobran menos.
export interface PromoConfig {
  group: number; // cada cuántas entradas
  free: number;  // cuántas de ese grupo son gratis
}

export function isValidPromo(promo: PromoConfig | null | undefined): promo is PromoConfig {
  return !!promo && Number.isInteger(promo.group) && Number.isInteger(promo.free)
    && promo.group >= 2 && promo.free >= 1 && promo.free < promo.group;
}

export function lineTotalCents(unitCents: number, count: number, promo: PromoConfig | null | undefined): number {
  if (unitCents <= 0 || count <= 0) return 0;
  if (!isValidPromo(promo)) return unitCents * count;
  const payableCount = count - Math.floor(count / promo.group) * promo.free;
  return unitCents * payableCount;
}

// Tarifa estándar de Stripe para tarjetas europeas (1,5% + 0,25€). Las
// tarjetas no-UE o Amex cobran distinto, pero como no se sabe el tipo de
// tarjeta ANTES de cobrar, se usa esta como referencia — es la que aplica a
// la gran mayoría de clientes de Rumba Liguria.
const STRIPE_FEE_RATE = 0.015;
const STRIPE_FEE_FIXED_CENTS = 25;

// Cuánto hay que cobrarle al comprador para que, después de que Stripe se
// quede con su comisión, el organizador reciba exactamente `netCents`.
export function grossUpForStripeFee(netCents: number): number {
  if (netCents <= 0) return 0;
  return Math.ceil((netCents + STRIPE_FEE_FIXED_CENTS) / (1 - STRIPE_FEE_RATE));
}

// Inversa: dado lo que se le cobra al comprador, cuánto neto le queda al
// organizador — solo para mostrarlo en el form de admin al editar un
// biglietto que ya tenía la comisión trasladada.
export function netFromGrossStripeFee(grossCents: number): number {
  if (grossCents <= 0) return 0;
  return Math.round(grossCents * (1 - STRIPE_FEE_RATE) - STRIPE_FEE_FIXED_CENTS);
}

export function formatEUR(cents: number): string {
  const v = (cents / 100).toFixed(2).replace(/\.00$/, "");
  return `€${v}`;
}
