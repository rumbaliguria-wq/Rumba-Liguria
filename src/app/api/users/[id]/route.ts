import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();

  // Reservation-only users: delete their reservations by email
  const type = req.nextUrl.searchParams.get("type");
  if (type === "reservation") {
    const email = decodeURIComponent(id);
    const { error } = await supabase.from("reservations").delete().eq("user_email", email);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
