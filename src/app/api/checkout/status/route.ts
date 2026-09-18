import { NextRequest, NextResponse } from "next/server";
import { getSiteOrigin } from "@/lib/stripe";
import { fulfillPaidSession } from "@/lib/payments";

export const runtime = "nodejs";

// La página de éxito consulta esto al volver de Stripe. Si el webhook aún no
// llegó (o no está configurado, como en local), aquí mismo se entregan las
// entradas — es idempotente.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Sessione non valida" }, { status: 400 });
  }
  try {
    const outcome = await fulfillPaidSession(sessionId, getSiteOrigin(req));
    return NextResponse.json(outcome);
  } catch (err) {
    console.error("Payment status error", err);
    return NextResponse.json({ error: "Impossibile verificare il pagamento." }, { status: 500 });
  }
}
