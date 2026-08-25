import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { decodePhoneField } from "@/lib/userPhone";

export async function GET() {
  const supabase = getServiceClient();

  // Fetch registered users
  const { data: registeredUsers, error } = await supabase
    .from("users")
    .select("id, email, phone, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch unique emails + names from reservations
  const { data: reservationUsers } = await supabase
    .from("reservations")
    .select("user_email, user_name, created_at")
    .order("created_at", { ascending: false });

  // Format an email into a display name
  function formatName(raw: string | null | undefined, email: string): string | null {
    if (!raw || raw.includes("@")) {
      // Name is missing or is literally an email — format from email prefix
      return email
        .split("@")[0]
        .replace(/[._0-9]/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\s+/g, " ")
        .trim() || null;
    }
    return raw;
  }

  // Build a map of email -> name from reservations
  const nameMap = new Map<string, string>();
  const reservationEmailSet = new Set<string>();
  for (const r of reservationUsers ?? []) {
    if (r.user_email) {
      reservationEmailSet.add(r.user_email.toLowerCase());
      if (!nameMap.has(r.user_email.toLowerCase())) {
        const n = formatName(r.user_name, r.user_email);
        if (n) nameMap.set(r.user_email.toLowerCase(), n);
      }
    }
  }

  // Enrich registered users with names (decode from phone field if encoded)
  const registeredEmails = new Set<string>();
  const enriched = (registeredUsers ?? []).map((u) => {
    registeredEmails.add(u.email.toLowerCase());
    const decoded = decodePhoneField(u.phone);
    // Prefer decoded name from phone field, then reservation name, then email fallback
    const registeredName = decoded.name;
    const rawName = registeredName ?? nameMap.get(u.email.toLowerCase()) ?? null;
    return {
      ...u,
      phone: decoded.phone, // expose actual phone number, not encoded JSON
      name: rawName ?? formatName(null, u.email),
      userType: decoded.userType, // "ERASMUS" | "UNIVERSITARIO" | "ALTRO" | null
      source: "registered" as const,
    };
  });

  // Add users who have reservations but are not in the users table
  const extraUsers: {
    id: string;
    email: string;
    phone: null;
    created_at: string;
    name: string | null;
    source: "reservation";
  }[] = [];

  const seen = new Set<string>();
  for (const r of reservationUsers ?? []) {
    const email = r.user_email?.toLowerCase();
    if (!email) continue;
    if (registeredEmails.has(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    extraUsers.push({
      id: `res-${email}`,
      email: r.user_email,
      phone: null,
      created_at: r.created_at,
      name: nameMap.get(email) ?? null,
      source: "reservation",
    });
  }

  const all = [...enriched, ...extraUsers].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return NextResponse.json(all);
}
