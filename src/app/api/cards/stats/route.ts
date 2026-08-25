import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = getServiceClient();

  const { count: totalCards, error: cardsError } = await supabase
    .from("client_cards")
    .select("*", { count: "exact", head: true });
  if (cardsError) return NextResponse.json({ error: cardsError.message }, { status: 500 });

  const { count: totalScans, error: scansError } = await supabase
    .from("card_scans")
    .select("*", { count: "exact", head: true });
  if (scansError) return NextResponse.json({ error: scansError.message }, { status: 500 });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { count: scansToday, error: todayError } = await supabase
    .from("card_scans")
    .select("*", { count: "exact", head: true })
    .gte("scanned_at", startOfToday.toISOString());
  if (todayError) return NextResponse.json({ error: todayError.message }, { status: 500 });

  const { data: typeRows, error: typesError } = await supabase.from("client_cards").select("id_type");
  if (typesError) return NextResponse.json({ error: typesError.message }, { status: 500 });
  const byType: Record<string, number> = {};
  for (const row of typeRows || []) {
    const key = row.id_type ? (row.id_type.startsWith("OTRO:") ? "OTRO" : row.id_type) : "SENZA_TIPO";
    byType[key] = (byType[key] || 0) + 1;
  }

  return NextResponse.json({
    total_cards: totalCards || 0,
    total_scans: totalScans || 0,
    scans_today: scansToday || 0,
    by_type: byType,
  });
}
