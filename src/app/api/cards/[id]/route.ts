import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { data: card, error } = await supabase
    .from("client_cards")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !card) {
    return NextResponse.json({ error: "Tessera non trovata" }, { status: 404 });
  }

  const { data: scans } = await supabase
    .from("card_scans")
    .select("id, scanned_at, event_id, events(title)")
    .eq("card_id", id)
    .order("scanned_at", { ascending: false });

  return NextResponse.json({ ...card, scans: scans || [] });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();
  const body = await req.json();

  // Only touch fields that were actually sent — e.g. toggling "active" alone
  // must not wipe every other field back to null.
  const updates: Record<string, unknown> = {};

  if (body.full_name !== undefined) {
    const full_name = (body.full_name || "").trim();
    if (!full_name) {
      return NextResponse.json({ error: "Il nome e cognome sono obbligatori" }, { status: 400 });
    }
    updates.full_name = full_name;
  }
  if (body.country !== undefined) updates.country = body.country || null;
  if (body.city !== undefined) updates.city = body.city || null;
  if (body.birth_date !== undefined) updates.birth_date = body.birth_date || null;
  if (body.phone !== undefined) updates.phone = body.phone || null;
  if (body.email !== undefined) updates.email = body.email || null;
  if (body.id_number !== undefined) updates.id_number = body.id_number || null;
  if (body.id_type !== undefined) updates.id_type = body.id_type || null;
  if (body.photo_url !== undefined) updates.photo_url = body.photo_url || null;
  if (body.notes !== undefined) updates.notes = body.notes || null;
  if (body.gender !== undefined) updates.gender = body.gender || null;
  if (body.language !== undefined) updates.language = body.language || "it";
  if (body.inactive_reason !== undefined) updates.inactive_reason = body.inactive_reason || null;
  if (typeof body.active === "boolean") updates.active = body.active;

  const { data, error } = await supabase
    .from("client_cards")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { error } = await supabase.from("client_cards").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
