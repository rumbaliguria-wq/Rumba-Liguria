import { createHash } from "crypto";
import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createSessionToken,
  sessionCookieOptions,
  createTrustedDeviceToken,
  trustedDeviceCookieOptions,
} from "@/lib/adminSession";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_ATTEMPTS = 5;
const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

export async function POST(req: Request) {
  try {
    const { challengeId, code } = await req.json();
    const cleanCode = typeof code === "string" ? code.trim() : "";
    if (!challengeId || !/^\d{6}$/.test(cleanCode)) {
      return NextResponse.json({ error: "Codice non valido" }, { status: 400 });
    }

    const { data: row } = await supabase
      .from("admin_login_codes")
      .select("id, code_hash, attempts, expires_at")
      .eq("id", challengeId)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ error: "Codice scaduto, richiedine uno nuovo" }, { status: 400 });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabase.from("admin_login_codes").delete().eq("id", row.id);
      return NextResponse.json({ error: "Codice scaduto, richiedine uno nuovo" }, { status: 400 });
    }

    if (row.attempts >= MAX_ATTEMPTS) {
      await supabase.from("admin_login_codes").delete().eq("id", row.id);
      return NextResponse.json({ error: "Troppi tentativi, richiedi un nuovo codice" }, { status: 429 });
    }

    if (row.code_hash !== hashCode(cleanCode)) {
      await supabase
        .from("admin_login_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      return NextResponse.json({ error: "Codice errato" }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set({ ...sessionCookieOptions(), value: await createSessionToken() });
    // Este navegador ya demostró tener acceso al código — lo marcamos como
    // confiable para no volver a pedirlo en los próximos logins.
    res.cookies.set({ ...trustedDeviceCookieOptions(), value: await createTrustedDeviceToken() });
    // Borrar el código de un solo uso no bloquea la respuesta: la sesión ya
    // está concedida y el código no vuelve a servir aunque tarde en irse.
    after(() => {
      supabase.from("admin_login_codes").delete().eq("id", row.id).then(
        () => {},
        (err) => console.error("admin_login_codes cleanup failed", err)
      );
    });
    return res;
  } catch (error) {
    console.error("Admin 2FA verify failed", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
