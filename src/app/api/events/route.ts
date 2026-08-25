import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { sendEmail, eventAnnouncementHtml } from "@/lib/email";
import { encodeSaleConfig, decodeSaleConfig } from "@/lib/saleConfig";
import { encodeTicketTypes, decodeTicketTypes } from "@/lib/ticketTypes";
import { getArchiveThresholdDate } from "@/lib/eventExpiry";

export async function GET() {
    const supabase = getServiceClient();
    const now = new Date().toISOString();

    // Auto-publish scheduled events whose publish_at has arrived
    await supabase
      .from("events")
      .update({ archived: false, publish_at: null })
      .eq("archived", true)
      .not("publish_at", "is", null)
      .lte("publish_at", now);

    // Auto-archive events after 05:00 Rome the day after the event
    // (e.g. Wednesday party → archived Thursday after 05:00, not at midnight)
    const archiveThreshold = getArchiveThresholdDate();
    await supabase
      .from("events")
      .update({ archived: true })
      .eq("archived", false)
      .lte("event_date_iso", archiveThreshold)
      .not("event_date_iso", "is", null);

    const { data, error } = await supabase
      .from("events")
      .select("*, reservations(status, guest_count)")
      .eq("archived", false)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add reservation counts + decode sale config + ticket types from details
  // Also handle archive_at: if set and time has passed, archive the event
  const events = await Promise.all((data || []).map(async (e) => {
    const reservations = (e.reservations as { status: string; guest_count?: number }[]) || [];
    // Real tickets sold: active/used only (excludes cancelled and VIP/link codes with guest_count 0)
    const ticketsSold = reservations
      .filter((r) => (r.status === "active" || r.status === "used") && (r.guest_count ?? 1) > 0)
      .reduce((sum, r) => sum + (r.guest_count ?? 1), 0);
    const decoded = decodeSaleConfig(e.details || "");
    const ttDecoded = decodeTicketTypes(decoded.details);
    // Auto-archive if archive_at is set and has passed
    if (decoded.archive_at && Date.now() >= new Date(decoded.archive_at).getTime()) {
      await supabase.from("events").update({ archived: true }).eq("id", e.id);
      return null; // will be filtered out
    }
    return {
      ...e,
      details: ttDecoded.details,
      sale_start: decoded.sale_start,
      sale_end: decoded.sale_end,
      archive_at: decoded.archive_at,
      ticket_types: ttDecoded.types,
      reservations: undefined,
      reservation_total: reservations.length,
      reservation_used: reservations.filter((r) => r.status === "used").length,
      tickets_sold: ticketsSold,
      // max_tickets 0/null means unlimited (same convention as the booking limit check)
      sold_out: !!e.max_tickets && ticketsSold >= e.max_tickets,
    };
  }));

  return NextResponse.json(events.filter(Boolean));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = getServiceClient();

    // Count only active (non-archived) events toward the 50 limit
    const { count } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("archived", false);

    if (count !== null && count >= 50) {
      return NextResponse.json({ error: "Maximum 50 active events reached" }, { status: 400 });
    }

    const baseInsert = {
      title: body.title,
      details: encodeSaleConfig(encodeTicketTypes(body.details || "", body.ticket_types || []), body.sale_start, body.sale_end, body.archive_at),
      price: body.price || "free",
      flyer_url: body.flyer_url,
      flyer_ratio: body.flyer_ratio || "16:9",
      maps_url: body.maps_url || null,
      is_popular: body.is_popular || false,
      organizer: body.organizer || "Rumba Liguria",
      event_date: body.event_date || null,
      event_date_iso: body.event_date_iso || null,
      event_time: body.event_time || null,
      event_time_end: body.event_time_end || null,
      max_tickets: body.max_tickets ? parseInt(body.max_tickets) : null,
      max_per_person: body.max_per_person ? parseInt(body.max_per_person) : null,
      dress_code: body.dress_code || null,
      min_age: body.min_age ? parseInt(body.min_age) : null,
      publish_at: body.publish_at || null,
      archived: body.publish_at ? true : false,
    };

    const { data, error } = await supabase.from("events").insert(baseInsert).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If notifyUsers flag set, send emails to all registered users
      if (body.notifyUsers) {
        const origin = req.headers.get("origin") || "";
      const siteUrl = origin || process.env.NEXT_PUBLIC_SITE_URL || "https://rumbaliguria.com";

      const { data: users } = await supabase.from("users").select("email");
      if (users && users.length > 0) {
        const html = eventAnnouncementHtml({
          title: data.title,
          details: data.details,
          price: data.price,
          flyer_url: data.flyer_url,
          siteUrl,
        });
        const emails = users.map((u) => u.email);
        for (let i = 0; i < emails.length; i += 50) {
          await sendEmail({
            to: emails.slice(i, i + 50),
            subject: `🎉 Nuovo Evento: ${data.title}`,
            html,
          });
        }
      }
    }

    const decoded = decodeSaleConfig(data.details || "");
    return NextResponse.json({ ...data, details: decoded.details, sale_start: decoded.sale_start, sale_end: decoded.sale_end, archive_at: decoded.archive_at });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
