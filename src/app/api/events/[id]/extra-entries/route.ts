import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

// Contador manual de gente que entró sin prenotazione (botón "Extra" en la
// pantalla de Scansiona QR) — un tap = +1, para que al final del evento
// quede el total real de entradas, no solo las que pasaron por QR/tessera.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { delta?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }
  const delta = body.delta === -1 ? -1 : 1;

  const supabase = getServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("extra_entries")
    .eq("id", id)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Evento non trovato" }, { status: 404 });

  const next = Math.max(0, (event.extra_entries || 0) + delta);
  const { error } = await supabase.from("events").update({ extra_entries: next }).eq("id", id);
  if (error) return NextResponse.json({ error: "Errore" }, { status: 500 });

  return NextResponse.json({ extra_entries: next });
}
