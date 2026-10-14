import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { decodeTicketTypes, extractTicketTypeTag, isQrSafeColor } from "@/lib/ticketTypes";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json([], { status: 200 });

  const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("reservations")
      .select("code, status, user_name, events(title, event_date, event_date_iso, flyer_url, details)")
      .eq("user_email", email.toLowerCase())
      .order("created_at", { ascending: false });

  if (error) return NextResponse.json([], { status: 200 });

  // El color del QR es el del tipo de biglietto elegido — queda tipeado en
  // user_name ("... [tipo:X]"), así que se vuelve a sacar de ahí.
  const withColor = (data || []).map((r) => {
    const ev = r.events as unknown as { details?: string } | null;
    const { types } = decodeTicketTypes(ev?.details || "");
    const tagName = extractTicketTypeTag(r.user_name);
    const rawColor = tagName ? types.find((t) => t.name === tagName)?.color : undefined;
    const ticket_color = isQrSafeColor(rawColor) ? rawColor : undefined;
    return { ...r, user_name: undefined, ticket_color };
  });

  return NextResponse.json(withColor);
}
