import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

// POST /api/events/reorder  body: { ids: string[] }
// Sets sort_order = index for each id in the array
export async function POST(req: Request) {
  try {
    const { ids } = await req.json() as { ids: string[] };
    if (!Array.isArray(ids)) return NextResponse.json({ error: "Invalid" }, { status: 400 });

    const supabase = getServiceClient();
    for (let i = 0; i < ids.length; i++) {
      await supabase.from("events").update({ sort_order: i }).eq("id", ids[i]);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
