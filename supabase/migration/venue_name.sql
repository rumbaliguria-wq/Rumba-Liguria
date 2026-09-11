-- =============================================================
-- Nombre del local por evento — ejecutar en:
-- Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================

alter table public.events
  add column if not exists venue_name text;
