import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getEventExpiryUTC } from "@/lib/eventExpiry";
import crypto from "crypto";

function generateEntryCode(): string {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = getServiceClient();

  // Codice Gruppo: un solo QR que vale para muchas personas — no es una
  // fila de reservations propia, así que se resuelve aparte.
  if (code.startsWith("GROUP-")) {
    const { data: pass } = await supabase
      .from("group_passes")
      .select("id, label, max_entries, event_id, events(title, event_date_iso, archived)")
      .eq("code", code)
      .maybeSingle();
    if (!pass) return NextResponse.json({ error: "Codice gruppo non trovato" }, { status: 404 });

    const event = pass.events as unknown as { title: string; event_date_iso: string | null; archived: boolean } | null;
    if (event?.event_date_iso && Date.now() > getEventExpiryUTC(event.event_date_iso)) {
      return NextResponse.json({ error: "QR scaduto", expired: true }, { status: 400 });
    }

    const { count } = await supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("group_pass_id", pass.id);
    const entriesCount = count || 0;

    if (pass.max_entries !== null && entriesCount >= pass.max_entries) {
      return NextResponse.json({ error: `Cupo esaurito (${entriesCount}/${pass.max_entries})` }, { status: 400 });
    }

    return NextResponse.json({
      is_group: true,
      event_id: pass.event_id,
      events: { title: event?.title },
      group: { label: pass.label || "Gruppo", entries_count: entriesCount, max_entries: pass.max_entries },
    });
  }

  const { data, error } = await supabase
    .from("reservations")
    .select("*, events(title, details, flyer_url, event_date_iso)")
    .eq("code", code)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const isVip = code.startsWith("VIP-");

  return NextResponse.json({
    ...data,
    is_vip: isVip,
    vip_status: isVip ? (data.status === "vip_used" ? "Gia usato" : "Valido") : undefined,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = getServiceClient();

  let toggle = false;
  let restore = false;
  try {
    const body = await req.json();
    if (body?.toggle) toggle = true;
    if (body?.restore) restore = true;
  } catch {}

  // Codice Gruppo: cada confirmación registra UNA entrada nueva (no "usa"
  // un código único de una persona) — se re-chequea el cupo acá adentro
  // por si dos escaneos llegaron casi juntos.
  if (code.startsWith("GROUP-")) {
    const { data: pass } = await supabase
      .from("group_passes")
      .select("id, label, max_entries, event_id, events(event_date_iso)")
      .eq("code", code)
      .maybeSingle();
    if (!pass) return NextResponse.json({ error: "Codice gruppo non trovato" }, { status: 404 });

    const eventDateIso = (pass.events as { event_date_iso?: string } | null)?.event_date_iso;
    if (eventDateIso && Date.now() > getEventExpiryUTC(eventDateIso)) {
      return NextResponse.json({ error: "QR scaduto", expired: true }, { status: 400 });
    }

    const { count } = await supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("group_pass_id", pass.id);
    const entriesCount = count || 0;
    if (pass.max_entries !== null && entriesCount >= pass.max_entries) {
      return NextResponse.json({ error: `Cupo esaurito (${entriesCount}/${pass.max_entries})` }, { status: 400 });
    }

    const { error: insertError } = await supabase.from("reservations").insert({
      code: `GE-${generateEntryCode()}`,
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
    return NextResponse.json({
      success: true,
      is_group: true,
      group: { label: pass.label || "Gruppo", entries_count: newCount, max_entries: pass.max_entries },
    });
  }

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code);

  const query = supabase.from("reservations").select("id, status, code, events(event_date_iso)");
  const { data: reservation } = await (isUUID
    ? query.or(`id.eq.${code},code.eq.${code}`).single()
    : query.eq("code", code).single()) as { data: { id: string; status: string; code: string; events?: { event_date_iso?: string } | null } | null };

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  // Restore mode: cancelled → active
  if (restore) {
    if (reservation.status !== "cancelled") {
      return NextResponse.json({ error: "Non cancellata" }, { status: 400 });
    }
    const { error } = await supabase
      .from("reservations")
      .update({ status: "active" })
      .eq("id", reservation.id);
    if (error) return NextResponse.json({ error: "Failed to restore" }, { status: 500 });
    return NextResponse.json({ success: true, newStatus: "active" });
  }

  if (reservation.status === "cancelled") {
    return NextResponse.json({ error: "Prenotazione cancellata" }, { status: 400 });
  }

  // Check expiry: next day after event at 05:00 Rome time
  // e.g. Wednesday event → Thursday 05:00 Rome time reservations expire
  const eventDateIso = (reservation.events as { event_date_iso?: string } | null)?.event_date_iso;
  if (eventDateIso && Date.now() > getEventExpiryUTC(eventDateIso)) {
    return NextResponse.json({ error: "QR scaduto", expired: true }, { status: 400 });
  }

  // VIP code: detect by prefix, use "used" status (only allowed status available)
  const isVipCode = code.startsWith("VIP-") || reservation.code?.startsWith("VIP-");
  if (isVipCode) {
    if (reservation.status === "used") {
      return NextResponse.json({ error: "VIP già utilizzato" }, { status: 400 });
    }
    const { error } = await supabase
      .from("reservations")
      .update({ status: "used", checked_in_at: new Date().toISOString() })
      .eq("id", reservation.id);
    if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    return NextResponse.json({ success: true, newStatus: "used", is_vip: true });
  }

  // Toggle mode: active ↔ used
  const newStatus = toggle
    ? reservation.status === "used" ? "active" : "used"
    : "used";

  // Non-toggle (QR scan): block re-scan
  if (!toggle && reservation.status === "used") {
    return NextResponse.json({ error: "Già utilizzato" }, { status: 400 });
  }

  // Se guarda la hora exacta del check-in (o se borra si se deshace, para
  // que no quede una hora vieja en una reserva que ya no está "entrata").
  const { error } = await supabase
    .from("reservations")
    .update({ status: newStatus, checked_in_at: newStatus === "used" ? new Date().toISOString() : null })
    .eq("id", reservation.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ success: true, newStatus });
}

// Admin: cancel a reservation by its UUID id (passed as "code" param for routing)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: id } = await params;
  const supabase = getServiceClient();

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

  const query = supabase
    .from("reservations")
    .update({ status: "cancelled" });

  if (isUUID) {
    query.or(`id.eq.${id},code.eq.${id}`);
  } else {
    query.eq("code", id);
  }

  const { error } = await query;

  if (error) {
    console.error("Cancellation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
