import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { sendEmail, qrTicketHtml } from "@/lib/email";
import crypto from "crypto";
import { getEventExpiryUTC, getSaleCloseUTC } from "@/lib/eventExpiry";
import { decodeSaleConfig } from "@/lib/saleConfig";
import { decodePhoneField } from "@/lib/userPhone";

function generateCode(): string {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

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

  const eventDateIso = (event as { event_date_iso?: string } | null)?.event_date_iso;

  // Block reservation if event has fully expired (next day 05:00 Rome time)
  if (eventDateIso && Date.now() > getEventExpiryUTC(eventDateIso)) {
    return NextResponse.json({ error: "Le prenotazioni per questo evento sono chiuse." }, { status: 400 });
  }

  // Block reservation if sales closed at midnight after the event (00:00 Rome next day)
  if (eventDateIso && Date.now() >= getSaleCloseUTC(eventDateIso)) {
    return NextResponse.json({ error: "Le prenotazioni per questo evento sono chiuse." }, { status: 400 });
  }

  // Check sale_start / sale_end from encoded details
  const { sale_start, sale_end } = decodeSaleConfig((event as { details?: string } | null)?.details || "");
  if (sale_start && Date.now() < new Date(sale_start).getTime()) {
    return NextResponse.json({ error: "Le prenotazioni non sono ancora aperte." }, { status: 400 });
  }
  if (sale_end && Date.now() > new Date(sale_end).getTime()) {
    return NextResponse.json({ error: "Le prenotazioni per questo evento sono chiuse." }, { status: 400 });
  }

  // Check max_per_person limit
  if (event?.max_per_person && guest_count > event.max_per_person) {
    return NextResponse.json(
      { error: `Puoi prenotare al massimo ${event.max_per_person} ${event.max_per_person === 1 ? "persona" : "persone"} per questa prenotazione.` },
      { status: 400 }
    );
  }

  // Check max_tickets (total sold) limit
  if (event?.max_tickets) {
    const { data: existing } = await supabase
      .from("reservations")
      .select("guest_count")
      .eq("event_id", event_id)
      .in("status", ["active", "used"]);
    const sold = (existing || []).reduce((sum: number, r: { guest_count: number }) => sum + r.guest_count, 0);
    if (sold + guest_count > event.max_tickets) {
      const remaining = event.max_tickets - sold;
      if (remaining <= 0) {
        return NextResponse.json({ error: "SOLD OUT — I biglietti sono esauriti. Scrivici su WhatsApp per info sulla lista d'attesa." }, { status: 400 });
      }
      return NextResponse.json(
        { error: `Rimangono solo ${remaining} ${remaining === 1 ? "posto" : "posti"} disponibili.` },
        { status: 400 }
      );
    }
  }

  // Create multiple individual tickets
  const ticketsToCreate = [];
  const codes: string[] = [];
  
  for (let i = 0; i < guest_count; i++) {
    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await supabase
        .from("reservations")
        .select("id")
        .eq("code", code)
        .single();
      if (!existing) break;
      code = generateCode();
      attempts++;
    }
    
    codes.push(code);
    // Decode name from phone field (new users), fallback to email prefix
    const decoded = decodePhoneField((user as { phone?: string } | null)?.phone ?? null);
    const baseName = decoded.name
      || user_email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    let displayName = baseName;
    if (ticket_type) displayName += ` [tipo:${ticket_type}]`;
    if (referral) displayName += ` [ref:${referral}]`;
    ticketsToCreate.push({
      code,
      event_id,
      user_email,
      user_name: displayName,
      guest_count: 1,
      status: "active"
    });
  }

  const { data, error } = await supabase
    .from("reservations")
    .insert(ticketsToCreate)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send QR email asynchronously (don't block the response)
  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://rumbaliguria.com";
  
  const tickets = codes.map(code => {
    const verifyUrl = `${origin}/verify/${code}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(verifyUrl)}`;
    return { code, verifyUrl, qrImageUrl };
  });

  sendEmail({
    to: user_email,
    subject: `🎟️ La tua prenotazione per ${event?.title || "l'evento"}`,
    html: qrTicketHtml({
      eventTitle: event?.title || "Evento Rumba Liguria",
      userEmail: user_email,
      guestCount: guest_count,
      tickets,
    }),
  }).catch(() => {/* ignore email errors */});

  return NextResponse.json(data);
}
