import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getEventExpiryUTC } from "@/lib/eventExpiry";
import crypto from "crypto";

// No hay sesión: cada pedido (login y cada escaneo) manda de nuevo nombre +
// PIN y se valida en el momento — igual que /api/rrpp y /api/colaborador.
async function checkPass(supabase: ReturnType<typeof getServiceClient>, name: string, pin: string) {
  const { data: pass } = await supabase
    .from("door_passes")
    .select("id, name, active, pin, event_id, events(id, title, event_date_iso, archived)")
    .ilike("name", name.trim())
    .maybeSingle();
  if (!pass || !pass.active || pass.pin !== pin.trim()) return null;
  return pass;
}

function isExpired(eventDateIso: string | null | undefined): boolean {
  return !!eventDateIso && Date.now() > getEventExpiryUTC(eventDateIso);
}

// POST: sin `code` es solo el login (pantalla de PIN); con `code` es el
// escaneo de un ticket. El acceso deja de servir solo cuando termina la
// fiesta de su evento (misma regla de siempre en toda la app).
export async function POST(req: NextRequest) {
  const { name, pin, code } = await req.json().catch(() => ({}));
  if (!name?.trim() || !pin?.trim()) {
    return NextResponse.json({ error: "Nome e PIN richiesti" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const pass = await checkPass(supabase, name, pin);
  if (!pass) return NextResponse.json({ error: "Link o PIN non corretti" }, { status: 401 });

  const event = pass.events as unknown as { id: string; title: string; event_date_iso: string | null; archived: boolean } | null;
  if (!event) return NextResponse.json({ error: "Nessun evento assegnato a questo accesso" }, { status: 404 });
  if (isExpired(event.event_date_iso)) {
    return NextResponse.json({ error: "expired", event_title: event.title }, { status: 410 });
  }

  const { count: checkedInCount } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("status", "used");

  if (!code?.trim()) {
    // Solo login: confirma que el link/PIN sirven y muestra el evento + contador.
    return NextResponse.json({ ok: true, event_title: event.title, checked_in_count: checkedInCount ?? 0 });
  }

  const cleanCode = code.trim().toUpperCase();

  // Codice Gruppo: un solo QR que vale para muchas personas en este evento.
  if (cleanCode.startsWith("GROUP-")) {
    const { data: pass } = await supabase
      .from("group_passes")
      .select("id, label, max_entries, event_id")
      .eq("code", cleanCode)
      .maybeSingle();
    if (!pass) return NextResponse.json({ error: "Codice non trovato" }, { status: 404 });
    if (pass.event_id !== event.id) {
      const { data: otherEvent } = await supabase.from("events").select("title").eq("id", pass.event_id).maybeSingle();
      return NextResponse.json({ error: `Codice di un altro evento (${otherEvent?.title || "sconosciuto"})` }, { status: 400 });
    }

    const { count: groupCount } = await supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("group_pass_id", pass.id);
    const entriesCount = groupCount || 0;
    if (pass.max_entries !== null && entriesCount >= pass.max_entries) {
      return NextResponse.json({ error: `Cupo esaurito (${entriesCount}/${pass.max_entries})` }, { status: 400 });
    }

    const { error: insertError } = await supabase.from("reservations").insert({
      code: `GE-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
      event_id: pass.event_id,
      user_email: "__group__",
      user_name: `${pass.label || "Gruppo"} [grupo]`,
      guest_count: 1,
      status: "used",
      checked_in_at: new Date().toISOString(),
      group_pass_id: pass.id,
    });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    const newCount = entriesCount + 1;
    const cap = pass.max_entries ? `${newCount}/${pass.max_entries}` : `${newCount}`;
    return NextResponse.json({
      valid: true,
      already_used: false,
      name: `👥 ${pass.label || "Gruppo"} (${cap})`,
      guest_count: 1,
      checked_in_count: (checkedInCount ?? 0) + 1,
    });
  }

  const { data: reservation } = await supabase
    .from("reservations")
    .select("id, status, event_id, user_name, guest_count")
    .or(`code.eq.${cleanCode},code.eq.${cleanCode.toUpperCase()}`)
    .maybeSingle();

  if (!reservation) return NextResponse.json({ error: "Ticket non trovato" }, { status: 404 });
  if (reservation.event_id !== event.id) {
    const { data: otherEvent } = await supabase.from("events").select("title").eq("id", reservation.event_id).maybeSingle();
    return NextResponse.json({ error: `Ticket di un altro evento (${otherEvent?.title || "sconosciuto"})` }, { status: 400 });
  }
  if (reservation.status === "cancelled") return NextResponse.json({ error: "Prenotazione cancellata" }, { status: 400 });
  if (reservation.status === "used") {
    return NextResponse.json({
      valid: false,
      already_used: true,
      name: (reservation.user_name || "").replace(/\s*\[(ref|tipo|cash):[^\]]+\]/g, "").trim() || "—",
      guest_count: reservation.guest_count,
      checked_in_count: checkedInCount ?? 0,
    });
  }

  const { error: updateError } = await supabase
    .from("reservations")
    .update({ status: "used", checked_in_at: new Date().toISOString() })
    .eq("id", reservation.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({
    valid: true,
    already_used: false,
    name: (reservation.user_name || "").replace(/\s*\[(ref|tipo|cash):[^\]]+\]/g, "").trim() || "—",
    guest_count: reservation.guest_count,
    checked_in_count: (checkedInCount ?? 0) + 1,
  });
}
