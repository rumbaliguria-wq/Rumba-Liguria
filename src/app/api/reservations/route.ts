import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { createReservationsAndNotify, validateBookingRules } from "@/lib/reservations";
import { getUnitPriceCents } from "@/lib/pricing";
import { decodeTicketTypes } from "@/lib/ticketTypes";

export async function GET() {
  const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("reservations")
      .select("*, events(title, event_date_iso, archived)")
      .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const { event_id, user_email, guest_count, ticket_type, referral } = await req.json();

  if (!event_id || !user_email || !guest_count) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Get user name and event info in parallel
  const [{ data: user }, { data: event }] = await Promise.all([
    supabase.from("users").select("phone").eq("email", user_email).single(),
    supabase.from("events").select("title, price, max_tickets, max_per_person, event_date_iso, details").eq("id", event_id).single(),
  ]);

  // Los eventos/tipos con precio solo se compran por el carrito (Stripe).
  const unitCents = event ? getUnitPriceCents(event, ticket_type) : 0;
  if (unitCents > 0) {
    return NextResponse.json({ error: "Questo biglietto è a pagamento: aggiungilo al carrello." }, { status: 402 });
  }

  const { types } = decodeTicketTypes(event?.details || "");
  const matchedType = types.find((t) => t.name === ticket_type) || null;
  const bookingError = await validateBookingRules(supabase, event, guest_count, event_id, user_email, unitCents, matchedType);
  if (bookingError) {
    return NextResponse.json({ error: bookingError }, { status: 400 });
  }

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://rumbaliguria.com";

  try {
    const data = await createReservationsAndNotify({
      supabase,
      event_id,
      eventTitle: event?.title,
      user_email,
      userPhone: (user as { phone?: string } | null)?.phone,
      guest_count,
      ticket_type,
      referral,
      origin,
      ticketColor: matchedType?.color,
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore" }, { status: 500 });
  }
}
