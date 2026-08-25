import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ exists: false });
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();
    return NextResponse.json({ exists: !!data });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
