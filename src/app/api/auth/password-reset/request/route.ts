import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { sendPasswordResetEmail } from "@/lib/email";

const GENERIC_RESPONSE = { success: true };

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Introduce un email válido" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: user } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    // Do not disclose whether an email is registered.
    if (!user) return NextResponse.json(GENERIC_RESPONSE);

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabase.from("password_reset_tokens").delete().eq("user_id", user.id);
    const { error: insertError } = await supabase.from("password_reset_tokens").insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    // A localhost URL would point to the recipient's own computer. Use the
    // request origin while developing or testing from another device on the LAN.
    const isLocalConfiguredUrl = configuredUrl && /:\/\/localhost(?::\d+)?$/i.test(configuredUrl);
    const siteUrl = !configuredUrl || isLocalConfiguredUrl ? new URL(req.url).origin : configuredUrl;
    await sendPasswordResetEmail({ to: user.email, resetUrl: `${siteUrl}/reset-password?token=${encodeURIComponent(token)}` });

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error("Password reset request failed", error);
    return NextResponse.json({ error: "No se pudo enviar el correo. Inténtalo de nuevo." }, { status: 500 });
  }
}
