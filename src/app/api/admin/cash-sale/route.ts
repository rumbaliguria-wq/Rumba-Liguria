import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { createReservationsAndNotify } from "@/lib/reservations";
import { getSiteOrigin } from "@/lib/stripe";
import crypto from "crypto";

// Venta manual en efectivo: el admin ya cobró en persona (a veces con
// descuento) y solo quiere generar las entradas reales — sin pasar por
// Stripe ni por las reglas de venta online (fechas de venta, un solo
// pedido por email). Sí respeta el cupo máximo del evento, porque son
// lugares reales de la fiesta.
export async function POST(req: NextRequest) {
  const { event_id, guest_count, total_price, customer_name, customer_email } = await req.json().catch(() => ({}));

  const count = Number(guest_count);
  const price = Number(total_price);
  if (!event_id) return NextResponse.json({ error: "Evento richiesto" }, { status: 400 });
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    return NextResponse.json({ error: "Quantità non valida" }, { status: 400 });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "Prezzo non valido" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, max_tickets, archived")
    .eq("id", event_id)
    .single();
  if (!event || event.archived) return NextResponse.json({ error: "Evento non disponibile" }, { status: 404 });

  if (event.max_tickets) {
    const { data: existing } = await supabase
      .from("reservations")
      .select("guest_count")
      .eq("event_id", event_id)
      .in("status", ["active", "used"]);
    const sold = (existing || []).reduce((sum: number, r: { guest_count: number }) => sum + r.guest_count, 0);
    if (sold + count > event.max_tickets) {
      const remaining = Math.max(0, event.max_tickets - sold);
      return NextResponse.json({ error: `Rimangono solo ${remaining} posti disponibili.` }, { status: 400 });
    }
  }

  const email = customer_email?.trim() || `contanti-${crypto.randomBytes(4).toString("hex")}@rumbaliguria.local`;
  // Precio por persona, para que sumando las entradas de esta venta se
  // reconstruya el total acordado (18€ / 2 entradas = 9€ cada una, etc.).
  const unitPrice = Math.round((price / count) * 100) / 100;
  const origin = getSiteOrigin(req);

  try {
    const data = await createReservationsAndNotify({
      supabase,
      event_id,
      eventTitle: event.title,
      user_email: email,
      guest_count: count,
      nameOverride: customer_name,
      cashPriceEUR: unitPrice,
      skipEmail: !customer_email?.trim(),
      origin,
    });
    return NextResponse.json({ codes: (data || []).map((r: { code: string }) => ({ code: r.code })), count, total_price: price });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore" }, { status: 500 });
  }
}
