import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const fileName = `${Date.now()}-${file.name.replace(/\s/g, "_")}`;
    const { error } = await supabase.storage
      .from("flyers")
      .upload(fileName, file, { contentType: file.type, upsert: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: urlData } = supabase.storage.from("flyers").getPublicUrl(fileName);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
