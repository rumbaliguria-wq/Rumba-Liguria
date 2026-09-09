import { createHash } from "crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServiceClient } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();
    if (typeof token !== "string" || !token || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const supabase = getServiceClient();
    const { data: reset } = await supabase
      .from("password_reset_tokens")
      .select("id, user_id")
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!reset) {
      return NextResponse.json({ error: "Este enlace no es válido o ha caducado." }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const { error: updateError } = await supabase.from("users").update({ password_hash }).eq("id", reset.user_id);
    if (updateError) throw updateError;

    // Invalidate every outstanding recovery link for this account.
    const { error: invalidateError } = await supabase.from("password_reset_tokens").delete().eq("user_id", reset.user_id);
    if (invalidateError) throw invalidateError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password reset confirmation failed", error);
    return NextResponse.json({ error: "No se pudo actualizar la contraseña. Inténtalo de nuevo." }, { status: 500 });
  }
}
