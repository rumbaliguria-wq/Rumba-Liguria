import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getStripe, getSiteOrigin } from "@/lib/stripe";

// Link de pago personalizado: el admin negoció un precio total (p.ej. un
// descuento por grupo grande) y quiere que ESA persona pague con tarjeta a
// distancia, en vez de cobrarle en efectivo en persona (eso ya lo hace
// "Vendita in Contanti"). Cuando paga de verdad, el webhook de Stripe de
// siempre se encarga de entregar las entradas + factura — acá solo se arma
// la sesión de pago con el total exacto acordado.
export async function POST(req: NextRequest) {
  const { event_id, guest_count, total_price, customer_name, customer_email } = await req.json().catch(() => ({}));

  const count = Number(guest_count);
  const price = Number(total_price);
  const email = String(customer_email || "").trim().toLowerCase();

  if (!event_id) return NextResponse.json({ error: "Evento richiesto" }, { status: 400 });
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    return NextResponse.json({ error: "Quantità non valida" }, { status: 400 });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "Prezzo non valido" }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email del cliente richiesta per il link di pagamento" }, { status: 400 });
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

  const totalCents = Math.round(price * 100);
  // Precio por persona, solo para que un reembolso parcial (si algo falla a
  // mitad de pago) reparta el importe de forma razonable.
  const unitCents = Math.max(1, Math.round(totalCents / count));

  const { data: payment, error: insertError } = await supabase
    .from("payments")
    .insert({
      user_email: email,
      items: [{
        event_id,
        guest_count: count,
        unit_cents: unitCents,
        event_title: event.title,
        promo: null,
        admin_override: true,
      }],
      amount_cents: totalCents,
    })
    .select("id")
    .single();
  if (insertError || !payment) {
    return NextResponse.json({ error: "Impossibile creare il pagamento." }, { status: 500 });
  }

  const origin = getSiteOrigin(req);

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: totalCents,
          product_data: {
            name: `${event.title} × ${count}${customer_name ? ` — ${customer_name}` : ""}`,
          },
        },
      }],
      metadata: { payment_id: payment.id },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          custom_fields: [
            { name: "Partita IVA", value: "IT03098620994" },
            { name: "Codice Fiscale", value: "MJLPRR89P17G605A" },
          ],
        },
      },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment=cancelled`,
    });

    await supabase.from("payments").update({ stripe_session_id: session.id }).eq("id", payment.id);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    await supabase.from("payments").delete().eq("id", payment.id);
    console.error("Custom payment link error", err);
    return NextResponse.json({ error: "Impossibile creare il link di pagamento." }, { status: 502 });
  }
}
