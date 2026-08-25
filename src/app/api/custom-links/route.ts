import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

// GET: fetch all custom links for an event
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("event_id");
  const supabase = getServiceClient();

  let query = supabase
    .from("reservations")
    .select("code, user_name, user_email, created_at, events(title)")
    .like("code", "__LINK__%");

  if (eventId) {
    query = query.eq("event_id", eventId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const links = (data || []).map((r: any) => ({
    name: r.user_name,
    eventId: r.event_id,
    eventTitle: r.events?.title || "",
    url: `/?ref=${encodeURIComponent(r.user_name)}&eid=${r.event_id}`,
    created_at: r.created_at,
  }));

  return NextResponse.json(links);
}

// POST: create a custom link
export async function POST(req: NextRequest) {
  const { event_id, name } = await req.json();
  if (!event_id || !name?.trim()) {
    return NextResponse.json({ error: "Event ID and name required" }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Check if link name already exists for this event
  const linkCode = `__LINK__${event_id.slice(0, 6)}__${name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
  const { data: existing } = await supabase
    .from("reservations")
    .select("id")
    .eq("code", linkCode)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Questo nome link già esiste per questo evento" }, { status: 409 });
  }

  const { error } = await supabase.from("reservations").insert({
    code: linkCode,
    event_id,
    user_email: `__link__${name.trim().toLowerCase()}__`,
    user_name: name.trim(),
    guest_count: 0,
    status: "active",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, name: name.trim(), code: linkCode });
}

// DELETE: remove a custom link
export async function DELETE(req: NextRequest) {
  const { event_id, name } = await req.json();
  if (!event_id || !name) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("reservations")
    .delete()
    .like("code", `__LINK__${event_id.slice(0, 6)}__${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}