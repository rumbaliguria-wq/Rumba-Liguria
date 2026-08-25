import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    const { data } = await supabase
      .from("admin_settings")
      .select("username, password")
      .eq("id", 1)
      .single();

    const validUser = data?.username || process.env.ADMIN_USERNAME;
    const validPass = data?.password || process.env.ADMIN_PASSWORD;

    if (username === validUser && password === validPass) {
      return NextResponse.json({ success: true, token: "admin-authenticated" });
    }
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
