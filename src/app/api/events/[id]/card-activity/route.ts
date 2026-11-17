import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

type CardLike = { full_name: string; city: string | null; id_type: string | null } | { full_name: string; city: string | null; id_type: string | null }[] | null;

function toEntry(card: CardLike) {
  const c = Array.isArray(card) ? card[0] : card;
  if (!c) return null;
  return { full_name: c.full_name, city: c.city ?? null, id_type: c.id_type ?? null };
}

// Tarjeta de socio: para este evento, separa quién reservó y asistió, quién
// reservó y no asistió (status "active" todavía), y quién asistió sin haber
// reservado (tessera escaneada en la puerta sin ninguna reserva ligada).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { data: res, error: resError } = await supabase
    .from("reservations")
    .select("card_id, status, client_cards(full_name, city, id_type)")
    .eq("event_id", id)
    .not("card_id", "is", null)
    .in("status", ["active", "used"]);
  if (resError) return NextResponse.json({ error: resError.message }, { status: 500 });

  const { data: scans, error: scanError } = await supabase
    .from("card_scans")
    .select("card_id, client_cards(full_name, city, id_type)")
    .eq("event_id", id)
    .order("scanned_at", { ascending: true });
  if (scanError) return NextResponse.json({ error: scanError.message }, { status: 500 });

  const reservedCardIds = new Set((res || []).map((r) => r.card_id as string));

  const reserved_attended = [];
  const reserved_not_attended = [];
  for (const r of res || []) {
    const entry = toEntry(r.client_cards);
    if (!entry) continue;
    if (r.status === "used") reserved_attended.push(entry);
    else reserved_not_attended.push(entry);
  }

  const seenScanCard = new Set<string>();
  const attended_without_reservation = [];
  for (const s of scans || []) {
    if (seenScanCard.has(s.card_id)) continue;
    seenScanCard.add(s.card_id);
    if (reservedCardIds.has(s.card_id)) continue;
    const entry = toEntry(s.client_cards);
    if (!entry) continue;
    attended_without_reservation.push(entry);
  }

  return NextResponse.json({ reserved_attended, reserved_not_attended, attended_without_reservation });
}
