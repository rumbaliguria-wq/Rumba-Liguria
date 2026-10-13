import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { decodeRentalConfig } from "@/lib/rentalConfig";
import { parseLeadingPriceCents } from "@/lib/pricing";
import { getStripe, getSiteOrigin } from "@/lib/stripe";

// Público: un cliente del sitio paga online el alquiler de una macchina ya
// listada (precio fijo que puso el admin), sin pasar por WhatsApp/email
// primero. Mismo circuito de factura + email de confirmación que el link
// que genera el admin a mano (ver /api/admin/rental-payment-link).
export async function POST(req: NextRequest) {
  const { item_id } = await req.json().catch(() => ({}));
  if (!item_id) return NextResponse.json({ error: "Attrezzatura richiesta" }, { status: 400 });

  const supabase = getServiceClient();
  const { data } = await supabase.from("admin_settings").select("accent_color").eq("id", 1).single();
  const { rental } = decodeRentalConfig(data?.accent_color || "");

  const item = rental.items.find((i) => i.id === item_id);
  if (!item || item.archived || !item.available) {
    return NextResponse.json({ error: "Attrezzatura non disponibile" }, { status: 404 });
  }

  const totalCents = parseLeadingPriceCents(item.price);
  if (totalCents <= 0) {
    return NextResponse.json({ error: "Prezzo non disponibile per il pagamento online" }, { status: 400 });
  }

  const origin = getSiteOrigin(req);

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: totalCents,
          product_data: { name: `Noleggio: ${item.name}` },
        },
      }],
      metadata: { kind: "rental", item_name: item.name, customer_name: "" },
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
    console.error("Rental public pay error", err);
    return NextResponse.json({ error: "Impossibile avviare il pagamento." }, { status: 502 });
  }
}
