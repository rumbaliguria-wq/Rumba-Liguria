import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getEventExpiryUTC } from "@/lib/eventExpiry";

function slug(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

// Cuánto tiempo después de terminado el evento el RR.PP. todavía puede ver
// sus estadísticas — pasado esto, el link "se apaga" solo para él (los
// datos siguen para siempre en el panel de admin, esto no los borra).
const VISIBILITY_EXTRA_MS = 24 * 60 * 60 * 1000;

// POST: el RR.PP. entra con su nombre de link + PIN y ve, de solo lectura,
// quién reservó a su nombre y quién ya entró — nada más se expone acá.
export async function POST(req: NextRequest) {
  const { name, pin } = await req.json().catch(() => ({}));
  if (!name?.trim() || !pin?.trim()) {
    return NextResponse.json({ error: "Nome e PIN richiesti" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const emailKey = `__link__${slug(name)}__`;

  const { data: link } = await supabase
    .from("reservations")
    .select("event_id, link_pin, events(id, title, event_date, event_date_iso)")
    .eq("user_email", emailKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!link || !link.link_pin || link.link_pin !== pin.trim()) {
    return NextResponse.json({ error: "Link o PIN non corretti" }, { status: 401 });
  }

  const event = link.events as unknown as { id: string; title: string; event_date: string | null; event_date_iso: string | null } | null;
  if (!event) {
    return NextResponse.json({ error: "Nessun evento assegnato a questo link al momento" }, { status: 404 });
  }

  if (event.event_date_iso) {
    const visibleUntil = getEventExpiryUTC(event.event_date_iso) + VISIBILITY_EXTRA_MS;
    if (Date.now() > visibleUntil) {
      return NextResponse.json({ error: "expired", event_title: event.title }, { status: 410 });
    }
  }

  const { data: reservations, error } = await supabase
    .from("reservations")
    .select("user_name, status")
    .eq("event_id", event.id)
    .neq("user_email", emailKey)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tag = `[ref:${name.trim()}]`;
  const people = (reservations || [])
    .filter((r) => (r.user_name || "").includes(tag) && r.status !== "cancelled")
    .map((r) => ({
      name: (r.user_name || "").replace(/\s*\[(ref|tipo):[^\]]+\]/g, "").trim() || "—",
      entered: r.status === "used",
    }));

  return NextResponse.json({
    event_title: event.title,
    event_date: event.event_date,
    total: people.length,
    entered: people.filter((p) => p.entered).length,
    people,
  });
}
