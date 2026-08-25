import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { sendEmail, eventAnnouncementHtml } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getServiceClient();

    // Get event
    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // Get all users with emails
    const { data: users } = await supabase
      .from("users")
      .select("email");

    if (!users || users.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const siteUrl = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://rumbaliguria.com";

    const html = eventAnnouncementHtml({
      title: event.title,
      details: event.details,
      price: event.price,
      flyer_url: event.flyer_url,
      siteUrl,
    });

    // Send in batches of 50 (Resend limit per call)
    const emails = users.map((u) => u.email);
    let sent = 0;
    for (let i = 0; i < emails.length; i += 50) {
      const batch = emails.slice(i, i + 50);
      await sendEmail({ to: batch, subject: `🎉 Nuovo Evento: ${event.title}`, html });
      sent += batch.length;
    }

    return NextResponse.json({ sent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
