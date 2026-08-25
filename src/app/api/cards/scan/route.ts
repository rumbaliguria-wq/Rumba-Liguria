import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export async function POST(req: Request) {
  const supabase = getServiceClient();
  const body = await req.json().catch(() => ({}));
  const code = (body.code || "").trim();
  const eventId = body.event_id || null;

  if (!code) return NextResponse.json({ error: "Codice mancante" }, { status: 400 });
  if (!eventId) return NextResponse.json({ error: "Seleziona un evento prima di scansionare" }, { status: 400 });

  const { data: card, error } = await supabase
    .from("client_cards")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !card) {
    return NextResponse.json({ error: "Tessera non trovata" }, { status: 404 });
  }

  if (!card.active) {
    return NextResponse.json({ error: "Tessera disattivata" }, { status: 400 });
  }

  const { data: allScans } = await supabase
    .from("card_scans")
    .select("id, scanned_at, event_id, events(title)")
    .eq("card_id", card.id)
    .order("scanned_at", { ascending: false });

  const scans = allScans || [];
  const existingForEvent = scans.find((s) => s.event_id === eventId);
  const isDuplicate = !!existingForEvent;

  let newScan = null;
  if (!isDuplicate) {
    const { data: inserted, error: insertError } = await supabase
      .from("card_scans")
      .insert({ card_id: card.id, event_id: eventId })
      .select("id, scanned_at, event_id, events(title)")
      .single();
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    newScan = inserted;
    scans.unshift(inserted);
  }

  return NextResponse.json({
    card,
    logged: !isDuplicate,
    visit_count: scans.length,
    recent_scans: scans.slice(0, 5),
    scan: newScan || existingForEvent,
  });
}
