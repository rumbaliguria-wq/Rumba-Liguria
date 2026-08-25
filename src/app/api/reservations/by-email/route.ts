import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json([], { status: 200 });

  const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("reservations")
      .select("code, status, events(title, event_date, event_date_iso, flyer_url)")
      .eq("user_email", email.toLowerCase())
      .order("created_at", { ascending: false });

  if (error) return NextResponse.json([], { status: 200 });
  return NextResponse.json(data ?? []);
}
