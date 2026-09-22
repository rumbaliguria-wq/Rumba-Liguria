import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

// No hay sesión: cada pedido (login y cada escaneo) manda de nuevo nombre +
// PIN y se valida en el momento — igual que /api/rrpp. Así no hace falta
// darle usuario/contraseña al colaborador externo, y si el admin le cambia
// el PIN, el link viejo deja de servir al toque.
async function checkPartner(supabase: ReturnType<typeof getServiceClient>, name: string, pin: string) {
  const { data: partner } = await supabase
    .from("partners")
    .select("id, name, active, pin")
    .ilike("name", name.trim())
    .maybeSingle();
  if (!partner || !partner.active || partner.pin !== pin.trim()) return null;
  return partner;
}

// Una misma tessera no puede volver a validarse en el mismo bar antes de
// que pase este tiempo — evita que una persona use el descuento dos veces
// la misma noche mostrando otra vez el QR.
const PARTNER_DUPLICATE_WINDOW_MS = 20 * 60 * 60 * 1000;

// POST: sin `code` es solo el login (pantalla de PIN); con `code` es el
// escaneo de una tessera.
export async function POST(req: NextRequest) {
  const { name, pin, code } = await req.json().catch(() => ({}));
  if (!name?.trim() || !pin?.trim()) {
    return NextResponse.json({ error: "Nome e PIN richiesti" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const partner = await checkPartner(supabase, name, pin);
  if (!partner) return NextResponse.json({ error: "Link o PIN non corretti" }, { status: 401 });

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const { data: recentScans } = await supabase
    .from("card_scans")
    .select("id")
    .eq("partner_id", partner.id)
    .gte("scanned_at", new Date(dayAgo).toISOString());
  const todayCount = recentScans?.length || 0;

  if (!code?.trim()) {
    // Solo login: confirma que el link/PIN sirven y muestra el contador.
    return NextResponse.json({ ok: true, partner_name: partner.name, today_count: todayCount });
  }

  const { data: card } = await supabase
    .from("client_cards")
    .select("id, full_name, id_type, card_number, photo_url, active")
    .eq("code", code.trim())
    .maybeSingle();

  if (!card) return NextResponse.json({ error: "Tessera non trovata" }, { status: 404 });
  if (!card.active) return NextResponse.json({ error: "Tessera disattivata" }, { status: 400 });

  const { data: lastScan } = await supabase
    .from("card_scans")
    .select("scanned_at")
    .eq("card_id", card.id)
    .eq("partner_id", partner.id)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isDuplicate = !!lastScan && Date.now() - new Date(lastScan.scanned_at).getTime() < PARTNER_DUPLICATE_WINDOW_MS;

  if (!isDuplicate) {
    const { error: insertError } = await supabase
      .from("card_scans")
      .insert({ card_id: card.id, event_id: null, partner_id: partner.id });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    valid: !isDuplicate,
    already_used: isDuplicate,
    card: {
      full_name: card.full_name,
      id_type: card.id_type,
      card_number: card.card_number,
      photo_url: card.photo_url,
    },
    today_count: todayCount + (isDuplicate ? 0 : 1),
  });
}
