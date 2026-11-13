import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

// Se llama al escanear (QR de entrada o tessera): si esa persona tiene un
// premio pendiente para este evento (sin caducar, sin reclamar todavía), se
// marca como reclamado en el momento y se devuelve para mostrarlo en
// pantalla — así un segundo escaneo de la misma persona no lo vuelve a sacar.
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("event_id");
  const email = (req.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
  if (!eventId || !email) return NextResponse.json({ prize: null });

  const supabase = getServiceClient();
  const { data: prize } = await supabase
    .from("prizes")
    .select("id, description, photo_url, expires_at")
    .eq("event_id", eventId)
    .eq("email", email)
    .is("claimed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!prize) return NextResponse.json({ prize: null });
  if (prize.expires_at && new Date(prize.expires_at) < new Date()) {
    return NextResponse.json({ prize: null });
  }

  await supabase.from("prizes").update({ claimed_at: new Date().toISOString() }).eq("id", prize.id);

  return NextResponse.json({ prize: { id: prize.id, description: prize.description, photo_url: prize.photo_url } });
}
