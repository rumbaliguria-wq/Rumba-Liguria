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

  // Términos y condiciones del/los tipo/s de biglietto en el carrito (si
  // tienen) — ya se aceptaron con la casilla obligatoria en el Carrello;
  // esto los manda también a la propia página de pago de Stripe (casilla
  // nativa) y un pedacito queda al pie de la factura.
  const termsList = [...new Set(priced.lines.map((l) => l.terms).filter((t): t is string => !!t))];
  const termsText = termsList.join(" · ").slice(0, 1200);

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
      // el total final a cobrar por ese evento. Si el tipo de biglietto tiene
      // la comisión a cargo del comprador, se agrega como línea "Servizio"
      // aparte — en el sitio siempre se vio solo el precio limpio, esto es
      // lo único que lo desglosa, y recién acá en Stripe.
      line_items: priced.lines
        .filter((l) => l.unit_cents > 0)
        .flatMap((l) => {
          const name = `${l.ticket_type ? `${l.event_title} — ${l.ticket_type}` : l.event_title} × ${l.guest_count}${l.promo ? ` (promo ${l.promo.group}x${l.promo.group - l.promo.free})` : ""}`;
          const items = [{
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: lineTotalCents(l.unit_cents, l.guest_count, l.promo),
              product_data: { name },
            },
          }];
          const feeTotal = lineTotalCents(l.fee_cents || 0, l.guest_count, l.promo);
          if (feeTotal > 0) {
            items.push({
              quantity: 1,
              price_data: {
                currency: "eur",
                unit_amount: feeTotal,
                product_data: { name: "Servizio" },
              },
            });
          }
          return items;
        }),
      metadata: { payment_id: payment.id },
      ...(termsText ? {
        consent_collection: { terms_of_service: "required" as const },
        custom_text: { terms_of_service_acceptance: { message: termsText } },
      } : {}),
      // Genera un recibo/factura en PDF por cada pago. Las plantillas que se
      // arman en el Dashboard de Stripe no se aplican acá (son solo para
      // facturas creadas a mano ahí), así que los datos fiscales van directo
      // en el código.
      invoice_creation: {
        enabled: true,
        invoice_data: {
          custom_fields: [
            { name: "Partita IVA", value: "IT03098620994" },
            { name: "Codice Fiscale", value: "MJLPRR89P17G605A" },
            { name: "Codice ATECO", value: "82.30.09" },
          ],
          ...(termsText ? { footer: `Termini e condizioni: ${termsText}`.slice(0, 5000) } : {}),
        },
      },
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
