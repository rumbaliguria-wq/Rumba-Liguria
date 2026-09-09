import { randomInt, createHash } from "crypto";
import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { sendAdminCodeEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";
import { verifyAdminPassword } from "@/lib/adminPassword";
import {
  createSessionToken,
  sessionCookieOptions,
  ADMIN_TRUSTED_COOKIE,
  verifyTrustedDeviceToken,
} from "@/lib/adminSession";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  const head = user.slice(0, 1);
  return `${head}${"•".repeat(Math.max(user.length - 1, 2))}@${domain}`;
}

function maskPhone(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return `•••••${digits.slice(-3)}`;
}

export async function POST(req: Request) {
  try {
    const { username, password, channel } = await req.json();

    const { data } = await supabase
      .from("admin_settings")
      .select("username, admin_email, admin_phone, whatsapp_apikey, two_factor_enabled")
      .eq("id", 1)
      .single();

    const validUser = data?.username || process.env.ADMIN_USERNAME;
    const passwordOk = await verifyAdminPassword(supabase, password);

    if (username !== validUser || !passwordOk) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const adminEmail = data?.admin_email?.trim();
    const adminPhone = data?.admin_phone?.trim();
    const apikey = data?.whatsapp_apikey?.trim();
    const emailAvailable = !!adminEmail;
    const whatsappAvailable = !!(adminPhone && apikey);
    const twoFactorEnabled = data?.two_factor_enabled !== false;

    // Este navegador ya pasó el 2FA una vez antes (cookie de larga duración) →
    // nos salteamos el código, con solo usuario + contraseña alcanza.
    const trustedToken = (await cookies()).get(ADMIN_TRUSTED_COOKIE)?.value;
    const isTrustedDevice = await verifyTrustedDeviceToken(trustedToken);

    // Sin canal configurado (o 2FA desactivado, o dispositivo ya confiable) → login directo.
    if (!twoFactorEnabled || (!emailAvailable && !whatsappAvailable) || isTrustedDevice) {
      const res = NextResponse.json({ success: true, twoFactorConfigured: false });
      res.cookies.set({ ...sessionCookieOptions(), value: await createSessionToken() });
      return res;
    }

    const channels: string[] = [
      ...(emailAvailable ? ["email"] : []),
      ...(whatsappAvailable ? ["whatsapp"] : []),
    ];

    // Paso 1: credenciales OK, el cliente aún debe elegir/confirmar el canal.
    if (!channel) {
      return NextResponse.json({
        twoFactor: true,
        channels,
        maskedEmail: emailAvailable ? maskEmail(adminEmail!) : null,
        maskedPhone: whatsappAvailable ? maskPhone(adminPhone!) : null,
      });
    }

    if (!channels.includes(channel)) {
      return NextResponse.json({ error: "Canale non disponibile" }, { status: 400 });
    }

    // Paso 2: generar y enviar el código.
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from("admin_login_codes").delete().lt("created_at", new Date().toISOString());
    const { data: inserted, error: insertError } = await supabase
      .from("admin_login_codes")
      .insert({ code_hash: hashCode(code), channel, expires_at: expiresAt })
      .select("id")
      .single();
    if (insertError || !inserted) throw insertError ?? new Error("No se pudo crear el código");

    // El envío (SMTP / WhatsApp) es lento: lo hacemos DESPUÉS de responder para
    // que el cliente pueda mostrar ya la pantalla del código. Si falla, el
    // usuario pulsa "Riprova" y se genera otro.
    after(async () => {
      try {
        if (channel === "email") {
          await sendAdminCodeEmail({ to: adminEmail!, code });
        } else {
          await sendWhatsApp({
            phone: adminPhone!,
            apikey: apikey!,
            text: `Rumba Liguria — codice di accesso al pannello: ${code}\nScade tra 10 minuti. Se non sei stato tu, cambia la password.`,
          });
        }
      } catch (err) {
        console.error("Admin login code delivery failed", err);
      }
    });

    return NextResponse.json({ twoFactor: true, sent: channel, challengeId: inserted.id });
  } catch (error) {
    console.error("Admin login failed", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
