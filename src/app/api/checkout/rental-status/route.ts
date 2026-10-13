import { NextRequest, NextResponse } from "next/server";
import { fulfillRentalSession } from "@/lib/payments";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "session_id richiesto" }, { status: 400 });

  try {
    const outcome = await fulfillRentalSession(sessionId);
    return NextResponse.json(outcome);
  } catch (err) {
    console.error("Rental status error", err);
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}
