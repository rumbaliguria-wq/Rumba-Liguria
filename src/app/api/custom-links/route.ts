import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

function slug(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

// GET: resolve a link name to its currently active event (?name=alex) —
// used by the homepage to figure out which event a ?ref=alex link points
// to right now. Or list all custom links, optionally filtered by event
// (?event_id=...), for the admin stats panel.
export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const name = req.nextUrl.searchParams.get("name");

  if (name) {
    const emailKey = `__link__${slug(name)}__`;
    const { data, error } = await supabase
      .from("reservations")
      .select("event_id, events(id, title, archived)")
      .eq("user_email", emailKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const ev = data?.events as unknown as { id: string; title: string; archived: boolean } | null;
    if (!data || !ev || ev.archived) {
      return NextResponse.json({ active: false });
    }
    return NextResponse.json({ active: true, event_id: ev.id, event_title: ev.title });
  }

  const eventId = req.nextUrl.searchParams.get("event_id");
  let query = supabase
    .from("reservations")
    .select("code, user_name, user_email, event_id, created_at, events(title)")
    .like("code", "__LINK__%");

  if (eventId) {
    query = query.eq("event_id", eventId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const links = (data || []).map((r) => ({
    name: r.user_name,
    eventId: r.event_id,
    eventTitle: (r.events as unknown as { title: string } | null)?.title || "",
    url: `/?ref=${encodeURIComponent(r.user_name)}`,
    created_at: r.created_at,
  }));

  return NextResponse.json(links);
}

// POST: create a custom link, or — if that name already has one — reassign
// it to a different event. Same shareable URL keeps working, it just points
// wherever it was last assigned.
export async function POST(req: NextRequest) {
  const { event_id, name } = await req.json();
  if (!event_id || !name?.trim()) {
    return NextResponse.json({ error: "Event ID and name required" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const emailKey = `__link__${slug(name)}__`;
  const code = `__LINK__${slug(name)}`;

  const { data: existing } = await supabase
    .from("reservations")
    .select("id")
    .eq("user_email", emailKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("reservations")
      .update({ event_id, code, user_name: name.trim(), created_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, reassigned: true, name: name.trim(), code });
  }

  const { error } = await supabase.from("reservations").insert({
    code,
    event_id,
    user_email: emailKey,
    user_name: name.trim(),
    guest_count: 0,
    status: "active",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, reassigned: false, name: name.trim(), code });
}

// DELETE: remove a custom link entirely, by name
export async function DELETE(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const supabase = getServiceClient();
  const emailKey = `__link__${slug(name)}__`;
  const { error } = await supabase.from("reservations").delete().eq("user_email", emailKey);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
