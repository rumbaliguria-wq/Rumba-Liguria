import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getStripe, getSiteOrigin } from "@/lib/stripe";
import { fulfillItems, priceCart, type CartItem } from "@/lib/payments";
import { lineTotalCents } from "@/lib/pricing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { email?: string; items?: CartItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Accedi per completare l'acquisto." }, { status: 400 });

  const supabase = getServiceClient();
  const { data: user } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (!user) return NextResponse.json({ error: "Accedi per completare l'acquisto." }, { status: 401 });

  const priced = await priceCart(supabase, email, body.items || []);
  if (!priced.ok) return NextResponse.json({ error: priced.error }, { status: 400 });

  const origin = getSiteOrigin(req);

  // Carrito 100 % gratis: no hace falta pasar por Stripe.
  if (priced.totalCents === 0) {
    const result = await fulfillItems(supabase, email, priced.lines, origin);
    return NextResponse.json({ free: true, result });
  }

  const { data: payment, error: insertError } = await supabase
    .from("payments")
    .insert({ user_email: email, items: priced.lines, amount_cents: priced.totalCents })
    .select("id")
    .single();
  if (insertError || !payment) {
    return NextResponse.json({ error: "Impossibile avviare il pagamento." }, { status: 500 });
  }

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      // El importe ya viene con el descuento del 3x2 aplicado (si corresponde)
      // metido en una sola línea — Stripe no sabe nada de la promo, solo ve
      // el total final a cobrar por ese evento.
      line_items: priced.lines
        .filter((l) => l.unit_cents > 0)
        .map((l) => ({
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: lineTotalCents(l.unit_cents, l.guest_count, l.promo),
            product_data: {
              name: `${l.ticket_type ? `${l.event_title} — ${l.ticket_type}` : l.event_title} × ${l.guest_count}${l.promo ? ` (promo ${l.promo.group}x${l.promo.group - l.promo.free})` : ""}`,
            },
          },
        })),
      metadata: { payment_id: payment.id },
      // Genera un recibo/factura en PDF por cada pago, con los datos del
      // negocio que se configuren en Stripe (Ajustes → Facturas).
      invoice_creation: { enabled: true },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment=cancelled`,
    });

    await supabase.from("payments").update({ stripe_session_id: session.id }).eq("id", payment.id);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    await supabase.from("payments").delete().eq("id", payment.id);
    console.error("Stripe session error", err);
    return NextResponse.json({ error: "Impossibile avviare il pagamento. Riprova." }, { status: 502 });
  }
}
