import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminPassword } from "@/lib/adminPassword";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("admin_email, admin_phone, whatsapp_apikey, two_factor_enabled")
      .eq("id", 1)
      .single();

    return NextResponse.json({
      admin_email: data?.admin_email || "",
      admin_phone: data?.admin_phone || "",
      whatsapp_apikey_set: !!data?.whatsapp_apikey,
      two_factor_enabled: data?.two_factor_enabled !== false,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { currentPassword, admin_email, admin_phone, whatsapp_apikey, two_factor_enabled } =
      await req.json();

    if (!(await verifyAdminPassword(supabase, currentPassword))) {
      return NextResponse.json({ error: "Password attuale errata" }, { status: 401 });
    }

    const email = typeof admin_email === "string" ? admin_email.trim() : "";
    const phone = typeof admin_phone === "string" ? admin_phone.trim() : "";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Email non valida" }, { status: 400 });
    }
    if (phone && !/^\+?[\d\s]{7,}$/.test(phone)) {
      return NextResponse.json({ error: "Numero non valido (usa il formato internazionale, es. +39...)" }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      admin_email: email || null,
      admin_phone: phone || null,
      two_factor_enabled: two_factor_enabled !== false,
      updated_at: new Date().toISOString(),
    };
    // Solo se sobrescribe la apikey si el cliente manda una nueva no vacía.
    if (typeof whatsapp_apikey === "string" && whatsapp_apikey.trim()) {
      update.whatsapp_apikey = whatsapp_apikey.trim();
    } else if (whatsapp_apikey === null) {
      update.whatsapp_apikey = null;
    }

    const { error } = await supabase.from("admin_settings").update(update).eq("id", 1);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin security update failed", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
