import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getSiteOrigin } from "@/lib/stripe";
import { getServiceClient } from "@/lib/supabase";
import { fulfillPaidSession } from "@/lib/payments";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Webhook non configurato" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: "Firma non valida" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      await fulfillPaidSession(session.id, getSiteOrigin(req));
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      await getServiceClient()
        .from("payments")
        .update({ status: "expired" })
        .eq("stripe_session_id", session.id)
        .eq("status", "pending");
    }
  } catch (err) {
    console.error("Stripe webhook error", err);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
