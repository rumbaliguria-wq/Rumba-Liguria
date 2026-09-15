import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { createReservationsAndNotify, validateBookingRules } from "@/lib/reservations";

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
    supabase.from("events").select("title, max_tickets, max_per_person, event_date_iso, details").eq("id", event_id).single(),
  ]);

  const bookingError = await validateBookingRules(supabase, event, guest_count, event_id, user_email);
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
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore" }, { status: 500 });
  }
}
