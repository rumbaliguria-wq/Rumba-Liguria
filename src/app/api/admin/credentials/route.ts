import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminPassword, hashAdminPassword } from "@/lib/adminPassword";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(req: Request) {
  try {
    const { currentPassword, newUsername, newPassword } = await req.json();

    if (!(await verifyAdminPassword(supabase, currentPassword))) {
      return NextResponse.json({ error: "Password attuale errata" }, { status: 401 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof newUsername === "string" && newUsername.trim()) {
      update.username = newUsername.trim();
    }
    if (typeof newPassword === "string" && newPassword) {
      update.password = await hashAdminPassword(newPassword);
    }

    const { error } = await supabase.from("admin_settings").update(update).eq("id", 1);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
