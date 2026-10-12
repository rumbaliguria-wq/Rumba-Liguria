import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

// Lista de quién entró con tessera a este evento (para el "Copia nomi" de
// Statistiche — p.ej. el sorteo de copas con los que ya entraron hasta esa
// hora). Si una tessera escaneó más de una vez, se queda con el primer
// escaneo (la hora real de entrada).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("card_scans")
    .select("card_id, scanned_at, client_cards(full_name, city, id_type)")
    .eq("event_id", id)
    .order("scanned_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const entries: { full_name: string; city: string | null; id_type: string | null; scanned_at: string }[] = [];
  for (const row of data || []) {
    if (seen.has(row.card_id)) continue;
    seen.add(row.card_id);
    const card = Array.isArray(row.client_cards) ? row.client_cards[0] : row.client_cards;
    if (!card) continue;
    entries.push({ full_name: card.full_name, city: card.city ?? null, id_type: card.id_type ?? null, scanned_at: row.scanned_at });
  }

  return NextResponse.json(entries);
}
