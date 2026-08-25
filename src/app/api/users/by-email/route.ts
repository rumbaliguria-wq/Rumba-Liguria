import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { decodePhoneField } from "@/lib/userPhone";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, phone")
    .eq("email", email.toLowerCase())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const decoded = decodePhoneField(data.phone);
  return NextResponse.json({
    email: data.email,
    name: decoded.name,
    userType: decoded.userType,
  });
}