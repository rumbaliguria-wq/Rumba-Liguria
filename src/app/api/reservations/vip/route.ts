import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import crypto from "crypto";

function generateCode(eventId: string): string {
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `VIP-${eventId.slice(0, 6)}-${random}`;
}

// GET: fetch all VIP codes
export async function GET() {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("*, events(title)")
    .eq("user_email", "__vip__")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: generate a VIP code for an event
export async function POST(req: NextRequest) {
  const { event_id, count = 1, name } = await req.json();
  if (!event_id) {
    return NextResponse.json({ error: "Event ID required" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const toInsert = [];
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = generateCode(event_id);
    codes.push(code);
    toInsert.push({
      code,
      event_id,
      user_email: "__vip__",
      user_name: name?.trim() || "",
      guest_count: 0,
      status: "active",
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