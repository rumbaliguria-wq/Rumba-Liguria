import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/adminSession";
import { getServiceClient } from "@/lib/supabase";

// ¿La cookie de sesión del navegador es válida? Lo consulta el panel al
// cargar para decidir entre mostrar el dashboard o la pantalla de login, y
// también la página pública para el acceso rápido y el modo "cliente" del
// propio admin (ver src/app/page.tsx).
export async function GET() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const authenticated = await verifySessionToken(token);
  if (!authenticated) return NextResponse.json({ authenticated: false });

  const { data } = await getServiceClient()
    .from("admin_settings")
    .select("admin_email")
    .eq("id", 1)
    .single();

  return NextResponse.json({ authenticated: true, email: data?.admin_email?.trim() || null });
}
