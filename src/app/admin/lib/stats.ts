// Utilidades de estadística para la pestaña Panoramica.

// Tendencia real semana-a-semana: cuenta elementos creados en los últimos 7
// días frente a los 7 anteriores. Muestra la diferencia bruta ("+69"), no un
// porcentaje — con números pequeños un % se dispara a cosas absurdas.
export function weekOverWeekTrend(
  items: { created_at: string }[]
): { thisWeek: number; lastWeek: number; diff: number } {
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  let thisWeek = 0,
    lastWeek = 0;
  for (const item of items) {
    const age = now - new Date(item.created_at).getTime();
    if (age >= 0 && age < WEEK) thisWeek++;
    else if (age >= WEEK && age < WEEK * 2) lastWeek++;
  }
  return { thisWeek, lastWeek, diff: thisWeek - lastWeek };
}

// Conteo diario de los últimos N días (más antiguo primero) — alimenta las
// gráficas del dashboard a partir de los created_at reales.
export function dailyCounts(
  items: { created_at: string }[],
  days: number
): { day: string; count: number }[] {
  const now = new Date();
  const buckets: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.push({ day: d.toISOString().slice(0, 10), count: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.day, i]));
  for (const item of items) {
    const key = new Date(item.created_at).toISOString().slice(0, 10);
    const i = index.get(key);
    if (i !== undefined) buckets[i].count++;
  }
  return buckets.map((b) => ({ ...b, day: b.day.slice(5).replace("-", "/") }));
}
