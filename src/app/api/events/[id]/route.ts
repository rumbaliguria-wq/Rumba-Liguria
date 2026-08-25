import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { encodeSaleConfig, decodeSaleConfig } from "@/lib/saleConfig";
import { encodeTicketTypes } from "@/lib/ticketTypes";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = getServiceClient();

    // Encode ticket types + sale config into details field
    const detailsWithTypes = encodeTicketTypes(body.details || "", body.ticket_types || []);
    const detailsWithSale = encodeSaleConfig(detailsWithTypes, body.sale_start, body.sale_end, body.archive_at);

    const { data, error } = await supabase
      .from("events")
      .update({
        title: body.title,
        details: detailsWithSale,
        price: body.price,
        flyer_url: body.flyer_url,
        flyer_ratio: body.flyer_ratio,
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
        ...(typeof body.archived === "boolean"
          ? { archived: body.archived }
          : body.publish_at
          ? { archived: true }
          : {}),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Decode sale config back for the response
    const decoded = decodeSaleConfig(data.details || "");
    return NextResponse.json({ ...data, details: decoded.details, sale_start: decoded.sale_start, sale_end: decoded.sale_end, archive_at: decoded.archive_at });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getServiceClient();

    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
