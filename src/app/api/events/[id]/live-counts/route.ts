import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

// Para que el admin vea, durante la noche, cuánta gente entró con ticket
// (normal, VIP o código de grupo) vs. cuánta entró mostrando la tessera
// de cliente — dos mundos distintos que hoy no se ven juntos en ningún
// lado hasta que se revisan las Statistiche al día siguiente.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { count: reservations } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id)
    .eq("status", "used");

  const { count: tessere } = await supabase
    .from("card_scans")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id);

  const { data: event } = await supabase
    .from("events")
    .select("extra_entries")
    .eq("id", id)
    .maybeSingle();

  return NextResponse.json({ reservations: reservations || 0, tessere: tessere || 0, extra: event?.extra_entries || 0 });
}
