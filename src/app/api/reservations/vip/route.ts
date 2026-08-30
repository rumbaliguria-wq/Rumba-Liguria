import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import crypto from "crypto";

function generateCode(eventId: string): string {
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `VIP-${eventId.slice(0, 6)}-${random}`;
}

// GET: fetch all VIP codes, optionally filtered by event
export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const eventId = req.nextUrl.searchParams.get("event_id");

  let query = supabase
    .from("reservations")
    .select("*, events(title)")
    .eq("user_email", "__vip__");

  if (eventId) query = query.eq("event_id", eventId);

  const { data, error } = await query
    .order("vip_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: generate VIP codes for an event. Each generation is its own personal
// batch (it carries the requester's name), so the numbering restarts at 1
// every time instead of continuing across the whole event — the name is
// what disambiguates two codes with the same number.
export async function POST(req: NextRequest) {
  const { event_id, count = 1, name } = await req.json();
  if (!event_id) {
    return NextResponse.json({ error: "Event ID required" }, { status: 400 });
  }

  const supabase = getServiceClient();

  let nextNumber = 1;

  const toInsert = [];
  const codes: { code: string; vip_number: number }[] = [];

  for (let i = 0; i < count; i++) {
    const code = generateCode(event_id);
    const vip_number = nextNumber++;
    codes.push({ code, vip_number });
    toInsert.push({
      code,
      event_id,
      user_email: "__vip__",
      user_name: name?.trim() || "",
      guest_count: 0,
      status: "active",
      vip_number,
    });
  }

  const { error } = await supabase.from("reservations").insert(toInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ codes, count });
}

// DELETE: Remove a VIP code
export async function DELETE(req: NextRequest) {
  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });

  const supabase = getServiceClient();
  const { error } = await supabase.from("reservations").delete().eq("code", code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
