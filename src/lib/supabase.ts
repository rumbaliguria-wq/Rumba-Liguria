import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// PostgREST (lo que usa supabase-js) devuelve como mucho 1000 filas por
// consulta aunque no se pida ningún `.limit()` — una tabla grande (ya
// pasamos las 1000 reservations/users) se recorta en silencio, sin error,
// así que las filas más viejas simplemente desaparecen de la respuesta.
// Esto pagina con `.range()` hasta traerlas todas.
export async function fetchAllRows<T>(
  // PromiseLike (no Promise): los query builders de supabase-js son
  // "thenable" pero no instancias reales de Promise, así que no tienen
  // .catch()/.finally() — PromiseLike solo exige el .then() que sí tienen.
  queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const PAGE_SIZE = 1000;
  let all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await queryFactory(from, from + PAGE_SIZE - 1);
    if (error) return { data: all, error };
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { data: all, error: null };
}
