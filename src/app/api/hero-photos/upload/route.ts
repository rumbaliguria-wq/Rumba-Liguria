import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Solo immagini per lo sfondo della Hero" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const fileName = `hero/${Date.now()}-${file.name.replace(/\s/g, "_")}`;

    const { error: uploadError } = await supabase.storage
      .from("flyers")
      .upload(fileName, file, { contentType: file.type, upsert: true });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: urlData } = supabase.storage.from("flyers").getPublicUrl(fileName);

    const { data, error } = await supabase
      .from("hero_photos")
      .insert({ url: urlData.publicUrl })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
