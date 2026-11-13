import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { sendEmail, prizeNotificationHtml } from "@/lib/email";
import { decodePhoneField } from "@/lib/userPhone";

// Premio por evento: el admin elige a alguien de su lista de Utenti (ya
// registrado o con tessera) y le asigna un regalo para un evento puntual —
// no hace falta que esa persona ya haya reservado para esa fiesta. Queda
// guardado por email; se "entrega" solo cuando se la escanea (QR o tessera)
// en ese mismo evento — ver /api/admin/prizes/match.
export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const eventId = req.nextUrl.searchParams.get("event_id");

  let query = supabase
    .from("prizes")
    .select("*, events(title)")
    .order("created_at", { ascending: false });
  if (eventId) query = query.eq("event_id", eventId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const { event_id, email, description, photo_url, expires_at } = await req.json().catch(() => ({}));

  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanDescription = String(description || "").trim();
  if (!event_id) return NextResponse.json({ error: "Evento richiesto" }, { status: 400 });
  if (!cleanEmail || !cleanEmail.includes("@")) return NextResponse.json({ error: "Email richiesta" }, { status: 400 });
  if (!cleanDescription) return NextResponse.json({ error: "Descrizione richiesta" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: event } = await supabase.from("events").select("title").eq("id", event_id).single();
  if (!event) return NextResponse.json({ error: "Evento non trovato" }, { status: 404 });

  // Si no se pone una fecha a mano, caduca a las 24 horas de creado.
  const expiresAtIso = expires_at ? new Date(expires_at).toISOString() : new Date(Date.now() + DEFAULT_EXPIRY_MS).toISOString();

  const { data: prize, error } = await supabase
    .from("prizes")
    .insert({ event_id, email: cleanEmail, description: cleanDescription, photo_url: photo_url || null, expires_at: expiresAtIso })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const expiresLabel = new Date(expiresAtIso).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });

  // Email automático — no requiere ninguna acción más del admin.
  try {
    await sendEmail({
      to: cleanEmail,
      subject: `🎁 Hai vinto un regalo per ${event.title}`,
      html: prizeNotificationHtml({ eventTitle: event.title, description: cleanDescription, photoUrl: photo_url || null, expiresLabel }),
    });
  } catch (err) {
    console.error("Prize email error", err);
  }

  // El teléfono lo arma el frontend en un link de WhatsApp — se busca
  // primero en Utenti (ya registrado), y si no, en la tessera (alguien que
  // solo tiene tessera guarda su teléfono ahí, no en la cuenta).
  const { data: user } = await supabase.from("users").select("phone").eq("email", cleanEmail).maybeSingle();
  let phone = user?.phone ? decodePhoneField(user.phone).phone : null;
  if (!phone) {
    const { data: card } = await supabase.from("client_cards").select("phone").eq("email", cleanEmail).maybeSingle();
    phone = card?.phone || null;
  }

  return NextResponse.json({ ...prize, event_title: event.title, phone });
}
