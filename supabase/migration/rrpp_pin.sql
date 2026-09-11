-- =============================================================
-- PIN de acceso para que cada RR.PP. vea sus propias estadísticas —
-- ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================

alter table public.reservations
  add column if not exists link_pin text;
