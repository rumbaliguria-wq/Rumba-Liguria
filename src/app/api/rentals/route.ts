import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { decodeRentalConfig, encodeRentalConfig, RentalItem, RentalConfig } from "@/lib/rentalConfig";
import crypto from "crypto";

async function getConfig() {
  const supabase = getServiceClient();
  const { data } = await supabase.from("admin_settings").select("accent_color").eq("id", 1).single();
  return decodeRentalConfig(data?.accent_color || "");
}

async function saveConfig(color: string, rental: RentalConfig) {
  const supabase = getServiceClient();
  const encoded = encodeRentalConfig(color, rental);
  await supabase.from("admin_settings").update({ accent_color: encoded }).eq("id", 1);
}

// GET: return rental items + section config
export async function GET() {
  const { color, rental } = await getConfig();
  void color;
  return NextResponse.json(rental);
}

// POST: add a new rental item
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Handle section config update
  if (body.type === "config") {
    const { color, rental } = await getConfig();
    const updated: RentalConfig = {
      ...rental,
      section_name: body.section_name ?? rental.section_name,
      button_name: body.button_name ?? rental.button_name,
      enabled: body.enabled ?? rental.enabled,
    };
    await saveConfig(color, updated);
    return NextResponse.json(updated);
  }

  const { color, rental } = await getConfig();

  if (rental.items.length >= 50) {
    return NextResponse.json({ error: "Maximum 50 items reached" }, { status: 400 });
  }

  const newItem: RentalItem = {
    id: crypto.randomUUID(),
    name: body.name || "",
    description: body.description || "",
    price: body.price || "",
    duration: body.duration || "",
    photos: body.photos || [],
    contact_phone: body.contact_phone || "",
    contact_email: body.contact_email || "",
    available: body.available !== false,
    created_at: new Date().toISOString(),
  };

  rental.items.unshift(newItem);
  await saveConfig(color, rental);
  return NextResponse.json(newItem);
}

// PUT: update an existing item or config
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { color, rental } = await getConfig();

  if (body.type === "config") {
    const updated: RentalConfig = {
      ...rental,
      section_name: body.section_name ?? rental.section_name,
      button_name: body.button_name ?? rental.button_name,
      enabled: body.enabled ?? rental.enabled,
    };
    await saveConfig(color, updated);
    return NextResponse.json(updated);
  }

  const idx = rental.items.findIndex((i) => i.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  rental.items[idx] = { ...rental.items[idx], ...body };
  await saveConfig(color, rental);
  return NextResponse.json(rental.items[idx]);
}

// DELETE: remove an item by id
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const { color, rental } = await getConfig();
  rental.items = rental.items.filter((i) => i.id !== id);
  await saveConfig(color, rental);
  return NextResponse.json({ success: true });
}
