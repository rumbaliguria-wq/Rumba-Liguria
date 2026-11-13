-- =============================================================
-- Caducidad y "ya reclamado" para los premios — ejecutar en:
-- Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================

alter table public.prizes
  add column if not exists expires_at timestamptz,
  add column if not exists claimed_at timestamptz;
