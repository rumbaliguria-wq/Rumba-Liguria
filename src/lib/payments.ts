import { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { createReservationsAndNotify, validateBookingRules } from "@/lib/reservations";
import { decodeTicketTypes, isQrSafeColor } from "@/lib/ticketTypes";
import { getUnitPriceCents, lineTotalCents, getFeeCents, type PromoConfig } from "@/lib/pricing";
import { decodeSaleConfig } from "@/lib/saleConfig";
import { sendEmail, rentalPaymentHtml } from "@/lib/email";

export interface CartItem {
  event_id: string;
  ticket_type?: string;
  guest_count: number;
  referral?: string;
}

export interface PricedItem extends CartItem {
  unit_cents: number;
  // Comisión de Stripe por persona, SOLO cuando el tipo de biglietto tiene
  // "il cliente paga anche la commissione" activado — se cobra como línea
  // aparte ("Servizio") recién al armar la sesión de Stripe, nunca se suma
  // a `unit_cents` ni se muestra en el sitio.
  fee_cents?: number;
  // Términos y condiciones del tipo de biglietto (si tiene) — el cliente ya
  // los aceptó en el Carrello; acá se arrastran solo para poder mandarlos
  // también a la propia página de pago de Stripe y a la factura.
  terms?: string;
  event_title: string;
  promo: PromoConfig | null;
  // Link de pago personalizado generado por el admin (venta de grupo
  // negociada): igual que "Vendita in Contanti", no pasa por las reglas de
  // venta pública (cupo por persona, ventana de venta, etc.) — ya lo decidió
  // el admin a mano.
  admin_override?: boolean;
}

export interface TicketResult {
  event_id: string;
  event_title: string;
  ticket_type?: string;
  ticket_color?: string;
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
    const matchedType = types.find((t) => t.name === raw.ticket_type) || null;
    const bookingError = await validateBookingRules(supabase, event, guest_count, event.id, email, unitCents, matchedType);
    if (bookingError) return { ok: false, error: `${event.title}: ${bookingError}` };

    const eventConfig = decodeSaleConfig(event.details || "");
    const promo: PromoConfig | null = eventConfig.promo_group && eventConfig.promo_free
      ? { group: eventConfig.promo_group, free: eventConfig.promo_free }
      : null;
    lines.push({
      event_id: event.id,
      ticket_type: raw.ticket_type || undefined,
      guest_count,
      referral: raw.referral || undefined,
      unit_cents: unitCents,
      fee_cents: getFeeCents(unitCents, matchedType?.feesToBuyer),
      terms: matchedType?.terms || undefined,
      event_title: event.title,
      promo,
    });
  }

  const totalCents = lines.reduce((s, l) =>
    s + lineTotalCents(l.unit_cents, l.guest_count, l.promo) + lineTotalCents(l.fee_cents || 0, l.guest_count, l.promo)
  , 0);
  return { ok: true, lines, totalCents };
}

// Crea las reservas (con QR y correo) de cada línea. Si una línea ya no se
// puede confirmar (agotada mientras se pagaba), no se entrega y se devuelve
// su importe para reembolsarlo.
export async function fulfillItems(
  supabase: SupabaseClient,
  email: string,
  items: PricedItem[],
  origin: string,
  invoiceUrl?: string | null
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
      const { types } = decodeTicketTypes(event?.details || "");
      const matchedType = types.find((t) => t.name === line.ticket_type) || null;
      if (!line.admin_override) {
        const bookingError = await validateBookingRules(supabase, event, line.guest_count, line.event_id, email, line.unit_cents, matchedType);
        if (bookingError) throw new Error(bookingError);
      }

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
        invoiceUrl,
        ticketColor: matchedType?.color,
      });
      result.tickets.push({
        event_id: line.event_id,
        event_title: line.event_title,
        ticket_type: line.ticket_type,
        ticket_color: isQrSafeColor(matchedType?.color) ? matchedType?.color : undefined,
        codes: (rows || []).map((r: { code: string }) => r.code),
      });
    } catch (err) {
      result.rejected.push({
        event_id: line.event_id,
        event_title: line.event_title,
        reason: err instanceof Error ? err.message : "Errore",
        refunded_cents: lineTotalCents(line.unit_cents, line.guest_count, line.promo) + lineTotalCents(line.fee_cents || 0, line.guest_count, line.promo),
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
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["invoice"] });
  if (session.payment_status !== "paid") return { status: "unpaid" };
  const invoice = session.invoice && typeof session.invoice !== "string" ? session.invoice : null;

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

  const result = await fulfillItems(supabase, claimed.user_email, claimed.items as PricedItem[], origin, invoice?.hosted_invoice_url);

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

// Link de pago para un noleggio (alquiler de un equipo): no genera entradas
// ni toca la tabla "payments" — Stripe ya es el registro del cobro. Solo
// manda un email simple con el link de la factura. La idempotencia (no
// mandar el correo dos veces si el webhook y la página de éxito llaman a la
// vez) se guarda en los propios metadata de la sesión de Stripe.
export async function fulfillRentalSession(sessionId: string): Promise<{ status: "unpaid" | "paid" }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["invoice"] });
  if (session.payment_status !== "paid") return { status: "unpaid" };
  if (session.metadata?.email_sent === "true") return { status: "paid" };

  const invoice = session.invoice && typeof session.invoice !== "string" ? session.invoice : null;
  const email = session.customer_details?.email || session.customer_email;
  if (email) {
    await sendEmail({
      to: email,
      subject: `✅ Pagamento confermato — Noleggio ${session.metadata?.item_name || "attrezzatura"}`,
      html: rentalPaymentHtml({
        itemName: session.metadata?.item_name || "Attrezzatura",
        customerName: session.metadata?.customer_name || undefined,
        amountCents: session.amount_total || 0,
        invoiceUrl: invoice?.hosted_invoice_url || null,
      }),
    }).catch(() => {/* ignore email errors */});
  }

  await stripe.checkout.sessions.update(sessionId, {
    metadata: { ...session.metadata, email_sent: "true" },
  });

  return { status: "paid" };
}
