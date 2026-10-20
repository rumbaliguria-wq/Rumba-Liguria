import { NextRequest, NextResponse } from "next/server";
import { getStripe, getSiteOrigin } from "@/lib/stripe";
import { getFeeCents } from "@/lib/pricing";

// Link de pago para un noleggio (alquiler de un parlante, etc.): el admin
// acordó un precio con el cliente de la discoteca y le manda este link para
// que pague con tarjeta a distancia. No hay entrada/QR que entregar — solo
// la factura con los datos fiscales, igual que en "Vendita in Contanti".
export async function POST(req: NextRequest) {
  const { item_name, total_price, customer_name, customer_email, fees_to_buyer } = await req.json().catch(() => ({}));

  const name = String(item_name || "").trim();
  const price = Number(total_price);
  const email = String(customer_email || "").trim().toLowerCase();

  if (!name) return NextResponse.json({ error: "Nome attrezzatura richiesto" }, { status: 400 });
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "Prezzo non valido" }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email del cliente richiesta per il link di pagamento" }, { status: 400 });
  }

  const totalCents = Math.round(price * 100);
  // Si el admin eligió que la comisión la pague el cliente, se cobra como
  // línea "Servizio" aparte — el precio acordado (totalCents) es siempre lo
  // que termina recibiendo el negocio, igual que con los biglietti del sitio.
  const feeCents = getFeeCents(totalCents, !!fees_to_buyer);
  const origin = getSiteOrigin(req);

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: totalCents,
            product_data: {
              name: `Noleggio: ${name}${customer_name ? ` — ${customer_name}` : ""}`,
            },
          },
        },
        ...(feeCents > 0 ? [{
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: feeCents,
            product_data: { name: "Servizio" },
          },
        }] : []),
      ],
      metadata: { kind: "rental", item_name: name, customer_name: customer_name || "" },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          custom_fields: [
            { name: "Partita IVA", value: "IT03098620994" },
            { name: "Codice Fiscale", value: "MJLPRR89P17G605A" },
          ],
        },
      },
      success_url: `${origin}/payment/rental-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Rental payment link error", err);
    return NextResponse.json({ error: "Impossibile creare il link di pagamento." }, { status: 502 });
  }
}
