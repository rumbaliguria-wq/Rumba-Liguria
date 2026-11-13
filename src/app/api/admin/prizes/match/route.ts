import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

// Se llama al escanear (QR de entrada o tessera): si esa persona tiene un
// premio pendiente para este evento, se devuelve para mostrarlo en pantalla.
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("event_id");
  const email = (req.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
  if (!eventId || !email) return NextResponse.json({ prize: null });

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("prizes")
    .select("id, description, photo_url")
    .eq("event_id", eventId)
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ prize: data || null });
}
