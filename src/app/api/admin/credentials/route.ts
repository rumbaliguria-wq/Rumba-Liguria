import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(req: Request) {
  try {
    const { currentPassword, newUsername, newPassword } = await req.json();

    const { data } = await supabase
      .from("admin_settings")
      .select("password")
      .eq("id", 1)
      .single();

    const validPass = data?.password || process.env.ADMIN_PASSWORD;
    if (currentPassword !== validPass) {
      return NextResponse.json({ error: "Password attuale errata" }, { status: 401 });
    }

    const { error } = await supabase
      .from("admin_settings")
      .update({
        username: newUsername,
        password: newPassword,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
