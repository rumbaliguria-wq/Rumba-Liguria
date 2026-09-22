import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

// GET: lista de colaboradores para el panel de admin, con cuántas tessere
// validó cada uno en total y en las últimas 24 horas.
export async function GET() {
  const supabase = getServiceClient();
  const { data: partners, error } = await supabase
    .from("partners")
    .select("id, name, pin, active, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: scans } = await supabase
    .from("card_scans")
    .select("partner_id, scanned_at, client_cards(full_name)")
    .not("partner_id", "is", null)
    .order("scanned_at", { ascending: false });

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const counts = new Map<string, { total: number; today: number }>();
  const recent = new Map<string, { full_name: string; scanned_at: string }[]>();
  (scans || []).forEach((s) => {
    if (!s.partner_id) return;
    const c = counts.get(s.partner_id) || { total: 0, today: 0 };
    c.total += 1;
    if (new Date(s.scanned_at).getTime() > dayAgo) c.today += 1;
    counts.set(s.partner_id, c);

    const list = recent.get(s.partner_id) || [];
    if (list.length < 30) {
      const card = s.client_cards as unknown as { full_name: string } | null;
      list.push({ full_name: card?.full_name || "—", scanned_at: s.scanned_at });
      recent.set(s.partner_id, list);
    }
  });

  return NextResponse.json(
    (partners || []).map((p) => ({
      ...p,
      total_scans: counts.get(p.id)?.total || 0,
      scans_today: counts.get(p.id)?.today || 0,
      recent_scans: recent.get(p.id) || [],
    }))
  );
}

// POST: crea un colaborador nuevo, o si el nombre ya existe le actualiza el
// PIN (para poder cambiarlo si el admin lo pierde/olvida).
export async function POST(req: NextRequest) {
  const { name, pin } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Nome richiesto" }, { status: 400 });
  if (!pin?.trim()) return NextResponse.json({ error: "PIN richiesto" }, { status: 400 });

  const supabase = getServiceClient();
  const cleanName = name.trim();

  const { data: existing } = await supabase
    .from("partners")
    .select("id")
    .ilike("name", cleanName)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("partners").update({ pin: pin.trim() }).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, updated: true });
  }

  const { error } = await supabase.from("partners").insert({ name: cleanName, pin: pin.trim() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, updated: false });
}

// PATCH: activa/desactiva un colaborador (sin borrar su historial de escaneos).
export async function PATCH(req: NextRequest) {
  const { id, active } = await req.json().catch(() => ({}));
  if (!id || typeof active !== "boolean") return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  const supabase = getServiceClient();
  const { error } = await supabase.from("partners").update({ active }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE: elimina un colaborador (los escaneos ya hechos quedan igual,
// solo pierden la referencia a quién los hizo).
export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "ID mancante" }, { status: 400 });
  const supabase = getServiceClient();
  const { error } = await supabase.from("partners").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
