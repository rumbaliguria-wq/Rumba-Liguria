import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { decodeSaleConfig } from "@/lib/saleConfig";
import { getArchiveThresholdDate } from "@/lib/eventExpiry";

// Admin-only: returns ALL events including archived
export async function GET() {
  const supabase = getServiceClient();

  // Auto-archive events after 05:00 Rome the day after the event
  const archiveThreshold = getArchiveThresholdDate();
  await supabase
    .from("events")
    .update({ archived: true })
    .eq("archived", false)
    .lte("event_date_iso", archiveThreshold)
    .not("event_date_iso", "is", null);

  const { data, error } = await supabase
    .from("events")
    .select("*, reservations(status)")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Handle archive_at: auto-archive events whose archive_at has passed
  const toArchive = (data || []).filter((e) => {
    const decoded = decodeSaleConfig(e.details || "");
    return decoded.archive_at && Date.now() >= new Date(decoded.archive_at).getTime() && !e.archived;
  });
  for (const e of toArchive) {
    await supabase.from("events").update({ archived: true }).eq("id", e.id);
  }

  const events = (data || []).map((e) => {
    const reservations = (e.reservations as { status: string }[]) || [];
    const decoded = decodeSaleConfig(e.details || "");
    return {
      ...e,
      details: decoded.details,
      sale_start: decoded.sale_start,
      sale_end: decoded.sale_end,
      archive_at: decoded.archive_at,
      reservations: undefined,
      reservation_total: reservations.length,
      reservation_used: reservations.filter((r) => r.status === "used").length,
    };
  });

  return NextResponse.json(events);
}
