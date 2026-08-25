import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getEventExpiryUTC } from "@/lib/eventExpiry";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = getServiceClient();

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
      .update({ status: "used" })
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

  const { error } = await supabase
    .from("reservations")
    .update({ status: newStatus })
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
