import { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { createReservationsAndNotify, validateBookingRules } from "@/lib/reservations";
import { decodeTicketTypes } from "@/lib/ticketTypes";
import { getUnitPriceCents, lineTotalCents } from "@/lib/pricing";
import { decodeSaleConfig } from "@/lib/saleConfig";

export interface CartItem {
  event_id: string;
  ticket_type?: string;
  guest_count: number;
  referral?: string;
}

export interface PricedItem extends CartItem {
  unit_cents: number;
  event_title: string;
  promo3x2: boolean;
}

export interface TicketResult {
  event_id: string;
  event_title: string;
  ticket_type?: string;
  codes: string[];
}

export interface RejectedResult {
  event_id: string;
  event_title: string;
  reason: string;
  refunded_cents: number;
}

export interface PaymentResult {
  tickets: TicketResult[];
  rejected: RejectedResult[];
}

const MAX_LINES = 10;
const MAX_GUESTS_PER_LINE = 20;

// Valida el carrito con las mismas reglas de siempre (fechas de venta, cupo,
// máximo por persona, un solo pedido por evento y email) y fija el precio
// leyéndolo de la base de datos — el precio que mande el navegador se ignora.
export async function priceCart(
  supabase: SupabaseClient,
  email: string,
  items: CartItem[]
): Promise<{ ok: true; lines: PricedItem[]; totalCents: number } | { ok: false; error: string }> {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "Il carrello è vuoto." };
  if (items.length > MAX_LINES) return { ok: false, error: "Troppi articoli nel carrello." };

  const seen = new Set<string>();
  const lines: PricedItem[] = [];

  for (const raw of items) {
    const guest_count = Number(raw?.guest_count);
    if (!raw?.event_id || !Number.isInteger(guest_count) || guest_count < 1 || guest_count > MAX_GUESTS_PER_LINE) {
      return { ok: false, error: "Articolo non valido." };
    }
    if (seen.has(raw.event_id)) {
      return { ok: false, error: "Puoi prenotare una sola volta per ogni evento." };
    }
    seen.add(raw.event_id);

    const { data: event } = await supabase
      .from("events")
      .select("id, title, price, max_tickets, max_per_person, event_date_iso, details, archived")
      .eq("id", raw.event_id)
      .single();
    if (!event || event.archived) return { ok: false, error: "Evento non disponibile." };

    const { types } = decodeTicketTypes(event.details || "");
    if (types.length > 0 && !types.some((t) => t.name === raw.ticket_type)) {
      return { ok: false, error: `Scegli il tipo di biglietto per "${event.title}".` };
    }

    const unitCents = getUnitPriceCents(event, raw.ticket_type);
    const bookingError = await validateBookingRules(supabase, event, guest_count, event.id, email, unitCents);
    if (bookingError) return { ok: false, error: `${event.title}: ${bookingError}` };

    const promo3x2 = decodeSaleConfig(event.details || "").promo3x2;
    lines.push({
      event_id: event.id,
      ticket_type: raw.ticket_type || undefined,
      guest_count,
      referral: raw.referral || undefined,
      unit_cents: unitCents,
      event_title: event.title,
      promo3x2,
    });
  }

  const totalCents = lines.reduce((s, l) => s + lineTotalCents(l.unit_cents, l.guest_count, l.promo3x2), 0);
  return { ok: true, lines, totalCents };
}

// Crea las reservas (con QR y correo) de cada línea. Si una línea ya no se
// puede confirmar (agotada mientras se pagaba), no se entrega y se devuelve
// su importe para reembolsarlo.
export async function fulfillItems(
  supabase: SupabaseClient,
  email: string,
  items: PricedItem[],
  origin: string
): Promise<PaymentResult> {
  const { data: user } = await supabase.from("users").select("phone").eq("email", email).single();
  const result: PaymentResult = { tickets: [], rejected: [] };

  for (const line of items) {
    try {
      const { data: event } = await supabase
        .from("events")
        .select("title, max_tickets, max_per_person, event_date_iso, details")
        .eq("id", line.event_id)
        .single();
      const bookingError = await validateBookingRules(supabase, event, line.guest_count, line.event_id, email, line.unit_cents);
      if (bookingError) throw new Error(bookingError);

      const rows = await createReservationsAndNotify({
        supabase,
        event_id: line.event_id,
        eventTitle: line.event_title,
        user_email: email,
        userPhone: (user as { phone?: string } | null)?.phone,
        guest_count: line.guest_count,
        ticket_type: line.ticket_type,
        referral: line.referral,
        origin,
      });
      result.tickets.push({
        event_id: line.event_id,
        event_title: line.event_title,
        ticket_type: line.ticket_type,
        codes: (rows || []).map((r: { code: string }) => r.code),
      });
    } catch (err) {
      result.rejected.push({
        event_id: line.event_id,
        event_title: line.event_title,
        reason: err instanceof Error ? err.message : "Errore",
        refunded_cents: lineTotalCents(line.unit_cents, line.guest_count, line.promo3x2),
      });
    }
  }
  return result;
}

export type FulfillOutcome =
  | { status: "unpaid" }
  | { status: "processing" }
  | { status: "paid" | "refunded" | "partially_refunded"; result: PaymentResult };

// Idempotente: la web (página de éxito) y el webhook de Stripe pueden llamarla
// a la vez; sólo el que logre pasar el pago de "pending" a "paid" entrega las
// entradas, el otro recibe el resultado ya guardado.
export async function fulfillPaidSession(sessionId: string, origin: string): Promise<FulfillOutcome> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") return { status: "unpaid" };

  const supabase = getServiceClient();
  const { data: claimed } = await supabase
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("stripe_session_id", sessionId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (!claimed) {
    const { data: existing } = await supabase
      .from("payments")
      .select("status, result")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (!existing || !existing.result) return { status: "processing" };
    return { status: existing.status, result: existing.result } as FulfillOutcome;
  }

  const result = await fulfillItems(supabase, claimed.user_email, claimed.items as PricedItem[], origin);

  const refundCents = result.rejected.reduce((s, r) => s + r.refunded_cents, 0);
  let status: "paid" | "refunded" | "partially_refunded" = "paid";
  if (refundCents > 0) {
    try {
      const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (pi) await stripe.refunds.create({ payment_intent: pi, amount: refundCents });
      status = result.tickets.length === 0 ? "refunded" : "partially_refunded";
    } catch (err) {
      console.error("Stripe refund failed", sessionId, err);
    }
  }

  await supabase
    .from("payments")
    .update({ status, result, refunded_cents: status === "paid" ? 0 : refundCents })
    .eq("id", claimed.id);

  return { status, result };
}
