import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

// GET: lista de accesos de entrada para el panel de admin, con el título
// del evento al que apunta cada uno.
export async function GET() {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("door_passes")
    .select("id, name, pin, active, created_at, event_id, events(title, event_date_iso, archived)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: crea un acceso nuevo, o si el nombre ya existe lo reapunta a otro
// evento (y/o le cambia el PIN) — para reusar el mismo link cada semana.
export async function POST(req: NextRequest) {
  const { name, event_id, pin } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Nome richiesto" }, { status: 400 });
  if (!event_id) return NextResponse.json({ error: "Evento richiesto" }, { status: 400 });
  if (!pin?.trim()) return NextResponse.json({ error: "PIN richiesto" }, { status: 400 });

  const supabase = getServiceClient();
  const cleanName = name.trim();

  const { data: existing } = await supabase
    .from("door_passes")
    .select("id")
    .ilike("name", cleanName)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("door_passes")
      .update({ event_id, pin: pin.trim(), active: true })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, updated: true });
  }

  const { error } = await supabase.from("door_passes").insert({ name: cleanName, event_id, pin: pin.trim() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, updated: false });
}

// PATCH: activa/desactiva un acceso manualmente (por si se pierde el
// dispositivo antes de que el evento termine solo).
export async function PATCH(req: NextRequest) {
  const { id, active } = await req.json().catch(() => ({}));
  if (!id || typeof active !== "boolean") return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  const supabase = getServiceClient();
  const { error } = await supabase.from("door_passes").update({ active }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE: elimina un acceso definitivamente.
export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "ID mancante" }, { status: 400 });
  const supabase = getServiceClient();
  const { error } = await supabase.from("door_passes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
