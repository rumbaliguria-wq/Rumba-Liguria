import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import crypto from "crypto";

function generateCode(): string {
  return `GROUP-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

// GET: lista de códigos de grupo (de todos los eventos, o filtrado por uno),
// con cuántas personas entraron ya por cada uno.
export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const eventId = req.nextUrl.searchParams.get("event_id");

  let query = supabase
    .from("group_passes")
    .select("id, code, label, max_entries, created_at, event_id, events(title, archived)")
    .order("created_at", { ascending: false });
  if (eventId) query = query.eq("event_id", eventId);

  const { data: passes, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: counts } = await supabase
    .from("reservations")
    .select("group_pass_id")
    .not("group_pass_id", "is", null);

  const countByPass = new Map<string, number>();
  (counts || []).forEach((r) => {
    if (!r.group_pass_id) return;
    countByPass.set(r.group_pass_id, (countByPass.get(r.group_pass_id) || 0) + 1);
  });

  return NextResponse.json(
    (passes || []).map((p) => ({ ...p, entries_count: countByPass.get(p.id) || 0 }))
  );
}

// POST: crea un código de grupo nuevo para un evento.
export async function POST(req: NextRequest) {
  const { event_id, label, max_entries } = await req.json().catch(() => ({}));
  if (!event_id) return NextResponse.json({ error: "Evento richiesto" }, { status: 400 });

  const maxEntries = max_entries === "" || max_entries === null || max_entries === undefined
    ? null
    : Number(max_entries);
  if (maxEntries !== null && (!Number.isInteger(maxEntries) || maxEntries < 1)) {
    return NextResponse.json({ error: "Tetto massimo non valido" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: event } = await supabase.from("events").select("id, archived").eq("id", event_id).single();
  if (!event || event.archived) return NextResponse.json({ error: "Evento non disponibile" }, { status: 404 });

  const { data, error } = await supabase
    .from("group_passes")
    .insert({ code: generateCode(), event_id, label: label?.trim() || null, max_entries: maxEntries })
    .select("id, code")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, id: data.id, code: data.code });
}

// DELETE: elimina un código de grupo (las entradas ya registradas quedan
// igual en las estadísticas, solo pierden la referencia al código).
export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "ID mancante" }, { status: 400 });
  const supabase = getServiceClient();
  const { error } = await supabase.from("group_passes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
