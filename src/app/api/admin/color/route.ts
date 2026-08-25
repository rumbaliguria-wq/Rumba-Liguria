import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { decodeRentalConfig, encodeRentalConfig } from "@/lib/rentalConfig";

export async function GET() {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("admin_settings")
    .select("accent_color")
    .eq("id", 1)
    .single();
  const { color } = decodeRentalConfig(data?.accent_color || "#3b82f6");
  return NextResponse.json({ accent_color: color });
}

export async function PUT(req: Request) {
  const { accent_color } = await req.json();
  const supabase = getServiceClient();
  // Preserve rental config when updating color
  const { data } = await supabase.from("admin_settings").select("accent_color").eq("id", 1).single();
  const { rental } = decodeRentalConfig(data?.accent_color || "");
  const encoded = encodeRentalConfig(accent_color, rental);
  const { error } = await supabase.from("admin_settings").update({ accent_color: encoded }).eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
