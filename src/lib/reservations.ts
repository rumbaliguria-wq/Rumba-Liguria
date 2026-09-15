import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { sendEmail, qrTicketHtml } from "@/lib/email";
import { decodePhoneField } from "@/lib/userPhone";
import { getEventExpiryUTC, getSaleCloseUTC } from "@/lib/eventExpiry";
import { decodeSaleConfig } from "@/lib/saleConfig";

// Extraído de api/reservations para poder reutilizar la generación de
// códigos/QR y el envío del email de confirmación desde otros lugares.

function generateCode(): string {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

type EventForValidation = {
  title?: string;
  max_tickets?: number | null;
  max_per_person?: number | null;
  event_date_iso?: string | null;
  details?: string | null;
} | null;

// Mismas reglas para el camino gratis y el de pago: fechas de venta, evento
// vencido y cupo máximo. Devuelve un mensaje de error (string) o null si está
// todo bien.
export async function validateBookingRules(
  supabase: SupabaseClient,
  event: EventForValidation,
  guest_count: number,
  event_id: string,
  user_email?: string
): Promise<string | null> {
  const eventDateIso = event?.event_date_iso;

  // Un mismo email no puede reservar dos veces para el mismo evento — no
  // importa si la primera vez fue por la página normal o por un link de
  // RR.PP. distinto. Si esa reserva anterior fue cancelada, no cuenta.
  if (user_email) {
    const { data: already } = await supabase
      .from("reservations")
      .select("id")
      .eq("event_id", event_id)
      .eq("user_email", user_email)
      .in("status", ["active", "used"])
      .limit(1)
      .maybeSingle();
    if (already) {
      return "Hai già una prenotazione per questo evento.";
    }
  }

  if (eventDateIso && Date.now() > getEventExpiryUTC(eventDateIso)) {
    return "Le prenotazioni per questo evento sono chiuse.";
  }
  if (eventDateIso && Date.now() >= getSaleCloseUTC(eventDateIso)) {
    return "Le prenotazioni per questo evento sono chiuse.";
  }

  const { sale_start, sale_end } = decodeSaleConfig(event?.details || "");
  if (sale_start && Date.now() < new Date(sale_start).getTime()) {
    return "Le prenotazioni non sono ancora aperte.";
  }
  if (sale_end && Date.now() > new Date(sale_end).getTime()) {
    return "Le prenotazioni per questo evento sono chiuse.";
  }

  if (event?.max_per_person && guest_count > event.max_per_person) {
    return `Puoi prenotare al massimo ${event.max_per_person} ${event.max_per_person === 1 ? "persona" : "persone"} per questa prenotazione.`;
  }

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
        return "SOLD OUT — I biglietti sono esauriti. Scrivici su WhatsApp per info sulla lista d'attesa.";
      }
      return `Rimangono solo ${remaining} ${remaining === 1 ? "posto" : "posti"} disponibili.`;
    }
  }

  return null;
}

export async function createReservationsAndNotify({
  supabase,
  event_id,
  eventTitle,
  user_email,
  userPhone,
  guest_count,
  ticket_type,
  referral,
  origin,
}: {
  supabase: SupabaseClient;
  event_id: string;
  eventTitle?: string;
  user_email: string;
  userPhone?: string | null;
  guest_count: number;
  ticket_type?: string;
  referral?: string;
  origin: string;
}) {
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
    const decoded = decodePhoneField(userPhone ?? null);
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
      status: "active",
    });
  }

  const { data, error } = await supabase
    .from("reservations")
    .insert(ticketsToCreate)
    .select();

  if (error) throw error;

  const tickets = codes.map(code => {
    const verifyUrl = `${origin}/verify/${code}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(verifyUrl)}`;
    return { code, verifyUrl, qrImageUrl };
  });

  sendEmail({
    to: user_email,
    subject: `🎟️ La tua prenotazione per ${eventTitle || "l'evento"}`,
    html: qrTicketHtml({
      eventTitle: eventTitle || "Evento Rumba Liguria",
      userEmail: user_email,
      guestCount: guest_count,
      tickets,
    }),
  }).catch(() => {/* ignore email errors */});

  return data;
}
