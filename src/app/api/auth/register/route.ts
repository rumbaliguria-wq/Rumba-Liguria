import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { encodePhoneField, decodePhoneField, normalizePhone } from "@/lib/userPhone";

export async function POST(req: Request) {
  try {
    const { email, password, phone, first_name, last_name, user_type } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email e password obbligatorie" }, { status: 400 });
    }
    if (!first_name?.trim() || !last_name?.trim()) {
      return NextResponse.json({ error: "Nome e cognome obbligatori" }, { status: 400 });
    }
    if (!phone?.trim()) {
      return NextResponse.json({ error: "Il numero di telefono è obbligatorio" }, { status: 400 });
    }
    const normalized = normalizePhone(phone);
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }
    if (!user_type || !["ERASMUS", "UNIVERSITARIO", "ALTRO"].includes(user_type)) {
      return NextResponse.json({ error: "Seleziona: ERASMUS, UNIVERSITARIO o ALTRO" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json({ error: "Email già registrata" }, { status: 409 });
    }

    // Block duplicate phone numbers (one account per phone)
    const { data: allUsers } = await supabase.from("users").select("phone");
    const phoneTaken = (allUsers || []).some((u) => {
      const existingPhone = decodePhoneField(u.phone).phone;
      if (!existingPhone) return false;
      const n = normalizePhone(existingPhone);
      return n.ok && n.e164 === normalized.e164;
    });
    if (phoneTaken) {
      return NextResponse.json({ error: "Questo numero di telefono è già registrato" }, { status: 409 });
    }

    const fullName = `${first_name.trim()} ${last_name.trim()}`;
    const password_hash = await bcrypt.hash(password, 10);
    // Store name + phone + userType encoded in the phone field (no schema migration needed)
    const phoneEncoded = encodePhoneField(fullName, normalized.e164, user_type);

    const { error } = await supabase
      .from("users")
      .insert({ email: email.toLowerCase(), password_hash, phone: phoneEncoded });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
