import bcrypt from "bcryptjs";
import type { SupabaseClient } from "@supabase/supabase-js";

const BCRYPT_ROUNDS = 12;
const isBcryptHash = (v: string) => /^\$2[aby]\$/.test(v);

export async function hashAdminPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

// Comprueba la contraseña del panel contra lo guardado en admin_settings.
// Transición suave: si el valor almacenado todavía está en texto plano (o
// viene sólo de ADMIN_PASSWORD), se acepta la comparación directa y se
// re-guarda como hash bcrypt para la próxima vez.
export async function verifyAdminPassword(
  supabase: SupabaseClient,
  plain: string
): Promise<boolean> {
  if (!plain) return false;

  const { data } = await supabase
    .from("admin_settings")
    .select("password")
    .eq("id", 1)
    .single();

  const stored = data?.password as string | null | undefined;

  if (stored && isBcryptHash(stored)) {
    return bcrypt.compare(plain, stored);
  }

  // Aún en texto plano: comparar con lo que haya (columna o env) y migrar.
  const legacy = stored || process.env.ADMIN_PASSWORD || "";
  if (!legacy || plain !== legacy) return false;

  try {
    await supabase
      .from("admin_settings")
      .update({ password: await hashAdminPassword(plain), updated_at: new Date().toISOString() })
      .eq("id", 1);
  } catch {
    // Si la migración falla no bloqueamos el login; se reintenta la próxima vez.
  }
  return true;
}
