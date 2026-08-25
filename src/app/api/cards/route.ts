import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { generateCardCode } from "@/lib/cardTypes";

export async function GET() {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("client_cards")
    .select("*, card_scans(scanned_at, event_id)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cards = (data || []).map((c) => {
    const scans = (c.card_scans as { scanned_at: string; event_id: string | null }[]) || [];
    const lastScan = scans.length
      ? scans.reduce((a, b) => (a.scanned_at > b.scanned_at ? a : b)).scanned_at
      : null;
    return {
      ...c,
      card_scans: undefined,
      visit_count: scans.length,
      last_visit: lastScan,
      event_ids: [...new Set(scans.map((s) => s.event_id).filter(Boolean))],
    };
  });

  return NextResponse.json(cards);
}

export async function POST(req: Request) {
  const supabase = getServiceClient();
  const body = await req.json();

  const full_name = (body.full_name || "").trim();
  if (!full_name) {
    return NextResponse.json({ error: "Il nome e cognome sono obbligatori" }, { status: 400 });
  }

  let code = generateCardCode();
  // Ensure uniqueness (astronomically unlikely to collide, but check anyway)
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase.from("client_cards").select("id").eq("code", code).maybeSingle();
    if (!existing) break;
    code = generateCardCode();
  }

  const { data, error } = await supabase
    .from("client_cards")
    .insert({
      code,
      full_name,
      country: body.country || null,
      city: body.city || null,
      birth_date: body.birth_date || null,
      phone: body.phone || null,
      email: body.email || null,
      id_number: body.id_number || null,
      id_type: body.id_type || null,
      photo_url: body.photo_url || null,
      notes: body.notes || null,
      gender: body.gender || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
